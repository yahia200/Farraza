---
description: apps/api (NestJS 12 + Prisma 8) architecture and conventions
paths:
  - "apps/api/**"
  - "packages/shared/**"
---

# API architecture

Loaded when you work in `apps/api` or `packages/shared`. The shared facts, docs table, commands, and the Prisma 8 basics are in the root `CLAUDE.md`. For NestJS, prefer the `.d.ts` files in `apps/api/node_modules/@nestjs/*`; for Prisma, `apps/api/prisma-8.md` and `prisma <command> --help`.

## Layering per feature module

Each feature folder (`companies`, `jobs`, `forms`, `applications`, `pipeline`, `users`, `auth`) follows the same layering:

- **Controller**: routing and param/DTO binding only.
- **Service**: business rules, authorization checks, and mapping outcomes to HTTP exceptions.
- **Repository**: the only layer that touches `PrismaService`. It maps rows through local `toX()` functions into plain domain types and never returns raw ORM rows.
- **`<feature>.ts`** (such as `company.ts`, `job.ts`, `pipeline.ts`): the domain interfaces and constants. For example, `DEFAULT_STAGES` lives in `jobs/job.ts`, and the `STATUS_FOR_STAGE`/`EVENT_FOR_STAGE` maps live in `pipeline/pipeline.ts`.
- **DTOs**: request bodies are validated by **Zod schemas from `@repo/shared`**, not class-validator.
  - A DTO file (`dto/*.dto.ts`) re-exports its schema and declares the DTO as a type: `export type CreateJobDto = CreateJobInput`.
  - Controllers attach the schema with `@Body({ schema: createJobSchema }) dto: CreateJobDto`. Import the DTO with `type`, which `isolatedModules` plus `emitDecoratorMetadata` require.
  - The global `StandardSchemaValidationPipe` (`main.ts`) validates every parameter that declares a schema and passes the parsed output to the handler.
  - Use `z.strictObject` for bodies, so unknown keys are rejected.
  - Failures return 400 `{ message, errors: [{ path, message }] }` via `common/validation-errors.ts`, the same shape services use for form and answer errors.
  - Docs: https://docs.nestjs.com/application/validation

The package is `"type": "module"`, so relative imports must use the `.js` extension (`import { X } from './x.js'`).

## Auth, tenancy, and authorization

1. **Authentication** is global. Session cookies come from `@nestjs/authentication`; `SessionAuth` loads the user, and `PrismaSessionStore` persists sessions in the `sessions` table. Every route requires a session unless it is marked `@Public()`, as `AuthController` and the applicant-facing `PublicController` are. Get the user with `@CurrentUser()`.
2. **Tenancy**: company-scoped controllers are mounted at `companies/:companySlug/...` and use `@UseGuards(CompanyMemberGuard)`. The guard looks up the user's membership by slug, throws **404, not 403**, for non-members so that company existence isn't leaked, and sets `request.membership`. Read it with `@CurrentMembership()`. The resulting `Membership` (`{ userId, role, company }`) is the only path from a slug to a `companyId`.
3. **Authorization**: services call `await this.authorization.authorize(SomePolicy, 'action', user, membership, ...)`. Policies are `@Policy()` classes holding role checks (`CompanyPolicy`, `MemberPolicy` with role ranking, `JobPolicy`, `ApplicationPolicy`) and must be listed in their module's `providers`. Roles: `owner > admin > recruiter = interviewer`. Interviewers can read and add notes but can't edit jobs or move candidates.
4. **Tenant isolation**: every company-owned table has a `companyId`. Repositories filter by it (along with `jobId`) on reads, and copy it from the parent on inserts.

A global `ThrottlerGuard` allows 100 requests/min. The public apply endpoint is tighter (5 per 10 min). Limits are per visitor: `apiFetch` sends the visitor's address in `x-client-ip` plus `x-internal-secret`, and `TrustedClientThrottlerGuard` (`common/trusted-client-throttler.guard.ts`) uses that address only when the secret matches; otherwise it counts the caller's own connection. There is no Express `trust proxy`: the web app runs on Vercel (no fixed address) and the API on Cloud Run. The address comes from `X-Forwarded-For`, which Vercel overwrites with the real client address; `next dev` fills it from the connection. Counts are in memory, which is correct only while the API runs as a single instance (Cloud Run max instances = 1); more instances would need shared storage.

## Concurrency and error conventions

- Writes are **conditional**, not read-then-write. Example: `move` updates `where({ id, stageId: from.id })`, job `open`/`close` filter on the current status, and a draft update filters on `publishedAt IS NULL`. When the repository gets back `null`, the service throws `ConflictException` with a "reload and try again" message.
- Unique-constraint races are caught with `isUniqueViolation()` (`common/db-errors.ts`, SQLSTATE 23505) and turned into `ConflictException`, or into a `'duplicate'` result.
- Slugs come from `slugify()` (`common/slugify.ts`). On collision, a random 4-hex suffix is appended.

## Domain flow

1. **Company**: created together with an `owner` membership in one transaction. Members are added and removed under `MemberPolicy` rank rules.
2. **Job**: created in `draft` with six default stages (Applied, Screening, Interview, Offer, Hired, Rejected; see `DEFAULT_STAGES`). Stage `kind` is `normal`, `hired`, or `rejected`.
3. **Form** (`form_versions`): at most one draft per job, enforced by a partial unique index. Published versions are **immutable**: editing after publish creates a new draft with `version + 1`, and applicants always get the latest published version. A job can't be opened until a published form exists. Each version also has `cv_mode` (off, optional, required; ADR-0002), saved with `fields` (`saveFormSchema` takes both) and part of the public job payload.
4. **Public apply** (`GET/POST /api/public/:companySlug/:jobSlug[/applications]`, in `applications/`):
   - Only `open` jobs are served. Fields go through `toPublicFields()`, which strips knockout rules; never send raw `fields` to applicants.
   - Answers are validated with `parseAnswers()`. If `findKnockout()` matches, the application is auto-placed in the Rejected stage.
   - A non-empty hidden `website` field is treated as a bot honeypot: the API returns success without saving anything.
   - Candidates are per-company (unique `companyId + email`, upserted). A job takes one application per candidate, per email and per phone: `applications` stores the submitted email and phone with UNIQUE (`job_id`, `email`) and (`job_id`, `phone`), so a repeat is rejected by the database (409).
   - **CV upload** (ADR-0002): `POST .../uploads` (`createUpload`, throttled 20 per 10 min per visitor, separate from submit's 5) checks the declared name, type and size against the open job's published form (CV: PDF or DOCX, up to 5 MB, `cv_mode` not `off`), inserts a pending `files` row and returns `{ fileId, url, contentType }`: a presigned PUT that signs the content type and length (`StorageService.createUpload`). The web app's Server Action calls it; the browser PUTs the bytes to the bucket. Submit takes an optional `cvFileId`: `required` without one is a 400 on `cvFileId`, `off` with one is a 400, and the file is attached inside the Application transaction with a conditional update (same job, purpose and field key, unattached, `pending`). A refused attach rolls back and answers 409 with `errors: [{ path: 'cvFileId' }]`; a duplicate Application or a validation error leaves the file pending, so a retry can reuse it. Objects are keyed by company, job and file id only (`docs/db-schema.md` §9). **Submit-time check** (`verifyFiles`, before the transaction, after answers and CV mode are validated): for each referenced pending file of this job, `StorageService.headObject` must find the object with exactly the declared `size_bytes`, and `readLeadingBytes` (first 64 KiB, `SNIFF_BYTES`) fed to `sniffFileType` (`storage/file-sniff.ts`, `file-type`'s `fileTypeFromBuffer`) must give an allowed type (CV: PDF or DOCX). A file that fails has its object deleted, then its row (conditional on pending and unattached), and the submit answers 400 `errors: [{ path: 'cvFileId' }]`; the sniffed type is passed on in `FileToAttach.mimeType` and stored by the attach. An id that is not a candidate at all (unknown, another job's, already attached) is the 409 above.
   - Phones are normalised to E.164 by `phoneSchema` (`packages/shared/src/phone.ts`, libphonenumber-js, default country `EG`) and checked by a CHECK constraint; never store a phone without it.
5. **Pipeline** (`pipeline/`): kanban board, application detail, stage moves (the target stage's `kind` sets the application `status`), and notes.

**Audit trail**: every state change (applied, auto-rejected, stage changed, hired/rejected, note added) writes an append-only `ApplicationEvent` **in the same transaction** as the change. Stage names go in `data` so the history stays readable if stages are later renamed or deleted.

## `@repo/shared`

`auth.ts`, `companies.ts`, `jobs.ts` and `applications.ts` hold the request-body schemas. The API validates with them and the web forms reuse them. Rebuild the package after changing them (`pnpm --filter @repo/shared build`), because the API imports its `dist/`.

`form-fields.ts` holds the Zod discriminated union for the six field types (`short_text`, `long_text`, `single_select`, `multi_select`, `yes_no`, `file`) and `parseFormFields()`. `answers.ts` holds `parseAnswers`, `findKnockout` (server-side only), and `toPublicFields`. These define the JSONB shapes of `form_versions.fields` and `applications.answers`. Field keys and option ids are UUIDs, so relabelling a question doesn't break old answers. Validation failures are returned as `{ ok: false, errors: [{ path, message }] }` and surfaced as `BadRequestException({ message, errors })`.
