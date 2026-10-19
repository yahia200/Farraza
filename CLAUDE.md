# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement (read this first)

This is a learning project. The owner is building it to learn and grow, and wants to understand and own every decision. These rules override the default habit of quietly picking a sensible option and moving on.

1. **Don't decide silently.** When a task involves a real choice (a library, a pattern, an API shape, a schema change, file layout, error handling, any trade-off), state the options, which one you recommend, and why. Include a doc reference where one exists. For significant or hard-to-reverse decisions, or when there's no clear conventional answer, ask before implementing. If a choice simply follows an existing pattern in this repo, you don't need to discuss it, but say which pattern you followed.
2. **Back every tool and decision with docs.** Every library API, CLI command, or config option you use or introduce needs a reference the owner can read: a local path or URL from the table below, ideally narrowed to the specific page or section. Prefer the version-matched local docs. Name the exact doc path or URL **in the explanation itself** — not a vague "the docs say so" or "per the documentation" — so the owner can open it. If you couldn't find a reference and are going from memory, say so explicitly.
3. **Follow current conventions, not remembered ones.** The installed versions are newer than your training data, so your memory of an API is probably stale. Before using any library API, CLI flag, or config option, read its installed-version source: the `.d.ts` types or the bundled docs for the version in this repo's `node_modules` (see the table below), not what you remember. If you are recalling an API from memory without having opened its installed docs this session, say so and verify before relying on it. Follow the conventions the installed version recommends, heed deprecation notices, and if existing code here deviates from current convention, point it out instead of copying it.
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
| docx-preview | 0.4.1 | `apps/web/node_modules/docx-preview/README.md` (API and options), `dist/docx-preview.d.ts`, readable source `dist/docx-preview.mjs` | https://github.com/VolodymyrBaydalka/docxjs |
| shadcn | 4.21.3 | `apps/web/node_modules/shadcn/README.md` | https://ui.shadcn.com/docs |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | 3.1151.0 / 3.1151.0 | `apps/api/node_modules/@aws-sdk/client-s3/README.md` and `dist-types/` (commands in `dist-types/commands/`, request shapes in `dist-types/models/models_0.d.ts`); `apps/api/node_modules/@aws-sdk/s3-request-presigner/README.md` and `dist-types/index.d.ts` | https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/ |
| `file-type` | 22.2.0 | `apps/api/node_modules/file-type/readme.md`, `apps/api/node_modules/file-type/source/index.d.ts` | https://github.com/sindresorhus/file-type |
| `browser-image-compression` | 2.0.2 | `apps/web/node_modules/browser-image-compression/README.md`, `apps/web/node_modules/browser-image-compression/dist/browser-image-compression.d.ts` | https://github.com/Donaldcwl/browser-image-compression#readme |

Prisma 8 differs most from older knowledge: there is no `PrismaClient`, no `prisma generate`, and no `schema.prisma`. See the "Database" section below.

## Commands

Run from the repo root unless noted. Node >= 24, pnpm 11.

```bash
docker compose up -d                 # Postgres 17 on :5432 (user/pass/db: hiring) + RustFS S3 on :9000 with the dev bucket and its CORS rules (docker/rustfs-cors.json); re-apply CORS with `docker compose up createbuckets`
pnpm dev                             # all apps (builds @repo/shared first via ^build)
pnpm --filter api dev                # API only, watch mode
pnpm --filter web dev                # web only, http://localhost:3000
pnpm build | pnpm lint | pnpm check-types
pnpm format                          # prettier over the whole repo
```

`apps/api/.env` needs `PORT`, `DATABASE_URL`, `APP_URL` (the web app's URL: CORS origin, session and CSRF `trustedOrigins`, and the base of the Google callback), `INTERNAL_API_SECRET`, the object-storage vars `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (an OAuth client of type "Web application" whose redirect URI is `${APP_URL}/auth/oidc/google/callback`, on the web origin: see ADR-0003). Optional: `S3_FORCE_PATH_STYLE` (`true`/`false`), `SMTP_URL` (required when `NODE_ENV=production`, where the API refuses to boot without it; in development and tests, leaving it unset prints emails to the API log) and `MAIL_FROM` (defaults to `Khatwateen <accounts@khatwateen.app>`). The API validates its environment at boot against `apps/api/src/config/env.schema.ts` and refuses to start with a list of what is missing or malformed; add new variables there. `apps/web/.env.local` needs `API_URL` and the same `INTERNAL_API_SECRET` (a long random string, different per environment). All API routes are under the `/api` prefix.

The API imports `@repo/shared` from its built `dist/`. After changing `packages/shared`, rebuild it (`pnpm --filter @repo/shared build`) or keep `pnpm dev` running, which watches it.

Tests use Vitest. API tests match `**/*.spec.ts` and sit next to the code they cover. Shared tests match `*.test.ts`.

```bash
pnpm --filter @repo/shared test
pnpm --filter @repo/shared exec vitest run src/answers.test.ts        # single file
pnpm --filter api test
pnpm --filter api exec vitest run src/path/to/file.spec.ts -t "name"  # single test
```

API specs test a service through its public methods, with the real service and real authorization policies wired to a hand-written in-memory fake of the repository (`src/jobs/jobs.service.spec.ts` is the pattern to copy). They need no database: `vitest.config.ts` sets a dummy `DATABASE_URL` so importing a service doesn't build a client against the real one. There are no API e2e tests. `packages/shared` has the pure-logic test suite.

Linting: the API uses **oxlint** (`apps/api/oxlint.json`) and the web app uses ESLint. API Prettier config: single quotes, trailing commas.

## Database (Prisma 8)

- The schema is `apps/api/src/prisma/contract.prisma`. After editing it, run `pnpm --filter api exec prisma contract emit` to regenerate `contract.json` and `contract.d.ts` next to it. Commit both.
- Apply schema changes to the dev DB with `pnpm --filter api exec prisma db update`. Run `prisma db --help` and `prisma migration --help` for verify/migrate/plan. Past schema commits also included new files under `apps/api/migrations/snapshots/` and `migrations/app/refs/db.json`.
- `src/prisma/db.ts` builds the client. `PrismaService` (global module) exposes it as `this.prisma.db`.
- Query style: `db.orm.public.Job.where({ companyId, slug }).include('stages').first()`, plus `.all()`, `.create()`, `.createAll()`, `.update()` (returns the row or `null`), `.updateAndCount()`, `.deleteAndCount()`, `.upsert({ create, update, conflictOn })`, `.orderBy((j) => j.createdAt.desc())`, and lambda predicates like `.where((v) => v.publishedAt.isNotNull())`.
- Transactions: `this.prisma.db.transaction(async (tx) => { await tx.orm.public.X.create(...) })`.
- Tables and columns are snake_case in Postgres and mapped to camelCase via `@map`/`@@map`.

`docs/db-schema.md` documents the applied schema table by table. It covers the JSONB shapes, which event writes what, the rules the services must enforce (§7), and the planned tables and constraints (§8). **`contract.prisma` and the Zod schemas in `packages/shared` are the source of truth.** When you change the contract, update that doc too. Contract enums become `text` columns with a CHECK, not Postgres enum types, and some `*_id` columns deliberately have no FK. The doc lists which ones.

## App-specific rules

Detailed architecture notes are split into path-scoped rules that load only when you open files in that area (so they don't cost context in every session):

- **`apps/web` (Next.js 16):** `.claude/rules/web.md` — backend-for-frontend, DAL, route groups, form builder, public apply page, Base UI gotchas.
- **`apps/api` (NestJS 12) and `packages/shared`:** `.claude/rules/api.md` — per-feature layering, auth/tenancy/authorization, concurrency conventions, domain flow, shared schemas.

If you're reasoning about cross-cutting work before touching files, open the relevant rule yourself.

## Conventions

- **Commit messages** follow Conventional Commits: `<type>(<scope>): <subject>`.
  - Type is one of `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`.
  - Scope is the app or feature touched: `jobs`, `auth`, `forms`, `applications`, `pipeline`, `companies`, `web`, `api`, `shared`, `db`, `storage`, `deps`. Examples: `feat(jobs): add status filter`, `fix(auth): relay session cookie on sign-out`.
  - One logical change per commit; keep the subject in the imperative and under ~72 chars.
- **Worktrees per session.** Each parallel desktop session runs in its own git worktree under `.claude/worktrees/` on its own branch, so sessions don't collide. A worktree is a fresh checkout: `.worktreeinclude` copies the `.env` files in automatically, but you must run `pnpm install` in a new worktree before `pnpm dev` works. Two sessions can't both bind ports 3000/3001, so only run dev servers in one at a time.
- `AGENTS.md` (root) and `apps/web/AGENTS.md` contain blocks managed by `turbo` and `next dev` that get re-added automatically. Leave them in place.

## Agent skills

Configuration the engineering skills (to-tickets, triage, to-spec, domain-modeling, etc.) read. Edit the files under `docs/agents/` directly to change these.

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/` in this repo (local-markdown workflow, no external tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root, created lazily by domain-modeling. See `docs/agents/domain.md`.
