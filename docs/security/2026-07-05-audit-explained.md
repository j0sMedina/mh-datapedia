# Security Audit — What We Did and Why

This document explains the security audit in plain language. No technical jargon. Each test is explained as if you've never done this before.

---

## What is a security audit?

A security audit is when you try to break your own app before someone else does. You pretend to be an attacker and try every trick you can think of. If something breaks, you fix it. If it holds, you document that it held — so you know your defenses are real, not assumed.

We tested 20 different attacks. Here's each one explained.

---

## Section 1 — Authentication (how you prove who you are)

### 1.1 — Can an attacker try thousands of passwords?

**What we did:** We sent 12 login attempts in a row with wrong passwords.

**Why:** If there's no limit, an attacker can write a script that tries millions of password combinations until one works (called a "brute force attack"). With no limit they'd crack a weak password in minutes.

**What happened:** The server blocked us after 5 attempts and returned an error saying "too many requests". The limit is 10 attempts per 15 minutes per IP address.

**Result:** ✅ Protected. The door locks after too many wrong keys.

---

### 1.2 — Does logout actually log you out?

**What we did:** We logged in, saved the login token, logged out, then tried to use the saved token to access our account.

**Why:** If a token keeps working after logout, an attacker who stole your token (from a shared computer, a screenshot, etc.) can keep using it even after you logged out.

**What happened:** The token still worked for up to 15 minutes after logout.

**Result:** ⚠️ This is a known trade-off. Our tokens expire automatically after 15 minutes, which limits the damage. The alternative (instant token invalidation) would require a separate database of "cancelled tokens" checked on every request — extra infrastructure we chose not to add at this scale. Documented and accepted.

---

### 1.3 — Can an old session token be reused?

**What we did:** We logged in, then used the "refresh" system to get a new session. Then we tried to use the old session again.

**Why:** Session tokens get refreshed automatically to keep you logged in without re-entering your password. If old tokens aren't properly cancelled, an attacker who steals one can use it forever.

**What happened:** The server detected the old token was already replaced and rejected it with "Token reuse detected".

**Result:** ✅ Protected. Old tokens are thrown away when new ones are issued.

---

### 1.4 — Can we forge a fake login token?

**What we did:** We crafted a fake token that claimed to be from a MASTER account, with no real signature — just the data we wanted, base64 encoded.

**Why:** Login tokens (JWTs) are like signed passes. They're signed by the server so no one can fake them. But old versions of some libraries had a bug where you could make a "no signature needed" token that still worked.

**What happened:** The server rejected it immediately. The request never even reached our app — Fly.io's proxy blocked it at the network level.

**Result:** ✅ Protected. Fake tokens are detected and rejected.

---

### 1.5 — Can another website silently refresh your session?

**What we did:** From the browser console (simulating a malicious website), we tried to call the session refresh endpoint while being logged into our app in another tab.

**Why:** If a malicious website can trigger your browser to silently renew your session token, they could potentially steal control of your account.

**What happened:** The browser blocked the request in two ways:
1. `SameSite=strict` on the cookie — the browser refused to send the session cookie to a different website
2. CORS policy — even if the cookie had been sent, the browser would have blocked reading the response

**Result:** ✅ Protected. Two independent layers both blocked the attack.

---

## Section 2 — Authorization (who is allowed to do what)

### 2.1 — Can a regular user promote themselves to Admin?

**What we did:** We logged in as a normal USER and sent a request to change our own role to ADMIN.

**Why:** If role promotion isn't properly protected, any user could make themselves an admin just by sending the right request.

**What happened:** The server returned "Insufficient permissions" (403 error) immediately.

**Result:** ✅ Protected. Only ADMIN and MASTER can change roles, and only downward within their rank.

---

### 2.2 — Can an Admin demote the Master account?

**What we did:** We logged in as ADMIN and tried to change the MASTER account's role to USER.

**Why:** If an admin account gets compromised, the attacker shouldn't be able to demote the MASTER and take full control of the app.

**What happened:** The server rejected it — MASTER accounts are outside the range of roles that an ADMIN can touch.

**Result:** ✅ Protected. ADMIN can only manage USER and HELPER accounts. MASTER is untouchable from the API.

---

### 2.3 — Could Helpers see user email addresses?

**What we did:** We checked what data the user list returned to a HELPER account.

**Why:** Helpers are lower-trust moderators. They need usernames and ban status to do their job, but they have no reason to see everyone's private email addresses.

**What happened:** This was actually a bug we found BEFORE the audit and fixed. HELPERs were receiving emails. We patched it so only ADMIN and MASTER accounts see emails.

**Result:** ✅ Fixed before testing.

---

### 2.4 — Can a banned user keep using the app?

**What we did:** We saved a login token, banned that account as an admin, then tried using the saved token immediately after the ban.

**Why:** A ban should cut off access. If it doesn't, a bad actor who gets banned can just keep doing whatever got them banned for up to 15 minutes.

**What happened:** The token still worked for up to 15 minutes. The ban correctly deleted the refresh session (preventing new logins), but the short-lived access token can't be cancelled instantly for the same reason as test 1.2.

**Result:** ⚠️ Same 15-minute trade-off as 1.2. Accepted risk.

---

### 2.5 — Can a demoted Admin keep using Admin features?

**What we did:** We saved an ADMIN token, then demoted that account to USER via the MASTER account. Then we immediately used the saved ADMIN token to call an admin-only endpoint.

**Why:** Same logic as 2.4 — if role changes don't take effect instantly, a demoted admin (or a compromised admin account) has a window to keep acting with their old permissions.

**What happened:** The token still worked for up to 15 minutes. Same root cause.

**Result:** ⚠️ Same 15-minute trade-off. Accepted risk.

---

## Section 3 — Input Validation (does bad data get rejected?)

### 3.1 — SQL Injection

**What we did:** In the user search box, we typed a malicious database command: `'; DROP TABLE "User"; --`

**Why:** This is one of the oldest and most famous attacks. If the server takes your input and pastes it directly into a database query, an attacker can inject their own commands — including deleting all your data.

**What happened:** The server treated the entire string as a search term and looked for users with that exact name. No damage, no error.

**Result:** ✅ Protected. Prisma (our database library) uses parameterized queries — it never pastes raw user input into database commands.

---

### 3.2 — Catastrophic slowdown via search (ReDoS)

**What we did:** We sent a search term designed to potentially cause catastrophic slowdowns: a long string of repeated characters.

**Why:** Some search systems use JavaScript regular expressions internally. Certain patterns can cause the engine to get stuck in a loop, taking minutes instead of milliseconds — effectively crashing the server with a single request.

**What happened:** Response time was identical to a normal search (around 550ms). No slowdown.

**Result:** ✅ Protected. Our search goes directly to PostgreSQL's LIKE query, not a JavaScript regex, so this attack doesn't apply.

---

### 3.3 — Can you register as a Master by including the role in the signup form?

**What we did:** We sent a registration request with an extra field: `"role": "MASTER"`.

**Why:** If the server naively applies everything in the request body to the new account, an attacker could set their own role during registration.

**What happened:** The account was created with role USER (the default). The `role` field was silently ignored.

**Result:** ✅ Protected. Zod (our data validation library) strips any fields not explicitly defined in the registration schema. Extra fields are thrown away before they reach the database.

---

### 3.4 — XSS (injecting malicious code through a username)

**What we did:** We tried to register with the username `<img src=x onerror=alert(1)>` — a classic XSS payload that makes browsers run JavaScript.

**Why:** If a malicious username gets stored and then displayed in the app without being "escaped", the browser would execute it as code. An attacker could steal session tokens or perform actions as other users.

**What happened:**
1. The frontend form rejected it (client-side validation).
2. We bypassed the frontend and sent it directly to the API — the server also rejected it with a validation error.
3. The username must match `/^[a-zA-Z0-9_-]+$/` — only letters, numbers, underscores, and hyphens.

**Result:** ✅ Protected. Two layers: server-side regex blocks the payload from being stored. And even if it somehow got stored, React automatically escapes HTML in displayed text.

---

## Section 4 — HTTP Configuration (is the server set up securely?)

### 4.1 — Security Headers

**What we did:** We inspected the raw HTTP headers returned by the server.

**Why:** Browsers look at special headers from the server to decide how to behave. Missing headers leave browsers vulnerable to certain attacks.

**What we checked:**

| Header | What it does |
|--------|-------------|
| `Strict-Transport-Security` | Forces the browser to always use HTTPS, never HTTP |
| `X-Frame-Options` | Prevents your site being embedded in an iframe on another site (clickjacking) |
| `X-Content-Type-Options` | Stops the browser from guessing file types (MIME sniffing) |
| `Content-Security-Policy` | Restricts what resources the page can load |
| `X-Powered-By` | Should be absent — advertising the tech stack helps attackers |

**Result:** ✅ All present and correct. The `helmet()` library handles all of these automatically.

---

### 4.2 — CORS (can other websites access our API?)

**What we did:** We sent requests to the API pretending to be from `https://evil.com`.

**Why:** CORS (Cross-Origin Resource Sharing) controls which websites can make requests to your API from a browser. If it's misconfigured, a malicious site could make API calls on behalf of a logged-in user.

**What happened:** The `evil.com` request was blocked. We also discovered that the web app uses an nginx reverse proxy, meaning all browser requests go to the same domain — CORS doesn't even apply to normal usage.

**We also fixed a misconfiguration:** The `CORS_ORIGIN` server setting was still pointing at `localhost:5173` (local development) instead of the production web domain. We corrected this to `https://mh-datapedia-web.fly.dev`.

**Result:** ✅ Protected (and cleaned up).

---

### 4.3 — Swagger UI (is the API documentation public?)

**What we did:** We opened `/api/docs` in a browser without logging in.

**Why:** Swagger UI shows the complete API documentation — every endpoint, what data it accepts, what it returns. This makes an attacker's job easier.

**What happened:** The documentation is fully accessible without any login.

**Result:** ⚠️ This is a known trade-off. The source code is already public on GitHub, so the schema isn't secret. For now it's acceptable. If the app ever goes fully commercial, we'd remove it or put it behind a login.

---

## Section 5 — Business Logic (does the app enforce its own rules?)

### 5.1 — Can an Admin ban themselves?

**What we did:** We tried to ban our own admin account using the ban endpoint.

**Why:** Self-banning would be a silly but real edge case — and it could potentially be exploited to create a confused state (an admin who is banned but still logged in).

**What happened:** The server returned "Insufficient permissions". ADMINs can only ban USER and HELPER accounts — their own ADMIN role puts them outside the range of what they can target.

**Result:** ✅ Protected.

---

### 5.2 — Can anyone set a role to MASTER through the API?

**What we did:** We sent a role change request with `"role": "MASTER"` as the target role, authenticated as MASTER.

**Why:** MASTER is the highest role and cannot be granted through the normal admin interface by design — it can only be set directly in the database. If the API accepted it, someone could chain role escalations to create new MASTERs.

**What happened:** The server returned a validation error — "Invalid enum value. Expected 'USER' | 'HELPER' | 'ADMIN', received 'MASTER'". The word MASTER is simply not in the list of values the API accepts.

**Result:** ✅ Protected. MASTER can only be assigned via direct database access.

---

### 5.3 — Pagination abuse (requesting millions of rows)

**What we did:** We requested the audit log with `?limit=999999` — asking for nearly a million records at once.

**Why:** If the server returned exactly what you asked for, fetching huge amounts of data could slow down or crash the server (denial of service via large queries).

**What happened:** The server capped the response at 50 records regardless of what we asked for, and also corrected an invalid page number (0) to page 1.

**Result:** ✅ Protected. Limits are enforced server-side regardless of what the client requests.

---

## Section 6 — Rate Limiter Bypass

### 6.1 — Faking your IP address to bypass login limits

**What we did:** We tried sending a fake IP address in a header (`X-Forwarded-For`) to trick the rate limiter into thinking each request came from a different computer.

**Why:** The rate limiter blocks too many requests from the same IP. If you could fake your IP, you could rotate it with every request and effectively have unlimited attempts.

**What happened:** The fake IP header was ignored. The rate limiter used the real IP address regardless.

**Result:** ✅ Protected. The server correctly ignores client-supplied IP headers.

---

## Summary

| Category | Tests | Result |
|----------|-------|--------|
| Authentication | 5 | 4 held, 1 accepted trade-off |
| Authorization | 5 | 4 held, 1 pre-fixed bug, 2 accepted trade-offs |
| Input validation | 4 | All held |
| HTTP configuration | 3 | All held (1 misconfiguration corrected) |
| Business logic | 3 | All held |
| Rate limiter | 1 | Held |

**No critical vulnerabilities found. Two known trade-offs documented. One bug fixed before testing. One misconfiguration corrected.**

---

## The 15-minute window (accepted trade-off)

Three tests (1.2, 2.4, 2.5) all came back as "partial" for the same underlying reason: access tokens can't be instantly cancelled.

Here's the simple version of why this exists and why we're OK with it:

When you log in, you get two things:
- An **access token** — a short-lived pass (15 minutes) that lets you use the app. The server never stores this anywhere.
- A **refresh token** — a longer-lived token stored in the database that lets you silently get new access tokens without re-logging in.

When you log out, get banned, or get demoted — the refresh token is deleted immediately. You can't get new access tokens. But any access token already in someone's hands is still valid until it expires on its own (up to 15 minutes).

The fix would be a "token denylist" — a database of cancelled tokens checked on every single API request. That means every page load, every search, every button press makes an extra database call. At our current scale, that's unnecessary overhead. If this ever becomes a serious concern, the fix is adding Redis (a fast in-memory database) to store cancelled tokens.
