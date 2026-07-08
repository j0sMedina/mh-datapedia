# Strategy Approval Workflow — Design Spec

## Overview

Users submit strategies in a **PENDING** state. Helpers, Admins, and Masters can approve or reject them from a dedicated review tab. Approved strategies go live publicly. Rejected strategies stay visible to their author (with the rejection reason) for 3 days, then are permanently deleted.

---

## Data Model

Add three fields to the `Strategy` model in `apps/api/prisma/schema.prisma`:

```prisma
enum StrategyStatus {
  PENDING
  APPROVED
  REJECTED
}

model Strategy {
  // existing fields unchanged
  status          StrategyStatus @default(PENDING)
  rejectionReason String?
  rejectedAt      DateTime?
}
```

**Migration:**
- Add the enum and new fields
- Backfill: set all existing strategies to `APPROVED` so they remain live
- `rejectionReason` and `rejectedAt` are null for all existing rows

---

## API

### Existing endpoints

**`POST /strategies`** — no route change. Strategy is now created with `status: PENDING`. Already requires `authenticate` + `requireVerified`, so unverified users cannot submit.

**`GET /monsters/:id/strategies`** — gains optional authentication (if a valid `Authorization` header is present, the user's identity is resolved; otherwise the request is treated as anonymous):
- Returns all `APPROVED` strategies to everyone
- If the requester is authenticated, also returns their own `PENDING` and `REJECTED` strategies
- Before building the response, lazily deletes any `REJECTED` strategies for this monster where `rejectedAt < now - 3 days`

### New endpoint

**`PATCH /api/strategies/:id/review`**

- Middleware: `authenticate`, `authorize('HELPER')`
- Body schema:
  ```ts
  { action: 'approve' | 'reject', reason?: string }
  ```
- `reason` is required when `action === 'reject'`; forbidden when `action === 'approve'`
- On approve: sets `status: APPROVED`, clears `rejectionReason` and `rejectedAt`
- On reject: sets `status: REJECTED`, `rejectionReason: reason`, `rejectedAt: now()`
- Returns the updated strategy
- Errors: 404 if not found, 400 if reason missing on reject, 409 if strategy is not PENDING

---

## Role permissions summary

| Action | USER (verified) | HELPER | ADMIN | MASTER |
|---|---|---|---|---|
| Submit strategy | ✅ | ✅ | ✅ | ✅ |
| Submit strategy (unverified) | ❌ | — | — | — |
| Approve / reject | ❌ | ✅ | ✅ | ✅ |
| See own pending/rejected | ✅ | ✅ | ✅ | ✅ |
| See others' pending/rejected | ❌ | ✅ | ✅ | ✅ |

---

## Web UI

### Monster detail — Strategies tab

- **Approved strategies**: visible to all users (logged in or not), unchanged layout
- **Author crown icon**: any strategy you authored shows a crown icon, regardless of status
- **Own pending strategy**: appears with an amber "Pending review" badge; only visible to the author
- **Own rejected strategy**: appears with a red "Rejected" badge and the rejection reason shown inline; only visible to the author; disappears from view after 3 days (lazy-deleted server-side)

### Review tab (`/review`)

- Added to the navbar, visible only when `user.role` is `HELPER`, `ADMIN`, or `MASTER`
- Lists all `PENDING` strategies across all monsters, sorted oldest-first
- Each card shows: monster name, author username, strategy title, difficulty, game, full content
- **Approve button** (green): immediately approves, card disappears from queue
- **Reject button** (red): expands an inline text input for the reason; submitting with an empty reason is blocked client-side; on submit the card disappears from queue

---

## Lazy cleanup

On every `GET /monsters/:id` strategy fetch, before returning results:

```ts
await prisma.strategy.deleteMany({
  where: {
    monsterId: id,
    status: 'REJECTED',
    rejectedAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
  },
});
```

No background worker or cron job required. Rejected strategies for monsters nobody visits will accumulate but are harmless — they are never returned to any client.

---

## Out of scope

- Mobile review UI (deferred to a future phase)
- Notifications to the author on approval/rejection
- Author editing and resubmitting a rejected strategy (rejection is final)
- Pagination on the review queue (add when the queue grows large)
