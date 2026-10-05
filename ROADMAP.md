🎟️ TicketRush — Build Roadmap

> A flash-sale ticket booking platform that guarantees **zero double bookings** under thousands of concurrent requests.
> Simple to explain. Deep to build.

This file is the single source of truth for the project. Keep it in the repo root (`ROADMAP.md`), tick off steps as you go, and paste the **Continuation Prompt** below into any new AI chat to pick up exactly where you left off.

---

## Table of Contents

1. How to use this roadmap
2. Continuation prompt (for AI sessions)
3. What we're building
4. Tech stack & why
5. Architecture
6. Project structure
7. Conventions
8. Progress tracker
9. Phase 0 — Repository foundation
10. Phase 1 — HTTP server fundamentals
11. Phase 2 — Infrastructure
12. Phase 3 — Data model
13. Phase 4 — Authentication
14. Phase 5 — Catalog
15. Phase 6 — Seat holds (the heart)
16. Phase 7 — Bookings
17. Phase 8 — Payments
18. Phase 9 — Background jobs
19. Phase 10 — Real-time seat map
20. Phase 11 — Protection under load
21. Phase 12 — Observability
22. Phase 13 — Proving it (load test)
23. Phase 14 — Frontend
24. Phase 15 — Ship it
25. Appendix — Stretch goals

---

## How to use this roadmap

Every step follows the same shape:

| Section                  | Meaning                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| **Goal**                 | What this step achieves and _why_ it matters.                     |
| **Setup (done for you)** | Config, tooling and infrastructure code. Copy it in as-is.        |
| **Your task**            | Business logic **you** write. No full solutions here, only specs. |
| **Hints**                | Nudges, patterns and gotchas. Read them _after_ you've tried.     |
| **Done when**            | Concrete checks. Don't move on until they pass.                   |
| **Commit**               | Run it yourself. Nothing is ever pushed or committed for you.     |

Ground rules for the whole project:

1. **Tiny steps.** One concern per step, one commit per step.
2. **Setup is given, logic is yours.** Config/infra code is provided; business logic is only specified and hinted.
3. **You commit.** Every step ends with a `git add` + Conventional Commit message.
4. **DRY.** If the same kind of code appears in **more than 2 files**, extract it into `lib/` (a util, helper or factory).
5. **Industry standards everywhere.** Typed config, structured logs, layered architecture, tests, CI.
6. **Minimal, efficient code.** Fewer lines that do more. No speculative abstractions.

---

## Continuation prompt (for AI sessions)

Paste this at the start of a new chat, together with this file:

```
You are my senior backend mentor for "TicketRush" (Next.js + Express, TypeScript monorepo).
ROADMAP.md is attached and is the source of truth. Follow these rules strictly:

1. Work in very small steps, exactly in roadmap order. One step per reply, then stop and wait for me.
2. You write configuration, tooling and setup code yourself.
   For business logic, give me the task + hints only. Never write the full solution
   unless I explicitly ask. When I paste my code, review it like a senior engineer
   (correctness, race conditions, security, naming, DRY) and point to issues with hints.
3. Never commit or push. End each step with the exact `git add` + Conventional Commit command.
4. No code repetition: if the same kind of code exists in more than 2 files, extract a helper/util.
5. Follow industry standards at every point, and keep code minimal and efficient.
6. If something in the roadmap is outdated (library API changes), tell me and give the fix.

I'm currently on step: <X.Y>. Here is what I've done so far / my question: <...>
```

---

## What we're building

**TicketRush** lets organizers put shows on sale and lets thousands of users fight for the same seats at the same second, fairly and correctly.

**User-facing features:** browse shows, live seat map, hold seats for 5 minutes, checkout, pay, see bookings, virtual waiting room for high-demand shows.

**The hard problems (what you'll talk about in interviews):**

| Problem                                                   | How TicketRush solves it                                              | Phase |
| --------------------------------------------------------- | --------------------------------------------------------------------- | ----- |
| Two users grab the same seat in the same millisecond      | Atomic Redis Lua holds + conditional DB update as the source of truth | 6, 7  |
| User double-clicks "Pay" / network retries                | Idempotency keys (the Stripe pattern)                                 | 7     |
| Payment provider sends duplicate / late / forged webhooks | HMAC signatures, replay window, dedup table, row locks                | 8     |
| User abandons checkout                                    | Delayed expiry jobs + a reconciliation sweeper (safety net)           | 9     |
| 10k people refreshing the seat map                        | SSE fan-out via Redis pub/sub, one serialization per event            | 10    |
| Flash-sale traffic spike                                  | Rate limiting, caching, O(1) virtual waiting room                     | 11    |
| "Does it actually work?"                                  | k6 load test: N users, 100 seats, **0 double bookings**               | 13    |

---

## Tech stack & why

| Layer                   | Choice                                                    | Why                                                               |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Runtime                 | Node.js 24 LTS                                            | Current LTS, native `--env-file`, `fetch`, `process.loadEnvFile`. |
| Monorepo                | pnpm workspaces                                           | Fast, strict dependency isolation, shared packages.               |
| Language                | TypeScript (strict)                                       | Industry default; catches bugs at compile time.                   |
| API                     | Express 5                                                 | Native async error handling (no `asyncHandler` wrappers needed).  |
| Validation              | Zod 4                                                     | One schema = runtime validation + static types.                   |
| Database                | PostgreSQL 17                                             | ACID transactions, row locks, partial indexes, `INSERT … SELECT`. |
| ORM                     | Drizzle ORM                                               | SQL-first and thin, so you still _show_ SQL knowledge.            |
| Cache / locks / pub-sub | Redis 7 (ioredis)                                         | Atomic Lua scripts, TTLs, pub/sub, queues.                        |
| Jobs                    | BullMQ                                                    | Delayed jobs, retries with backoff, job schedulers.               |
| Auth                    | JWT access token (jose) + rotating opaque refresh token   | Short-lived stateless access, revocable sessions.                 |
| Passwords               | Argon2id (`@node-rs/argon2`)                              | OWASP-recommended; prebuilt binaries (no native build).           |
| Logging                 | pino + pino-http                                          | Fast structured JSON logs with request IDs.                       |
| Metrics                 | prom-client                                               | Prometheus-standard `/metrics`.                                   |
| Testing                 | Vitest + Supertest                                        | Fast, ESM-native, real integration tests against Postgres/Redis.  |
| Load testing            | k6                                                        | Industry-standard scripted load tests.                            |
| Frontend                | Next.js (App Router) + Tailwind                           | Dashboard/booking UI.                                             |
| Quality                 | ESLint 9 (flat), Prettier, Husky, lint-staged, commitlint | Enforced standards on every commit.                               |
| Delivery                | Docker (multi-stage), docker compose, GitHub Actions      | Reproducible builds + CI.                                         |

> Versions: install the latest stable of each. If an API in this file has changed, check the library's changelog before copying.

---

## Architecture

```mermaid
flowchart LR
  B[Browser<br/>Next.js] -->|REST + SSE| API[Express API<br/>N instances]
  API --> PG[(PostgreSQL<br/>source of truth)]
  API --> R[(Redis<br/>holds · cache · rate limits<br/>pub/sub · queues)]
  W[Worker process<br/>BullMQ] --> R
  W --> PG
  API -->|create intent| P[Mock Payment Provider]
  P -->|signed webhooks<br/>late · duplicated · retried| API
```

**Booking flow (the core of the project):**

```mermaid
sequenceDiagram
  actor U as User
  participant API
  participant R as Redis
  participant DB as Postgres
  participant W as Worker
  participant P as Payment Provider
  U->>API: POST /shows/:id/holds
  API->>R: Lua script: hold ALL seats or NONE (TTL 5 min)
  U->>API: POST /bookings (Idempotency-Key)
  API->>DB: TX: seats available→reserved (conditional), insert booking
  API->>W: schedule expiry (10 min)
  U->>API: POST /bookings/:id/pay
  API->>P: create payment intent
  P-->>API: signed webhook (may be late or duplicated)
  API->>DB: TX: lock booking, confirm, seats reserved→booked
  W->>DB: if still pending → expire, seats → available
```

**Key principle:** _Redis is the fast lane, Postgres is the truth._ Redis holds absorb the stampede; a conditional `UPDATE … WHERE status = 'available'` in Postgres guarantees correctness even if Redis loses data.

---

## Project structure

```
ticketrush/
├─ apps/
│  ├─ api/
│  │  ├─ drizzle/                 # generated SQL migrations (committed)
│  │  ├─ src/
│  │  │  ├─ config/env.ts         # typed, validated environment
│  │  │  ├─ db/                   # client, schema/, column helpers, migrator
│  │  │  ├─ lib/                  # reusable building blocks (logger, errors, route, redis…)
│  │  │  ├─ middlewares/          # cross-cutting Express middlewares
│  │  │  ├─ modules/<feature>/    # feature.routes.ts · feature.service.ts · feature.schema.ts
│  │  │  ├─ jobs/                 # queues + worker processors
│  │  │  ├─ scripts/              # migrate, seed, load-test fixture
│  │  │  ├─ types/                # global type augmentation
│  │  │  ├─ app.ts                # builds the Express app (no port binding)
│  │  │  ├─ routes.ts             # mounts feature routers under /api/v1
│  │  │  ├─ server.ts             # HTTP entrypoint
│  │  │  └─ worker.ts             # background worker entrypoint
│  │  └─ test/
│  └─ web/                        # Next.js app
├─ packages/shared/               # zod schemas + types shared by api & web
├─ infra/                         # postgres init, k6 scripts
├─ docs/adr/                      # Architecture Decision Records
├─ docker-compose.yml
└─ ROADMAP.md
```

---

## Conventions

**Layering (strict):**

- `.routes.ts` is the HTTP layer (the "controller"). It wires middlewares and calls services through the `route()` helper. It's the only layer that touches `req`/`res`.
- `.service.ts` holds business logic. It knows nothing about HTTP, throws `Errors.*`, and uses Drizzle directly.
- `.schema.ts` holds Zod request contracts shaped as `{ body, query, params }`.

> We deliberately skip a separate repository layer: Drizzle already _is_ a typed data-access layer, and another wrapper would be boilerplate. Write this down in an ADR (it's a good interview answer).

**API:**

- Base path is `/api/v1`, with plural nouns (`/shows/:id/holds`). Path params are always `:id` for the primary resource.
- Success responses are `{ "data": … }`. Errors are `{ "error": { "code", "message", "details?", "requestId" } }`.
- Money is stored as integer minor units (paise), `priceCents: 49900` means ₹499.00. Never use floats for money.
- Timestamps are `timestamptz`, serialized as ISO-8601 UTC.
- IDs are UUIDs generated by Postgres (`gen_random_uuid()`), or by the app when needed before insert.

**Code:**

- File names are `kebab-case` with a role suffix (`holds.service.ts`). Code is camelCase; DB columns are snake_case (Drizzle maps them automatically).
- Import paths use the `@/` alias for `apps/api/src`.
- DRY rule: same kind of code in >2 files means extract it into `src/lib/`.
- Every business step ships with at least one integration test.

**Commits:** Conventional Commits, enforced by commitlint.
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`. Scope = area (`api`, `web`, `db`, `infra`).

**ADRs:** For every significant decision, add `docs/adr/NNNN-title.md` using the template from step 0.1. Steps that deserve one say so.

---

## Progress tracker

- **Phase 0 — Foundation**
  - [x] 0.1 Initialize the monorepo
  - [x] 0.2 TypeScript + ESLint + Prettier
  - [x] 0.3 Git hooks (husky, lint-staged, commitlint)
- **Phase 1 — HTTP fundamentals**
  - [x] 1.1 Minimal Express server
  - [x] 1.2 Typed, validated config
  - [x] 1.3 Structured logging + request IDs
  - [x] 1.4 Graceful shutdown
  - [x] 1.5 Security middlewares
  - [x] 1.6 Error handling
  - [x] 1.7 `route()` helper + module structure
- **Phase 2 — Infrastructure**
  - [x] 2.1 Docker compose (Postgres + Redis)
  - [x] 2.2 Drizzle + first table
  - [x] 2.3 Redis client + readiness probe
  - [x] 2.4 Test harness
- **Phase 3 — Data model**
  - [x] 3.1 Catalog tables
  - [x] 3.2 Booking & payment tables
- **Phase 4 — Auth**
  - [x] 4.1 Auth primitives
  - [x] 4.2 Register + login
  - [x] 4.3 Refresh rotation + reuse detection + logout
  - [x] 4.4 `/me` + admin guard
- **Phase 5 — Catalog**
  - [x] 5.1 Shared schema & pagination helpers
  - [x] 5.2 Venues with seat layouts
  - [x] 5.3 Events & shows + seat inventory
  - [x] 5.4 Browse shows (keyset pagination)
  - [x] 5.5 Seat map
  - [x] 5.6 Seed script
- **Phase 6 — Seat holds**
  - [x] 6.1 Redis script helper
  - [ ] 6.2 Hold seats atomically
  - [ ] 6.3 Release holds + seat map overlay
  - [ ] 6.4 Concurrency tests
- **Phase 7 — Bookings**
  - [ ] 7.1 Idempotency middleware
  - [ ] 7.2 Create booking (hold → reserved)
  - [ ] 7.3 Locking strategy switch + ADR _(optional, recommended)_
- **Phase 8 — Payments**
  - [ ] 8.1 Mock provider + webhook plumbing
  - [ ] 8.2 Start payment
  - [ ] 8.3 Webhook handler
- **Phase 9 — Background jobs**
  - [ ] 9.1 BullMQ + worker process
  - [ ] 9.2 Expire unpaid bookings
  - [ ] 9.3 Reconciliation sweeper
- **Phase 10 — Real-time**
  - [ ] 10.1 Pub/sub + SSE helpers
  - [ ] 10.2 Live seat map stream
- **Phase 11 — Protection under load**
  - [ ] 11.1 Rate limiter
  - [ ] 11.2 Cache-aside for hot reads
  - [ ] 11.3 Virtual waiting room
- **Phase 12 — Observability**
  - [ ] 12.1 Prometheus metrics
- **Phase 13 — Proving it**
  - [ ] 13.1 Load-test fixture + k6 script
  - [ ] 13.2 Run the rush, publish results
- **Phase 14 — Frontend**
  - [ ] 14.1 Next.js app + shared package
  - [ ] 14.2 API client + SSE hook
  - [ ] 14.3 Auth + browse pages
  - [ ] 14.4 Live seat map
  - [ ] 14.5 Checkout
  - [ ] 14.6 Waiting room
- **Phase 15 — Ship**
  - [ ] 15.1 Docker images + full compose
  - [ ] 15.2 CI pipeline
  - [ ] 15.3 README, ADRs, benchmarks

---

## Phase 0 — Repository foundation

### Step 0.1 — Initialize the monorepo

**Goal:** A clean pnpm workspace with editor and formatting conventions, before any app code exists.

**Setup (done for you):**

```bash
mkdir ticketrush && cd ticketrush
git init -b main
npm i -g pnpm            # or: corepack enable
mkdir -p apps packages docs/adr infra
```

`package.json` (root). Replace the `packageManager` version with your `pnpm -v` output:

```json
{
  "name": "ticketrush",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.0.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev:api": "pnpm --filter api dev",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`.nvmrc`:

```
24
```

`.gitignore`:

```
node_modules
dist
.next
coverage
.env
.env.*.local
*.log
.DS_Store
infra/k6/fixture.json
```

`.editorconfig`:

```
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

`.prettierrc`:

```json
{ "singleQuote": true, "printWidth": 100 }
```

`.prettierignore`:

```
pnpm-lock.yaml
dist
.next
apps/api/drizzle
```

`docs/adr/0000-template.md`:

```markdown
# NNNN. Title

- Status: accepted
- Date: YYYY-MM-DD

## Context

What problem are we solving? What constraints exist?

## Decision

What did we choose?

## Alternatives considered

What else did we look at, and why not?

## Consequences

Trade-offs, risks, and what becomes easier or harder.
```

Also copy this `ROADMAP.md` into the repo root.

**Done when:** `pnpm -v` works and the folder tree exists.

**Commit:**

```bash
git add .
git commit -m "chore: initialize pnpm monorepo with editor conventions"
```

---

### Step 0.2 — TypeScript + ESLint + Prettier

**Goal:** One shared strict TypeScript base and one lint config for the whole repo.

**Setup (done for you):**

```bash
pnpm add -D -w typescript eslint @eslint/js typescript-eslint eslint-config-prettier prettier
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`eslint.config.js`:

```jsx
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['**/dist', '**/node_modules', '**/.next', 'apps/web/**', 'infra/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  prettier,
]);
```

> `apps/web` gets its own ESLint config from Next.js in Phase 14.

**Done when:** `pnpm lint` runs without crashing (there's nothing to lint yet).

**Commit:**

```bash
git add .
git commit -m "build: add shared typescript, eslint and prettier configuration"
```

---

### Step 0.3 — Git hooks (husky, lint-staged, commitlint)

**Goal:** Standards are _enforced_, not hoped for. Bad code or bad commit messages can't get in.

**Setup (done for you):**

```bash
pnpm add -D -w husky lint-staged @commitlint/cli @commitlint/config-conventional
pnpm exec husky init
```

Replace `.husky/pre-commit` with:

```bash
pnpm exec lint-staged
```

Create `.husky/commit-msg`:

```bash
pnpm exec commitlint --edit "$1"
```

`commitlint.config.js`:

```jsx
export default { extends: ['@commitlint/config-conventional'] };
```

Add to the root `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx,js}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```

> If pnpm warns about ignored build scripts at any point in the project, run `pnpm approve-builds`.

**Done when:** `git commit -m "bad message"` is rejected by commitlint.

**Commit:**

```bash
git add .
git commit -m "build: enforce lint-staged and conventional commits via husky"
```

---

## Phase 1 — HTTP server fundamentals

### Step 1.1 — Minimal Express server

**Goal:** The smallest possible running API. We split **app** (builds the Express instance) from **server** (binds a port). Tests will import the app without opening a port.

**Setup (done for you):**

```bash
mkdir -p apps/api/src && cd apps/api
pnpm init
pnpm add express
pnpm add -D @types/express @types/node tsx tsup
cd ../..
```

In `apps/api/package.json`, set:

```json
{
  "name": "api",
  "private": true,
  "type": "module",
  "files": ["dist", "drizzle"],
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsup",
    "start": "node --env-file-if-exists=.env dist/server.js",
    "typecheck": "tsc"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "test", "*.config.ts"]
}
```

`apps/api/tsup.config.ts`:

```tsx
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node24',
  sourcemap: true,
  clean: true,
});
```

`apps/api/src/app.ts`:

```tsx
import express from 'express';

export const createApp = () => {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
};
```

`apps/api/src/server.ts`:

```tsx
import { createApp } from '@/app';

const PORT = 4000;

createApp().listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
```

**Done when:** `pnpm dev:api` starts and `curl localhost:4000/health` returns `{"status":"ok"}`. `pnpm typecheck` passes.

**Commit:**

```bash
git add .
git commit -m "feat(api): bootstrap minimal express server"
```

---

### Step 1.2 — Typed, validated config

**Goal:** The app **fails fast** at boot if the environment is wrong, instead of crashing mysteriously at 3 AM. The rest of the code imports a typed `env` object and never touches `process.env`.

**Setup (done for you):**

```bash
pnpm --filter api add zod
```

`apps/api/src/config/env.ts`:

```tsx
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  console.error(`Invalid environment variables:\n${issues.join('\n')}`);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export const isProd = env.NODE_ENV === 'production';
```

`apps/api/.env.example` (committed) and `apps/api/.env` (git-ignored, copy of the example):

```
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000
TRUST_PROXY=0
```

Update the dev script so Node loads `.env`:

```json
"dev": "tsx watch --env-file=.env src/server.ts"
```

Update `server.ts` to use `env.PORT` instead of the constant:

```tsx
import { createApp } from '@/app';
import { env } from '@/config/env';

createApp().listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
```

> **Rule from now on:** every new env var goes into `env.ts` **and** `.env.example` in the same commit.

**Done when:** Setting `PORT=abc` in `.env` makes the server refuse to start with a clear message.

**Commit:**

```bash
git add .
git commit -m "feat(api): add zod-validated environment configuration"
```

---

### Step 1.3 — Structured logging + request IDs

**Goal:** JSON logs in production, pretty logs in development, and a request ID on every log line and response. That's how you trace one request across services.

**Setup (done for you):**

```bash
pnpm --filter api add pino pino-http
pnpm --filter api add -D pino-pretty
```

`apps/api/src/lib/logger.ts`:

```tsx
import { pino } from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  ...(env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
});
```

`apps/api/src/middlewares/http-logger.ts`:

```tsx
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '@/lib/logger';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (_req, res, err) =>
    err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
});
```

In `app.ts`, register it first: `app.use(httpLogger);`

In `server.ts`, replace `console.log` with `logger.info(...)`.

**Done when:** Each request logs one line with `reqId`, status and response time, and responses carry an `x-request-id` header.

**Commit:**

```bash
git add .
git commit -m "feat(api): add structured logging with request ids"
```

---

### Step 1.4 — Graceful shutdown

**Goal:** On deploy/restart (`SIGTERM`), stop accepting new requests, finish in-flight ones, close DB/Redis cleanly, then exit. Every module registers its own cleanup with `onShutdown()`, so `server.ts` never has to know about the DB, Redis or queues.

**Setup (done for you):**

`apps/api/src/lib/lifecycle.ts`:

```tsx
import { logger } from './logger';

type Task = () => unknown;

const tasks: Task[] = [];
let shuttingDown = false;

/** Register cleanup work. Runs in reverse registration order (LIFO), like `defer`. */
export const onShutdown = (task: Task) => void tasks.unshift(task);

export const runShutdownTasks = async () => {
  for (const task of tasks.splice(0)) {
    await Promise.resolve()
      .then(task)
      .catch((err) => logger.error({ err }, 'Shutdown task failed'));
  }
};

export const gracefulShutdown = async (reason: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, 'Shutting down gracefully');
  setTimeout(() => process.exit(1), 10_000).unref(); // hard deadline
  await runShutdownTasks();
  process.exit(exitCode);
};

export const handleProcessSignals = () => {
  const crash = (err: unknown) => {
    logger.fatal({ err }, 'Fatal error');
    void gracefulShutdown('fatal', 1);
  };
  process.once('SIGINT', gracefulShutdown).once('SIGTERM', gracefulShutdown);
  process.on('unhandledRejection', crash).on('uncaughtException', crash);
};
```

`apps/api/src/server.ts` (final shape):

```tsx
import { createApp } from '@/app';
import { env } from '@/config/env';
import { handleProcessSignals, onShutdown } from '@/lib/lifecycle';
import { logger } from '@/lib/logger';

const server = createApp().listen(env.PORT, (err) => {
  if (err) throw err;
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Registered last → runs first: stop accepting traffic before closing DB/Redis.
onShutdown(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
      setTimeout(() => server.closeAllConnections(), 5_000).unref(); // cut long-lived streams (SSE)
    }),
);

handleProcessSignals();
```

**Done when:** `Ctrl+C` logs "Shutting down gracefully" and exits with code 0.

**Commit:**

```bash
git add .
git commit -m "feat(api): add graceful shutdown lifecycle"
```

---

### Step 1.5 — Security middlewares

**Goal:** Sensible HTTP security defaults: secure headers, a strict CORS allowlist, body size limits (a trivial DoS vector otherwise), and correct client IPs behind a proxy.

**Setup (done for you):**

```bash
pnpm --filter api add helmet cors
pnpm --filter api add -D @types/cors
```

`apps/api/src/app.ts`:

```tsx
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from '@/config/env';
import { httpLogger } from '@/middlewares/http-logger';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.use(
    httpLogger,
    helmet(),
    cors({ origin: env.CORS_ORIGINS, credentials: true }),
    express.json({ limit: '100kb' }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
};
```

> `TRUST_PROXY=1` in production behind exactly one load balancer. Otherwise `req.ip` (used by rate limiting later) is the proxy's IP, or is spoofable via `X-Forwarded-For`.

**Done when:** Responses include helmet headers (`x-content-type-options`, etc.), no `x-powered-by` header, and a >100kb JSON body gets a 413.

**Commit:**

```bash
git add .
git commit -m "feat(api): add security headers, cors allowlist and body limits"
```

---

### Step 1.6 — Error handling

**Goal:** One error type, one error handler, one error shape. Services just `throw Errors.notFound()`, and Express 5 forwards thrown/rejected errors to the handler automatically.

**Setup (done for you):**

`apps/api/src/lib/errors.ts`:

```tsx
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

const factory =
  (status: number, code: string, fallback: string) =>
  (message = fallback, details?: unknown) =>
    new AppError(status, message, code, details);

export const Errors = {
  badRequest: factory(400, 'BAD_REQUEST', 'Bad request'),
  unauthorized: factory(401, 'UNAUTHORIZED', 'Unauthorized'),
  forbidden: factory(403, 'FORBIDDEN', 'Forbidden'),
  notFound: factory(404, 'NOT_FOUND', 'Resource not found'),
  conflict: factory(409, 'CONFLICT', 'Conflict'),
  gone: factory(410, 'GONE', 'Resource no longer available'),
  validation: factory(422, 'VALIDATION_ERROR', 'Validation failed'),
  tooManyRequests: factory(429, 'RATE_LIMITED', 'Too many requests'),
  unavailable: factory(503, 'SERVICE_UNAVAILABLE', 'Service unavailable'),
};
```

> Need a custom code, like `SEATS_UNAVAILABLE`? Use `new AppError(409, 'Seats are taken', 'SEATS_UNAVAILABLE', { seatIds })`.

`apps/api/src/middlewares/error-handler.ts`:

```tsx
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, Errors } from '@/lib/errors';

export const notFound: RequestHandler = (req) => {
  throw Errors.notFound(`Cannot ${req.method} ${req.path}`);
};

const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;
  // body-parser & friends attach a 4xx `status` (malformed JSON, payload too large…)
  const status = (err as { status?: number })?.status;
  if (status && status >= 400 && status < 500) {
    return new AppError(status, (err as Error).message, 'BAD_REQUEST');
  }
  return new AppError(500, 'Something went wrong', 'INTERNAL_ERROR');
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const { statusCode, code, message, details } = toAppError(err);
  if (statusCode >= 500) req.log.error({ err }, 'Unhandled error');
  res.status(statusCode).json({ error: { code, message, details, requestId: req.id } });
};
```

Register them **last** in `app.ts`:

```tsx
app.use(notFound);
app.use(errorHandler);
```

**Done when:** `GET /nope` returns `404 { error: { code: "NOT_FOUND", … , requestId } }`, and malformed JSON returns a 400 instead of a stack trace.

**Commit:**

```bash
git add .
git commit -m "feat(api): add centralized error handling with typed app errors"
```

---

### Step 1.7 — `route()` helper + module structure

**Goal:** Kill controller boilerplate. Every endpoint does the same four things: validate input, call a service, wrap the result in `{ data }`, and set a status. One helper does it once, and handlers become one-liners with **fully inferred types** from the Zod schema.

**Setup (done for you):**

`apps/api/src/lib/route.ts`:

```tsx
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { Errors } from './errors';

type RequestSchema = z.ZodType<{ body?: unknown; query?: unknown; params?: unknown }>;
type Ctx = { req: Request; res: Response };

/**
 * Validates `{ body, query, params }` against `schema`, runs `handler` with typed input,
 * and responds with `{ data }`. If the handler already responded (e.g. SSE), it does nothing.
 */
export const route =
  <S extends RequestSchema>(
    schema: S,
    handler: (input: z.output<S>, ctx: Ctx) => unknown,
    { status = 200 } = {},
  ): RequestHandler =>
  async (req, res) => {
    const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!parsed.success) {
      throw Errors.validation(
        undefined,
        parsed.error.issues.map(({ path, message }) => ({
          path: path.map(String).join('.'),
          message,
        })),
      );
    }
    const data = await handler(parsed.data, { req, res });
    if (!res.headersSent) res.status(status).json({ data });
  };
```

`apps/api/src/lib/schemas.ts`:

```tsx
import { z } from 'zod';

export const noInput = z.object({});
```

`apps/api/src/modules/health/health.routes.ts`:

```tsx
import { Router } from 'express';
import { route } from '@/lib/route';
import { noInput } from '@/lib/schemas';

export const healthRouter = Router().get(
  '/live',
  route(noInput, () => ({ status: 'ok' })),
);
```

`apps/api/src/routes.ts`:

```tsx
import { Router } from 'express';

export const apiRouter = Router();
// Feature routers get mounted here, e.g. apiRouter.use('/auth', authRouter);
```

`apps/api/src/app.ts`: remove the inline `/health` handler and mount the routers before `notFound`:

```tsx
app.use('/health', healthRouter);
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
```

**How a feature endpoint will look (reference for later phases):**

```tsx
// modules/venues/venues.schema.ts
export const createVenueSchema = z.object({ body: z.object({ name: z.string().min(2) }) });

// modules/venues/venues.routes.ts
export const venuesRouter = Router().post(
  '/',
  authenticate,
  authorize('admin'),
  route(createVenueSchema, ({ body }) => createVenue(body), { status: 201 }),
);
```

**Done when:** `GET /health/live` returns `{ "data": { "status": "ok" } }` and unknown routes still return the 404 envelope.

**Commit:**

```bash
git add .
git commit -m "feat(api): add typed route helper and feature module structure"
```

---

## Phase 2 — Infrastructure

### Step 2.1 — Docker compose (Postgres + Redis)

**Goal:** A one-command local infrastructure that matches production, with health checks and a separate test database.

**Setup (done for you):**

`docker-compose.yml` (root):

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ticketrush
      POSTGRES_PASSWORD: ticketrush
      POSTGRES_DB: ticketrush
    ports: ['5432:5432']
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ticketrush']
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ['redis-server', '--appendonly', 'yes']
    ports: ['6379:6379']
    volumes: [redisdata:/data]
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
  redisdata:
```

`infra/postgres/init.sql`:

```sql
CREATE DATABASE ticketrush_test;
```

Add to root `package.json` scripts:

```json
"infra:up": "docker compose up -d --wait",
"infra:down": "docker compose down"
```

**Done when:** `pnpm infra:up` finishes with both containers healthy.

**Commit:**

```bash
git add .
git commit -m "build(infra): add postgres and redis via docker compose"
```

---

### Step 2.2 — Drizzle + first table

**Goal:** A pooled DB connection, migrations as committed SQL files, and reusable column helpers. We create one table (`users`) as the reference pattern you'll copy in Phase 3.

**Setup (done for you):**

```bash
pnpm --filter api add drizzle-orm pg
pnpm --filter api add -D drizzle-kit @types/pg
```

Env additions (`env.ts` schema + `.env.example` + `.env`):

```tsx
DATABASE_URL: z.url(),
DB_POOL_MAX: z.coerce.number().int().positive().default(10),
```

```
DATABASE_URL=postgres://ticketrush:ticketrush@localhost:5432/ticketrush
DB_POOL_MAX=10
```

`apps/api/drizzle.config.ts`:

```tsx
import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
```

`apps/api/src/db/columns.ts` (reused by every table, so there's no copy-paste of id/timestamps):

```tsx
import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const id = () => uuid().primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
```

`apps/api/src/db/schema/users.ts` (**the reference pattern**):

```tsx
import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from '../columns';

export const userRole = pgEnum('user_role', ['user', 'admin']);
export type Role = (typeof userRole.enumValues)[number];

export const users = pgTable('users', {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: userRole().notNull().default('user'),
  ...timestamps,
});
```

`apps/api/src/db/schema/index.ts`:

```tsx
export * from './users';
```

`apps/api/src/db/index.ts`:

```tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '@/config/env';
import { onShutdown } from '@/lib/lifecycle';
import { logger } from '@/lib/logger';
import * as schema from './schema';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX });
pool.on('error', (err) => logger.error({ err }, 'Postgres pool error'));
onShutdown(() => pool.end());

export const db = drizzle({ client: pool, schema, casing: 'snake_case' });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Accept either so a function works standalone or inside a caller's transaction. */
export type Executor = Db | Tx;
```

`apps/api/src/db/migrate.ts` (shared by the CLI script, tests and Docker):

```tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const runMigrations = async (connectionString: string, migrationsFolder = './drizzle') => {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
};
```

`apps/api/src/scripts/migrate.ts`:

```tsx
import { runMigrations } from '@/db/migrate';

await runMigrations(process.env.DATABASE_URL!);
console.log('Migrations applied');
```

Scripts in `apps/api/package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "tsx --env-file=.env src/scripts/migrate.ts",
"db:studio": "drizzle-kit studio"
```

Add `'src/scripts/migrate.ts'` to the tsup `entry` array.

Generate and apply the first migration:

```bash
pnpm --filter api db:generate --name init_users
pnpm --filter api db:migrate
```

**Done when:** `drizzle/0000_init_users.sql` exists and the `users` table is visible in `pnpm --filter api db:studio`.

**Commit:**

```bash
git add .
git commit -m "feat(db): set up drizzle with migrations and users table"
```

---

### Step 2.3 — Redis client + readiness probe

**Goal:** A Redis client factory (we'll need several connections: main, pub/sub subscriber, queues), and a proper **liveness vs readiness** split, the way Kubernetes expects it.

**Setup (done for you):**

```bash
pnpm --filter api add ioredis
```

Env: `REDIS_URL: z.url(),` with `.env` value `REDIS_URL=redis://localhost:6379/0`.

`apps/api/src/lib/redis.ts`:

```tsx
import { Redis, type RedisOptions } from 'ioredis';
import { env } from '@/config/env';
import { onShutdown } from './lifecycle';
import { logger } from './logger';

export const createRedis = (name: string, options: RedisOptions = {}) => {
  const client = new Redis(env.REDIS_URL, { connectionName: name, ...options });
  client.on('error', (err) => logger.error({ err, name }, 'Redis error'));
  onShutdown(() => client.quit());
  return client;
};

export const redis = createRedis('main');
```

`apps/api/src/modules/health/health.routes.ts`:

```tsx
import { sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@/db';
import { AppError } from '@/lib/errors';
import { redis } from '@/lib/redis';
import { route } from '@/lib/route';
import { noInput } from '@/lib/schemas';

const checks = {
  database: () => db.execute(sql`select 1`),
  redis: () => redis.ping(),
};

const readiness = async () => {
  const report = Object.fromEntries(
    await Promise.all(
      Object.entries(checks).map(async ([name, check]) => [
        name,
        await check().then(
          () => 'up',
          () => 'down',
        ),
      ]),
    ),
  );
  if (Object.values(report).includes('down')) {
    throw new AppError(503, 'Service not ready', 'NOT_READY', report);
  }
  return report;
};

export const healthRouter = Router()
  .get(
    '/live',
    route(noInput, () => ({ status: 'ok' })),
  )
  .get('/ready', route(noInput, readiness));
```

> **Liveness** = "is the process alive?" (restart it if not). **Readiness** = "can it serve traffic?" (remove it from the load balancer if not). Mixing them causes restart storms when the DB blips.

**Done when:** `/health/ready` returns `{ database: "up", redis: "up" }`, and after `docker compose stop redis` it returns 503 while `/health/live` stays 200.

**Commit:**

```bash
git add .
git commit -m "feat(api): add redis client factory and readiness probe"
```

---

### Step 2.4 — Test harness

**Goal:** Real integration tests against real Postgres and Redis (no mocks for infrastructure), with a clean slate before each test.

**Setup (done for you):**

```bash
pnpm --filter api add -D vitest vite-tsconfig-paths supertest @types/supertest
```

`apps/api/.env.test` (committed; local-only values, no secrets):

```
NODE_ENV=test
LOG_LEVEL=silent
DATABASE_URL=postgres://ticketrush:ticketrush@localhost:5432/ticketrush_test
REDIS_URL=redis://localhost:6379/1
```

`apps/api/vitest.config.ts`:

```tsx
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

process.loadEnvFile('.env.test');

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // files share one database
    hookTimeout: 30_000,
  },
});
```

`apps/api/test/global-setup.ts`:

```tsx
import { runMigrations } from '../src/db/migrate';

export default () => runMigrations(process.env.DATABASE_URL!);
```

`apps/api/test/setup.ts`:

```tsx
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach } from 'vitest';
import { db } from '@/db';
import { runShutdownTasks } from '@/lib/lifecycle';
import { redis } from '@/lib/redis';

beforeEach(async () => {
  await db.execute(sql`
    DO $$ BEGIN
      EXECUTE (
        SELECT 'TRUNCATE ' || string_agg(format('%I', tablename), ', ') || ' RESTART IDENTITY CASCADE'
        FROM pg_tables WHERE schemaname = 'public'
      );
    END $$;
  `);
  await redis.flushdb();
});

afterAll(runShutdownTasks);
```

`apps/api/test/helpers.ts`:

```tsx
import request from 'supertest';
import { createApp } from '@/app';

export const api = request(createApp());
```

`apps/api/test/health.test.ts`:

```tsx
import { describe, expect, it } from 'vitest';
import { api } from './helpers';

describe('health', () => {
  it('reports liveness', async () => {
    const res = await api.get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('reports readiness of dependencies', async () => {
    const res = await api.get('/health/ready');
    expect(res.body.data).toEqual({ database: 'up', redis: 'up' });
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await api.get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
  });
});
```

Scripts: `"test": "vitest run", "test:watch": "vitest"`.

**Done when:** `pnpm --filter api test` is green.

**Commit:**

```bash
git add .
git commit -m "test(api): add vitest integration harness with isolated test database"
```

---

## Phase 3 — Data model

> Schema design **is** business logic, so this phase is yours. Follow the `users` table pattern. Put each domain in its own file under `db/schema/` and re-export it from `index.ts`.

### Step 3.1 — Catalog tables

**Goal:** Model venues, their physical seats, events, shows, and **per-show seat inventory**.

**Your task:** Create `venues.ts`, `events.ts` and `shows.ts` in `db/schema/` with these tables:

| Table        | Columns                                                                                                                                                                                                                                 | Constraints / indexes                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `venues`     | `id`, `name`, `city`, `address?`, timestamps                                                                                                                                                                                            | index on `city`                                                                          |
| `seats`      | `id`, `venueId` → venues (cascade), `section`, `row`, `number` (int), `tier` (enum `seat_tier`: standard/premium/vip)                                                                                                                   | **unique** (`venueId`, `section`, `row`, `number`)                                       |
| `events`     | `id`, `title`, `description`, `durationMinutes`, timestamps                                                                                                                                                                             |                                                                                          |
| `shows`      | `id`, `eventId` → events, `venueId` → venues, `startsAt`, `salesOpenAt`, `status` (enum `show_status`: scheduled/cancelled), `isHighDemand` (bool, default false), `pricing` (jsonb: `{ standard, premium, vip }` in paise), timestamps | index on (`startsAt`, `id`)                                                              |
| `show_seats` | `id`, `showId` → shows (cascade), `seatId` → seats, `priceCents` (int), `status` (enum `show_seat_status`: available/reserved/booked), `bookingId?` (FK added in 3.2), `version` (int, default 0)                                       | **unique** (`showId`, `seatId`), index (`showId`, `status`), **check** `priceCents >= 0` |

Then generate and apply: `pnpm --filter api db:generate --name catalog && pnpm --filter api db:migrate`.

**Hints:**

- Table-level constraints use the array syntax: `pgTable('seats', {...}, (t) => [unique().on(t.venueId, t.section, t.row, t.number)])`.
- Type the jsonb column: `jsonb().$type<Record<SeatTier, number>>().notNull()`.
- **Why `show_seats` exists:** a _seat_ is physical (Row A, Seat 12). _Inventory_ is per show. The same seat is sold separately for every show, and locking happens on these rows.
- **Why copy `priceCents` onto `show_seats`:** price snapshots. Changing a venue's pricing later must not change what past bookings cost.
- **Why no `on_sale` / `sold_out` status:** they're **derived** (`salesOpenAt <= now < startsAt`, count of available seats). Storing derived state means keeping it in sync forever. Store facts, derive the rest.
- The `(showId, status)` index makes "available seats for show X" an index scan.

**Done when:** The migration applies cleanly and `pnpm --filter api test` still passes.

**Commit:**

```bash
git add .
git commit -m "feat(db): add venues, seats, events, shows and show seat inventory"
```

---

### Step 3.2 — Booking & payment tables

**Goal:** Model bookings, their line items, payments, and webhook deduplication.

**Your task:** Create `bookings.ts` and `payments.ts`:

| Table                      | Columns                                                                                                                                                                              | Constraints / indexes                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `bookings`                 | `id`, `userId` → users, `showId` → shows, `status` (enum `booking_status`: pending/confirmed/expired/cancelled), `totalCents`, `currency` (default `'INR'`), `expiresAt`, timestamps | index (`status`, `expiresAt`), index (`userId`)                    |
| `booking_items`            | `bookingId` → bookings (cascade), `showSeatId` → show_seats, `priceCents`                                                                                                            | **primary key** (`bookingId`, `showSeatId`)                        |
| `payments`                 | `id`, `bookingId` → bookings, `providerIntentId` (unique), `amountCents`, `status` (enum `payment_status`: processing/succeeded/failed/refund_pending), timestamps                   | **partial unique index** on `bookingId` where `status <> 'failed'` |
| `processed_webhook_events` | `id` (text, PK: the provider's event id), `receivedAt`                                                                                                                               |                                                                    |

Also add the FK `show_seats.bookingId → bookings.id` (on delete set null).

**Hints:**

- Circular import between `shows.ts` and `bookings.ts`? Use a lazy reference: `bookingId: uuid().references((): AnyPgColumn => bookings.id, { onDelete: 'set null' })`.
- Composite PK: `(t) => [primaryKey({ columns: [t.bookingId, t.showSeatId] })]`.
- Partial unique index: `uniqueIndex().on(t.bookingId).where(sql\`${t.status} <> 'failed'`)`. It makes "two in-flight payments for one booking" **impossible at the database level**, even under races in your code.
- `(status, expiresAt)` exists for the sweeper query in Phase 9: "pending bookings that expired".
- `refund_pending` is for the nasty edge case in 8.3: payment succeeds _after_ the booking already expired.

**Done when:** Migration applies; tests pass.

**Commit:**

```bash
git add .
git commit -m "feat(db): add bookings, booking items, payments and webhook dedup tables"
```

---

## Phase 4 — Authentication

### Step 4.1 — Auth primitives

**Goal:** All the reusable security building blocks, so auth _logic_ (yours) stays small.

**Setup (done for you):**

```bash
pnpm --filter api add jose @node-rs/argon2 cookie-parser
pnpm --filter api add -D @types/cookie-parser
```

Env additions:

```tsx
JWT_ACCESS_SECRET: z.string().min(32),
JWT_ACCESS_TTL: z.string().default('15m'),
REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
```

Generate a secret with `openssl rand -base64 48`, and add a (different) one to `.env.test` too.

`apps/api/src/lib/crypto.ts`:

```tsx
import { hash, verify } from '@node-rs/argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const hashPassword = (plain: string) => hash(plain); // argon2id by default
export const verifyPassword = (hashed: string, plain: string) => verify(hashed, plain);

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const hmacSign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

/** Constant-time comparison: prevents timing attacks on secrets/signatures. */
export const safeEqual = (a: string, b: string) => {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
};
```

`apps/api/src/lib/jwt.ts`:

```tsx
import { jwtVerify, SignJWT } from 'jose';
import { env } from '@/config/env';
import type { Role } from '@/db/schema';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export type AuthUser = { id: string; role: Role };

export const signAccessToken = ({ id, role }: AuthUser) =>
  new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret);

export const verifyAccessToken = async (token: string): Promise<AuthUser> => {
  const { payload } = await jwtVerify<{ role: Role }>(token, secret, { algorithms: ['HS256'] });
  return { id: payload.sub!, role: payload.role };
};
```

`apps/api/src/types/express.d.ts`:

```tsx
import type { AuthUser } from '@/lib/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
```

`apps/api/src/middlewares/auth.ts`:

```tsx
import type { Request, RequestHandler } from 'express';
import type { Role } from '@/db/schema';
import { Errors } from '@/lib/errors';
import { verifyAccessToken } from '@/lib/jwt';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw Errors.unauthorized('Missing access token');
  req.user = await verifyAccessToken(token).catch(() => {
    throw Errors.unauthorized('Invalid or expired access token');
  });
  next();
};

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw Errors.forbidden();
    next();
  };

/** Typed accessor for handlers behind `authenticate`. */
export const currentUser = (req: Request) => {
  if (!req.user) throw Errors.unauthorized();
  return req.user;
};
```

`apps/api/src/db/errors.ts`:

```tsx
// Drizzle wraps driver errors, so the Postgres code may live on `cause`.
const pgCode = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
};

export const isUniqueViolation = (err: unknown) => pgCode(err) === '23505';
```

`apps/api/src/modules/auth/auth.cookies.ts`:

```tsx
import type { CookieOptions, Request, Response } from 'express';
import { env, isProd } from '@/config/env';

const NAME = 'refresh_token';
const options: CookieOptions = {
  httpOnly: true, // unreadable by JS → safe from XSS token theft
  secure: isProd,
  sameSite: 'strict',
  path: '/api/v1/auth', // only sent to auth endpoints
};

export const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(NAME, token, { ...options, maxAge: env.REFRESH_TTL_DAYS * 86_400_000 });
export const clearRefreshCookie = (res: Response) => res.clearCookie(NAME, options);
export const readRefreshCookie = (req: Request): string | undefined => req.cookies?.[NAME];
```

In `app.ts`, add `cookieParser()` right after `express.json(...)`.

Test helper to append to `test/helpers.ts` (fast users without going through HTTP):

```tsx
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/crypto';
import { signAccessToken } from '@/lib/jwt';

export const TEST_PASSWORD = 'Password123!';
const passwordHash = hashPassword(TEST_PASSWORD); // hash once, reuse (argon2 is slow on purpose)

export const createUser = async (overrides: Partial<typeof users.$inferInsert> = {}) => {
  const [user] = await db
    .insert(users)
    .values({
      email: `${randomUUID()}@test.dev`,
      name: 'Test User',
      passwordHash: await passwordHash,
      ...overrides,
    })
    .returning();
  const token = await signAccessToken({ id: user!.id, role: user!.role });
  return { user: user!, auth: { authorization: `Bearer ${token}` } };
};
```

**Done when:** `pnpm typecheck` passes.

**Commit:**

```bash
git add .
git commit -m "feat(api): add auth primitives (argon2, jwt, cookies, guards)"
```

---

### Step 4.2 — Register + login

**Goal:** Secure signup and login that issue a short-lived access token (JSON) plus a long-lived refresh token (httpOnly cookie).

**Your task:**

- Create `auth.schema.ts`, `auth.service.ts` and `auth.routes.ts` in `modules/auth/`, and mount the router at `/auth` in `routes.ts`.
- `POST /api/v1/auth/register` takes `{ name, email, password }` and returns `201 { user, accessToken }`, plus the refresh cookie.
- `POST /api/v1/auth/login` takes `{ email, password }` and returns `200 { user, accessToken }`, plus the refresh cookie.
- Export from the service: `register(input)` and `login(input)`, both returning `{ user, accessToken, refreshToken }`. The **route** sets the cookie; the service never sees `res`.
- For now, the refresh token can be `randomToken()` without storage. Step 4.3 persists it.

**Hints:**

- Normalize email in the schema (trim + lowercase). Cap password length (e.g. 8–128) so nobody makes you hash a 10 MB string.
- **Don't check-then-insert** for duplicate emails (race condition). Insert and catch `isUniqueViolation(err)`, then throw `Errors.conflict('Email already registered')`.
- Login errors must be identical for "no such email" and "wrong password" (`Invalid credentials`), otherwise attackers can enumerate accounts.
- Timing leaks too: if the user doesn't exist, still run `verifyPassword` against a dummy hash so both paths take the same time.
- Never return `passwordHash`. Write one `toPublicUser(user)` mapper (or select explicit columns) and reuse it.
- Both endpoints end the same way ("issue a session"). Write that once: `issueSession(user)`.

**Done when:** Tests cover register 201, duplicate email 409, login 200, wrong password 401 with the same message as unknown email, and validation 422.

**Commit:**

```bash
git add .
git commit -m "feat(auth): add registration and login with argon2id and jwt"
```

---

### Step 4.3 — Refresh rotation + reuse detection + logout

**Goal:** Revocable sessions with **refresh token rotation** and **reuse detection**, the OAuth 2.0 security BCP pattern. If a stolen refresh token is ever replayed, the whole session family gets killed.

**Your task:**

- Add a `refresh_tokens` table: `id`, `userId` → users (cascade), `tokenHash` (unique), `familyId` (uuid), `expiresAt`, `revokedAt?`, `createdAt`, with an index on `familyId`. Generate a migration.
- Update `issueSession` to store `sha256(refreshToken)` with a new `familyId` on login/register.
- `POST /auth/refresh` reads the cookie and returns `{ accessToken }` plus a **new** refresh cookie.
- `POST /auth/logout` revokes the family, clears the cookie, and returns `204`like `{ data: null }`.
- Export `refresh(token)` and `logout(token)` from the service.

**Hints:**

- Store only the **hash** of refresh tokens. A DB leak must not leak live sessions (same idea as passwords, but SHA-256 is fine because tokens are high-entropy random).
- The refresh flow:
  1. Hash the cookie token and look it up. If it's not found, return 401.
  2. If it's **already revoked**, that's reuse, and someone replayed an old token. Revoke **every** token in its `familyId` and return 401.
  3. If it's expired, return 401.
  4. Otherwise, in a transaction, revoke the current token and insert a new one with the **same** `familyId`.
- Race: two tabs refresh at the same instant with the same token. Use `UPDATE … SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id`, and only the request that gets a row back proceeds. (Bonus: a small grace window for the loser instead of nuking the family. Mention it in an ADR.)
- `clearCookie` must use the same `path`/options as `setCookie`, or the browser won't delete it. The helpers already handle this.

**Done when:** Tests prove that refresh returns a new token, the old token can't be reused (401), reusing it also revokes the newest token in the family, and logout revokes the session.

**ADR:** `0001-refresh-token-rotation.md`.

**Commit:**

```bash
git add .
git commit -m "feat(auth): add refresh token rotation with reuse detection and logout"
```

---

### Step 4.4 — `/me` + admin guard

**Goal:** Prove the guards work end-to-end.

**Your task:**

- `GET /auth/me` (behind `authenticate`) returns the public user.
- Add a test for `authorize('admin')` on any admin-only route (you'll create the first one in 5.2, so add the test then if you prefer).

**Hints:** Use `currentUser(req)` inside the handler: `route(noInput, (_input, { req }) => getMe(currentUser(req).id))`.

**Done when:** Tests cover no token → 401, bad token → 401, valid → 200.

**Commit:**

```bash
git add .
git commit -m "feat(auth): add current user endpoint"
```

---

## Phase 5 — Catalog

### Step 5.1 — Shared schema & pagination helpers

**Goal:** Reusable pieces every list/detail endpoint needs, written once.

**Setup (done for you):** append to `apps/api/src/lib/schemas.ts`:

```tsx
export const idParams = z.object({ params: z.object({ id: z.uuid() }) });
```

`apps/api/src/lib/pagination.ts`:

```tsx
import { z } from 'zod';
import { Errors } from './errors';

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const encodeCursor = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export const decodeCursor = <T>(cursor?: string): T | undefined => {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString()) as T;
  } catch {
    throw Errors.badRequest('Invalid cursor');
  }
};

/** Query `limit + 1` rows, then pass them here: the extra row tells us if there's a next page. */
export const paginate = <T>(rows: T[], limit: number, toCursor: (last: T) => unknown) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? encodeCursor(toCursor(items.at(-1)!)) : null };
};
```

**Commit:**

```bash
git add .
git commit -m "feat(api): add shared id params and cursor pagination helpers"
```

---

### Step 5.2 — Venues with seat layouts

**Goal:** An admin creates a venue _and_ its full seat layout in one request, atomically.

**Your task:** Create the `modules/venues/` module with:

- `POST /venues` (admin only). The body looks like this:

  ```json
  {
    "name": "JLN Arena",
    "city": "Delhi",
    "sections": [
      { "name": "Floor", "rows": 10, "seatsPerRow": 20, "tier": "vip" },
      { "name": "Balcony", "rows": 15, "seatsPerRow": 30, "tier": "standard" }
    ]
  }
  ```

  It returns `201` with the venue and a seat count.

- `GET /venues/:id` returns the venue with a per-section summary.
- Export `createVenue(input)` and `getVenue(id)`.

**Hints:**

- Generate row labels `A, B, C…` with `String.fromCharCode(65 + i)` (think about what happens after `Z`).
- Build all seats with `flatMap` and insert them in **one** statement: `tx.insert(seats).values(allSeats)`. Never insert rows in a loop (that's N round trips).
- Venue + seats go in **one transaction**. A venue with half its seats is corrupt data.
- Guard the total with `.superRefine()` (e.g. max 5,000 seats) so one request can't insert a million rows. Also keep Postgres's 65,535 bind-parameter limit in mind.
- Test that a non-admin gets 403 (this covers step 4.4's pending test).

**Done when:** Tests pass for creation, seat count, 403 for non-admin, and 422 for an invalid layout.

**Commit:**

```bash
git add .
git commit -m "feat(catalog): add venue creation with generated seat layouts"
```

---

### Step 5.3 — Events & shows + seat inventory

**Goal:** Creating a show generates its entire seat inventory in a **single SQL statement**, whether the venue has 50 seats or 50,000.

**Your task:**

- Create `modules/events/`: `POST /events` (admin) and `GET /events/:id`. Export `createEvent(input)`.
- Create `modules/shows/`: `POST /shows` (admin) with `{ eventId, venueId, startsAt, salesOpenAt, pricing: { standard, premium, vip }, isHighDemand? }`. Export `createShow(input)`.
- In one transaction, insert the show and then generate its `show_seats` from the venue's `seats`, pricing each by tier.

**Hints:**

- The key move is `INSERT INTO show_seats (show_id, seat_id, price_cents) SELECT … FROM seats WHERE venue_id = $1`. Drizzle supports this with `tx.insert(showSeats).select(...)`, or you can use the `sql` template.
- Price by tier straight from the jsonb inside SQL: `(${pricing}::jsonb ->> seats.tier::text)::int`.
- Validate in Zod: `salesOpenAt < startsAt`, `startsAt` in the future, and non-negative integer prices (`z.coerce.date()` for dates).
- Verify `eventId`/`venueId` exist. A FK violation will throw anyway; you can map it to a 404/422 using the same `pgCode` idea as `isUniqueViolation` (`23503`). If you do, extend `db/errors.ts` instead of duplicating it.

**Done when:** Tests show that creating a show on a 100-seat venue yields exactly 100 `available` show seats with correct tier prices.

**Commit:**

```bash
git add .
git commit -m "feat(catalog): add events and shows with set-based seat inventory generation"
```

---

### Step 5.4 — Browse shows (keyset pagination)

**Goal:** A public, paginated show listing that stays fast at page 10,000.

**Your task:**

- `GET /shows?city=&from=&limit=&cursor=` returns upcoming, non-cancelled shows with event title and venue name/city, ordered by `startsAt`.
- `GET /shows/:id` returns a single show with event and venue details and a derived `onSale` boolean.
- Export `listShows(query)` and `getShow(id)`.

**Hints:**

- Use **keyset** (cursor) pagination, not `OFFSET`. `OFFSET 100000` makes Postgres read and throw away 100k rows; keyset jumps straight there via the index.
- The cursor is the last row's `(startsAt, id)`. `id` breaks ties between shows at the same time.
- The row comparison is `sql\`(${shows.startsAt}, ${shows.id}) > (${c.startsAt}, ${c.id})``, and it uses your` (startsAt, id)` index.
- Fetch `limit + 1` rows, then `paginate(rows, limit, (last) => ({ startsAt: last.startsAt, id: last.id }))`.
- Compute `onSale` in one place (a small function) since you'll need it again in holds.

**Done when:** Tests show that paging through 25 shows with `limit=10` returns 10, 10, 5 with no duplicates and `nextCursor: null` at the end.

**Commit:**

```bash
git add .
git commit -m "feat(catalog): add show listing with keyset pagination"
```

---

### Step 5.5 — Seat map

**Goal:** The data behind the seat picker UI, in one efficient query.

**Your task:**

- `GET /shows/:id/seats` returns a flat list of `{ id (showSeatId), section, row, number, tier, priceCents, status }`, sorted by section, row and number.
- Export `getSeatMap(showId)`.

**Hints:**

- One query: `show_seats` joined to `seats`, selecting only the columns the UI needs.
- Return a flat list and let the client group it. It's smaller over the wire and simpler on the server.
- In Phase 6 you'll overlay Redis holds on this, so keep the function easy to extend.

**Done when:** Tests pass for correct count, sort order, and 404 for an unknown show.

**Commit:**

```bash
git add .
git commit -m "feat(catalog): add show seat map endpoint"
```

---

### Step 5.6 — Seed script

**Goal:** `pnpm db:seed` gives you a realistic local dataset in seconds.

**Setup (done for you):** `apps/api/src/scripts/seed.ts`. Adjust the input shapes if yours differ:

```tsx
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { runShutdownTasks } from '@/lib/lifecycle';
import { register } from '@/modules/auth/auth.service';
import { createEvent } from '@/modules/events/events.service';
import { createShow } from '@/modules/shows/shows.service';
import { createVenue } from '@/modules/venues/venues.service';

const DAY = 86_400_000;

const { user: admin } = await register({
  name: 'Admin',
  email: 'admin@ticketrush.dev',
  password: 'Admin123!',
});
await db.update(users).set({ role: 'admin' }).where(eq(users.id, admin.id));

const venue = await createVenue({
  name: 'JLN Arena',
  city: 'Delhi',
  sections: [
    { name: 'Floor', rows: 5, seatsPerRow: 20, tier: 'vip' },
    { name: 'Lower', rows: 10, seatsPerRow: 25, tier: 'premium' },
    { name: 'Upper', rows: 10, seatsPerRow: 30, tier: 'standard' },
  ],
});

const event = await createEvent({
  title: 'Arijit Live',
  description: 'An evening of music',
  durationMinutes: 180,
});

for (const [i, isHighDemand] of [false, false, true].entries()) {
  await createShow({
    eventId: event.id,
    venueId: venue.id,
    startsAt: new Date(Date.now() + (i + 7) * DAY),
    salesOpenAt: new Date(),
    pricing: { standard: 99_900, premium: 249_900, vip: 499_900 },
    isHighDemand,
  });
}

console.log('Seeded: admin@ticketrush.dev / Admin123!');
await runShutdownTasks();
```

Script: `"db:seed": "tsx --env-file=.env src/scripts/seed.ts"`. To reset the database: `docker compose down -v && pnpm infra:up && pnpm --filter api db:migrate && pnpm --filter api db:seed`.

**Your task:** Make it run against your services, and fix any shape mismatches.

**Commit:**

```bash
git add .
git commit -m "chore(db): add development seed script"
```

---

## Phase 6 — Seat holds (the heart)

### Step 6.1 — Redis script helper

**Goal:** Run Lua scripts atomically in Redis, efficiently (EVALSHA, sending only the hash) with automatic fallback.

**Setup (done for you):** `apps/api/src/lib/redis-script.ts`:

```tsx
import { createHash } from 'node:crypto';
import { redis } from './redis';

/** Defines a Lua script once; calls use EVALSHA and fall back to EVAL if Redis hasn't cached it. */
export const defineScript = <T = unknown,>(lua: string) => {
  const sha = createHash('sha1').update(lua).digest('hex');
  return async (keys: string[], args: (string | number)[] = []): Promise<T> => {
    try {
      return (await redis.evalsha(sha, keys.length, ...keys, ...args)) as T;
    } catch (err) {
      if (!(err instanceof Error) || !err.message.startsWith('NOSCRIPT')) throw err;
      return (await redis.eval(lua, keys.length, ...keys, ...args)) as T;
    }
  };
};
```

Env additions:

```tsx
HOLD_TTL_SECONDS: z.coerce.number().int().positive().default(300),
MAX_SEATS_PER_HOLD: z.coerce.number().int().positive().default(6),
```

**Commit:**

```bash
git add .
git commit -m "feat(api): add atomic redis lua script helper"
```

---

### Step 6.2 — Hold seats atomically

**Goal:** When 5,000 people click the same seat, **exactly one** wins, with **all-or-nothing** semantics for multi-seat selections.

**Your task:** Create `modules/holds/`:

- `POST /shows/:id/holds` (authenticated) with `{ showSeatIds: uuid[] }` (1..`MAX_SEATS_PER_HOLD`, unique).
  - On success, return `201 { holdId, showSeatIds, expiresAt }`.
  - If any seat is taken, return `409` with code `SEATS_UNAVAILABLE` and `details: { showSeatIds: [...taken] }`, so the UI can highlight exactly which seats lost.
- Export `holdSeats(userId, showId, showSeatIds)`.
- Write the Lua script in `holds.scripts.ts` using `defineScript`.

**Rules to enforce:**

1. The show exists, isn't cancelled, and is on sale (reuse your `onSale` function).
2. All seats belong to this show and are `available` in Postgres (one query, compare counts). This is a cheap pre-check; Postgres re-verifies later.
3. **One active hold per user per show.** A new hold replaces the old one (or reject it; your call, but document it).
4. The Lua script holds **every** seat or **none**.

**Hints:**

- Suggested keys:
  - `hold:{<showId>}:seat:<showSeatId>` → `holdId` (one per seat, TTL = `HOLD_TTL_SECONDS`)
  - `hold:{<showId>}:meta:<holdId>` → JSON `{ userId, showSeatIds }` (same TTL)
  - `hold:{<showId>}:user:<userId>` → `holdId` (same TTL)
- The `{showId}` braces are a **Redis Cluster hash tag**: every key of a show lands on the same shard, so a multi-key Lua script stays legal if you ever scale out. It's a great detail to mention in an interview.
- Script shape, in two passes: first check everything, then write everything.

  ```lua
  -- KEYS = seat keys..., ARGV = { holdId, ttlMs }
  local taken = {}
  for i, key in ipairs(KEYS) do
    if redis.call('EXISTS', key) == 1 then table.insert(taken, i) end
  end
  if #taken > 0 then return taken end
  -- second pass: SET each key to holdId with PX ttl …
  return {}
  ```

- **Why Lua and not `MULTI/EXEC`?** A transaction can't branch on data it reads ("if any exists, abort"), so you'd need `WATCH` plus retry loops. Lua runs atomically in Redis's single thread: no interleaving and no retries.
- Return indexes (or ids) of taken seats, map them back to `showSeatIds` in TypeScript, and throw the 409.
- `holdId = randomUUID()`, `expiresAt = now + TTL`.

**Done when:** A single hold works; holding a taken seat returns 409 with the right ids; holding 7 seats returns 422.

**ADR:** `0002-seat-holds-in-redis.md` (why holds live in Redis with TTLs instead of rows in Postgres: speed, automatic expiry, and no write amplification on the DB during a stampede).

**Commit:**

```bash
git add .
git commit -m "feat(holds): add atomic all-or-nothing seat holds with redis lua"
```

---

### Step 6.3 — Release holds + seat map overlay

**Goal:** Users can release holds safely, and the seat map shows held seats.

**Your task:**

- `DELETE /holds/:id` (authenticated, owner only) releases the hold.
- Export `releaseHold(showId, holdId)`, which you'll reuse after booking in 7.2.
- Update `getSeatMap` so seats that are `available` in Postgres but held in Redis show as `held`. Never reveal _who_ holds them.

**Hints:**

- Release with **compare-and-delete** in Lua: delete a seat key **only if its value is still this `holdId`**.
  - Why: your hold might have expired and **someone else** now holds that seat. A blind `DEL` would silently free _their_ hold. This is the classic distributed-lock bug (it's in the Redlock docs). Say this in interviews.
- Get the show id for a hold from the meta key. Return 404 if the hold is gone or belongs to someone else (404, not 403, so you don't leak existence).
- Overlay: one `MGET` over all seat keys for the show. It's a single round trip even for thousands of keys; chunk it if the venue is huge.

**Done when:** Tests cover release frees seats, releasing someone else's hold returns 404, and the seat map shows `held`.

**Commit:**

```bash
git add .
git commit -m "feat(holds): add safe hold release and held-seat overlay on seat map"
```

---

### Step 6.4 — Concurrency tests

**Goal:** **Prove** correctness under contention. These are the most impressive tests in your repo.

**Your task:** In `test/holds.concurrency.test.ts`:

1. **Same seat, 50 users:** create 50 users, fire 50 hold requests for the same seat with `Promise.all`, and assert exactly **one** 201 and **49** 409s.
2. **Overlapping selections:** user A wants seats [1,2], user B wants [2,3], fired concurrently. Assert they never both succeed, and that the loser holds **nothing** (all-or-nothing).
3. **Expiry:** set a tiny TTL (via Redis `PEXPIRE` in the test, or a test env var), wait, and assert the seat is holdable again.

**Hints:** Use `createUser()` from the helpers, run `Promise.all(users.map(...))`, and count statuses.

**Done when:** All three pass reliably, 10 runs in a row.

**Commit:**

```bash
git add .
git commit -m "test(holds): prove exactly-one-winner semantics under concurrent requests"
```

---

## Phase 7 — Bookings

### Step 7.1 — Idempotency middleware

**Goal:** A retried or double-clicked request **never** creates two bookings or two charges. This is the exact mechanism Stripe uses (the `Idempotency-Key` header, now an IETF draft standard).

**Your task:** Create `middlewares/idempotency.ts` exporting `idempotent()`, and use it on `POST /bookings` and later `POST /bookings/:id/pay`.

**Behavior:**

| Situation                           | Response                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Missing `Idempotency-Key` header    | `400`                                                                    |
| First time seeing key               | Process normally, store the response                                     |
| Same key, request still in progress | `409` code `REQUEST_IN_PROGRESS`                                         |
| Same key, finished                  | Replay the stored status + body, with header `Idempotent-Replayed: true` |
| Same key, **different** payload     | `422` code `IDEMPOTENCY_KEY_REUSED`                                      |
| Original request failed with 5xx    | Delete the key so the client can retry                                   |

**Hints:**

- Scope the key per user: `idem:<userId>:<key>`. Validate the key's length (8–255 chars; clients usually send a UUID).
- Fingerprint = `sha256(method + path + JSON.stringify(body))`.
- Claim atomically: `SET key '{"state":"processing","fingerprint":…}' NX EX 86400`. `NX` is the whole trick: only one request can claim a key.
- Capture the response by wrapping `res.json` before calling `next()`:

  ```tsx
  const json = res.json.bind(res);
  res.json = (body) => {
    captured = body;
    return json(body);
  };
  ```

  Then, on `res.on('finish')`, store `{ state: 'completed', status: res.statusCode, body: captured }` (or delete the key on 5xx).

- It depends on `req.user`, so mount it after `authenticate`.

**Done when:** Tests cover the same key twice (one booking, identical responses, replay header), the same key with a different body (422), and no key (400).

**ADR:** `0003-idempotency-keys.md`.

**Commit:**

```bash
git add .
git commit -m "feat(api): add idempotency key middleware for unsafe requests"
```

---

### Step 7.2 — Create booking (hold → reserved)

**Goal:** Convert a Redis hold into a durable `pending` booking. **Postgres is the source of truth**: even if Redis lost every key, you still can't double-sell.

**Your task:** Create `modules/bookings/`:

- `POST /bookings` (authenticated + idempotent) with `{ holdId }` returns `201 { booking }`.
- `GET /bookings` lists my bookings (keyset paginated, newest first).
- `GET /bookings/:id` returns my booking with its items (404 if it's not mine).
- Export `createBooking(userId, holdId)`, `listMyBookings(userId, query)` and `getMyBooking(userId, id)`.

Env: `PAYMENT_WINDOW_MINUTES` (default 10).

**The flow:**

1. Load the hold meta from Redis. If it's missing, return `410 HOLD_EXPIRED`. If it's not this user's, return 404.
2. In **one transaction**:
   - Insert the booking (`pending`, `expiresAt = now + PAYMENT_WINDOW`), with an id you generate in the app (`randomUUID()`) so you can reference it immediately.
   - Run a **conditional update**: `UPDATE show_seats SET status='reserved', booking_id=$id, version=version+1 WHERE show_id=$show AND id IN (...) AND status='available' RETURNING id, price_cents`.
   - If the returned row count isn't equal to the requested seat count, throw a `409`, which **rolls back everything**.
   - Insert `booking_items` from the returned rows and set `totalCents` from **DB prices** (never trust client prices).
3. **After commit:** `releaseHold(...)`. Leave `// TODO(9.2): schedule expiry` and `// TODO(10.2): publish seat changes` comments.

**Hints:**

- `WHERE status = 'available'` is an **optimistic, set-based check**. The row lock taken by `UPDATE` means two concurrent transactions can't both flip the same row: the second one waits, re-checks the `WHERE`, and matches 0 rows.
- Why side effects go _after_ commit: if you release the hold and then the transaction rolls back, you've freed seats that aren't booked. The rule is **never do irreversible side effects inside a transaction that might roll back**.
- `inArray(showSeats.id, ids)` and `.returning({...})` are your Drizzle tools here.
- Guard the transition later with the state machine (8.1). For now, statuses are simple.

**Done when:** Tests cover the happy path (seats `reserved`, total correct, hold released), an expired hold (410), and a forced conflict where you manually mark a seat `booked` in the DB before booking (409, and nothing persisted).

**Commit:**

```bash
git add .
git commit -m "feat(bookings): convert holds into pending bookings with conditional seat reservation"
```

---

### Step 7.3 — Locking strategy switch + ADR _(optional, recommended)_

**Goal:** Show you _understand_ the options, not just that one works.

**Your task:** Add `BOOKING_LOCK_STRATEGY=conditional|pessimistic` and implement the pessimistic variant:

- `SELECT … FROM show_seats WHERE id IN (...) ORDER BY id FOR UPDATE`, verify all rows are `available` in TypeScript, then update.

**Hints:**

- `ORDER BY id` gives **consistent lock ordering**, which prevents deadlocks when two transactions lock overlapping seats in different orders. This is a classic interview question.
- Look up `FOR UPDATE NOWAIT` (fail fast) and `SKIP LOCKED` (queue-style work), and explain why neither fits here.
- You'll benchmark both strategies in Phase 13.

**ADR:** `0004-seat-locking-strategy.md` comparing conditional update, `SELECT FOR UPDATE`, version-column optimistic locking, and Redis-only locking.

**Commit:**

```bash
git add .
git commit -m "feat(bookings): add configurable pessimistic locking strategy"
```

---

## Phase 8 — Payments

### Step 8.1 — Mock provider + webhook plumbing

**Goal:** A realistic fake payment provider (PSP) that behaves like Razorpay or Stripe: **asynchronous** settlement, random failures, **retries**, and **duplicate** webhooks. Your code has to survive all of it.

**Setup (done for you):**

Env additions:

```tsx
API_URL: z.url().default('http://localhost:4000'),
PAYMENT_WEBHOOK_SECRET: z.string().min(32),
MOCK_PAYMENT_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.2),
```

`apps/api/src/modules/payments/payments.provider.ts`:

```tsx
import { env } from '@/config/env';
import { hmacSign, randomToken } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export type PaymentEvent = {
  id: string;
  type: 'payment.succeeded' | 'payment.failed';
  data: { intentId: string; bookingId: string; amountCents: number };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Header format: t=<unix seconds>,v1=<hmac(t + "." + body)> (same scheme as Stripe). */
export const signWebhook = (body: string, timestamp = Math.floor(Date.now() / 1000)) =>
  `t=${timestamp},v1=${hmacSign(`${timestamp}.${body}`, env.PAYMENT_WEBHOOK_SECRET)}`;

const deliver = async (event: PaymentEvent) => {
  const body = JSON.stringify(event);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const ok = await fetch(`${env.API_URL}/api/v1/webhooks/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': signWebhook(body) },
      body,
    })
      .then((res) => res.ok)
      .catch(() => false);
    if (ok) return;
    await sleep(2 ** attempt * 500); // exponential backoff, like real PSPs
  }
  logger.error({ eventId: event.id }, 'Mock PSP gave up delivering webhook');
};

/** Simulates a PSP: async settlement, random failures, retries and duplicate deliveries. */
export const paymentProvider = {
  async createIntent({ bookingId, amountCents }: { bookingId: string; amountCents: number }) {
    const intentId = `pi_${randomToken(12)}`;
    const failed = Math.random() < env.MOCK_PAYMENT_FAILURE_RATE;
    const event: PaymentEvent = {
      id: `evt_${randomToken(12)}`,
      type: failed ? 'payment.failed' : 'payment.succeeded',
      data: { intentId, bookingId, amountCents },
    };
    if (env.NODE_ENV !== 'test') {
      setTimeout(
        () => {
          void deliver(event);
          if (Math.random() < 0.1) setTimeout(() => void deliver(event), 1_500); // duplicate
        },
        500 + Math.random() * 2_500,
      );
    }
    return { intentId };
  },
};
```

`apps/api/src/lib/state-machine.ts`:

```tsx
import { Errors } from './errors';

export const createStateMachine = <S extends string>(
  name: string,
  transitions: Record<S, readonly S[]>,
) => {
  const can = (from: S, to: S) => transitions[from].includes(to);
  const assert = (from: S, to: S) => {
    if (!can(from, to)) throw Errors.conflict(`Invalid ${name} transition: ${from} → ${to}`);
  };
  return { can, assert };
};
```

Webhooks need the **raw body** to verify signatures (re-serialized JSON won't match byte-for-byte). In `app.ts`, mount the webhook router **before** `express.json()`:

```tsx
app.use(
  '/api/v1/webhooks',
  express.raw({ type: 'application/json', limit: '100kb' }),
  webhooksRouter,
);
```

`apps/api/src/modules/payments/webhooks.routes.ts`:

```tsx
import { Router } from 'express';
import { route } from '@/lib/route';
import { noInput } from '@/lib/schemas';
import { handlePaymentWebhook } from './payments.service';

export const webhooksRouter = Router().post(
  '/payments',
  route(noInput, (_input, { req }) =>
    handlePaymentWebhook(req.body as Buffer, req.header('x-signature')),
  ),
);
```

Add `PAYMENT_WEBHOOK_SECRET` to `.env` and `.env.test`, and set `MOCK_PAYMENT_FAILURE_RATE=0` in `.env.test`.

**Your task:** Define the two state machines in their services:

- **Booking:** `pending → confirmed | expired | cancelled`. Nothing leaves `confirmed`/`expired`/`cancelled` (for now).
- **Payment:** `processing → succeeded | failed | refund_pending`.

Use `assert` in 7.2's code path as well.

**Commit:**

```bash
git add .
git commit -m "feat(payments): add mock payment provider, webhook plumbing and state machines"
```

---

### Step 8.2 — Start payment

**Goal:** Begin payment for a pending booking, exactly once.

**Your task:**

- `POST /bookings/:id/pay` (authenticated + idempotent) returns `202 { paymentId, status: 'processing' }`.
- Export `startPayment(userId, bookingId)`.

**Rules:** the booking must be mine, `pending` and not expired. If there's already a `processing` payment, return it rather than creating a second intent.

**Hints:**

- **Never hold a DB transaction open across a network call.** Call `paymentProvider.createIntent()` outside any transaction, then insert the `payments` row.
- Your partial unique index (3.2) is the backstop: two racing requests can't both insert a non-failed payment. Catch the unique violation and return the existing payment.
- Why `202 Accepted`? The result is decided later, by the webhook.

**Done when:** Tests pass for happy path (202 + payment row), paying someone else's booking (404), and paying an expired booking (410).

**Commit:**

```bash
git add .
git commit -m "feat(payments): start payments with a single in-flight intent per booking"
```

---

### Step 8.3 — Webhook handler

**Goal:** Process webhooks that may be **forged, replayed, duplicated, reordered or late**, and still end in a correct state.

**Your task:** Implement `handlePaymentWebhook(rawBody, signatureHeader)`:

1. **Verify the signature.** Parse `t` and `v1` from the header, reject if `|now − t| > 300s` (replay protection), recompute `hmacSign(\`${t}.${rawBody}`)`and compare with`safeEqual`. On failure, throw` 400`.
2. **Parse** the body into a `PaymentEvent` (validate with Zod; never trust it).
3. In **one transaction**:
   - **Dedup:** `INSERT INTO processed_webhook_events (id) … ON CONFLICT DO NOTHING RETURNING id`. If no row comes back, it's already processed, so return `{ received: true }`.
   - **Lock the booking row:** `SELECT … FOR UPDATE`. This serializes you against the expiry job (Phase 9).
   - Apply transitions:
     - `payment.succeeded` + booking `pending`: set the payment to `succeeded`, the booking to `confirmed`, and seats `reserved → booked` (`WHERE booking_id = $id`).
     - `payment.succeeded` + booking **already expired**: the seats may have been resold! Set the payment to `refund_pending` and log a warning. **Never** resurrect the booking.
     - `payment.failed`: set the payment to `failed`. The booking stays `pending`, so the user can retry until it expires.
4. Return `200` quickly. Providers retry on non-2xx, so only return errors for genuinely bad requests.

**Hints:**

- Why dedup **inside** the same transaction: if you mark an event processed and then crash before applying it, it's lost forever. Same transaction means both happen or neither does.
- The row lock is the whole race-condition story: "What if the success webhook and the expiry job run at the same millisecond?" Whoever locks first wins; the other sees the new state and does the right thing.
- Put "move seats for booking X from status A to B" in one small function taking an `Executor`. You'll reuse it for confirm, expire and cancel.
- To test, build events yourself and sign them with `signWebhook(body)`, then `api.post('/api/v1/webhooks/payments').set('content-type','application/json').set('x-signature', sig).send(body)`.

**Done when:** Tests cover valid success (booking confirmed, seats booked), the same event twice (processed once), a bad signature (400), a stale timestamp (400), and success after expiry (`refund_pending`, seats untouched).

**ADR:** `0005-webhook-driven-payment-confirmation.md`.

**Commit:**

```bash
git add .
git commit -m "feat(payments): process signed webhooks idempotently with row-level locking"
```

---

## Phase 9 — Background jobs

### Step 9.1 — BullMQ + worker process

**Goal:** A **separate worker process** for background work. API and workers scale independently, which is a core architecture talking point.

**Setup (done for you):**

```bash
pnpm --filter api add bullmq
```

`apps/api/src/lib/queue.ts`:

```tsx
import { Queue, Worker, type Processor } from 'bullmq';
import { onShutdown } from './lifecycle';
import { logger } from './logger';
import { createRedis } from './redis';

const connection = createRedis('bullmq', { maxRetriesPerRequest: null }); // required by BullMQ

export const createQueue = <T>(name: string) => {
  const queue = new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  });
  onShutdown(() => queue.close());
  return queue;
};

export const createWorker = <T>(name: string, processor: Processor<T>, concurrency = 5) => {
  const worker = new Worker<T>(name, processor, { connection, concurrency });
  worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id, name }, 'Job failed'));
  onShutdown(() => worker.close()); // waits for active jobs to finish
  return worker;
};
```

`apps/api/src/jobs/queues.ts`:

```tsx
import { createQueue } from '@/lib/queue';

export type BookingJob = { bookingId?: string };
export const bookingQueue = createQueue<BookingJob>('bookings');
```

`apps/api/src/jobs/bookings.worker.ts`:

```tsx
import { createWorker } from '@/lib/queue';
import type { BookingJob } from './queues';

createWorker<BookingJob>('bookings', async (job) => {
  switch (job.name) {
    // case 'expire':    return expireBooking(job.data.bookingId!);   ← 9.2
    // case 'reconcile': return reconcileExpiredBookings();           ← 9.3
    default:
      throw new Error(`Unknown job: ${job.name}`);
  }
});
```

`apps/api/src/worker.ts`:

```tsx
import '@/jobs/bookings.worker';
import { handleProcessSignals } from '@/lib/lifecycle';
import { logger } from '@/lib/logger';

handleProcessSignals();
logger.info('Worker started');
```

Scripts in `apps/api/package.json`:

```json
"dev:worker": "tsx watch --env-file=.env src/worker.ts",
"start:worker": "node --env-file-if-exists=.env dist/worker.js"
```

Add `'src/worker.ts'` to the tsup `entry`, and `"dev:worker": "pnpm --filter api dev:worker"` to the root scripts.

**Done when:** `pnpm dev:worker` logs "Worker started" and shuts down gracefully on `Ctrl+C`.

**Commit:**

```bash
git add .
git commit -m "feat(jobs): add bullmq queues and a dedicated worker process"
```

---

### Step 9.2 — Expire unpaid bookings

**Goal:** Abandoned checkouts give their seats back automatically at exactly the right time.

**Your task:**

- After a booking commits in 7.2 (replace the TODO), enqueue `bookingQueue.add('expire', { bookingId }, { delay, jobId: \`expire-${bookingId}` })`.
- Export `expireBooking(bookingId)` from the bookings service and wire it into the worker.

**`expireBooking` logic:** in a transaction, lock the booking (`FOR UPDATE`). If it's not `pending`, do nothing (the job is **idempotent**). Otherwise set it to `expired` and move seats `reserved → available`, clearing `booking_id`.

**Hints:**

- `jobId` deduplicates, so enqueueing twice for the same booking is harmless.
- Jobs are delivered **at least once** (a worker can crash after finishing but before acking). Every processor must be safe to run twice, and "if not pending, no-op" gives you that.
- Edge case: a payment is `processing` right at expiry. Options: expire anyway (a late success becomes `refund_pending`, as in 8.3), or grant a short grace period by re-queueing. Pick one and document it.
- Reuse the "move seats for booking" function from 8.3.

**Done when:** A test creates a booking, calls `expireBooking` directly, and asserts the booking is expired and seats are available. A second call is a no-op.

**Commit:**

```bash
git add .
git commit -m "feat(jobs): expire unpaid bookings with idempotent delayed jobs"
```

---

### Step 9.3 — Reconciliation sweeper

**Goal:** A **safety net**. If the process crashes between "commit booking" and "enqueue job", that booking would stay `pending` forever and its seats would be locked for good. This is the **dual-write problem**.

**Your task:**

- Export `reconcileExpiredBookings()`: find up to 100 `pending` bookings with `expiresAt < now() - interval '30 seconds'` and run `expireBooking` for each.
- Register a repeatable job **once** at worker startup: `bookingQueue.upsertJobScheduler('reconcile-expired', { every: 60_000 }, { name: 'reconcile' })`.

**Hints:**

- The `(status, expiresAt)` index from 3.2 makes this query cheap.
- `upsertJobScheduler` is idempotent across restarts and multiple workers, so you get exactly one schedule.
- Mention in your ADR that the textbook fix for dual writes is the **transactional outbox** pattern (listed in the stretch goals). The sweeper is the pragmatic 80/20 solution.

**Done when:** A test inserts an already-expired pending booking directly, runs the sweeper, and sees it expired.

**ADR:** `0006-booking-expiry-and-reconciliation.md`.

**Commit:**

```bash
git add .
git commit -m "feat(jobs): add reconciliation sweeper for missed booking expiries"
```

---

## Phase 10 — Real-time seat map

### Step 10.1 — Pub/sub + SSE helpers

**Goal:** Push seat changes to every viewer, across **every API instance**. Redis pub/sub bridges instances, and Server-Sent Events deliver updates to browsers.

**Setup (done for you):** `apps/api/src/lib/realtime.ts`:

```tsx
import type { Request, Response } from 'express';
import { createRedis, redis } from './redis';

type Listener = (frame: string) => void;

const subscriber = createRedis('subscriber'); // a subscribed connection can't run other commands
const listeners = new Map<string, Set<Listener>>();
subscriber.on('message', (channel: string, frame: string) =>
  listeners.get(channel)?.forEach((listener) => listener(frame)),
);

// Serialize ONCE at publish time; every instance just forwards bytes to N clients.
const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const publish = (channel: string, event: string, data: unknown) =>
  redis.publish(channel, frame(event, data));

const subscribe = async (channel: string, listener: Listener) => {
  let set = listeners.get(channel);
  if (!set) {
    listeners.set(channel, (set = new Set()));
    await subscriber.subscribe(channel);
  }
  set.add(listener);
  return async () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(channel);
      await subscriber.unsubscribe(channel);
    }
  };
};

/** Streams every message on `channel` to this client as Server-Sent Events. */
export const streamChannel = async (
  req: Request,
  res: Response,
  channel: string,
  initial?: { event: string; data: unknown },
) => {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no', // disable proxy buffering (nginx)
  });
  if (initial) res.write(frame(initial.event, initial.data));
  const unsubscribe = await subscribe(channel, (f) => res.write(f));
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000); // keep proxies from timing out
  req.on('close', () => {
    clearInterval(heartbeat);
    void unsubscribe();
  });
};
```

> **Why SSE over WebSockets?** Updates flow one way (server → client). SSE is plain HTTP, auto-reconnects natively, works through proxies, and needs no extra protocol. Write this as `0007-sse-over-websockets.md`.

**Commit:**

```bash
git add .
git commit -m "feat(realtime): add redis pub/sub fan-out and sse streaming helper"
```

---

### Step 10.2 — Live seat map stream

**Goal:** Two browser tabs: select a seat in one and watch it turn grey in the other, instantly.

**Your task:**

- `GET /shows/:id/seats/stream` (public) calls `streamChannel(req, res, \`show:${id}:seats`)`inside`route(...)`. The helper skips the JSON response because headers are already sent.
- Create **one** function, `emitSeatChanges(showId, showSeatIds, status)`, in `modules/shows/seat-events.ts`.
- Call it from every place seats change: hold (`held`), release (`available`), reserve (`reserved`), confirm (`booked`) and expire (`available`). Replace the TODOs from 7.2.

**Hints:**

- One emitter function means one event format and no duplication, and it's grep-able.
- Publish **after** commit, never inside a transaction.
- Holds that expire via Redis TTL emit **nothing**. Options: (a) the client already knows `expiresAt` and reverts locally, (b) Redis keyspace notifications (`notify-keyspace-events Ex`), or (c) accept eventual consistency until the next fetch. Pick one and explain why.
- Test with `curl -N localhost:4000/api/v1/shows/<id>/seats/stream` while holding seats from another terminal.

**Done when:** You see events stream in curl. Then run two API instances on different ports and confirm events cross instances.

**Commit:**

```bash
git add .
git commit -m "feat(realtime): stream live seat status changes over sse"
```

---

## Phase 11 — Protection under load

### Step 11.1 — Rate limiter

**Goal:** Build a distributed **sliding-window** rate limiter from scratch, instead of installing one.

**Your task:** Create `middlewares/rate-limit.ts` exporting `rateLimit({ name, limit, windowSec, key })`, where `key: (req) => string`. Apply it to:

- login: 5/min per `ip + email`
- holds: 10/min per user
- global: 300/min per IP

Env: `RATE_LIMIT_ENABLED: z.stringbool().default(true)` (you'll disable it for the load test).

**Hints:**

- The **sliding window counter** algorithm keeps a counter for the current fixed window and the previous one, then estimates:

  `count = previous × (1 − elapsedInCurrentWindow / window) + current`

  It's accurate enough, uses O(1) memory per key, and has no boundary burst problem (unlike a fixed window).

- Do the read-and-increment in **one Lua script** via `defineScript`, otherwise two instances can race past the limit.
- Set the standard headers: `RateLimit-Limit`, `RateLimit-Remaining` and `Retry-After` (on 429).
- Throw `Errors.tooManyRequests()`.
- Decide what happens if Redis is down: fail open (availability) or fail closed (protection)? Document it.

**Done when:** A test fires 6 logins and gets a 429 on the sixth, with a `Retry-After` header.

**Commit:**

```bash
git add .
git commit -m "feat(api): add redis sliding-window rate limiter"
```

---

### Step 11.2 — Cache-aside for hot reads

**Goal:** During a flash sale, `GET /shows/:id` gets hammered. Cache the static parts and keep the dynamic parts fresh.

**Setup (done for you):** `apps/api/src/lib/cache.ts`:

```tsx
import { redis } from './redis';

/** Cache-aside: return cached JSON, or load, store with TTL, and return. */
export const cached = async <T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> => {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;
  const value = await load();
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return value;
};

export const invalidate = (...keys: string[]) => redis.del(...keys);
```

**Your task:**

- Cache `getShow` for 60 seconds, and cache the **static** seat layout (section/row/number/tier/price) for a long time.
- Keep **statuses uncached**: overlay live status on the cached layout.
- Invalidate on any admin update to that show.

**Hints:**

- Dates come back from JSON as strings. Decide on the boundary where you convert them.
- **Cache stampede:** when a hot key expires, 1,000 requests miss simultaneously and all hit the DB. Look up "single-flight" / request coalescing (a short Redis lock, or an in-process `Map<key, Promise>`). Implementing the in-process version is ~5 lines inside `cached()`.

**Done when:** A second `GET /shows/:id` doesn't hit Postgres (verify via logs or a spy).

**Commit:**

```bash
git add .
git commit -m "perf(catalog): cache hot show reads with cache-aside and targeted invalidation"
```

---

### Step 11.3 — Virtual waiting room

**Goal:** For high-demand shows, users queue **fairly** and are admitted at a controlled rate, exactly how Ticketmaster and BookMyShow handle huge on-sales.

**Your task:**

- `POST /shows/:id/queue` (authenticated) joins the queue and returns `{ ticket, position }`. Rejoining returns the same ticket.
- `GET /shows/:id/queue/stream` streams admission progress over SSE.
- Add a worker-side **admitter** repeatable job (every ~2s) that admits the next `ADMIT_BATCH` users for each high-demand show that's on sale.
- Add a `requireAdmission` middleware on the holds endpoint that returns 403 `NOT_ADMITTED` for high-demand shows without admission.

**The elegant design (an O(1) broadcast):**

- `ticket = INCR queue:{showId}:tail`, stored per user with `SET … NX` so rejoining is stable.
- The admitter advances `queue:{showId}:head` by `ADMIT_BATCH`, never past `tail`, in Lua.
- A user is admitted when `ticket <= head`, and their position is `ticket − head`.
- Publish **only the new `head`** to `queue:{showId}`. Every client computes its own position. One message serves 100,000 waiting users; per-user messages would need 100,000.

**Hints:**

- An admission should expire (e.g. 10 minutes to pick seats). Think about how to stop someone from being "re-admitted" forever once `ticket <= head` is permanently true.
- A sorted set (`ZADD` by join time + `ZRANK`) is the alternative design. Compare them in an ADR (`0008-waiting-room.md`).
- Rate limit the join endpoint so bots can't grab 1,000 tickets.
- `EventSource` can't send an `Authorization` header. The stream only needs the public `head`, so it can be public and each client already knows its ticket.

**Done when:** A test joins 10 users, runs the admitter once with `ADMIT_BATCH=3`, and asserts users 1–3 can hold seats while user 4 gets 403.

**Commit:**

```bash
git add .
git commit -m "feat(queue): add virtual waiting room with o(1) admission broadcasts"
```

---

## Phase 12 — Observability

### Step 12.1 — Prometheus metrics

**Goal:** You can _see_ the system: request latency percentiles and business events.

**Setup (done for you):**

```bash
pnpm --filter api add prom-client
```

`apps/api/src/lib/metrics.ts`:

```tsx
import type { RequestHandler } from 'express';
import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    // Use the route *pattern* (/shows/:id), never the raw URL, or label cardinality explodes.
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
};

export const counter = <L extends string>(
  name: string,
  help: string,
  labelNames: readonly L[] = [],
) => new client.Counter({ name, help, labelNames, registers: [registry] });
```

In `app.ts`, add `metricsMiddleware` right after `httpLogger`, and add the endpoint before `notFound`:

```tsx
app.get('/metrics', async (_req, res) => {
  res.type(registry.contentType).send(await registry.metrics());
});
```

> In production, `/metrics` should be reachable only from inside the network (a separate port or network policy), never publicly.

**Your task:** Add business counters with `counter(...)`:

- `holds_total{result="won|conflict"}`
- `bookings_total{status}` on every transition
- `webhook_events_total{type,result="processed|duplicate|invalid"}`

**Done when:** `curl localhost:4000/metrics` shows your counters changing as you use the app.

**Commit:**

```bash
git add .
git commit -m "feat(observability): expose prometheus http and business metrics"
```

---

## Phase 13 — Proving it (load test)

### Step 13.1 — Load-test fixture + k6 script

**Goal:** Tooling to reproduce a flash sale on demand.

**Setup (done for you):** install k6.

`apps/api/src/scripts/loadtest-fixture.ts`. It creates N users with pre-minted tokens (argon2 per user would take minutes) and exports the target show's seats:

```tsx
import { writeFileSync } from 'node:fs';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { seats, showSeats, users } from '@/db/schema';
import { hashPassword } from '@/lib/crypto';
import { runShutdownTasks } from '@/lib/lifecycle';
import { signAccessToken } from '@/lib/jwt';

const [showId, count = '2000'] = process.argv.slice(2);
if (!showId) throw new Error('Usage: loadtest:fixture <showId> [users]');

const passwordHash = await hashPassword('LoadTest123!');
const created = await db
  .insert(users)
  .values(
    Array.from({ length: Number(count) }, (_, i) => ({
      email: `load-${Date.now()}-${i}@test.dev`,
      name: `Load ${i}`,
      passwordHash,
    })),
  )
  .returning({ id: users.id, role: users.role });

const tokens = await Promise.all(created.map((u) => signAccessToken(u)));
const seatIds = (
  await db
    .select({ id: showSeats.id })
    .from(showSeats)
    .innerJoin(seats, eq(seats.id, showSeats.seatId))
    .where(eq(showSeats.showId, showId))
    .orderBy(asc(seats.section), asc(seats.row), asc(seats.number))
).map((s) => s.id);

writeFileSync(
  new URL('../../../../infra/k6/fixture.json', import.meta.url),
  JSON.stringify({ showId, seatIds, tokens }),
);
console.log(`Fixture: ${tokens.length} users, ${seatIds.length} seats`);
await runShutdownTasks();
```

Script: `"loadtest:fixture": "tsx --env-file=.env src/scripts/loadtest-fixture.ts"`.

`infra/k6/rush.js`:

```jsx
import { check } from 'k6';
import exec from 'k6/execution';
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';

const fixture = JSON.parse(open('./fixture.json'));
const tokens = new SharedArray('tokens', () => fixture.tokens);
const BASE = __ENV.API_URL || 'http://localhost:4000/api/v1';

const holdsWon = new Counter('holds_won');
const holdsLost = new Counter('holds_lost');
const bookingsCreated = new Counter('bookings_created');

http.setResponseCallback(http.expectedStatuses(200, 201, 409));

export const options = {
  scenarios: {
    rush: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 500),
      iterations: tokens.length,
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:hold}': ['p(99)<500'],
  },
};

export default function () {
  const i = exec.scenario.iterationInTest;
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${tokens[i]}` };
  const start = Math.floor(Math.random() * (fixture.seatIds.length - 1));

  const hold = http.post(
    `${BASE}/shows/${fixture.showId}/holds`,
    JSON.stringify({ showSeatIds: fixture.seatIds.slice(start, start + 2) }),
    { headers, tags: { name: 'hold' } },
  );
  check(hold, { 'hold is 201 or 409': (r) => r.status === 201 || r.status === 409 });
  if (hold.status !== 201) return holdsLost.add(1);
  holdsWon.add(1);

  const booking = http.post(
    `${BASE}/bookings`,
    JSON.stringify({ holdId: hold.json('data.holdId') }),
    {
      headers: { ...headers, 'idempotency-key': `rush-${i}-${Date.now()}` },
      tags: { name: 'booking' },
    },
  );
  if (booking.status === 201) bookingsCreated.add(1);
}
```

**Commit:**

```bash
git add .
git commit -m "test(load): add k6 flash-sale scenario and fixture generator"
```

---

### Step 13.2 — Run the rush, publish results

**Goal:** The killer demo, and the number that goes on your resume.

**Your task:**

1. Use a **normal** (not high-demand) show, set `RATE_LIMIT_ENABLED=false` (all k6 traffic shares one IP), and run the API **without** watch mode (`pnpm --filter api build && pnpm --filter api start`).
2. Run `pnpm --filter api loadtest:fixture <showId> 2000`, then `k6 run infra/k6/rush.js`.
3. Verify with the query below. It **must return zero rows**:

   ```sql
   SELECT bi.show_seat_id, count(*)
   FROM booking_items bi
   JOIN bookings b ON b.id = bi.booking_id
   WHERE b.status IN ('pending', 'confirmed')
   GROUP BY bi.show_seat_id
   HAVING count(*) > 1;
   ```

   Run it with `docker compose exec postgres psql -U ticketrush -c "<query>"`.

4. Record p50/p95/p99 for holds and bookings, throughput, and won/lost counts.
5. Repeat with `BOOKING_LOCK_STRATEGY=pessimistic` (7.3) and with **3 API instances** on different ports (point k6 at each via `API_URL`, or put nginx in front).
6. Write everything to `docs/benchmarks.md` with your machine specs.

**Hints:** Tokens expire after `JWT_ACCESS_TTL`, so regenerate the fixture if you wait too long. Watch `/metrics` and Postgres connection counts during the run. Try varying `DB_POOL_MAX` and explain what you see.

**Done when:** You have a table like "2,000 users → 650 seats, 0 double bookings, hold p99 = X ms" in `docs/benchmarks.md`.

**Commit:**

```bash
git add .
git commit -m "docs: publish flash-sale load test results"
```

---

## Phase 14 — Frontend

> The frontend exists to _demo_ the backend. Keep it clean and functional; don't gold-plate it.

### Step 14.1 — Next.js app + shared package

**Goal:** A Next.js app and a `shared` package, so request contracts are defined **once** and used by both API and web.

**Setup (done for you):**

```bash
pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-pnpm
mkdir -p packages/shared/src
```

`packages/shared/package.json`:

```json
{
  "name": "@ticketrush/shared",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc" }
}
```

`packages/shared/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "noEmit": true }, "include": ["src"] }
```

```bash
pnpm --filter @ticketrush/shared add zod
pnpm --filter api --filter web add @ticketrush/shared@workspace:*
```

In `apps/api/tsup.config.ts`, add `noExternal: ['@ticketrush/shared']` so the TypeScript source gets bundled into the build.

`apps/web/next.config.ts`:

```tsx
import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@ticketrush/shared'],
  // Same-origin proxy: the refresh cookie stays first-party and CORS disappears for REST calls.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
```

`apps/web/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000` (used only for SSE, which connects to the API directly to avoid proxy buffering).

Root scripts:

```json
"dev:web": "pnpm --filter web dev",
"dev": "pnpm run --parallel \"/^dev:(api|worker|web)$/\""
```

**Your task:** Move the **request body** schemas the web also needs (register, login, hold, booking) from the API modules into `packages/shared/src/` and export them, plus their `z.infer` types, from `index.ts`. The API's `*.schema.ts` files then compose them: `z.object({ body: loginBody })`.

**Done when:** `pnpm dev` starts API, worker and web together, and `pnpm typecheck` passes for all packages.

**Commit:**

```bash
git add .
git commit -m "feat(web): scaffold next.js app and share request schemas via workspace package"
```

---

### Step 14.2 — API client + SSE hook

**Goal:** One fetch wrapper that attaches tokens, silently refreshes on 401 (once, even with 10 concurrent requests), and throws typed errors.

**Setup (done for you):** `apps/web/src/lib/api.ts`:

```tsx
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

// Single-flight: concurrent 401s share ONE refresh request.
let refreshing: Promise<boolean> | null = null;
export const refreshSession = () =>
  (refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return false;
      setAccessToken((await res.json()).data.accessToken);
      return true;
    })
    .finally(() => (refreshing = null)));

type Options = Omit<RequestInit, 'body'> & { json?: unknown; headers?: Record<string, string> };

export async function api<T>(
  path: string,
  { json, headers, ...init }: Options = {},
  retry = true,
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(json !== undefined && { 'content-type': 'application/json' }),
      ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });

  if (res.status === 401 && retry && (await refreshSession()))
    return api<T>(path, { json, headers, ...init }, false);

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error ?? {};
    throw new ApiError(
      res.status,
      error.code ?? 'UNKNOWN',
      error.message ?? res.statusText,
      error.details,
    );
  }
  return body?.data as T;
}
```

`apps/web/src/hooks/use-event-source.ts`:

```tsx
'use client';
import { useEffect, useEffectEvent } from 'react';

/** Subscribes to one SSE event type; reconnects automatically (native EventSource behaviour). */
export function useEventSource<T>(url: string | null, event: string, onMessage: (data: T) => void) {
  const handle = useEffectEvent((data: T) => onMessage(data));

  useEffect(() => {
    if (!url) return;
    const source = new EventSource(url);
    source.addEventListener(event, (e) => handle(JSON.parse((e as MessageEvent).data)));
    return () => source.close();
  }, [url, event]);
}
```

**Commit:**

```bash
git add .
git commit -m "feat(web): add api client with single-flight token refresh and sse hook"
```

---

### Step 14.3 — Auth + browse pages

**Your task:**

- `/login` and `/register` forms, validated with the shared schemas.
- An auth context (`AuthProvider`) holding the current user. On app load, call `refreshSession()` then `GET /auth/me` to restore the session silently.
- `/` lists upcoming shows with "Load more" using `nextCursor`.
- `/shows/[id]` shows details and an "on sale" badge.

**Hints:** Keep the access token **in memory only** (never `localStorage`, which is readable by any XSS). The httpOnly cookie restores it after reload. That's the whole point of the setup.

**Commit:**

```bash
git add .
git commit -m "feat(web): add auth flow and show browsing pages"
```

---

### Step 14.4 — Live seat map

**Your task:**

- The seat grid on `/shows/[id]` is grouped by section → row with `useMemo`, colored by status and tier.
- Live updates come from `useEventSource(\`${NEXT_PUBLIC_API_URL}/api/v1/shows/${id}/seats/stream`, 'seats', …)`, patching a` Map<showSeatId, status>`.
- Selection is capped at `MAX_SEATS_PER_HOLD`. "Hold seats" calls the API, and on `409` highlights `error.details.showSeatIds` in red.

**Hints:** Apply SSE patches to state keyed by id (O(1) per update), not by re-fetching the whole map.

**Commit:**

```bash
git add .
git commit -m "feat(web): add live seat map with real-time status updates"
```

---

### Step 14.5 — Checkout

**Your task:**

- After a successful hold, show a countdown to `expiresAt` and a "Continue" button.
- Continue calls `POST /bookings` with an `Idempotency-Key`, and Pay calls `POST /bookings/:id/pay`.
- Poll `GET /bookings/:id` every ~1.5s until the status isn't `pending`, then show success or failure (with retry while the window is open).
- `/bookings` lists my bookings.

**Hints:**

- Generate the idempotency key **once per user intent** (`useRef(crypto.randomUUID())`), not per click. A retry after a network error must reuse the same key, or idempotency is pointless.
- Disable buttons while a request is in flight, but the backend must **not rely** on that.

**Commit:**

```bash
git add .
git commit -m "feat(web): add checkout flow with countdown, idempotent requests and payment polling"
```

---

### Step 14.6 — Waiting room

**Your task:**

- For high-demand shows, `/shows/[id]` first shows a "Join queue" screen.
- After joining, subscribe to the queue stream and display `position = ticket − head` with an ETA.
- When admitted, reveal the seat map.

**Commit:**

```bash
git add .
git commit -m "feat(web): add virtual waiting room experience"
```

---

## Phase 15 — Ship it

### Step 15.1 — Docker images + full compose

**Goal:** `docker compose --profile app up` runs the whole backend: migrations, API and worker.

**Setup (done for you):**

`.dockerignore` (root):

```
**/node_modules
**/dist
**/.next
**/.env
.git
coverage
```

`apps/api/Dockerfile`:

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV HUSKY=0
RUN npm i -g pnpm
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch                                   # cached layer: only reruns when the lockfile changes
COPY . .
RUN pnpm install --offline --frozen-lockfile \
 && pnpm --filter api build \
 && pnpm --filter api deploy --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

Append to `docker-compose.yml` (YAML anchors keep it DRY):

```yaml
x-api: &api
  build: { context: ., dockerfile: apps/api/Dockerfile }
  env_file: apps/api/.env
  environment:
    NODE_ENV: production
    DATABASE_URL: postgres://ticketrush:ticketrush@postgres:5432/ticketrush
    REDIS_URL: redis://redis:6379/0
    API_URL: http://api:4000
  profiles: [app]

  # add under `services:`
  migrate:
    <<: *api
    command: ['node', 'dist/scripts/migrate.js']
    depends_on: { postgres: { condition: service_healthy } }

  api:
    <<: *api
    ports: ['4000:4000']
    depends_on:
      migrate: { condition: service_completed_successfully }
      redis: { condition: service_healthy }

  worker:
    <<: *api
    command: ['node', 'dist/worker.js']
    depends_on:
      migrate: { condition: service_completed_successfully }
      redis: { condition: service_healthy }
```

> Deploy the web app on Vercel (set `API_URL` and `NEXT_PUBLIC_API_URL`), or add a Next.js `output: 'standalone'` image as a stretch goal.

**Done when:** `docker compose --profile app up --build` gives you a healthy `/health/ready` on :4000.

**Commit:**

```bash
git add .
git commit -m "build: add multi-stage api image and full-stack compose profile"
```

---

### Step 15.2 — CI pipeline

**Goal:** Every push is linted, type-checked and tested against real Postgres and Redis.

**Setup (done for you):** `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push: { branches: [main] }
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: ticketrush
          POSTGRES_PASSWORD: ticketrush
          POSTGRES_DB: ticketrush_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U ticketrush" --health-interval 5s
          --health-timeout 3s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping" --health-interval 5s
          --health-timeout 3s --health-retries 10

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm --filter web lint
      - run: pnpm typecheck
      - run: pnpm --filter api test
      - run: pnpm --filter api build
```

Add a CI badge to the README once it's green.

**Commit:**

```bash
git add .
git commit -m "ci: lint, typecheck, test and build on every push"
```

---

### Step 15.3 — README, ADRs, benchmarks

**Goal:** A recruiter understands the project in 30 seconds; an engineer is impressed in 5 minutes.

**Your task:** Write `README.md` with these sections, in this order:

1. **One-line pitch + CI badge.** For example: "Flash-sale ticketing that sold 650 seats to 2,000 concurrent users with zero double bookings."
2. **Demo GIF.** Two browser windows, seats turning grey live, a 409 on a contested seat.
3. **Architecture diagram**, reusing the Mermaid diagrams from this file.
4. **"The hard problems"** table (problem → solution → link to ADR/code).
5. **Benchmarks**, a summary of `docs/benchmarks.md`.
6. **Run it locally**: `pnpm i && pnpm infra:up && pnpm --filter api db:migrate && pnpm --filter api db:seed && pnpm dev`.
7. **Tech stack & decisions**, linking to `docs/adr/`.
8. **What I'd do at 100× scale**: read replicas for browsing, sharding holds by show via the Redis Cluster hash tags you already use, a transactional outbox, a CDN for static catalog data, and partitioning bookings by date.

Make sure every ADR mentioned in this roadmap exists.

**Commit:**

```bash
git add .
git commit -m "docs: add readme with architecture, hard problems and benchmarks"
```

---

## Appendix — Stretch goals

Pick any of these after Phase 15. Each one is a strong interview story.

| Stretch goal                                                                                                       | What it demonstrates                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Transactional outbox** (write events to an `outbox` table in the same transaction, relay them to BullMQ/pub-sub) | The _proper_ fix for dual writes, replacing the 9.3 sweeper as the primary mechanism. |
| **Redis keyspace notifications** for hold expiry → live `available` events                                         | Deep Redis knowledge; closes the gap from 10.2.                                       |
| **OpenAPI docs generated from Zod** (e.g. `zod-openapi`) + Scalar/Swagger UI at `/docs`                            | API-first thinking, no hand-written docs drift.                                       |
| **OpenTelemetry tracing** API → Redis → Postgres → worker, viewed in Jaeger                                        | Distributed tracing across process boundaries.                                        |
| **Grafana dashboard** provisioned in compose (latency, holds won/lost, bookings by status)                         | Operability; great screenshot for the README.                                         |
| **nginx + 3 API replicas** in compose                                                                              | Proves horizontal scaling and cross-instance SSE.                                     |
| **Refund worker** for `refund_pending` payments                                                                    | Completing the money lifecycle, compensating actions (saga-style).                    |
| **"Best available" seat finder** (N contiguous seats in the best row)                                              | Algorithms applied to a real feature.                                                 |
| **Chaos drills**: kill the worker mid-job, restart Redis mid-sale, and document what happens                       | You understand your failure modes, not just your happy paths.                         |

### Interview cheat sheet

| If they ask…                                | Point them to                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| "How do you prevent double booking?"        | 6.2 Lua holds + 7.2 conditional update + 13.2 proof query                            |
| "What if Redis goes down?"                  | Postgres is the source of truth (7.2); rate limiter fail-open/closed decision (11.1) |
| "What if the client retries?"               | Idempotency keys (7.1)                                                               |
| "What if a webhook arrives twice, or late?" | Dedup table + row lock + `refund_pending` (8.3)                                      |
| "What if the server crashes mid-flow?"      | Graceful shutdown (1.4), idempotent jobs (9.2), sweeper (9.3)                        |
| "How does it scale horizontally?"           | Stateless API, Redis pub/sub SSE (10), hash tags (6.2), separate worker (9.1)        |
| "Why these tools?"                          | `docs/adr/`                                                                          |
