# CI/CD Deploy Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically test and deploy the monorepo to Fly.io on every push to `master`, gated by tests, with smart path-based deploys.

**Architecture:** Single GitHub Actions workflow with four jobs — `changes` (path detection) and `test` (Postgres service + full suite) run in parallel; `deploy-api` and `deploy-web` run in parallel after both pass, each gated by path filter output.

**Tech Stack:** GitHub Actions, dorny/paths-filter@v3, superfly/flyctl-actions, PostgreSQL 16 service container, pnpm 9, Node 20.

## Global Constraints

- Workflow file lives at `.github/workflows/deploy.yml` — no other workflow files
- Node version: 20 (matches production Dockerfiles)
- pnpm version: 9 (matches `packageManager` field in root `package.json`)
- Postgres image: `postgres:16`
- All Fly deploys use `--remote-only` (build on Fly's builders, not the GitHub runner)
- Production secrets (`DATABASE_URL`, `JWT_SECRET`) never go into GitHub — they stay in Fly secrets only
- Two GitHub Actions secrets required: `FLY_API_TOKEN`, `JWT_SECRET`

---

### Task 1: Create the GitHub Actions workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: a working workflow that tests and deploys on push to `master`

- [ ] **Step 1: Create the workflows directory and file**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/deploy.yml` with this exact content:

```yaml
name: CI / Deploy

on:
  push:
    branches: [master]

jobs:
  # ── Detect which paths changed ──────────────────────────────────────────────
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api:
              - 'apps/api/**'
              - 'packages/shared/**'
              - 'fly.api.toml'
            web:
              - 'apps/web/**'
              - 'packages/shared/**'
              - 'fly.web.toml'

  # ── Run full test suite with a real Postgres instance ───────────────────────
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mh_datapedia_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mh_datapedia_test
      JWT_SECRET: ${{ secrets.JWT_SECRET }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared package
        run: pnpm --filter @mh-datapedia/shared build

      - name: Run database migrations
        run: pnpm --filter @mh-datapedia/api exec prisma migrate deploy

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

  # ── Deploy API (only if api/shared/fly.api.toml changed) ────────────────────
  deploy-api:
    needs: [test, changes]
    if: needs.changes.outputs.api == 'true'
    runs-on: ubuntu-latest
    env:
      FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy API
        run: flyctl deploy --config fly.api.toml --remote-only

  # ── Deploy Web (only if web/shared/fly.web.toml changed) ────────────────────
  deploy-web:
    needs: [test, changes]
    if: needs.changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    env:
      FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy Web
        run: flyctl deploy --config fly.web.toml --remote-only
```

- [ ] **Step 2: Validate YAML syntax locally**

```bash
npx js-yaml .github/workflows/deploy.yml
```

Expected: prints the parsed object with no errors. If it throws, fix the indentation error it points to.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions test and deploy workflow"
```

---

### Task 2: Wire up GitHub secrets and validate the workflow

**Files:**
- No code changes — this task is configuration and verification only.

**Interfaces:**
- Consumes: `.github/workflows/deploy.yml` from Task 1
- Produces: a live pipeline that runs on push to `master`

- [ ] **Step 1: Generate a Fly deploy token**

Run locally:

```bash
flyctl tokens create deploy
```

Copy the token that starts with `FlyV1 ...`. This is your `FLY_API_TOKEN`.

- [ ] **Step 2: Add GitHub Actions secrets**

Go to: `https://github.com/j0sMedina/mh-datapedia/settings/secrets/actions`

Add two secrets:

| Name | Value |
|------|-------|
| `FLY_API_TOKEN` | The token from Step 1 |
| `JWT_SECRET` | Any random string (e.g. `ci-test-secret-not-production`) — only used by tests |

- [ ] **Step 3: Push to master and watch the workflow**

```bash
git push origin master
```

Go to: `https://github.com/j0sMedina/mh-datapedia/actions`

You should see a workflow run appear within seconds. Click it and verify:

- `changes` job completes (shows which outputs are `true`/`false`)
- `test` job runs all steps — look for `Tests: 33 passed`
- `deploy-api` and/or `deploy-web` run if their paths were in the push

- [ ] **Step 4: Verify a passing run end-to-end**

Wait for the workflow to finish (typically 3–5 minutes for tests + deploy).

Expected final state:
- All jobs show green checkmarks
- In the `test` job logs: `Test Suites: 5 passed, 5 total` / `Tests: 33 passed, 33 total`
- In the deploy job logs: `Visit your newly deployed app at https://mh-datapedia-api.fly.dev/` (or web equivalent)

If the `test` job fails at the `Run database migrations` step with `P1001: Can't reach database server`:
- The Postgres service container wasn't ready. This usually means the `--health-cmd` options weren't applied. Double-check the `options:` block indentation in the YAML — it must be under `postgres:`, not under `services:`.

If a deploy job fails with `Error: FLY_API_TOKEN is not set`:
- The secret name in GitHub doesn't match exactly. Secret names are case-sensitive. Verify it's `FLY_API_TOKEN` (all caps, underscores).

- [ ] **Step 5: Test path filtering works**

Make a small change to only a web file:

```bash
echo "# ci test" >> apps/web/README.md
git add apps/web/README.md
git commit -m "test: verify path filtering — web only"
git push origin master
```

Watch the Actions tab. Expected:
- `changes` outputs: `api=false`, `web=true`
- `test` runs ✅
- `deploy-api` is **skipped** (grey, not red)
- `deploy-web` runs ✅

Clean up:

```bash
git revert HEAD --no-edit
git push origin master
```
