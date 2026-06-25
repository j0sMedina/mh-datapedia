# Infrastructure — Monorepo, Docker, Fly.io, and CI/CD

This document explains how the project is structured as a monorepo, how Docker packages it for deployment, how Fly.io runs it in the cloud, how CI/CD automates everything, and what the `.gitignore` and `.env` files do.

---

## The monorepo

A monorepo is a single Git repository that contains multiple projects. This project has four:

```
mh-datapedia/
├── apps/
│   ├── api/          — the Express backend
│   ├── web/          — the React frontend
│   └── mobile/       — the React Native / Expo mobile app
└── packages/
    └── shared/       — Zod schemas and TypeScript types shared between api and web
```

The alternative would be four separate repositories. The monorepo approach has a key advantage here: when you change a Zod schema in `packages/shared/` (for example, adding a new role to `RoleSchema`), TypeScript immediately shows errors in both `apps/api/` and `apps/web/` — in the same editor, in the same commit. There is no "publish the shared package, then update the consumers" step.

---

## pnpm workspaces

pnpm is the package manager. The file `pnpm-workspace.yaml` tells it that this monorepo has multiple packages:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

This means:
- A single `pnpm install` at the root installs dependencies for all four packages.
- Packages can reference each other: `apps/api/package.json` lists `"@mh-datapedia/shared": "workspace:*"` as a dependency. pnpm resolves this to the local `packages/shared/` folder instead of downloading from npm. When you import `from '@mh-datapedia/shared'`, you are importing directly from the local source.
- pnpm uses a content-addressable store on disk: identical files are stored once and hard-linked. This makes installs fast and saves disk space compared to npm.
- The `pnpm-lock.yaml` file records the exact version of every dependency. `pnpm install --frozen-lockfile` (used in CI) refuses to change this file — if it would need to update, it fails. This guarantees reproducible installs.

---

## Turborepo

Turborepo is the task runner for the monorepo. It understands which packages depend on which, and it runs tasks in the right order and in parallel where possible.

The config is `turbo.json`:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

`"dependsOn": ["^build"]` means "before running `build` in this package, first run `build` in all packages this one depends on." The `^` means "upstream dependencies."

So when you run `pnpm build` at the root, Turborepo sees:
- `apps/api` depends on `packages/shared`
- `apps/web` depends on `packages/shared`
- Therefore: build `packages/shared` first, then build `apps/api` and `apps/web` in parallel.

If you run `pnpm build` again without changing anything, Turborepo reads its cache (stored in `.turbo/`) and skips everything — it prints "cache hit" and exits in milliseconds. If you change one file in `apps/api`, it only rebuilds `apps/api`, not `packages/shared` or `apps/web`.

---

## The shared package

`packages/shared/` compiles to two outputs: CommonJS (`dist/index.js`) for the API and ES Module (`dist/esm/index.js`) for the frontend. Both are compiled from the same TypeScript source.

Key schemas:
- **`enums.schema.ts`** — `RoleSchema` (`USER | HELPER | ADMIN | MASTER`), `AuditActionSchema` (`ROLE_CHANGE | BAN | UNBAN`)
- **`auth.schema.ts`** — RegisterSchema, LoginSchema
- **`monster.schema.ts`**, **`strategy.schema.ts`**, **`weakness.schema.ts`**, **`hitzone.schema.ts`** — content schemas

This is why the CI pipeline always runs `pnpm --filter @mh-datapedia/shared build` before anything else. Without it, the `dist/` folder doesn't exist and both `apps/api` and `apps/web` fail to import from `@mh-datapedia/shared`.

---

## Docker

Docker packages an application into a self-contained image that runs the same way everywhere — on your machine, on a server, on Fly.io.

Both web apps use **multi-stage Dockerfiles**. The idea is to have a large "builder" stage that has all the tools needed to compile the code, and a small "runner" stage that has only what's needed to run it. This keeps the production image small.

### API Dockerfile (`apps/api/Dockerfile`)

**Stage 1 (builder):**
1. Starts from `node:20-alpine` (Node.js on a minimal Linux).
2. Installs pnpm globally.
3. Copies the package manifests (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) — not the source code yet. This is intentional: Docker builds are cached layer by layer. If you only change source code and not dependencies, the `pnpm install` layer is reused from cache, making builds much faster.
4. Runs `pnpm install --frozen-lockfile`.
5. Copies the rest of the source code.
6. Builds `packages/shared` (the API needs it).
7. Runs `prisma generate` — this reads `schema.prisma` and writes the TypeScript Prisma client into `node_modules/.prisma`.
8. Compiles TypeScript (`pnpm build`) — the output is JavaScript files in `apps/api/dist/`.
9. Runs `pnpm deploy --prod /deploy` — pnpm copies only the production dependencies (no dev tools) into a clean `/deploy` directory.
10. Manually copies `dist/` and the `.prisma` generated client into `/deploy` (pnpm deploy skips gitignored files).

**Stage 2 (runner):**
1. Starts from a fresh `node:20-alpine` with no build tools.
2. Installs OpenSSL (Prisma's migration engine requires it on Alpine).
3. Copies only `/deploy` from the builder stage — the compiled code and production dependencies.
4. Copies the Prisma schema (needed at runtime to run migrations).
5. Sets `NODE_ENV=production`, exposes port 3001.
6. Changes ownership to the `node` user and switches to it (running as root is a security risk).
7. Starts the app with `node dist/index.js`.

### Web Dockerfile (`apps/web/Dockerfile`)

**Stage 1 (builder):**
1. Starts from `node:20-alpine`.
2. Installs pnpm, copies manifests, runs `pnpm install`.
3. Builds `packages/shared`.
4. Runs `pnpm --filter @mh-datapedia/web build` — Vite compiles all React code, CSS, and assets into static files in `apps/web/dist/`. `VITE_API_URL` is empty, so all `/api/` calls are relative URLs.

**Stage 2 (runner):**
1. Starts from `nginx:alpine` — a minimal web server, no Node.js needed.
2. Copies the compiled static files from the builder into `/usr/share/nginx/html/`.
3. Copies `apps/web/nginx.conf` as the nginx config.
4. Exposes port 80 and starts nginx.

The web server does not run Node.js at all in production — it just serves static files.

### Mobile app (`apps/mobile`)

The mobile app is **not** deployed via Docker. It is built using **EAS (Expo Application Services)** — Expo's cloud build service. Running `eas build -p android --profile preview` uploads the source to Expo's servers, which compile the native Android `.apk`. The resulting file is downloaded and distributed directly (e.g., via WhatsApp or Google Drive for testing). No Fly.io involvement.

---

## How nginx connects the frontend to the API

When a user visits `https://mh-datapedia-web.fly.dev/api/monsters`, the request goes to the nginx container (the web app). nginx sees that the path starts with `/api/` and proxies it to the API:

```nginx
location /api/ {
    set $api_upstream http://mh-datapedia-api.internal:3001;
    proxy_pass $api_upstream;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

`mh-datapedia-api.internal` is a private hostname that only exists inside Fly.io's internal IPv6 network. The web app and API talk to each other over this private network — the API is never directly exposed to the internet.

The `set $api_upstream` syntax (assigning to a variable first) is required for Fly.io's DNS resolver to resolve `.internal` hostnames at request time rather than at startup.

For non-API paths, nginx uses the SPA fallback:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

This means: try to find the file (`$uri`), try adding a `/` to see if it's a directory, and if both fail, serve `index.html`. This is required for client-side routing — when a user refreshes the page at `/monsters/abc123`, nginx serves `index.html` and TanStack Router takes over from there.

---

## Fly.io

Fly.io runs the Docker containers in the cloud. The project has three Fly apps:

| App name | What it is |
|----------|-----------|
| `mh-datapedia-api` | The Express API server |
| `mh-datapedia-web` | nginx serving the React build |
| `mh-datapedia-db` | Managed PostgreSQL database |

Each app is configured by a TOML file at the repo root:

- `fly.api.toml` — points to `apps/api/Dockerfile`, sets `PORT=3001`, runs `prisma migrate deploy` as a release command.
- `fly.web.toml` — points to `apps/web/Dockerfile`.

**The release command** (`node_modules/.bin/prisma migrate deploy`) runs inside the new API container before it starts serving traffic. It applies any pending database migrations. If the migrations fail, the deploy is aborted and the previous version keeps running.

**Auto-stop / auto-start:** Both apps are configured with `auto_stop_machines = true` and `min_machines_running = 0` (for web) or `1` (for API). Fly.io will stop machines when there's no traffic and start them on the next request. This keeps costs low for low-traffic apps.

**Secrets:** Production environment variables are never in the code or in any file. They are set via `flyctl secrets set VAR=value` and are injected by Fly.io as environment variables when the container starts. The app reads them via the `env.ts` validator at startup. The three production secrets are `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`. `DATABASE_URL` lives only in Fly secrets — it is never set as a GitHub Actions secret.

---

## CI/CD — GitHub Actions

The CI/CD pipeline is a GitHub Actions workflow at `.github/workflows/deploy.yml`. It runs automatically on every push to the `master` branch.

### The four jobs

```
push to master
├── [changes]  — detect which files changed
└── [test]     — run the full test suite (52 tests)
        │
  needs: [test, changes]
        ├── [deploy-api]  — if apps/api or packages/shared or fly.api.toml changed
        └── [deploy-web]  — if apps/web or packages/shared or fly.web.toml changed
```

`changes` and `test` run in parallel. The deploy jobs only start after both finish.

### The `changes` job (path filtering)

Uses the `dorny/paths-filter` action. It compares the files in the push against two filter groups:

```yaml
api:
  - 'apps/api/**'
  - 'packages/shared/**'
  - 'fly.api.toml'
web:
  - 'apps/web/**'
  - 'packages/shared/**'
  - 'fly.web.toml'
```

It outputs `api=true/false` and `web=true/false`. The deploy jobs use these as conditions:
```yaml
if: needs.changes.outputs.api == 'true'
```

If you only change a frontend file, `deploy-api` is skipped. If you change the shared package, both deploy because either app could be affected.

### The `test` job

This job runs on every push regardless of what changed — tests are always a gate for deployments.

Key steps:
1. Install pnpm 9 and Node 20 (same versions as production Dockerfiles).
2. `pnpm install --frozen-lockfile` — reproducible install.
3. `pnpm --filter @mh-datapedia/shared build` — build shared package first.
4. `prisma generate` — generate the Prisma client so TypeScript types exist.
5. `prisma migrate reset --force --skip-seed` — reset the CI test database to a clean state.
6. Write `apps/api/.env.test` from GitHub secrets — Prisma reads env from a file in test mode.
7. `pnpm typecheck` — TypeScript check across all packages.
8. `pnpm test` — run Jest + supertest (52 tests across 8 test suites).

The test database is a PostgreSQL 16 container that GitHub Actions spins up alongside the test runner. The connection string is `postgresql://postgres:postgres@localhost:5432/mh_datapedia_test`. It is destroyed after the job ends.

### The deploy jobs

```yaml
- uses: superfly/flyctl-actions/setup-flyctl@ed8efb3...   # pinned to a commit SHA
- run: flyctl deploy --config fly.api.toml --remote-only
```

`--remote-only` means Fly.io builds the Docker image on its own remote builders instead of on the GitHub runner. This avoids needing Docker-in-Docker on GitHub Actions and makes deploys faster.

The `FLY_API_TOKEN` secret is an org-level Fly.io token. It gives the CI runner permission to deploy to any app in the organization. The token is stored as a GitHub Actions secret — it is never in the codebase.

The action pin (`@ed8efb3...` instead of `@master`) is a security practice. Pinning to a commit SHA means the action cannot be silently changed by a supply-chain attack on Fly.io's GitHub repository.

---

## The `.gitignore`

The root `.gitignore` excludes files that should never be committed:

```gitignore
node_modules/      — installed dependencies (reproducible from package.json)
dist/              — compiled output (reproducible from source)
.env               — local development secrets
.env.test          — test database credentials
.env.prod          — production secrets (never needed locally)
*.tsbuildinfo      — TypeScript incremental build cache
.turbo/            — Turborepo task cache
```

The most important ones are the `.env` files. If a `.env` file were committed, every secret in it (database password, JWT secret) would be permanently in the Git history — even if you deleted the file in a later commit, it would still be visible in `git log`.

---

## The `.env` files

The app uses separate env files for each environment:

| File | Used when | Contains |
|------|-----------|----------|
| `apps/api/.env` | Local development | `DATABASE_URL` pointing to your local Postgres, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` |
| `apps/api/.env.test` | Running tests locally | Same shape but pointing to a test database (different DB name so tests don't wipe dev data) |
| Production | Fly.io | Set via `flyctl secrets set` — never in a file |

`dotenv` (the `import 'dotenv/config'` at the top of `index.ts`) reads `.env` and loads it into `process.env` when the app starts. It only does this in development — in production, Fly.io injects the variables directly.

The CI test job writes `apps/api/.env.test` dynamically at runtime from GitHub secrets:

```yaml
- name: Create test env file
  env:
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    JWT_REFRESH_SECRET: ${{ secrets.JWT_REFRESH_SECRET }}
  run: |
    printf 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mh_datapedia_test\n' > apps/api/.env.test
    printf 'JWT_SECRET=%s\n' "$JWT_SECRET" >> apps/api/.env.test
    printf 'JWT_REFRESH_SECRET=%s\n' "$JWT_REFRESH_SECRET" >> apps/api/.env.test
```

Note that the secrets are passed as step-level environment variables (`env:`) rather than interpolated directly into the shell command string (`${{ secrets.JWT_SECRET }}`). The reason is that if a secret contained shell metacharacters (like `'` or `$`), direct interpolation could break the command or leak partial values. Using `$JWT_SECRET` in the shell (reading from the process environment) is always safe.

---

## Summary: how a code change flows from laptop to production

1. You edit a file in `apps/api/src/` and push to `master`.
2. GitHub Actions starts the workflow.
3. `changes` detects `apps/api/**` changed → `api=true`, `web=false`.
4. `test` runs 52 tests against a fresh Postgres container. If any fail, everything stops here.
5. `deploy-api` starts (because `api=true`). `deploy-web` is skipped (because `web=false`).
6. `flyctl deploy --config fly.api.toml --remote-only` tells Fly.io to build the API Docker image using the current repo code.
7. Fly.io's remote builder runs the multi-stage Dockerfile, producing a fresh image.
8. Fly.io runs `prisma migrate deploy` inside the new container (the release command).
9. The new container starts. Fly.io health-checks it, then shifts traffic from the old container to the new one.
10. The web app is untouched — `deploy-web` was skipped because no web files changed.
