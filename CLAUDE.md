# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth: ROADMAP.md

`ROADMAP.md` (~3.7k lines) defines the whole project: stack, architecture, conventions, and 15 phases of numbered steps (0.1 … 15.3) with a progress tracker. Read the relevant step before doing work, and work **strictly in roadmap order, one step at a time**. Each step has Goal / Setup / Your task / Hints / Done when / Commit.

Working agreement (from the roadmap's continuation prompt):

- **Setup/config/tooling code: write it.** **Business logic: give the task + hints only**, don't write the full solution unless explicitly asked; review the user's code like a senior engineer instead.
- **Never commit or push.** End each step with the exact `git add` + Conventional Commit command for the user to run.
- If a roadmap snippet is outdated (library API/version changes), say so and give the fix.
- Tick the progress tracker in `ROADMAP.md` as steps complete.

Current position: Phase 0 done (0.1–0.3); Phase 1 done (1.1–1.7). 2.1 done (`pnpm infra:up` for Postgres+Redis). 2.2 done (Drizzle, `db:generate`/`db:migrate`, users table). 2.3 done (Redis client, `/health/ready`). Next: 2.4 test harness.

## Project

TicketRush: flash-sale ticket booking with zero double bookings under concurrency. Core principle: **Redis is the fast lane, Postgres is the truth** — Redis Lua holds absorb the stampede; a conditional `UPDATE … WHERE status = 'available'` in Postgres guarantees correctness. Planned stack: Express 5, Zod 4, Postgres 17 + Drizzle, Redis 7 (ioredis), BullMQ, jose JWT + rotating refresh tokens, pino, prom-client, Vitest + Supertest, k6, Next.js frontend. Only `apps/api` exists so far; most of this is not yet built.

## Commands

pnpm workspace (Node >=24, pnpm 11). Run from the repo root:

```bash
pnpm infra:up                   # docker compose: Postgres 17 (+ ticketrush_test DB) and Redis 7
pnpm infra:down
pnpm dev:api                    # tsx watch apps/api/src/server.ts (port 4000)
pnpm lint                       # eslint .
pnpm format                     # prettier --write .
pnpm typecheck                  # pnpm -r typecheck (tsc per package)
pnpm test                       # pnpm -r test
pnpm --filter api build         # tsup -> apps/api/dist
```

Tests will use Vitest (roadmap step 2.4); once set up, a single test is `pnpm --filter api exec vitest run path/to/file.test.ts -t "name"`.

## Architecture & conventions (planned; enforce as code lands)

- `apps/api/src/app.ts` builds the Express app **without binding a port** (`createApp()`); `server.ts` binds it; `worker.ts` will be the BullMQ entrypoint. Tests import the app directly.
- Strict layering under `src/modules/<feature>/`: `*.routes.ts` (only layer touching `req`/`res`, uses the `route()` helper), `*.service.ts` (business logic, throws `Errors.*`, uses Drizzle directly — no repository layer, record as an ADR), `*.schema.ts` (Zod `{ body, query, params }`).
- Code never reads `process.env`; it imports the validated `env` object from `src/config/env.ts`.
- Import via the `@/` alias (`apps/api/src`); works in tsx, tsup and tsc.
- API: base `/api/v1`, plural nouns, success `{ data }`, errors `{ error: { code, message, details?, requestId } }`. Money is integer minor units (paise); timestamps `timestamptz`/ISO-8601 UTC; UUID ids.
- DRY rule: same kind of code in more than 2 files → extract to `src/lib/`. Every business step ships with at least one integration test (real Postgres/Redis). Significant decisions get `docs/adr/NNNN-title.md` (template: `docs/adr/0000-template.md`).
- Files are kebab-case with a role suffix (`holds.service.ts`); DB columns snake_case.

## Tooling notes

- **TypeScript is pinned to `~6.0.x`** in the root `package.json`: typescript-eslint 8.x rejects TS 7 (`>=4.8.4 <6.1.0`) and `pnpm lint` crashes on it. Don't bump TypeScript until typescript-eslint supports it.
- `tsconfig.base.json` is strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (use `import type`; ESLint enforces `consistent-type-imports`). Unused vars must be prefixed `_`.
- Prettier: single quotes, 100 cols. `apps/web/**` and `infra/**` are excluded from the root ESLint config (Next.js gets its own in Phase 14).
- Husky hooks: `pre-commit` runs lint-staged (eslint --fix + prettier); `commit-msg` runs commitlint. Commits must be Conventional Commits (`feat|fix|refactor|test|docs|chore|build|ci|perf`, scope = `api|web|db|infra`).
- If pnpm warns about ignored build scripts, `pnpm approve-builds` (esbuild is already allowed in `pnpm-workspace.yaml`).
