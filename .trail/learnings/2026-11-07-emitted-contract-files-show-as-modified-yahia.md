---
title: Emitted contract files show as modified on Windows from line endings alone and block merges
author: Yahia
date: 2026-11-07
branch: main
cost: { minutes: 14, tokens: 33478 }
id: l-a00fa939
scope: repo
status: active
src: agent
touches:
  - apps/web/components/apply/use-cv-autofill.ts
  - apps/web/lib/cv-reader.ts
  - packages/shared/src/cv-contacts.ts
  - packages/shared/src/cv-layout.test.ts
  - packages/shared/src/cv-layout.ts
  - packages/shared/src/cv-name.test.ts
  - packages/shared/src/cv-name.ts
  - packages/shared/src/cv-text.ts
  - packages/shared/src/index.ts
  - apps/api/src/prisma/contract.json
---

## Decided
- `apps/api/src/prisma/contract.json`, `contract.d.ts` and `apps/api/migrations/app/refs/db.json` can show as `M` in the main folder with no content change (CRLF vs LF under autocrlf). Before a merge, prove it with `diff <(git show HEAD:<file> | tr -d '\r') <(tr -d '\r' < <file>)`; if identical, `git checkout -- <file>` loses nothing.

## Tried and ruled out
- `git update-index --refresh` did not clear them, and `git stash` is shared across worktrees, so neither was used.

## Watch out
- `git merge --ff-only` aborts with "local changes would be overwritten" on exactly these files even when you have no real contract edits; `git diff --stat` printing nothing for them is the tell.
