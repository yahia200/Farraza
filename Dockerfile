# Image for apps/api (Cloud Run). Build context is the repo root, because the
# API depends on the workspace package @repo/shared.
# Docs: https://docs.docker.com/build/building/multi-stage/
#       https://cloud.google.com/run/docs/container-contract

FROM node:26-slim AS build
# Node 25+ no longer ships corepack, so install the pnpm pinned in the root
# package.json ("packageManager") directly.
RUN npm install -g pnpm@12.15.0
WORKDIR /repo

# Manifests first: this layer (and the install below) is cached until a
# dependency changes, not on every source edit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# The `permissions` block only exists so pnpm links agent skills (.claude/skills)
# for coding agents. The image has no agent and no such directory, so the install
# fails with ERR_PNPM_NO_AGENT_SKILLS_DIR. Deleting from `permissions:` to the end
# of the file assumes it is the last block in pnpm-workspace.yaml (it is today).
RUN sed -i '/^permissions:/,$d' pnpm-workspace.yaml
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
# `api...` = the API plus the workspace packages it depends on.
RUN pnpm install --frozen-lockfile --filter "api..."

COPY packages packages
COPY apps/api apps/api
# @repo/shared first: the API imports its built dist/ (CLAUDE.md, Commands).
RUN pnpm --filter @repo/shared build && pnpm --filter api build
# A self-contained, production-only copy of the API for the runtime stage.
RUN pnpm --filter api deploy --prod /out

FROM node:26-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
# Not root. The `node` user ships with the official image.
USER node
# Cloud Run injects PORT; the API reads it (env.schema.ts) and listens on it.
CMD ["node", "dist/main"]
