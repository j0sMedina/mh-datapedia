# Backlog — MH Datapedia

Features and improvements to implement in future sessions. Ordered roughly by priority.

---

## Content

- **Monster data** — populate remaining monsters across all MH titles
- **Wilds migration** — finish migrating Monster Hunter Wilds data (partial migration done, see `2026-06-21-wilds-migration` plan)
- **Drops / rewards** — item drop tables per monster per rank (Low/High/Master)

---

## Mobile Phase 2

- **Monster detail screen** — tap a monster card → full detail view with tabs
- **Weaknesses tab** — elemental/status weaknesses on mobile
- **Hitzones tab** — hitzone table on mobile
- **Strategies tab** — read + submit strategies on mobile
- **Favorites** — save monsters locally, show a favorites tab

---

## Security Phase 2

- **Email verification** — require email confirmation on register before account is active
- **Password reset** — forgot password flow via email link
- **Session management** — let users see and revoke active sessions from a profile page
- **2FA** — optional TOTP two-factor authentication

---

## Performance

- **Monster list pagination** — server-side cursor pagination instead of loading all monsters
- **Image CDN** — move monster images to a CDN (Cloudflare R2 or similar) instead of inline URLs
- **Search optimization** — full-text search index on monster names/descriptions in PostgreSQL

---

## Web UX

- **Profile page** — avatar, username change, password change, active sessions
- **Notifications** — in-app toast when an admin changes your role
- **Monster comparison** — side-by-side weakness/hitzone comparison for two monsters
- **Dark/light theme toggle** — currently hardcoded dark

---

## Infrastructure

- **Mobile CI** — EAS build triggered automatically on push (currently manual)
- **Staging environment** — separate Fly.io app for testing before prod
- **DB backups** — automated daily snapshots of the Fly Postgres volume
