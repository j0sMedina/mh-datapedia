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

TypeScript is compiled to plain JavaScript before it runs. The compiler (`tsc`) checks every type and throws an error if something doesn't match — before the code ever runs. That is why this project can catch bugs like "you passed a number where a string was expected" at build time, not in production.

The `.tsx` extension is used for files that contain JSX — the HTML-like syntax used in React components:

```tsx
// .tsx file — TypeScript + JSX together
function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}
```

---

## How to declare things in TypeScript

### A function

```typescript
// Basic function
function add(a: number, b: number): number {
  return a + b;
}

// Arrow function (same thing, different syntax — used more in this project)
const add = (a: number, b: number): number => {
  return a + b;
};

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
  ) {
    super(message);       // calls the parent class Error's constructor
    this.name = 'AppError';
  }
}

// Using it:
throw new AppError(404, 'Monster not found', 'NOT_FOUND');
```

`extends Error` means `AppError` inherits everything `Error` has, and adds `statusCode` and `code` on top. `public readonly` means those properties are automatically assigned in the constructor and cannot be changed after creation.

### An interface

An interface describes the shape of an object. It has no implementation — it's just a contract:

```typescript
interface Hitzone {
  id: string;
  part: string;
  cut: number;
  blunt: number;
  fire: number;
  // ...
}

// A function that accepts any object matching that shape:
function displayHitzone(hz: Hitzone): string {
  return `${hz.part}: cut=${hz.cut}`;
}
```

### A type from a Zod schema

In this project, most types are not written by hand — they are derived from Zod schemas:

```typescript
import { z } from 'zod';

// Define the schema (validation rules)
const RegisterSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

// Derive the TypeScript type from it automatically
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
    ├── Middleware chain (helmet, cors, auth, validate, rate limit)
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

**How it's declared:**

```typescript
// packages/shared/src/schemas/auth.schema.ts

import { z } from 'zod';

export const RegisterSchema = z.object({
  email:    z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8),
});

export type Register = z.infer<typeof RegisterSchema>;
```

**How it's used in the API:**

```typescript
import { RegisterSchema } from '@mh-datapedia/shared';
// validate(RegisterSchema) parses and rejects bad requests
```

**How it's used in the frontend:**

```typescript
import type { Register } from '@mh-datapedia/shared';
// used as the type for the register form's data
```

The same schema, the same type, both places. If you add a field to `RegisterSchema`, TypeScript immediately shows errors in both the API route and the frontend form.

---

## Layer 2 — Middleware (`apps/api/src/middleware/`)

Middleware is a function that runs between the request arriving and the route handler running. It has this exact signature:

```typescript
// The shape Express expects for middleware:
type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
```

- `req` — the incoming request (headers, body, cookies, params)
- `res` — the response you're building
- `next` — a function you call to pass control to the next middleware or route

If you call `next(error)` with an argument, Express skips all remaining middleware and jumps to the error handler.

### `authenticate.ts`

```typescript
export const authenticate: RequestHandler = (req, _res, next) => {
  const auth = req.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or malformed authorization header', 'UNAUTHORIZED'));
    // ↑ calling next() with an error skips to errorHandler
  }

  const token = auth.slice(7); // strips "Bearer "

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    // ↑ attaches decoded user to the request object so later middleware can read it
    next(); // ← no argument = success, continue to next middleware
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
  }
};
```

### `validate.ts`

```typescript
// This is a "middleware factory" — a function that returns a middleware function
export const validate =
  (schema: ZodSchema, target: Target = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]); // target = 'body' | 'params' | 'query'

    if (!result.success) {
      return next(new ValidationError(result.error.flatten()));
      // ↑ sends 422 with field-level errors
    }

    req[target] = result.data; // ← replace raw input with parsed+typed data
    next();
  };
```

`validate` is called with a schema and returns a middleware. This is why you see it used like:

```typescript
router.put('/:id/weaknesses',
  authenticate,          // middleware 1
  authorize('ADMIN'),    // middleware 2
  validate(IdParamSchema, 'params'), // middleware 3
  validate(UpsertWeaknessesSchema),  // middleware 4
  wrap(async (req, res) => { ... }), // route handler
);
```

Each one runs in order. If any calls `next(error)`, the rest are skipped.

### `errorHandler.ts`

The error handler has a special signature — four parameters instead of three. Express uses this to know it's an error handler:

```typescript
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ValidationError) {
    return res.status(422).json({ error: err.message, details: err.details });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Resource already exists' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Resource not found' });
  }
  return res.status(500).json({ error: 'Internal server error' });
};
```

`instanceof` checks which class the error is. Each class produces a different HTTP status and message. This is how one place handles all errors from all routes.

---

## Layer 3 — Routers (`apps/api/src/routes/`)

A router groups related routes together. The monsters router is mounted at `/api/monsters` in `app.ts`, so all paths inside it are relative to that prefix.

### The `wrap` helper

Every async route handler needs to catch errors and pass them to `next`. Instead of repeating try/catch in every route, this project uses a `wrap` helper:

```typescript
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
// ↑ if fn throws or rejects, .catch(next) sends the error to the error handler
```

Without `wrap`, every route would look like this:

```typescript
router.get('/:id', async (req, res, next) => {
  try {
    const monster = await monsterService.getMonsterById(req.params.id);
    res.json({ data: monster });
  } catch (err) {
    next(err); // must do this or Express never knows about the error
  }
});
```

With `wrap`:

```typescript
router.get('/:id', validate(IdParamSchema, 'params'), wrap(async (req, res) => {
  const monster = await monsterService.getMonsterById(req.params.id);
  res.json({ data: monster });
  // throw here → .catch(next) → errorHandler handles it
}));
```

### How a route is declared

```typescript
router.METHOD(
  'PATH',
  middleware1,
  middleware2,
  routeHandler,
);

// Real example:
router.put(
  '/:id/weaknesses',        // path — :id is a URL parameter
  authenticate,             // must be logged in
  authorize('ADMIN'),       // must be ADMIN role
  validate(IdParamSchema, 'params'),      // validate :id
  validate(UpsertWeaknessesSchema),       // validate body
  wrap(async (req, res) => {
    const data = await monsterService.upsertWeaknesses(req.params.id, req.body);
    res.json({ data });
  }),
);
```

After `validate` runs, `req.params.id` is a verified string and `req.body` is a verified `UpsertWeaknesses` array. The route handler never needs to check if the input is valid — that's already done.

---

## Layer 4 — Services (`apps/api/src/services/`)

Services contain the business logic and the database calls. Routers call services; services call Prisma. This separation means you could swap Express for a different framework without rewriting the database logic.

```typescript
// monster.service.ts

import { prisma } from '../lib/prisma'; // the singleton Prisma client

export async function getMonsterById(id: string) {
  const monster = await prisma.monster.findUnique({
    where: { id },
    include: MONSTER_DETAIL_INCLUDE, // tells Prisma to JOIN all related tables
  });
  if (!monster) throw new AppError(404, 'Monster not found', 'NOT_FOUND');
  return monster;
}
```

`prisma.monster` is an auto-generated object with methods for every operation on the `Monster` table. `findUnique` runs `SELECT ... WHERE id = $1 LIMIT 1`. Prisma translates the JavaScript object syntax into SQL — you never write raw SQL.

### How the service is imported in the router

```typescript
import * as monsterService from '../services/monster.service';

// Later:
const monster = await monsterService.getMonsterById(req.params.id);
```

`import *` imports every exported function as a property of `monsterService`. This is a module — not a class — but it works the same way for organizing related functions.

---

## Layer 5 — The `AppError` class

`AppError` is the single class used to signal a known failure across the entire API:

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public readonly statusCode: number, // HTTP status to send (404, 403, 401...)
    message: string,                    // human-readable message
    public readonly code?: string,      // machine-readable code ('NOT_FOUND', 'FORBIDDEN')
  ) {
    super(message); // pass message to the built-in Error class
    this.name = 'AppError';
  }
}
```

**How it connects to everything else:**

- Services throw it: `throw new AppError(404, 'Monster not found', 'NOT_FOUND')`
- Middleware throws it: `next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'))`
- The error handler catches it: `if (err instanceof AppError) { res.status(err.statusCode).json(...) }`

Because every part of the app throws the same class, one handler at the bottom handles everything consistently.

---

## Layer 6 — Frontend API client (`apps/web/src/lib/api.ts`)

On the frontend, all HTTP calls go through four functions. They all call `fetchWithAuth` internally:

```typescript
let _accessToken: string | null = null; // stored in memory, not localStorage

async function fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
    // ↑ attaches the token to every request that has one
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include', // ← makes browser send the httpOnly cookie automatically
  });

  if (res.status === 401 && _refreshCallback && !_isRefreshing) {
    // access token expired → silently get a new one and retry
    _isRefreshing = true;
    const newToken = await _refreshCallback();
    _isRefreshing = false;
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      return fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' });
    }
  }

  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithAuth(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}
```

`<T>` is a **generic** — a placeholder type that gets filled in at the call site:

```typescript
// T is filled in as { data: MonsterDetail } here:
const monster = await apiGet<{ data: MonsterDetail }>('/api/monsters/abc123');
// TypeScript now knows monster.data is a MonsterDetail
```

---

## Layer 7 — Custom hooks (`apps/web/src/hooks/`)

Hooks are functions that start with `use`. They wrap TanStack Query's `useQuery` and `useMutation` to encapsulate one API operation each.

### A query hook (read data)

```typescript
// hooks/useMonsters.ts
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import type { PaginatedResponse, MonsterListItem } from '../lib/types';

export function useMonsters(filters: MonsterFiltersInput = {}) {
  const params = new URLSearchParams();
  if (filters.game) params.set('game', filters.game);
  // ... build query string

  return useQuery({
    queryKey: ['monsters', filters], // cache address
    queryFn: () => apiGet<PaginatedResponse<MonsterListItem>>(`/api/monsters?${params}`),
    // ↑ called by TanStack Query when needed, result is cached under queryKey
  });
}
```

### A mutation hook (write data)

```typescript
// hooks/useUpdateWeaknesses.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpsertWeaknesses } from '@mh-datapedia/shared';
import { apiPut } from '../lib/api';
import type { ElementWeakness } from '../lib/types';

export function useUpdateWeaknesses(monsterId: string) {
  const queryClient = useQueryClient(); // access to the global cache

  return useMutation({
    mutationFn: (data: UpsertWeaknesses) =>
      apiPut<{ data: ElementWeakness[] }>(`/api/monsters/${monsterId}/weaknesses`, data)
        .then((r) => r.data),
    // ↑ called when you call mutate() or mutateAsync()

    onSuccess: () => {
      // invalidate = mark as stale = TanStack Query refetches automatically
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId, 'weaknesses'] });
      queryClient.invalidateQueries({ queryKey: ['monsters', monsterId] });
      queryClient.invalidateQueries({ queryKey: ['monsters'] });
    },
  });
}
```

### How a component uses both

```tsx
// Inside WeaknessesTab.tsx
function WeaknessesTab({ monsterId }: { monsterId: string }) {
  const { data: weaknesses, isLoading } = useWeaknesses(monsterId);
  // ↑ reads from cache or fetches if not cached

  const { mutateAsync, isPending } = useUpdateWeaknesses(monsterId);
  // ↑ gives you a function to trigger the PUT request

  async function handleSave(draft) {
    try {
      await mutateAsync(draft);     // calls the API
      // onSuccess fires → cache is invalidated → useWeaknesses refetches
    } catch (err) {
      // show error to user
    }
  }
}
```

---

## Layer 8 — React Context (`apps/web/src/context/AuthContext.tsx`)

Context is React's way of sharing state across many components without passing props through every layer.

```typescript
// 1. Create a context with a type
const AuthContext = createContext<AuthState | null>(null);

// 2. Create a provider that holds the state and provides functions
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);

  async function login(email: string, password: string): Promise<void> {
    const data = await apiPost<{ user: User; accessToken: string }>(
      '/api/auth/login',
      { email, password },
    );
    setToken(data.accessToken); // store token in React state
    setUser(data.user);
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, register, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Create a hook to read the context from any component
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
```

**How components use it:**

```tsx
// In Navbar.tsx — completely unrelated to WeaknessesTab, but shares the same auth state
function Navbar() {
  const { user, logout } = useAuth();
  return (
    <nav>
      {user ? (
        <button onClick={logout}>Logout ({user.username})</button>
      ) : (
        <a href="/login">Login</a>
      )}
    </nav>
  );
}
```

---

## Complete workflow: admin saves new weaknesses

Here is the full chain traced from button click to database write to UI update:

```
1. Admin clicks "Save" in WeaknessesTab
   └── handleSave(draft) is called
       └── await mutateAsync(draft)          [useUpdateWeaknesses hook]

2. mutateAsync calls the mutationFn:
   └── apiPut('/api/monsters/abc/weaknesses', draft)  [api.ts]
       └── fetchWithAuth builds the request:
           - adds Authorization: Bearer <token> header
           - JSON.stringify(draft) as body
           └── fetch('https://mh-datapedia-web.fly.dev/api/monsters/abc/weaknesses', { method: 'PUT', ... })

3. Browser sends the request → nginx receives it
   └── nginx sees /api/ → proxies to mh-datapedia-api.internal:3001

4. Express receives the request, runs the middleware chain:
   ├── helmet()          sets security headers
   ├── cors()            allows the web origin
   ├── express.json()    parses the JSON body into req.body
   ├── cookieParser()    parses cookies (not needed for this route but always runs)
   ├── requestId         attaches a unique ID to this request
   ├── generalLimiter    checks IP hasn't exceeded 100 req/15min
   └── logger            logs "PUT /api/monsters/abc/weaknesses"

5. Express matches the route PUT /:id/weaknesses in monsters.router.ts
   └── runs the route-specific middleware chain:
       ├── authenticate  reads JWT from header, verifies signature+expiry, sets req.user
       ├── authorize     checks req.user.role === 'ADMIN' (throws 403 if not)
       ├── validate(IdParamSchema, 'params')    validates req.params.id is a string
       └── validate(UpsertWeaknessesSchema)     validates req.body shape

6. Route handler calls monsterService.upsertWeaknesses(req.params.id, req.body)

7. Service opens a Prisma transaction:
   └── prisma.$transaction(async (tx) => {
         tx.elementWeakness.deleteMany(...)   → DELETE FROM "ElementWeakness" WHERE monsterId = $1
         tx.elementWeakness.createMany(...)   → INSERT INTO "ElementWeakness" (monsterId, element, rating, isImmune) VALUES ...
         return tx.elementWeakness.findMany() → SELECT * FROM "ElementWeakness" WHERE monsterId = $1
       })
   All three SQL statements run in the same transaction. If any fails, all roll back.

8. Prisma returns the saved weaknesses. Service returns them to the router.
   └── res.json({ data: [...weaknesses] })

9. Response travels back: Express → nginx → browser
   └── fetchWithAuth receives the response
       └── res.json() parses the JSON
           └── apiPut returns { data: ElementWeakness[] }

10. mutationFn resolves → onSuccess fires:
    └── queryClient.invalidateQueries(['monsters', 'abc', 'weaknesses'])
    └── queryClient.invalidateQueries(['monsters', 'abc'])
    └── queryClient.invalidateQueries(['monsters'])

11. TanStack Query refetches all invalidated queries
    └── useWeaknesses(monsterId) refetches → new data from server
        └── WeaknessesTab re-renders with the updated weakness list
```

That is 11 steps, touching 8 different layers, using TypeScript functions, classes, middleware, services, Prisma, PostgreSQL transactions, an HTTP client, React hooks, and a shared cache — all connected in a single admin button click.

---

## How the layers connect at a glance

```
packages/shared/
  └── Zod schemas (RegisterSchema, UpsertWeaknessesSchema, ...)
      ├── used by API middleware (validate)  → rejects bad input
      └── used by frontend hooks (types)     → TypeScript knows the shape

apps/api/
  app.ts
  └── createApp() mounts all middleware + routers in order
      middleware/ (authenticate, authorize, validate, rateLimiter, errorHandler)
      └── each is a function: (req, res, next) => void
          routes/ (auth.router, monsters.router, ...)
          └── each file creates a Router, declares METHOD + PATH + middleware chain
              services/ (auth.service, monster.service)
              └── each exported function does one operation, calls prisma, may throw AppError
                  lib/prisma.ts
                  └── singleton PrismaClient — the only thing that talks to PostgreSQL

apps/web/
  main.tsx
  └── mounts QueryClientProvider + AuthProvider + Router
      context/AuthContext.tsx
      └── holds user + token in React state, exposes login/logout/register
          lib/api.ts
          └── fetchWithAuth — adds auth header, handles 401 refresh, wraps fetch
              hooks/ (useMonsters, useMonster, useUpdateWeaknesses, ...)
              └── each wraps useQuery or useMutation with one specific API call
                  routes/ (file-based pages)
                  └── each page reads hooks, renders components
                      components/
                      └── pure UI — receives data as props, calls hooks for mutations
```
