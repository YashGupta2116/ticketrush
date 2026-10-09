# syntax=docker/dockerfile:1
# One file, two images: `--target api` (API + worker + migrate/seed scripts) and `--target web`.

FROM node:24-slim AS base
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@11.6.0
WORKDIR /repo

# Manifests only, so this layer stays cached until a dependency changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ---- api
FROM deps AS api-build
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN pnpm --filter api build && pnpm --filter api deploy --prod --legacy /out

FROM node:24-slim AS api
ENV NODE_ENV=production
WORKDIR /app
# /out holds package.json, the production node_modules and the `files` (dist, drizzle).
COPY --from=api-build /out ./
USER node
CMD ["node", "dist/server.js"]

# ---- web
FROM deps AS web-build
# Relative on purpose: Caddy serves the site and the API from one origin.
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web apps/web
RUN pnpm --filter web build

FROM node:24-slim AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=web-build /repo/apps/web/.next/standalone ./
COPY --from=web-build /repo/apps/web/.next/static ./apps/web/.next/static
USER node
CMD ["node", "apps/web/server.js"]
