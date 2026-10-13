# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement (read this first)

This is a learning project. The owner is building it to learn and grow, and wants to understand and own every decision. These rules override the default habit of quietly picking a sensible option and moving on.

1. **Don't decide silently.** When a task involves a real choice (a library, a pattern, an API shape, a schema change, file layout, error handling, any trade-off), state the options, which one you recommend, and why. Include a doc reference where one exists. For significant or hard-to-reverse decisions, or when there's no clear conventional answer, ask before implementing. If a choice simply follows an existing pattern in this repo, you don't need to discuss it, but say which pattern you followed.
2. **Back every tool and decision with docs.** Every library API, CLI command, or config option you use or introduce needs a reference the owner can read: a local path or URL from the table below, ideally narrowed to the specific page or section. Prefer the version-matched local docs. If you couldn't find a reference and are going from memory, say so explicitly.
3. **Follow current conventions, not remembered ones.** The installed versions are newer than your training data. Before writing code against a library, read its docs or type definitions for the installed version, follow the conventions it currently recommends, and heed deprecation notices. If existing code here deviates from current convention, point it out instead of copying it.
4. **Explain every file change.** End each task with a list of every file you created, modified, or deleted, each with a one-line explanation of what changed and why.

## What this is

Khatwateen is a multi-tenant hiring-pipeline SaaS (a small ATS). Companies create jobs, build a versioned application form per job, publish a public apply page, and move applicants through a stage pipeline. It is a pnpm + Turborepo monorepo:

- `apps/api`: NestJS 12 REST API (ESM), Prisma 8 ORM on PostgreSQL. Most of the code lives here.
- `apps/web`: Next.js 16 frontend (App Router, Tailwind v4, shadcn `base-luma` on `@base-ui/react`). It has a landing page, sign-in/sign-up, onboarding, and a placeholder dashboard. See "Web architecture" below.
- `packages/shared` (`@repo/shared`): Zod schemas and pure logic for form fields and answers, used by the API (and later by the web app).
- `packages/typescript-config`, `packages/eslint-config`: shared configs.

The root `README.md` and `apps/*/README.md` are unmodified starter boilerplate. Ignore `.turbo-clone-temp/`, a stray clone of the Turborepo source repo that isn't part of the project.

## Documentation references

Use the local docs first: they match the installed version. Paths are relative to the repo root; pnpm gives each workspace its own `node_modules`. Where a package ships only a README, its type definitions (`.d.ts`) in the same folder are the most accurate API reference. Bump the versions here when you upgrade.

| Tool | Version | Local (version-matched) | Online |
|---|---|---|---|
| Turborepo | 2.11.7 | `node_modules/turbo/docs/` (start at `README.md`). Read before changing `turbo.json`; see root `AGENTS.md`. | https://turborepo.dev/docs |
| pnpm | 11.25.0 | — | https://pnpm.io |
| Next.js | 16.4.0 | `apps/web/node_modules/next/dist/docs/` (`01-app/` for the App Router). Read before writing web code; see `apps/web/AGENTS.md`. | https://nextjs.org/docs |
| NestJS (core, common, config, testing, CLI) | 12.1 | READMEs only, so use the `.d.ts` files in `apps/api/node_modules/@nestjs/*` | https://docs.nestjs.com |
| `@nestjs/authentication`, `@nestjs/authorization` | 0.0.1 | Each `README.md` (quick start) plus its `.d.ts` files. These are new packages. | https://docs.nestjs.com/security/authentication, https://docs.nestjs.com/security/authorization |
| `@nestjs/throttler` | 6.7.1 | `apps/api/node_modules/@nestjs/throttler/README.md` (full guide) | https://github.com/nestjs/throttler |
| Prisma ORM (`@prisma/orm-postgres`) | 8.0.0-rc.14 | `apps/api/prisma-8.md`, plus the generated types in `apps/api/src/prisma/contract.d.ts` | https://github.com/prisma/orm |
| Prisma CLI (`prisma`) | 8.0.0-rc.20 | `prisma <command> --help` (authoritative); `apps/api/node_modules/prisma/README.md` | https://github.com/prisma/prisma-cli/blob/main/docs/README.md |
| Nest Standard Schema validation | 12.1 | `apps/api/node_modules/@nestjs/common/pipes/standard-schema-validation.pipe.d.ts` | https://docs.nestjs.com/application/validation |
| React Hook Form, `@hookform/resolvers` | 7.90 / 5.9 | `.d.ts` in `apps/web/node_modules/react-hook-form` | https://react-hook-form.com, https://ui.shadcn.com/docs/forms/react-hook-form |
| Zod | 4.4.3 | `packages/shared/node_modules/zod/README.md` | https://zod.dev |
| Vitest | 4.1.11 | `.d.ts` in `apps/api/node_modules/vitest` | https://vitest.dev |
| oxlint | 1.87.0 | `apps/api/node_modules/oxlint/README.md` | https://oxc.rs/docs/guide/usage/linter |
| ESLint | 9.39.5 | — | https://eslint.org |
| Tailwind CSS | 4.3.3 | — | https://tailwindcss.com/docs |
| Base UI (`@base-ui/react`) | 1.8.0 | `apps/web/node_modules/@base-ui/react/docs/` | https://base-ui.com |
| shadcn | 4.21.3 | `apps/web/node_modules/shadcn/README.md` | https://ui.shadcn.com/docs |

Prisma 8 differs most from older knowledge: there is no `PrismaClient`, no `prisma generate`, and no `schema.prisma`. See the "Database" section below.

## Commands

Run from the repo root unless noted. Node >= 24, pnpm 11.

```bash
docker compose up -d                 # Postgres 17 on :5432 (user/pass/db: hiring)
pnpm dev                             # all apps (builds @repo/shared first via ^build)
pnpm --filter api dev                # API only, watch mode
pnpm --filter web dev                # web only, http://localhost:3000
pnpm build | pnpm lint | pnpm check-types
pnpm format                          # prettier over the whole repo
```

`apps/api/.env` needs `PORT`, `DATABASE_URL`, and `APP_URL`. All API routes are under the `/api` prefix. CORS and session `trustedOrigins` are hard-coded to `http://localhost:3000`.

The API imports `@repo/shared` from its built `dist/`. After changing `packages/shared`, rebuild it (`pnpm --filter @repo/shared build`) or keep `pnpm dev` running, which watches it.

Tests use Vitest. API unit tests match `**/*.spec.ts` and e2e tests match `**/*.e2e-spec.ts`. Shared tests match `*.test.ts`.

```bash
pnpm --filter @repo/shared test
pnpm --filter @repo/shared exec vitest run src/answers.test.ts        # single file
pnpm --filter api test
pnpm --filter api exec vitest run src/path/to/file.spec.ts -t "name"  # single test
pnpm --filter api test:e2e
```

The only existing API specs (`src/app.controller.spec.ts`, `test/app.e2e-spec.ts`) are leftover Nest scaffolding: they import an `AppController` that no longer exists, so `pnpm --filter api test` currently fails. `packages/shared` has the real test suite.

Linting: the API uses **oxlint** (`apps/api/oxlint.json`) and the web app uses ESLint. API Prettier config: single quotes, trailing commas.

## Database (Prisma 8)

- The schema is `apps/api/src/prisma/contract.prisma`. After editing it, run `pnpm --filter api exec prisma contract emit` to regenerate `contract.json` and `contract.d.ts` next to it. Commit both.
- Apply schema changes to the dev DB with `pnpm --filter api exec prisma db update`. Run `prisma db --help` and `prisma migration --help` for verify/migrate/plan. Past schema commits also included new files under `apps/api/migrations/snapshots/` and `migrations/app/refs/db.json`.
- `src/prisma/db.ts` builds the client. `PrismaService` (global module) exposes it as `this.prisma.db`.
- Query style: `db.orm.public.Job.where({ companyId, slug }).include('stages').first()`, plus `.all()`, `.create()`, `.createAll()`, `.update()` (returns the row or `null`), `.updateAndCount()`, `.deleteAndCount()`, `.upsert({ create, update, conflictOn })`, `.orderBy((j) => j.createdAt.desc())`, and lambda predicates like `.where((v) => v.publishedAt.isNotNull())`.
- Transactions: `this.prisma.db.transaction(async (tx) => { await tx.orm.public.X.create(...) })`.
- Tables and columns are snake_case in Postgres and mapped to camelCase via `@map`/`@@map`.

`docs/db-schema.md` documents the applied schema table by table. It covers the JSONB shapes, which event writes what, the rules the services must enforce (§7), and the planned tables and constraints (§8). **`contract.prisma` and the Zod schemas in `packages/shared` are the source of truth.** When you change the contract, update that doc too. Contract enums become `text` columns with a CHECK, not Postgres enum types, and some `*_id` columns deliberately have no FK. The doc lists which ones.

## Web architecture

- **Next.js is a backend for the frontend.** The browser never calls the API. Server Actions (`app/actions/`) and the DAL (`lib/dal.ts`) call it from the server through `lib/api.ts`, which reads `API_URL` from `apps/web/.env.local` and forwards the session cookie.
  - The API's `__Host-sid` cookie is relayed onto the web origin with `relaySessionCookie()`.
  - Docs: `02-guides/backend-for-frontend.md`, `03-api-reference/04-functions/cookies.md`.
- **The DAL is the only place that reads "who is signed in".** `getCurrentUser()` and `getMyCompanies()` use `'use cache: private'` and redirect to `/sign-in` on 401. Any component that calls them must render inside `<Suspense>` (`cacheComponents` is on).
  - Any action that changes the session or memberships must call `revalidatePath('/', 'layout')` before redirecting, or the private cache serves stale data.
  - Docs: `02-guides/authentication-with-cache-components.md`.
- **Gating:** there is no `proxy.ts`. Pages enforce routing themselves:
  - Signed-out users are redirected to `/sign-in` by the DAL.
  - `/dashboard` sends users with no company to `/onboarding`, and `/onboarding` sends users who have one back to `/dashboard`.
  - Sign-up goes to `/onboarding`.
- **Forms:** React Hook Form with `zodResolver(<schema from @repo/shared>)` and shadcn `Field`/`FieldError` (https://ui.shadcn.com/docs/forms/react-hook-form).
  - `onSubmit` calls a Server Action, which re-validates and returns `ActionFailure<Field>` on failure or redirects on success.
  - `applyActionFailure()` puts server errors into the form.
  - `failureFromResponse()` maps API errors (400 `errors[]` to fields, 429, and per-action overrides such as 409).
- **Onboarding:** there are no invitations yet. Employees are told to ask an admin to add them by email (`POST /api/companies/:slug/members`). "Check again" asks the API directly, bypassing the cache.

## API architecture

### Layering per feature module

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

### Auth, tenancy, and authorization

1. **Authentication** is global. Session cookies come from `@nestjs/authentication`; `SessionAuth` loads the user, and `PrismaSessionStore` persists sessions in the `sessions` table. Every route requires a session unless it is marked `@Public()`, as `AuthController` and the applicant-facing `PublicController` are. Get the user with `@CurrentUser()`.
2. **Tenancy**: company-scoped controllers are mounted at `companies/:companySlug/...` and use `@UseGuards(CompanyMemberGuard)`. The guard looks up the user's membership by slug, throws **404, not 403**, for non-members so that company existence isn't leaked, and sets `request.membership`. Read it with `@CurrentMembership()`. The resulting `Membership` (`{ userId, role, company }`) is the only path from a slug to a `companyId`.
3. **Authorization**: services call `await this.authorization.authorize(SomePolicy, 'action', user, membership, ...)`. Policies are `@Policy()` classes holding role checks (`CompanyPolicy`, `MemberPolicy` with role ranking, `JobPolicy`, `ApplicationPolicy`) and must be listed in their module's `providers`. Roles: `owner > admin > recruiter = interviewer`. Interviewers can read and add notes but can't edit jobs or move candidates.
4. **Tenant isolation**: every company-owned table has a `companyId`. Repositories filter by it (along with `jobId`) on reads, and copy it from the parent on inserts.

A global `ThrottlerGuard` allows 100 requests/min. The public apply endpoint is tighter (5 per 10 min).

### Concurrency and error conventions

- Writes are **conditional**, not read-then-write. Example: `move` updates `where({ id, stageId: from.id })`, job `open`/`close` filter on the current status, and a draft update filters on `publishedAt IS NULL`. When the repository gets back `null`, the service throws `ConflictException` with a "reload and try again" message.
- Unique-constraint races are caught with `isUniqueViolation()` (`common/db-errors.ts`, SQLSTATE 23505) and turned into `ConflictException`, or into a `'duplicate'` result.
- Slugs come from `slugify()` (`common/slugify.ts`). On collision, a random 4-hex suffix is appended.

### Domain flow

1. **Company**: created together with an `owner` membership in one transaction. Members are added and removed under `MemberPolicy` rank rules.
2. **Job**: created in `draft` with six default stages (Applied, Screening, Interview, Offer, Hired, Rejected; see `DEFAULT_STAGES`). Stage `kind` is `normal`, `hired`, or `rejected`.
3. **Form** (`form_versions`): at most one draft per job, enforced by a partial unique index. Published versions are **immutable**: editing after publish creates a new draft with `version + 1`, and applicants always get the latest published version. A job can't be opened until a published form exists.
4. **Public apply** (`GET/POST /api/public/:companySlug/:jobSlug[/applications]`, in `applications/`):
   - Only `open` jobs are served. Fields go through `toPublicFields()`, which strips knockout rules; never send raw `fields` to applicants.
   - Answers are validated with `parseAnswers()`. If `findKnockout()` matches, the application is auto-placed in the Rejected stage.
   - A non-empty hidden `website` field is treated as a bot honeypot: the API returns success without saving anything.
   - Candidates are per-company (unique `companyId + email`, upserted). Each candidate can apply to a job only once.
5. **Pipeline** (`pipeline/`): kanban board, application detail, stage moves (the target stage's `kind` sets the application `status`), and notes.

**Audit trail**: every state change (applied, auto-rejected, stage changed, hired/rejected, note added) writes an append-only `ApplicationEvent` **in the same transaction** as the change. Stage names go in `data` so the history stays readable if stages are later renamed or deleted.

### `@repo/shared`

`auth.ts`, `companies.ts`, `jobs.ts` and `applications.ts` hold the request-body schemas. The API validates with them and the web forms reuse them. Rebuild the package after changing them (`pnpm --filter @repo/shared build`), because the API imports its `dist/`.

`form-fields.ts` holds the Zod discriminated union for the six field types (`short_text`, `long_text`, `single_select`, `multi_select`, `yes_no`, `file`) and `parseFormFields()`. `answers.ts` holds `parseAnswers`, `findKnockout` (server-side only), and `toPublicFields`. These define the JSONB shapes of `form_versions.fields` and `applications.answers`. Field keys and option ids are UUIDs, so relabelling a question doesn't break old answers. Validation failures are returned as `{ ok: false, errors: [{ path, message }] }` and surfaced as `BadRequestException({ message, errors })`.

## Conventions

- Commit messages follow Conventional Commits with a scope: `feat(jobs): ...`, `feat(auth): ...`.
- `AGENTS.md` (root) and `apps/web/AGENTS.md` contain blocks managed by `turbo` and `next dev` that get re-added automatically. Leave them in place.
