# Frontend — How the Web App Works

The frontend is a React 18 single-page application (SPA) built with Vite. It lives in `apps/web/` and talks to the API at `/api/`. This document explains how the app starts, how routing works, how it fetches and caches data, and how authentication state flows through the whole app.

---

## How the app starts

The browser loads `index.html` (served by nginx). That file has one `<script>` tag pointing to the JavaScript bundle that Vite compiled. The bundle's entry point is `src/main.tsx`:

```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
      {import.meta.env.DEV && <ReactQueryDevtools />}
    </QueryClientProvider>
  </StrictMode>,
);
```

This sets up three layers that wrap the entire app:

1. **`QueryClientProvider`** — makes TanStack Query available to every component. All data fetching hooks (`useMonsters`, `useMonster`, etc.) read from and write to this shared cache.
2. **`AuthProvider`** — stores the logged-in user and access token, and provides `login`, `register`, and `logout` functions to every component via React Context.
3. **`InnerApp`** — reads auth state and passes it as context into the router so that routes can access the user.

---

## How routing works

The router is TanStack Router. Instead of writing route config manually, every file inside `src/routes/` automatically becomes a route. TanStack Router scans these files at build time and generates `src/routeTree.gen.ts` — you never edit that file directly.

The route tree looks like this:

```
src/routes/
├── __root.tsx          →  /          (layout: Navbar + Footer wrapping everything)
├── index.tsx           →  /          (home page)
├── login.tsx           →  /login
├── register.tsx        →  /register
├── favorites.tsx       →  /favorites
└── monsters/
    ├── index.tsx       →  /monsters
    └── $id.tsx         →  /monsters/:id
```

The `$` prefix in `$id.tsx` is the TanStack Router convention for dynamic segments. Inside the component, `Route.useParams()` gives you `{ id: string }` with full TypeScript types — no casting needed.

### URL search parameters as state

The monster detail page (`/monsters/$id`) stores the active tab in the URL as a search param: `/monsters/abc123?tab=weaknesses`. This means:
- The browser back button works correctly.
- Sharing a link takes you directly to the right tab.
- No extra state management needed — the URL is the source of truth.

This is declared with a Zod schema in the route:

```typescript
const detailSearchSchema = z.object({
  tab: z.enum(TABS).optional().catch('overview'),
});

export const Route = createFileRoute('/monsters/$id')({
  validateSearch: detailSearchSchema,
  component: MonsterDetailPage,
});
```

The `.catch('overview')` means if someone types `?tab=garbage`, it silently defaults to `'overview'` instead of crashing.

### The root layout

`__root.tsx` renders `<Navbar />`, `<main><Outlet /></main>`, and `<Footer />`. The `<Outlet />` is where child routes render their content. This means every page automatically has the navbar and footer without repeating code.

Before rendering anything, the root layout checks `auth.isLoading`. On first load, the app tries to silently refresh the session (explained in the auth section). While that's in progress, the whole screen shows a spinner instead of flashing the wrong logged-out state.

---

## How data fetching works

All data fetching goes through TanStack Query. The pattern is always the same:

```typescript
// A hook file like useMonsters.ts:
export function useMonsters(filters) {
  return useQuery({
    queryKey: ['monsters', filters],
    queryFn: () => apiGet(`/api/monsters?${params}`),
  });
}

// A component uses it:
const { data, isLoading, error } = useMonsters({ game: 'MONSTER_HUNTER_WILDS' });
```

**What TanStack Query does automatically:**
- Runs the fetch when the component mounts.
- Returns `{ data, isLoading, error }` so the component can render different states.
- Caches the result. If two components call `useMonsters` with the same filters, only one network request is made.
- Refetches in the background when the browser window regains focus.
- Marks cached data as stale after a timeout, triggering a background refetch.

**The query key** (`['monsters', filters]`) is how the cache is addressed. When a mutation succeeds, it calls `queryClient.invalidateQueries({ queryKey: ['monsters'] })` — this tells TanStack Query that anything in the cache whose key starts with `'monsters'` is now stale and should be refetched. The UI updates automatically.

### The API client (`src/lib/api.ts`)

All network calls go through four functions: `apiGet`, `apiPost`, `apiPut`, `apiDelete`. They all call an internal `fetchWithAuth` function that:

1. Reads the current access token from memory and adds it to the `Authorization: Bearer ...` header.
2. Calls `fetch()` with `credentials: 'include'` — this makes the browser send the `refresh_token` cookie automatically.
3. If the response is 401 and a refresh callback is registered, it silently calls the refresh endpoint and retries the original request with the new access token.

The access token is stored in a module-level variable (`let _accessToken`), not in localStorage. This keeps it out of `document.cookie` and `localStorage`, both of which are readable by any JavaScript on the page (XSS vectors). The tradeoff is that the token is lost on page refresh — that is why the silent refresh on startup exists.

---

## How authentication works in the frontend

The `AuthContext.tsx` file manages the entire auth lifecycle.

### On startup (silent refresh)

When the app first loads, `AuthProvider` immediately calls `silentRefresh()`:

```typescript
useEffect(() => {
  setRefreshCallback(silentRefresh);
  silentRefresh().finally(() => setIsLoading(false));
}, [silentRefresh]);
```

`silentRefresh` sends `POST /api/auth/refresh`. The browser automatically includes the `refresh_token` cookie. If the user has a valid session from a previous visit, the server responds with a new access token. The app stores the token in memory and fetches `/api/auth/me` to get the user object. If there is no session, this call returns 401 and the user stays logged out — no error is shown.

This is why the app can remember you across page refreshes even though the access token lives in memory: the token disappears, but the cookie survives, and the app re-authenticates on the next load.

### Login and register

Both call the corresponding API endpoint, receive `{ user, accessToken }`, and store them in React state. The refresh token cookie is set by the server's `Set-Cookie` header — the frontend code never handles the refresh token directly.

### Logout

Calls `POST /api/auth/logout` to delete the refresh token from the database, then clears the local state. The server also clears the cookie via `res.clearCookie(...)`.

### How components read auth state

Any component can call `useAuth()`:

```typescript
const { user, login, logout } = useAuth();
```

Admin-only features check `user?.role === 'ADMIN'`:

```typescript
{user?.role === 'ADMIN' && <button onClick={() => setEditOpen(true)}>Edit weaknesses</button>}
```

---

## How the monster detail page is structured

The monster detail page (`src/routes/monsters/$id.tsx`) is the most complex page in the app. It demonstrates several patterns used throughout.

```
MonsterDetailPage
├── useMonster(id)           — fetches the monster with all relations
├── MonsterHeader            — name, image, type, game badges, admin edit/delete buttons
├── Tab bar                  — Overview | Hitzones | Weaknesses | Drops | Strategies
│   ├── OverviewTab          — description, habitats, ailments, subspecies
│   ├── HitzonesTab          — editable table (admin) or read-only (user)
│   ├── WeaknessesTab        — click-to-set stars (admin) or read-only (user)
│   ├── DropsTab             — material drop table by rank and method
│   └── StrategiesTab        — community hunt guides
├── MonsterFormModal         — admin form to edit monster fields
└── DeleteConfirmModal       — admin confirm dialog before deletion
```

**Inline editing (admin only):**
The `WeaknessesTab` and `HitzonesTab` components have an edit mode that admins can toggle. In edit mode:
- `WeaknessesTab` renders clickable star buttons. Clicking a star changes a draft state in the component; clicking Save calls `useUpdateWeaknesses(monsterId).mutateAsync(draft)`.
- `HitzonesTab` renders an editable table with number inputs (clamped 0–100). Clicking Save calls `useUpdateHitzones(monsterId).mutateAsync(rows)`.

Both mutation hooks call the API, then invalidate the relevant query keys so the UI refreshes automatically.

---

## How the app is wired end-to-end (request lifecycle example)

Here is what happens when you navigate to `/monsters/abc123`:

1. TanStack Router matches the URL and renders `MonsterDetailPage`.
2. `useMonster('abc123')` is called. TanStack Query checks the cache for `['monsters', 'abc123']`. Cache miss — triggers a fetch.
3. `apiGet('/api/monsters/abc123')` is called. `fetchWithAuth` adds the `Authorization` header (if logged in) and the browser adds the cookie automatically.
4. The request reaches nginx on the web server. nginx sees `/api/` and proxies it to `http://mh-datapedia-api.internal:3001` over Fly's internal network.
5. The API server receives it, runs `authenticate` (skipped since GET is public), and calls `monsterService.getMonsterById('abc123')`.
6. Prisma runs a `findUnique` with a large `include` — one SQL query with multiple JOINs — and returns the full monster object.
7. The API responds with `{ data: monster }` as JSON.
8. TanStack Query stores the result in the cache under `['monsters', 'abc123']` and gives it to the component.
9. The component renders: `MonsterHeader` shows the image and name, the tab renders `OverviewTab` with the description and habitats.

---

## Component organization

```
src/
├── routes/        — one file per URL, these are pages
├── components/
│   ├── monsters/  — everything related to displaying monster data
│   │   ├── detail/tabs/  — each tab is its own file
│   │   ├── MonsterCard.tsx
│   │   ├── MonsterFilters.tsx
│   │   └── MonsterGrid.tsx
│   ├── admin/     — forms and dialogs only admins see
│   ├── auth/      — login and register forms
│   ├── layout/    — Navbar, Footer
│   └── ui/        — reusable primitives: Button, Input, Modal, Spinner, Badge
├── hooks/         — one file per API operation (useMonsters, useUpdateHitzones, etc.)
├── context/       — AuthContext
└── lib/           — api.ts, queryClient.ts, types.ts, utils.ts
```

This keeps pages thin (they compose components and hooks), components focused (each has one job), and hooks testable independently of the UI.
