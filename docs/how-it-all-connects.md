# How Everything Connects — Methods, Classes, and Workflow

This document explains the programming language used, how to declare functions and classes in this project, how each layer calls the next one, and how every piece interacts to complete a real operation.

---

## The language: TypeScript

Every file in this project is **TypeScript** (`.ts` or `.tsx`). TypeScript is JavaScript with types added on top.

A type is a label that says what shape a value has. For example:

```typescript
// JavaScript — no type info, you have to guess
function greet(name) {
  return 'Hello ' + name;
}

// TypeScript — you know exactly what goes in and what comes out
function greet(name: string): string {
  return 'Hello ' + name;
}
```

TypeScript is compiled to plain JavaScript before it runs. The compiler (`tsc`) checks every type and throws an error if something doesn't match — before the code ever runs.

The `.tsx` extension is used for files that contain JSX — the HTML-like syntax used in React components:

```tsx
function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}
```

---

## How to declare things in TypeScript

### A function

```typescript
// Arrow function (used most in this project)
const add = (a: number, b: number): number => a + b;

// Async function (returns a Promise — used for database calls and API calls)
async function getUser(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user;
}
```

### A class

```typescript
class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly data?: Record<string, unknown>, // extra payload (e.g., ban details)
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Usage — error with extra data attached:
throw new AppError(403, 'Account is banned', 'BANNED', {
  bannedReason: 'Spam',
  bannedAt: '2026-06-25T00:00:00Z',
  bannedUntil: null,
});
```

`public readonly` means properties are automatically assigned in the constructor and cannot be changed after creation. The `data` field allows attaching structured extra info that the error handler spreads into the response body.

### A type from a Zod schema

In this project, most types are not written by hand — they are derived from Zod schemas:

```typescript
import { z } from 'zod';

const RegisterSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

type Register = z.infer<typeof RegisterSchema>;
// Register is now: { email: string; username: string; password: string }
```

This means you write the shape once and get both runtime validation AND compile-time types for free.

---

## The layers of the project

Every operation in this project passes through a chain of layers. Each layer has one job and calls the next one:

```
Browser (React)
    │
    │  HTTP request (JSON over HTTPS)
    ▼
nginx (reverse proxy)
    │
    │  proxies /api/* to internal network
    ▼
Express (Node.js)
    ├── Middleware chain (helmet, cors, rate limit, auth, authorize, validate)
    ├── Router (matches the URL, calls the service)
    └── Service (business logic, calls Prisma)
            │
            │  SQL query
            ▼
        PostgreSQL (database)
```

---

## Layer 1 — The shared package (`packages/shared/`)

This package is imported by both the API and the frontend. It contains Zod schemas and the TypeScript types inferred from them.

```typescript
// packages/shared/src/schemas/enums.schema.ts
export const RoleSchema = z.enum(['USER', 'HELPER', 'ADMIN', 'MASTER']);
export type Role = z.infer<typeof RoleSchema>;

export const AuditActionSchema = z.enum(['ROLE_CHANGE', 'BAN', 'UNBAN']);
export type AuditAction = z.infer<typeof AuditActionSchema>;
```

```typescript
// packages/shared/src/schemas/auth.schema.ts
export const RegisterSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8),
});
export type Register = z.infer<typeof RegisterSchema>;
```

The same schema, the same type, both places. If you add a field to `RegisterSchema`, TypeScript immediately shows errors in both the API route and the frontend form.

---

## Layer 2 — Middleware (`apps/api/src/middleware/`)

Middleware is a function that runs between the request arriving and the route handler running. It has this exact signature:

```typescript
type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
```

- `req` — the incoming request (headers, body, cookies, params)
- `res` — the response you're building
- `next` — a function you call to pass control to the next middleware or route

If you call `next(error)` with an argument, Express skips all remaining middleware and jumps to the error handler.

### `authenticate.ts`

Verifies the JWT in the `Authorization: Bearer` header and attaches the decoded user to `req.user`. Critically, it also validates the role at runtime — TypeScript types don't prevent a crafted JWT from carrying an arbitrary role string:

```typescript
const KNOWN_ROLES = new Set(['USER', 'HELPER', 'ADMIN', 'MASTER']);

export const authenticate: RequestHandler = (req, _res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or malformed authorization header', 'UNAUTHORIZED'));
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!KNOWN_ROLES.has(payload.role)) {
      return next(new AppError(401, 'Invalid token', 'UNAUTHORIZED'));
      // ↑ rejects JWTs with unknown roles — they'd pass authorize() silently otherwise
    }

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
};
```

### `authorize.ts`

Hierarchy-aware role check. Instead of a flat `role === 'ADMIN'` comparison, it uses a rank table so a single `authorize('HELPER')` automatically passes for HELPER, ADMIN, and MASTER:

```typescript
const ROLE_RANK: Record<Role, number> = { USER: 0, HELPER: 1, ADMIN: 2, MASTER: 3 };

export const authorize =
  (minRole: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || ROLE_RANK[req.user.role as Role] < ROLE_RANK[minRole]) {
      return next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
    }
    next();
  };
```

Usage: `authorize('HELPER')` → passes for HELPER/ADMIN/MASTER. `authorize('ADMIN')` → passes for ADMIN/MASTER only.

### `validate.ts`

Middleware factory — a function that returns a middleware function. Validates and replaces `req.body`, `req.params`, or `req.query` with parsed+typed data:

```typescript
export const validate =
  (schema: ZodSchema, target: Target = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(new ValidationError(result.error.flatten()));
    }
    req[target] = result.data;
    next();
  };
```

### `rateLimiter.ts`

Five limiters, all with `skip: () => process.env.NODE_ENV === 'test'` to avoid test interference:

```typescript
export const generalLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, skip: () => isTest });
export const authLimiter      = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  skip: () => isTest });
export const strategyLimiter  = rateLimit({ windowMs: 60 * 60 * 1000, max: 10,  skip: () => isTest });
export const adminLimiter     = rateLimit({ windowMs: 15 * 60 * 1000, max: 30,  skip: () => isTest });
export const searchLimiter    = rateLimit({ windowMs: 60 * 1000,       max: 60,  skip: () => isTest });
```

### `errorHandler.ts`

Four-parameter signature — Express uses this to know it's an error handler. Handles all error types in one place and spreads any `data` payload from `AppError` into the response:

```typescript
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    return res.status(422).json({ error: err.message, details: err.details });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.data ?? {}),  // ← spreads ban details, lockedUntil, etc. into response body
    });
  }
  // ...
};
```

---

## Layer 3 — Routers (`apps/api/src/routes/`)

A router groups related routes together. Routes follow the pattern: `authenticate → authorize → validate → wrap(handler)`.

### The `wrap` helper

Every async route handler needs to catch errors and pass them to `next`. Instead of repeating try/catch:

```typescript
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
```

### Route declaration example

```typescript
// admin.router.ts
router.patch(
  '/users/:id/ban',
  authenticate,                         // must be logged in
  authorize('ADMIN'),                   // must be ADMIN or MASTER
  adminLimiter,                         // rate limit admin actions
  validate(IdParamSchema, 'params'),
  validate(BanSchema),
  wrap(async (req, res) => {
    const user = await adminService.setBanned(req.params.id, req.body, req.user!.id, req.user!.role);
    res.json({ user });
  }),
);
```

### Route summary

| Router | Base path | Key middleware |
|--------|-----------|---------------|
| `auth.router` | `/api/auth` | `authLimiter` on login/register |
| `monsters.router` | `/api/monsters` | `searchLimiter` on GET, `authorize('HELPER')` on writes |
| `strategies.router` | `/api/strategies` | `strategyLimiter` on POST |
| `admin.router` | `/api/admin` | `authorize('HELPER')` for users list, `authorize('ADMIN')` for audit, `adminLimiter` on PATCH |

---

## Layer 4 — Services (`apps/api/src/services/`)

Services contain the business logic and database calls. Key services:

### `auth.service.ts` — Login lockout and token reuse detection

```typescript
// login() — account lockout
async function login(email, password) {
  // 1. Count recent failures for this email
  const recentAttempts = await prisma.loginAttempt.count({
    where: { email, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  if (recentAttempts >= 5) {
    // find oldest attempt to calculate when the lockout expires
    throw new AppError(429, 'Too many attempts', 'RATE_LIMITED', { lockedUntil });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    await prisma.loginAttempt.create({ data: { email } });  // record failure
    throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
  }

  await prisma.loginAttempt.deleteMany({ where: { email } }); // clear on success
  // ... auto-unban check, issue tokens
}

// refresh() — token reuse detection
async function refresh(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const revoked = await prisma.revokedToken.findUnique({ where: { tokenHash: hash } });
  if (revoked) {
    // token was already rotated — someone is replaying it
    await prisma.refreshToken.deleteMany({ where: { userId: revoked.userId } });
    throw new AppError(401, 'Token reuse detected', 'TOKEN_REUSE_DETECTED');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: rawToken } });
  if (!stored) throw new AppError(401, 'Invalid token', 'UNAUTHORIZED');

  // rotate: delete old, save hash as revoked, issue new token
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token: rawToken } }),
    prisma.revokedToken.create({ data: { tokenHash: hash, userId: stored.userId, expiresAt } }),
    prisma.refreshToken.create({ data: { token: newToken, userId: stored.userId, expiresAt } }),
  ]);
}
```

### `admin.service.ts` — Scope-enforced role and ban management

```typescript
// setRole() — ADMIN can only touch USER/HELPER targets; MASTER is unrestricted
const ADMIN_MANAGEABLE_ROLES = ['USER', 'HELPER'];

async function setRole(targetId, newRole, requesterId, requesterRole) {
  if (targetId === requesterId) throw new AppError(400, 'Cannot change own role', 'SELF_ACTION');

  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });

  if (requesterRole === 'ADMIN' && !ADMIN_MANAGEABLE_ROLES.includes(target.role)) {
    throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
  }

  // atomic: update role + write audit row in same transaction
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetId }, data: { role: newRole } }),
    prisma.adminAction.create({ data: { actorId: requesterId, action: 'ROLE_CHANGE',
      targetUserId: targetId, metadata: { from: target.role, to: newRole } } }),
  ]);
}

// setBanned() — banning a HELPER or ADMIN auto-downgrades their role to USER
async function setBanned(targetId, { banned, reason, bannedUntil }, requesterId, requesterRole) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: banned
        ? { banned: true, bannedReason: reason, bannedAt: new Date(), bannedUntil,
            ...(target.role !== 'USER' ? { role: 'USER' } : {}) }  // downgrade on ban
        : { banned: false, bannedReason: null, bannedAt: null, bannedUntil: null },
    }),
    ...(banned ? [prisma.refreshToken.deleteMany({ where: { userId: targetId } })] : []),
    prisma.adminAction.create({ data: { actorId: requesterId,
      action: banned ? 'BAN' : 'UNBAN', targetUserId: targetId,
      metadata: banned ? { reason, bannedUntil } : {} } }),
  ]);
}
```

### `admin.service.ts` — Audit log pruning

On API startup and every 24 hours, entries older than 90 days are hard-deleted:

```typescript
// index.ts
async function pruneAuditLog() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.adminAction.deleteMany({ where: { createdAt: { lt: cutoff } } });
  if (count > 0) logger.info(`Pruned ${count} audit log entries older than 90 days`);
}

server.listen(PORT, '::', () => {
  pruneAuditLog();
  setInterval(pruneAuditLog, 24 * 60 * 60 * 1000);
});
```

---

## Layer 5 — Frontend API client (`apps/web/src/lib/api.ts`)

On the frontend, all HTTP calls go through `fetchWithAuth`, which:
1. Attaches the `Authorization: Bearer <token>` header if a token exists.
2. Sends cookies (`credentials: 'include'`) so the httpOnly refresh token cookie is included.
3. On a 401 response, silently calls `POST /api/auth/refresh` to get a new access token and retries the original request.

```typescript
export async function apiGet<T>(path: string): Promise<T> { ... }
export async function apiPost<T>(path: string, body?: unknown): Promise<T> { ... }
export async function apiPut<T>(path: string, body?: unknown): Promise<T> { ... }
export async function apiPatch<T>(path: string, body?: unknown): Promise<T> { ... }
export async function apiDelete<T>(path: string): Promise<T> { ... }
```

`<T>` is a generic — a placeholder type filled in at the call site:

```typescript
const result = await apiPatch<{ user: AdminUser }>(`/api/admin/users/${id}/role`, { role: 'HELPER' });
// TypeScript knows result.user is an AdminUser
```

---

## Layer 6 — React Context (`apps/web/src/context/AuthContext.tsx`)

Context shares state across components without prop drilling. `AuthContext` holds the current user, access token, and ban state.

```typescript
interface AuthState {
  user: User | null;
  bannedDetails: BanDetails | null;   // set when login or refresh returns 403 BANNED
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearBannedDetails: () => void;
}
```

**Ban flow:**
- `login()` or `silentRefresh()` catches a 403 with `code === 'BANNED'` → sets `bannedDetails` instead of re-throwing.
- `AuthContext` renders `<BannedModal>` (full-screen, non-dismissable) when `bannedDetails !== null`.
- `BannedModal` shows the ban reason, dates, and a 100-second countdown. On countdown end or button click: `logout()` → `window.location.replace('/')`.

```typescript
// AuthContext renders this after {children}:
{bannedDetails && (
  <BannedModal
    bannedReason={bannedDetails.bannedReason}
    bannedAt={bannedDetails.bannedAt}
    bannedUntil={bannedDetails.bannedUntil}
    onLogout={handleBannedLogout}
  />
)}
```

---

## Layer 7 — Custom hooks (`apps/web/src/hooks/`)

Hooks wrap TanStack Query's `useQuery` and `useMutation` to encapsulate one API operation each.

### `useDebounce.ts`

Used in search inputs to avoid firing a request on every keystroke:

```typescript
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Usage in monsters list:
const [searchInput, setSearchInput] = useState('');
const search = useDebounce(searchInput, 400); // only updates after 400ms of no typing
useEffect(() => {
  navigate({ search: (prev) => ({ ...prev, q: search || undefined }) });
}, [search]);
```

---

## Layer 8 — Admin panel (`apps/web/src/routes/admin.tsx`)

The admin panel is a `beforeLoad`-guarded route that allows HELPER, ADMIN, and MASTER. Each role sees a different subset of controls.

### Role rank (frontend)

```typescript
const ROLE_RANK: Record<Role, number> = { USER: 0, HELPER: 1, ADMIN: 2, MASTER: 3 };
```

### What each role sees

| Viewer role | Users tab | Audit log tab | Role controls | Ban controls |
|-------------|-----------|---------------|---------------|--------------|
| HELPER | ✓ (read-only) | — | — | — |
| ADMIN | ✓ | ✓ | USER ↔ HELPER | Ban/unban USER and HELPER |
| MASTER | ✓ | ✓ | USER / HELPER / ADMIN | Ban/unban anyone (except other MASTERs) |

### `canManage` logic

```typescript
function canManage(targetRole: Role): boolean {
  return ROLE_RANK[viewerRole] > ROLE_RANK[targetRole];
}
// MASTER (3) > ADMIN (2) → true. ADMIN (2) > ADMIN (2) → false.
```

When a user is banned, role controls are hidden — only the Unban button is shown. Controls return after unbanning.

### Audit log filters

The Audit Log tab has a filter navbar (All / Role change / Bans / Unbans) and a debounced search bar. The search hits `GET /api/admin/audit?search=<term>` which filters by actor or target username server-side.

---

## Complete workflow: ADMIN bans a user

Here is the full chain traced from button click to database write to UI update:

```
1. ADMIN clicks "Ban" on a user row in the admin panel
   └── BanModal opens → ADMIN fills in reason + duration → clicks Confirm
       └── banMutation.mutate({ id, reason, bannedUntil })

2. banMutation calls the mutationFn:
   └── apiPatch('/api/admin/users/abc/ban', { banned: true, reason, bannedUntil })
       └── fetchWithAuth builds the request:
           - adds Authorization: Bearer <token>
           - JSON.stringify(body)
           └── fetch('.../api/admin/users/abc/ban', { method: 'PATCH', ... })

3. Browser sends the request → nginx proxies to mh-datapedia-api.internal:3001

4. Express runs the middleware chain:
   ├── helmet, cors, express.json, cookieParser, requestId, logger
   ├── generalLimiter    — checks IP hasn't exceeded 100 req/15min
   └── matches PATCH /users/:id/ban in admin.router.ts

5. Route middleware chain:
   ├── authenticate      — verifies JWT, validates role is in KNOWN_ROLES, sets req.user
   ├── authorize('ADMIN')— checks ROLE_RANK[req.user.role] >= ROLE_RANK['ADMIN']
   ├── adminLimiter      — checks ADMIN hasn't exceeded 30 PATCH requests/15min
   ├── validate(IdParamSchema, 'params')  — validates req.params.id
   └── validate(BanSchema)               — validates body (reason min 10 chars, bannedUntil)

6. Route handler calls adminService.setBanned(id, body, req.user.id, req.user.role)

7. Service runs a Prisma $transaction:
   ├── user.update      → SET banned=true, bannedReason, bannedAt, bannedUntil,
   │                       role='USER' (if target was HELPER or ADMIN)
   ├── refreshToken.deleteMany → DELETE refresh tokens (logs target out immediately)
   └── adminAction.create → INSERT audit row (actorId, BAN, targetUserId, metadata)
   All three writes succeed or all roll back.

8. Service returns updated user → res.json({ user })

9. Response travels back: Express → nginx → browser
   └── banMutation.onSuccess fires:
       └── queryClient.invalidateQueries(['admin', 'users'])

10. TanStack Query refetches the users list
    └── UsersTab re-renders — banned user now shows "Banned" status and only Unban button

11. On the banned user's next request or token refresh:
    └── auth.service.refresh() sees banned=true and bannedUntil not expired
        └── throws AppError(403, 'Account is banned', 'BANNED', { bannedReason, bannedAt, bannedUntil })
        └── AuthContext catches this → sets bannedDetails
        └── BannedModal appears full-screen with 100s countdown
        └── Countdown reaches 0 → logout() + redirect to /
```

---

## How the layers connect at a glance

```
packages/shared/
  └── Zod schemas (RoleSchema, AuditActionSchema, RegisterSchema, ...)
      ├── used by API middleware (validate)  → rejects bad input
      └── used by frontend hooks (types)     → TypeScript knows the shape

apps/api/
  index.ts
  └── server.listen() → pruneAuditLog() on start + every 24h
  app.ts
  └── createApp() mounts all middleware + routers in order
      middleware/
      ├── authenticate   — JWT verify + KNOWN_ROLES check → req.user
      ├── authorize      — ROLE_RANK hierarchy check
      ├── validate       — Zod parse → req.body/params/query
      ├── rateLimiter    — 5 limiters (general/auth/strategy/admin/search)
      └── errorHandler   — catches AppError/ValidationError/Prisma errors
      routes/
      └── each file: Router → METHOD + PATH + middleware chain → service call
      services/
      ├── auth.service   — login lockout, token rotation + reuse detection, auto-unban
      ├── admin.service  — setRole (scope-enforced), setBanned (atomic tx), listAuditLog (search+pagination)
      └── monster/strategy services — business logic, Prisma calls, AppError throws
      lib/prisma.ts
      └── singleton PrismaClient — the only thing that talks to PostgreSQL

apps/web/
  main.tsx
  └── QueryClientProvider + AuthProvider + Router
      context/AuthContext.tsx
      └── user + token + bannedDetails in React state
          ├── silentRefresh on load (from httpOnly cookie)
          ├── BANNED 403 → sets bannedDetails → renders BannedModal
          └── exposes login/logout/register/clearBannedDetails
      lib/api.ts
      └── fetchWithAuth — auth header, 401 silent refresh, wraps fetch
      hooks/
      ├── useDebounce    — 400ms debounce for search inputs
      └── useMonsters, useMonster, useUpdateWeaknesses, ... — TanStack Query wrappers
      routes/
      ├── /admin         — HELPER/ADMIN/MASTER; tabs, role-gated controls, audit log
      ├── /monsters      — list with debounced search
      └── /monsters/$id  — detail with hitzones, weaknesses, strategies tabs
      components/
      ├── ui/BannedModal  — full-screen overlay, 100s countdown, auto-logout
      └── monsters/detail — MonsterHeader, HitzonesTab, WeaknessesTab, StrategiesTab
                            (all check ['HELPER','ADMIN','MASTER'].includes(user.role) for edit access)
```
