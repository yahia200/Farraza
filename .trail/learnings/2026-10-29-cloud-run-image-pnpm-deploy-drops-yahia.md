---
title: "Cloud Run image: pnpm deploy drops dist/ and pnpm 12 needs the skills block stripped"
author: Yahia
date: 2026-10-29
branch: main
cost: { minutes: 53, tokens: 375833 }
id: l-6cafff4f
scope: repo
status: active
src: agent
touches:
  - apps/api/src/app.module.ts
  - apps/api/src/main.ts
  - ".dockerignore"
  - Dockerfile
  - apps/api/package.json
  - ".scratch/auth-token-stores/spec.md"
  - apps/api/migrations/app/refs/db.json
  - apps/api/migrations/snapshots/d4c8f92deccfb5738ebbaa89c92a49b5b324afe8d6cd38509306c4a12af1b1bd/contract.d.ts
  - apps/api/migrations/snapshots/d4c8f92deccfb5738ebbaa89c92a49b5b324afe8d6cd38509306c4a12af1b1bd/contract.json
  - apps/api/src/auth/auth.module.ts
---

## Decided
- The API image is built by the root `Dockerfile` (two stages, `pnpm --filter api deploy --prod /out`, runtime as the `node` user). Hosting is Cloud Run with a Cloud Build trigger set up in the console (public access, request-based billing, max instances 1). Max instances 1 because the throttler counts in memory (`.claude/rules/api.md`).
- `apps/api/package.json` has `"files": ["dist"]`. `apps/api/.gitignore` lists `dist/`, and with no `files` field `pnpm deploy` copied `src` but not `dist`, so the image had no `dist/main.js`. Not read from pnpm docs; it is the npm packing convention, confirmed only by the image missing `dist` before and working after.
- The Dockerfile runs `sed -i '/^permissions:/,$d' pnpm-workspace.yaml` before `pnpm install`. The `permissions` block (skills for `@prisma/orm-postgres` and `prisma`) makes pnpm 12 link agent skills, and with `.claude` excluded by `.dockerignore` the install failed with `ERR_PNPM_NO_AGENT_SKILLS_DIR`.
- `.dockerignore` excludes `**/*.tsbuildinfo`: `apps/api/tsconfig.json` has `incremental: true`, so a stale cache in the context could make `tsc` skip emitting `dist/`.

## Tried and ruled out
- An opt-out flag for skill linking: none found in pnpm.io/cli/install or in about 200k of the 464k-character 12.15.0 CHANGELOG (the rest unread). `pnpm install --help` was never run for it.
- `skills.dirs` in `pnpm-workspace.yaml` or `mkdir -p .claude/skills` in the Dockerfile: both still install the skills, which was the thing to avoid in the image.
- `service.yaml` plus a GitHub Actions workflow (Workload Identity Federation) and a `cloudbuild.yaml` trigger: written or researched, then dropped for the console-configured Cloud Build trigger. Nothing from them was committed.

## Watch out
- The `sed` deletes from `permissions:` to the end of the file. It is only correct while `permissions` is the last block in `pnpm-workspace.yaml`; a block added below it silently disappears from the image build.
- The image sets `NODE_ENV=production`, so `env.schema.ts` requires `SMTP_URL`, and `@nestjs/authentication` refuses to boot without real stores for every contract a configured feature reads. A plain `docker run` shows both as boot errors.
- Apply the schema to Neon (`prisma db update`) before the first deploy; the build does not do it.
