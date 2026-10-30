---
title: "Vercel 'Can't resolve @repo/shared' came from turbo cache hit with no dist/ output declared"
author: Yahia
date: 2026-10-30
branch: main
cost: { minutes: 1, tokens: 86911 }
id: l-5329bb8b
scope: repo
status: active
src: agent
touches:
  - turbo.json
---

## Decided
turbo.json `build.outputs` now includes `dist/**` so a Turborepo cache hit on @repo/shared restores its tsc output. Root cause of intermittent Vercel failures: outputs only listed `.next/**`, so a hit on @repo/shared:build replayed logs and restored no files, and apps/web could not resolve `@repo/shared` (exports point at ./dist).

## Tried and ruled out
Not verified by a deploy yet. The "manual redeploy works" explanation (redeploy skips the build cache) is an inference, not checked against Vercel docs. A package-level turbo.json in packages/shared was considered and skipped as extra file for little gain.

## Watch out
Fails only when packages/shared is unchanged (cache hit); passes when it changes, and always locally because dist/ exists on disk. The first deploy after the fix may replay the stale dist-less cache entry: redeploy once without build cache. Any new package that builds to a folder other than dist/ or .next/ needs its outputs declared in turbo.json too.
