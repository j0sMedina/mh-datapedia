# CI/CD — MH Datapedia

## What CI/CD is

**CI (Continuous Integration)** — every time you push code, an automated system runs your tests to make sure nothing is broken. You catch bugs before they reach production instead of finding them a week later.

**CD (Continuous Deployment)** — if the tests pass, the same system automatically ships your code to the live server. No manual deploys, no "I forgot to push to production."

Together: push code → tests run → if green → live in minutes, automatically.

---

## How it works in this project

Everything lives in one file: `.github/workflows/deploy.yml`. It runs on every push to `master` and has 4 jobs.

### Job 1 — `changes` (smart filter)

Checks which files actually changed. It tags the push as `api: true` or `web: true` depending on what moved:

| Changed files | Tag |
|---|---|
| `apps/api/**`, `packages/shared/**`, `fly.api.toml` | `api: true` |
| `apps/web/**`, `packages/shared/**`, `fly.web.toml` | `web: true` |

If you only change the web frontend, the API deploy is skipped entirely — and vice versa. Saves time and avoids unnecessary redeploys.

### Job 2 — `test` (always runs)

Spins up a real Postgres 16 database, runs migrations on it, then:

1. Typechecks all packages
2. Runs the full test suite against the real DB

The JWT secrets come from GitHub Actions secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) — never hardcoded in the file.

### Job 3 — `deploy-api` (only if `api: true` and tests passed)

Uses `flyctl` to build and deploy `apps/api` to Fly.io. Requires `FLY_API_TOKEN` from GitHub secrets.

### Job 4 — `deploy-web` (only if `web: true` and tests passed)

Same thing for `apps/web`.

---

## Flow diagram

```
push to master
       │
       ▼
   [changes]
   what changed?
       │
       ├── api: true?  ──┐
       └── web: true?  ──┤
                         │
                         ▼
                      [test]
               spin up Postgres 16
               run migrations
               typecheck + test suite
                         │
               ┌─────────┴─────────┐
            passed?             failed?
               │                   │
     ┌─────────┴─────────┐       stops here,
     ▼                   ▼       no deploy
[deploy-api]       [deploy-web]
 (if api:true)      (if web:true)
flyctl → Fly.io    flyctl → Fly.io
```

---

## Secrets required

| Secret | Used by |
|--------|---------|
| `JWT_SECRET` | test job (signs access tokens) |
| `JWT_REFRESH_SECRET` | test job (signs refresh tokens) |
| `FLY_API_TOKEN` | deploy-api and deploy-web jobs |
| `DATABASE_URL` | stays in Fly.io secrets only — never in GitHub |

---

## In practice

Every commit that touches `apps/api/` triggers: test → deploy API.
Every commit that touches `apps/web/` triggers: test → deploy web.
A commit that touches `packages/shared/` triggers both.
A docs-only commit triggers neither deploy (tests still run).
