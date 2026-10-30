---
title: "User avatars are generated with boring-avatars (beam, seeded by user id), not the Google picture"
author: Yahia
date: 2026-10-30
branch: feat/jobs-empty-state
cost: { minutes: 8, tokens: 128507 }
id: l-08b4bb4e
scope: repo
status: active
src: agent
touches:
  - apps/api/src/prisma/contract.prisma
  - apps/api/src/users/user.ts
  - apps/web/components/dashboard/user-avatar.tsx
  - apps/web/components/dashboard/members/columns.tsx
  - apps/web/components/dashboard/nav-user.tsx
  - apps/api/src/users/users.repository.ts
  - apps/api/src/testing/in-memory-users.repository.ts
  - apps/web/lib/dal.ts
---

## Decided
- The sidebar account menu (`nav-user.tsx`) and the members table (`members/columns.tsx`) show `UserAvatar` (`apps/web/components/dashboard/user-avatar.tsx`): `boring-avatars` 2.0.4, variant `beam`, seeded by `user.id` (never changes on rename, no email in the SVG).
- The palette is a hex copy of `--primary-200/400/500/700` and `--brand-accent` from `globals.css`, because the library takes hex strings, not CSS variables.

## Tried and ruled out
- Storing Google's `picture` claim (`OidcProfile.picture`) in a new `users.image_url` column and hotlinking it. Dropped by the owner before any schema or API change was written, in favour of generated avatars, which need no DB, API or DAL change and also work for password sign-ups.
- Other variants (marble, bauhaus, pixel, ring, sunset): beam reads most clearly as a person at the 32px sidebar size.
- Seeding by name or email: the avatar would change on rename, or expose the email.

## Watch out
- If the brand tokens in `globals.css` change, update `PALETTE` in `user-avatar.tsx` by hand.
- `initials()` is still used for company logo fallbacks; only user avatars moved to boring-avatars.
