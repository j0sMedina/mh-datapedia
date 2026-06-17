# CI/CD Deploy Pipeline — Design Spec

## Goal

Automatically test and deploy the monorepo to Fly.io on every push to `master`, with smart path-based deploys so only the app that changed gets redeployed.

## Architecture

Single GitHub Actions workflow (`.github/workflows/deploy.yml`) with four jobs:

```
push to master
├── [changes]   detect which paths changed        (parallel)
└── [test]      postgres → install → build → test (parallel)
                      │
            needs: [test, changes]
                      ├── [deploy-api]  if api/shared/fly.api.toml changed
                      └── [deploy-web]  if web/shared/fly.web.toml changed
```

- `changes` and `test` run in parallel from the start
- Both deploy jobs wait for both `test` and `changes` to finish
- If `test` fails, neither deploy runs
- The two deploy jobs run in parallel with each other (independent Fly apps)

## Jobs

### `changes`

Uses `dorny/paths-filter@v3` to detect which paths were modified in the push.

| Output | Paths watched |
|--------|--------------|
| `api`  | `apps/api/**`, `packages/shared/**`, `fly.api.toml` |
| `web`  | `apps/web/**`, `packages/shared/**`, `fly.web.toml` |

`packages/shared/**` is listed in both filters because a schema change can affect either app.

### `test`

Runs on every push unconditionally. Steps:

1. Checkout code
2. Install pnpm 9 + Node 20 (matches production Dockerfiles)
3. `pnpm install --frozen-lockfile`
4. `pnpm --filter @mh-datapedia/shared build` — compile shared package to `dist/` (API tests import from it)
5. `pnpm typecheck` — TypeScript check across all three packages
6. `pnpm test` — Jest + supertest integration tests (33 tests)

The test job runs a PostgreSQL 16 service container on the GitHub Actions runner. The `DATABASE_URL` is constructed from the service container's credentials and passed to the test process as an environment variable. `JWT_SECRET` is read from a GitHub Actions secret.

### `deploy-api`

Conditions: `needs: [test, changes]` + `if: needs.changes.outputs.api == 'true'`

Steps:
1. Checkout code
2. Install flyctl via `superfly/flyctl-actions/setup-flyctl@master`
3. `flyctl deploy --config fly.api.toml --remote-only`

The `--remote-only` flag tells Fly to build the Docker image on Fly's remote builders instead of on the GitHub runner, avoiding the overhead of Docker-in-Docker.

### `deploy-web`

Conditions: `needs: [test, changes]` + `if: needs.changes.outputs.web == 'true'`

Steps:
1. Checkout code
2. Install flyctl
3. `flyctl deploy --config fly.web.toml --remote-only`

## Secrets

One GitHub Actions secret required:

| Secret | Where to get it | Where to set it |
|--------|----------------|-----------------|
| `FLY_API_TOKEN` | `flyctl tokens create deploy` | GitHub repo → Settings → Secrets → Actions |

`DATABASE_URL` for tests is constructed inline from the Postgres service container — not a secret.
`JWT_SECRET` for tests is a GitHub Actions secret (any string works for tests, doesn't need to match production).
All production secrets (production `DATABASE_URL`, `JWT_SECRET`, etc.) stay in Fly secrets only — they are never in GitHub.

## Tech Stack

- **GitHub Actions** — workflow runner
- **dorny/paths-filter@v3** — detects changed paths to gate conditional deploys
- **superfly/flyctl-actions/setup-flyctl** — installs flyctl on the runner
- **PostgreSQL 16 service container** — ephemeral database for integration tests
- **pnpm 9 / Node 20** — matches production Dockerfiles

## What This Does Not Cover

- PR-level checks (only `master` pushes trigger the workflow)
- Rollback automation (Fly keeps previous releases; rollback is manual via `flyctl releases`)
- Slack/email notifications on failure
- Environment promotion (staging → production) — only one environment exists
