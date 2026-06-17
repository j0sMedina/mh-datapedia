# Backend — How the API Works

The API is an Express server written in TypeScript. It lives in `apps/api/` and runs on port 3001. This document explains how everything is wired together, from how a request enters the server to how it touches the database and comes back out.

---

## How the server starts

The entry point is `apps/api/src/index.ts`. It imports `createApp()` from `app.ts`, calls it to get an Express instance, and then calls `app.listen()` on the configured port.

`createApp()` is a factory function — instead of creating the app at the module level, it returns it. This matters for testing: the test suite calls `createApp()` directly to get a fresh app for each test run without starting a real server.

```
index.ts  →  createApp()  →  app.listen(PORT, '::')
```

The `'::'` address means the server listens on all IPv6 and IPv4 interfaces. This was required by Fly.io's internal network, which routes traffic over IPv6.

---

## How a request flows through the app

`app.ts` is where all middleware and routes are registered. Every request that arrives goes through this chain in order:

```
Request
  │
  ▼
helmet()          — sets secure HTTP headers (XSS protection, no sniffing, etc.)
cors()            — allows the frontend origin to make requests (CORS)
express.json()    — parses the JSON body into req.body
cookieParser()    — parses cookies into req.cookies (needed for refresh tokens)
requestId         — attaches a unique ID to every request for log tracing
generalLimiter    — blocks IPs that make too many requests (100 req / 15 min)
logger            — logs METHOD + path for every request
  │
  ▼
/api/docs         — Swagger UI (auto-generated from JSDoc comments in routers)
/api/health       — health check endpoint
/api/auth         — register, login, refresh, logout, me
/api/monsters     — list, detail, create, update, delete, weaknesses, hitzones
/api/users        — favorites, profile
/api/strategies   — hunt strategies per monster
  │
  ▼
errorHandler      — catches any error thrown in a route and sends a JSON response
```

If no route matches, Express's default 404 handler kicks in (we haven't overridden it, it just sends a text response).

---

## Environment variables and validation

Before the app does anything else, `apps/api/src/config/env.ts` runs a Zod schema parse against `process.env`:

```typescript
const EnvSchema = z.object({
  DATABASE_URL:       z.string().url(),
  JWT_SECRET:         z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT:               z.coerce.number().int().default(3001),
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN:        z.string().default('http://localhost:5173'),
});
```

If any variable is missing or invalid, the process exits immediately with an error. This is intentional: it is better to crash at startup with a clear message than to crash later with a confusing one. The rest of the codebase imports `env` from this file instead of reading `process.env` directly, so every variable access is typed.

---

## The database and Prisma

The database is PostgreSQL. Prisma is the tool that connects the app to it.

**The schema file** (`apps/api/prisma/schema.prisma`) is the single source of truth for the database structure. Every table, column, relationship, and index is declared there. Prisma reads it and generates a TypeScript client that the app imports to run queries.

**The Prisma client** is a singleton at `apps/api/src/lib/prisma.ts`:

```typescript
export const prisma = new PrismaClient();
```

The app imports this `prisma` object everywhere it needs to talk to the database. A singleton avoids opening multiple connection pools.

**Migrations** live in `apps/api/prisma/migrations/`. Every time you change the schema, you run `prisma migrate dev` locally — it creates a new SQL migration file. In production, the Fly.io release command runs `prisma migrate deploy` before the new version of the app starts serving traffic. This guarantees the database schema is always in sync with the code that just deployed.

### The data models

```
User
├── email (unique)
├── username (unique)
├── passwordHash
├── role (USER | ADMIN)
├── favorites → [Monster]  (many-to-many)
├── strategies → [Strategy]
└── refreshTokens → [RefreshToken]

Monster
├── name, title, description, type, firstGame
├── imageUrl, iconUrl, isBoss, habitats
├── parentId → Monster (self-relation for subspecies)
├── gameAppearances → [GameAppearance]
├── weaknesses → [ElementWeakness]
├── hitzones → [Hitzone]
├── strategies → [Strategy]
├── ailments → [MonsterAilment]
└── drops → [MonsterDrop]

RefreshToken
├── token (unique, random 128-char hex string)
├── userId → User
└── expiresAt
```

---

## How user registration works (step by step)

1. Client sends `POST /api/auth/register` with `{ email, username, password }`.
2. The `authLimiter` middleware checks that this IP hasn't made too many auth requests (20 / 15 min). If the limit is exceeded, it returns 429.
3. The `validate(RegisterSchema)` middleware runs the Zod schema from `@mh-datapedia/shared` against `req.body`. If the password is too short or the email is malformed, it returns 422 with field-level errors. If it passes, `req.body` is replaced with the parsed and typed result.
4. `authService.register()` runs:
   - Hashes the password with bcrypt at cost factor 12 (makes brute-forcing slow).
   - Creates a `User` row in the database.
   - Calls `signAccessToken()` — a 15-minute JWT signed with `JWT_SECRET`.
   - Calls `createRefreshToken()` — a random 128-character hex string stored in the `RefreshToken` table with a 7-day expiry.
5. The router sets the refresh token as an `httpOnly` cookie named `refresh_token`. `httpOnly` means JavaScript in the browser cannot read it — only the browser's HTTP engine sends it. This protects it from XSS attacks.
6. The response body returns `{ user, accessToken, expiresIn: 900 }`. The access token goes into JavaScript memory — never into localStorage.

---

## How tokens work

There are two tokens: an **access token** and a **refresh token**. They solve a problem together.

### Access token (JWT)

A JWT (JSON Web Token) is a string in three parts separated by dots: `header.payload.signature`.

- The **header** says it's a JWT signed with HS256 (HMAC-SHA256).
- The **payload** contains `{ sub: userId, role: "USER" | "ADMIN", iat: issuedAt, exp: expiresAt }`.
- The **signature** is created by hashing `header + payload` with `JWT_SECRET`. If anyone tampers with the payload, the signature will no longer match.

The API verifies tokens in `authenticate.ts`:

```typescript
const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
req.user = { id: payload.sub, role: payload.role };
```

`jwt.verify` checks the signature AND the expiry in one call. If either is wrong, it throws and the middleware returns 401. No database lookup is needed — the token is self-contained. This is called **stateless authentication**.

The access token lives for **15 minutes** (`ACCESS_TOKEN_TTL_S = 900`). After it expires, every protected request returns 401.

### Refresh token (opaque)

The refresh token is not a JWT — it is just a long random string stored in the database. It lives for **7 days**.

When the access token expires, the frontend calls `POST /api/auth/refresh`. The browser automatically sends the `refresh_token` cookie with this request (because it is set with `credentials: 'include'`). The server looks up the refresh token in the database, verifies it hasn't expired, deletes the old one, creates a new one (rotation), and issues a new access token.

This pattern means:
- Short-lived access tokens minimize the window if one leaks.
- The refresh token never appears in JavaScript or response bodies.
- Every refresh rotates the token, so a stolen refresh token can only be used once before it becomes invalid.

### Authorization (role check)

The `authorize('ADMIN')` middleware (used after `authenticate`) simply checks `req.user.role`:

```typescript
if (req.user.role !== role) throw new AppError(403, 'Forbidden', 'FORBIDDEN');
```

Because the role is embedded in the JWT payload and the JWT is signed, the client cannot forge a different role.

---

## How monster data is managed

### Reading

`monster.service.ts` contains all the database logic. The list endpoint:

```typescript
const [data, total] = await Promise.all([
  prisma.monster.findMany({ where, skip, take, include: { gameAppearances, weaknesses }, orderBy: { name: 'asc' } }),
  prisma.monster.count({ where }),
]);
```

Both queries run in parallel (`Promise.all`). The result includes pagination metadata: `{ data, meta: { page, limit, total, totalPages } }`.

The detail endpoint uses a large `include` object (`MONSTER_DETAIL_INCLUDE`) that Prisma expands into JOIN queries — it fetches the monster and all its related data (weaknesses, hitzones, strategies, drops, ailments, subspecies) in one round trip to the database.

### Writing (admin only)

The `PUT /api/monsters/:id/weaknesses` and `PUT /api/monsters/:id/hitzones` routes use a **replace-all pattern** inside a Prisma interactive transaction:

```typescript
return prisma.$transaction(async (tx) => {
  await tx.elementWeakness.deleteMany({ where: { monsterId } });
  await tx.elementWeakness.createMany({ data: items.map(item => ({ ...item, monsterId })) });
  return tx.elementWeakness.findMany({ where: { monsterId } });
});
```

A transaction means all three operations succeed together or all fail together. The `findMany` at the end runs inside the same transaction, so it reads the data that was just written — not stale data from before the write. This property is called **read-your-own-writes consistency**.

---

## Input validation with Zod

The `validate` middleware takes a Zod schema and an optional target (`'body'`, `'params'`, or `'query'`):

```typescript
router.put('/:id/weaknesses',
  authenticate,
  authorize('ADMIN'),
  validate(IdParamSchema, 'params'),
  validate(UpsertWeaknessesSchema),
  ...
```

The schemas themselves live in `packages/shared/` and are imported by both the API and the frontend. This means the exact same validation rules apply on both sides — if the frontend validates a field correctly, the API will accept it; if the API rejects something, the frontend can show the same error before even sending the request.

---

## Error handling

Every async route is wrapped in a try/catch that calls `next(err)`. This passes the error to the `errorHandler` middleware at the bottom of `app.ts`:

```
AppError (known errors, e.g. 404 "Monster not found")
  → sends { error: message, code: "NOT_FOUND" } with the correct HTTP status

ValidationError (from validate middleware)
  → sends { error: "Validation failed", details: fieldErrors } with 422

Unknown errors
  → logs the full error, sends { error: "Internal server error" } with 500
```

Clients always receive JSON, never an HTML error page.
