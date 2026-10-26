---
title: "Repeating groups are tested only through the @repo/shared public functions"
author: Yahia
date: 2026-10-24
branch: main
cost: { minutes: 1, tokens: 1538 }
id: l-a459dab5
scope: repo
status: active
src: agent
---

## Decided
The repeating-groups feature (spec: .scratch/repeating-groups/spec.md, ADR-0004) is tested at one seam: the public functions in packages/shared (parseFormFields, parseAnswers, toPublicFields, findKnockout), in form-fields.test.ts and answers.test.ts. Every rule lives there (group and child validation, preset-key catalog and uniqueness, blank-entry dropping, error paths, groups ignored by auto-reject), it is pure, and both the API and the web app call it. The web pieces (builder, apply step, candidate sheet) are verified by hand in the browser pane, and what was checked is recorded.

## Tried and ruled out
- A case in apps/api applications.service.spec.ts that submits a group answer through the service: the service only delegates to parseAnswers, so it re-tests the shared seam for almost no extra signal and makes a second seam.
- Adding Vitest and Testing Library to apps/web as part of this feature: new tooling is a large scope increase and belongs in its own ticket, not folded into a feature spec.

## Watch out
Group behaviour in the web UI is not covered by the shared tests, so a regression in the apply step or candidate sheet will not fail them. Check those in the browser.
