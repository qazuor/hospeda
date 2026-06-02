---
specId: SPEC-182
title: Unified Authentication + Host-Mode Access Model
type: feature
status: in-progress
complexity: high
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-182-unified-auth-host-access
worktree: /home/qazuor/projects/WEBS/hospeda-spec-182-unified-auth-host-access
linearIssues:
  - BETA-52
  - BETA-57
tags:
  - auth
  - web
  - admin
  - better-auth
  - session
  - host-mode
  - cookie
  - redirect
  - signup-as-host
  - permissions
---

# SPEC-182 — Unified Authentication + Host-Mode Access Model

## 1. Origin & problem statement

Two Linear issues converge on a fundamental product model question: **where does auth live, and how do users become hosts?**

### BETA-52 — Admin redirects to its own signin instead of web signin

Users land on `admin.hospeda.com.ar/auth/signin` — a disconnected, brand-inconsistent page —
instead of the already polished, i18n'd, CSS-module auth surface at `hospeda.com.ar/{locale}/auth/signin`.
The admin's own signin page is a dead end: it does not know about the host-on-publish flow, the
email-verification UX, or the locale-aware copy the web team has already invested in.

### BETA-57 — Admin OAuth signup creates role=USER instead of HOST

When a user signs up via OAuth on `admin.hospeda.com.ar/auth/signup`, they are created with
`role=USER` (the Better Auth default) and immediately locked out of the admin panel by the
`ACCESS_PANEL_ADMIN` guard. The root cause: the OAuth callback does not hit the bespoke
`/signup-as-host` endpoint — it goes through Better Auth's standard OAuth flow which always
assigns the default role.

**This bug dissolves entirely** when there is no more logged-out signup in admin. BETA-57 is
not a bug to fix — it is a code path to delete.

### Industry research context

Investigation of Airbnb, VRBO, MercadoLibre, and Sharetribe reveals a consistent pattern:

- **Consumer auth lives in the consumer app.** The hosting/admin side consumes the same session
  cookie, it does not maintain a separate login form.
- **Host status is earned by action, not declared at signup.** On Airbnb and VRBO, "host" is
  the result of publishing a first listing — not a separate account type. On MercadoLibre /
  Sharetribe, sellers start as regular users and become sellers when they create their first
  listing.
- **"Switch to hosting"** is an in-session UI toggle that leverages the existing session, not
  a separate login.

This spec formalizes that model for Hospeda.

---

## 2. Architecture overview — what already exists vs. what is new

### What ALREADY EXISTS (preserve, repoint, extend — do not rebuild)

| Component | Location | What it does |
|-----------|----------|-------------|
| Web auth pages | `apps/web/src/pages/[lang]/auth/{signin,signup,forgot-password,reset-password,verify-email,verify-email-sent}.astro` | Fully functional, i18n'd, CSS-module bespoke auth surface (NOT `@repo/auth-ui` which is Tailwind-based and unused in web) |
| `buildLoginRedirect` helper | `apps/web/src/lib/middleware-helpers.ts` | Builds `/{locale}/auth/signin/?returnUrl=...` paths. Currently handles web-internal redirects only. |
| Smart guard | `apps/admin/src/lib/authed-guard.ts` + `apps/admin/src/routes/_authed.tsx` | Pure decision function: routes by role — `redirect-signin`, `redirect-tourist-funnel` → `/{locale}/publicar/?from=admin`, `redirect-forbidden`, `redirect-change-password`, `allow`. The tourist and host funnels already work correctly. |
| Cross-subdomain cookie | `apps/api/src/lib/auth.ts:454` | `crossSubDomainCookies.domain = 'hospeda.com.ar'` in production. The Better Auth session cookie is shared across `hospeda.com.ar`, `admin.hospeda.com.ar`, and `staging.hospeda.com.ar`. After logging in on web, admin reads the same session. |
| Host-on-publish trial | `apps/api/src/services/accommodation-publish-deps.ts` | Trial subscription created on first publish. The `role=USER → role=HOST` promotion is triggered by publishing, not by signup. |
| Owner-scoping for HOST | SPEC-169 (`apps/admin/src/lib/authed-guard.ts` + service-core) | `ACCOMMODATION_VIEW_OWN` — hosts only see their own accommodations in admin. Preserved. |
| "Modo anfitrión" menu item | `apps/web/src/components/shared/navigation/UserMenu.client.tsx:123` | i18n key `items.hostMode` exists in es/en/pt. The discriminator already distinguishes HOST from staff via `access.apiAdmin`. Needs wiring to admin URL for role=HOST users with published accommodations. |
| `USER_CREATE` permission | `packages/schemas/src/enums/permission.enum.ts:224` | `user.create` — already exists. Candidate for gating the staff host-creation action. |

### What is NEW (this spec authors)

1. **callbackUrl support on web signin** — web auth pages accept an external `callbackUrl` param with allowlist validation.
2. **Admin guard redirect target** — `redirect-signin` in `_authed.tsx` changes from internal `/auth/signin` to `{SITE_URL}/{locale}/auth/signin?callbackUrl={admin-url}`.
3. **Admin auth pages removal** — `signup.tsx` + `signin.tsx` deleted from admin routes. `forbidden.tsx` and `change-password.tsx` are kept.
4. **Staff host-creation action** — `signup-as-host` endpoint migrates from Origin-check to permission-check (`USER_CREATE` or a new `HOST_ONBOARD` permission), accessible only to authenticated staff via a new admin in-panel action.
5. **Web "Publicar / Switch to hosting" CTA** — morphs based on session state: tourist → listing funnel; host with published accommodation → admin URL; host without published accommodation → listing funnel.
6. **Dev-local cross-subdomain cookie workaround** — documented and implemented recipe for developing the web→admin session flow locally.

---

## 3. Direct admin access — role matrix

| User state | Guard decision | Destination |
|-----------|---------------|-------------|
| Unauthenticated | `redirect-signin` | Web signin: `{SITE_URL}/{locale}/auth/signin?callbackUrl={admin-url}` |
| Authenticated, role=USER (tourist), no `ACCESS_PANEL_ADMIN` | `redirect-tourist-funnel` | `{SITE_URL}/{locale}/publicar/?from=admin` |
| Authenticated, role=HOST, has `ACCESS_PANEL_ADMIN`, has `access.apiAdmin` | `allow` | Admin panel (owner-scoped via SPEC-169) |
| Authenticated, role=HOST, has `ACCESS_PANEL_ADMIN`, no `access.apiAdmin` | `allow` (host-mode — existing behavior) | Admin panel with "Modo anfitrión" label |
| Authenticated, role=HOST, no `ACCESS_PANEL_ADMIN` | `redirect-forbidden` | `reason=host-missing-permission` |
| Authenticated, staff (ADMIN/SUPER_ADMIN/EDITOR/CLIENT_MANAGER), has `ACCESS_PANEL_ADMIN` | `allow` | Admin panel (full access) |
| Authenticated, any role, `passwordChangeRequired=true` | `redirect-change-password` | `/auth/change-password` |

---

## 4. Scope

### In scope

1. **Phase 1** — Web auth callbackUrl support + allowlist validation.
2. **Phase 2** — Admin consumes web auth (guard redirect + auth page removal).
3. **Phase 3** — Staff host-creation as authenticated back-office action.
4. **Phase 4** — Web "Publicar / Switch to hosting" CTA host-mode toggle.
5. **Phase 5** — Dev-local cross-subdomain cookie workaround.
6. **Phase 6** — Tests, docs, auth architecture doc, manual smoke, index closeout.

### Out of scope

- Rebuilding the web auth pages (they already work).
- Changing the host-on-publish trial logic (keep as-is).
- Changing SPEC-169 owner-scoping (keep as-is).
- Moving `@repo/auth-ui` (Tailwind, unused in web — leave untouched).
- OAuth provider changes (Google OAuth continues to work via web signin; BETA-57 dissolves by deletion not by fixing the OAuth flow).
- Password-reset in admin (the `change-password.tsx` page stays; it handles the case where an authenticated admin user has a forced password reset, which is separate from the auth surface).

---

## 5. Functional specification by phase

### Phase 1 — Web auth as the unified surface

**Goal**: web signin/signup pages become the single auth entry point for both web consumers and
admin-redirected users.

**What changes**:

- `apps/web/src/pages/[lang]/auth/signin.astro` — accept a `callbackUrl` query param. On
  successful signin, if `callbackUrl` is present and passes allowlist validation, redirect to it
  instead of the default `returnUrl` destination.
- `buildLoginRedirect` (or a new `buildAdminLoginRedirect`) — extended to produce a URL pointing
  to the web signin page with `callbackUrl` set to the admin URL.
- **Allowlist validation** (security-critical): `callbackUrl` is ONLY honored if its origin
  matches one of:
  - The web app's own origin (`HOSPEDA_SITE_URL`)
  - The admin app's origin (`HOSPEDA_ADMIN_URL`)
  - Any subdomain of `hospeda.com.ar` in production (regex: `^https?://([a-z0-9-]+\.)?hospeda\.com\.ar`)
  - `localhost` and `*.hospeda.local` in development
  
  Any other value is silently ignored and the user is redirected to the locale root instead.
  This prevents open-redirect attacks where an attacker crafts a signin link with a malicious
  `callbackUrl`.

**Security note**: the allowlist must be server-side validated (in Astro server code), not
client-side validated. The signin page is an Astro page with server rendering — the redirect
happens in server-side `Astro.redirect()`, not in client JS.

### Phase 2 — Admin consumes web auth

**Goal**: admin no longer hosts its own auth pages for unauthenticated entry.

**What changes**:

- `apps/admin/src/routes/_authed.tsx:78` — change:
  ```
  case 'redirect-signin':
      throw redirect({ to: '/auth/signin', search: decision.search });
  ```
  to redirect to the external web auth URL:
  ```
  case 'redirect-signin':
      throw redirect({ href: buildWebSigninUrl(env.VITE_SITE_URL, preferredLocale, adminUrl) });
  ```
  where `buildWebSigninUrl` constructs `{SITE_URL}/{locale}/auth/signin?callbackUrl={encodeURIComponent(adminUrl)}`.

- `apps/admin/src/lib/authed-guard.ts` — update `DecideAuthedGuardArgs` if needed; the
  `redirect-signin` decision shape stays the same (it carries the redirect path), but the
  consumer in `_authed.tsx` now builds the external URL from it.

- **Delete** `apps/admin/src/routes/auth/signup.tsx` — the logged-out host signup page.
- **Delete** `apps/admin/src/routes/auth/signin.tsx` — the admin-own signin page.
- **Keep** `apps/admin/src/routes/auth/forbidden.tsx` — the access-denied page (still needed).
- **Keep** `apps/admin/src/routes/auth/change-password.tsx` — forced password change (still
  needed for authenticated users with `passwordChangeRequired=true`).
- **Keep** `apps/admin/src/routes/auth/index.tsx` — if it redirects to signin, update target to
  web auth URL; if it is a dead catch-all, update or delete.
- **Keep** `apps/admin/src/routes/auth/callback.tsx` — the OAuth callback handler continues
  to function (OAuth flows that originate from admin's OAuth buttons redirect back here).

**Cross-subdomain session verification** (manual smoke task):
In production, `crossSubDomainCookies.domain = 'hospeda.com.ar'` is set in `apps/api/src/lib/auth.ts:454`.
After the web signin succeeds and the browser is redirected to the admin `callbackUrl`, the
`/_authed` guard runs `fetchAuthSession()` → `GET /api/v1/public/auth/me` with the shared cookie.
This must return the authenticated session. The manual smoke task (T-015) verifies this end-to-end.

### Phase 3 — Host creation as a staff back-office action

**Goal**: creating a host account is an authenticated, permission-gated in-panel staff action —
not a public logged-out form.

**What changes**:

- `apps/api/src/routes/auth/signup-as-host.ts` — change the guard from Origin-header check to
  a Better Auth session + permission check. The endpoint moves from `createPublicRoute` to
  `createProtectedRoute` (or a thin admin route) gated by `PermissionEnum.USER_CREATE`
  (already exists: `user.create`). The Origin check is removed.
  
  Alternatively: introduce a new `PermissionEnum.HOST_ONBOARD = 'host.onboard'` if the
  use-case is distinct enough from generic user creation. Recommendation: use `USER_CREATE`
  for now (YAGNI — a dedicated permission can be carved out later if role-permission models
  diverge). This decision is flagged for user approval before implementation (see §8).

- A new admin UI page/modal — authenticated staff with `USER_CREATE` can create a host account
  by providing name + email + temporary password. The endpoint handles the role assignment.
  Location TBD: either a dedicated route under `/users/create-host` or a modal on the users
  list page. Flagged for user approval (see §8).

- **Remove** the `signupAsHostRoute` from `apps/api/src/routes/auth/index.ts` if it is moved
  to a protected route. If the endpoint path changes, ensure no references remain to the old
  `/api/v1/public/auth/signup-as-host` path.

**BETA-57 closes** as a consequence: with no public signup-as-host form in admin, the OAuth
signup path that created `role=USER` simply no longer exists.

### Phase 4 — Web "Publicar / Switch to hosting" CTA (host-mode toggle)

**Goal**: the web "Publicar" CTA adapts to the user's host state.

**CTA state machine** (driven by `/api/v1/public/auth/me` session data):

| User state | CTA label | CTA destination |
|-----------|-----------|----------------|
| Unauthenticated | "Publicar alojamiento" | `/{locale}/publicar/` (listing funnel/landing) |
| role=USER (tourist) | "Publicar alojamiento" | `/{locale}/publicar/` |
| role=HOST, has ≥1 published accommodation | "Modo anfitrión / Ir al panel" | `{ADMIN_URL}` (or `/dashboard` in admin) |
| role=HOST, no published accommodation yet | "Publicar alojamiento" | `/{locale}/publicar/nueva/` (create wizard) |

**What changes**:

- `apps/web/src/components/shared/navigation/UserMenu.client.tsx` — the existing `hostMode` i18n
  key is already present (es/en/pt). Wire it to the admin URL for users where
  `role === 'HOST'` and they have at least one published accommodation (check from session or a
  lightweight `/api/v1/public/accommodations/my?status=PUBLISHED&pageSize=1` call).
  
- `apps/web/src/components/sections/HostLandingCta.client.tsx` — already handles unauthenticated
  vs authenticated states. Extend to also detect the `role=HOST` + published accommodation case
  and point the CTA to the admin panel.

- Navigation header CTA (mobile + desktop) — the "Publicar" button in
  `apps/web/src/components/shared/navigation/MobileMenuIsland.astro` and its desktop counterpart
  may need the same three-state logic.

**Performance note**: detecting "has published accommodation" ideally avoids an extra API call.
Options: (a) include a `hasPublishedAccommodation: boolean` flag in the `/auth/me` response, or
(b) derive it from `role === 'HOST'` (a HOST always has at least one published accommodation
by the host-on-publish model). Option (b) is simpler and correct: if `role=HOST`, the user
already has a published accommodation. No extra call needed. Flagged for user approval (see §8).

### Phase 5 — Dev-local cross-subdomain cookie workaround

**Goal**: allow developers to test the web→admin session hand-off locally without production cookies.

**Problem**: in development, `crossSubDomainCookies.domain` is `undefined` (only set when
`NODE_ENV=production`). The web app runs on `localhost:4321` and admin on `localhost:3000` —
different origins, so the session cookie from the web login is not sent to the admin request.

**Options evaluated**:

| Option | Pros | Cons |
|--------|------|------|
| A. Local `/etc/hosts` entry (`hospeda.local`) + cross-subdomain config override in dev | Realistic; mirrors prod | Requires `/etc/hosts` edit per developer; cookie domain must be `.hospeda.local` |
| B. Nginx reverse proxy (same-origin) | Single origin, no cookie issue | Adds nginx as a dev dependency; more setup |
| C. Document "log in to admin separately" as the dev workaround | Zero setup | Poor DX; hides bugs |
| D. Dev-mode flag in auth.ts to enable `crossSubDomainCookies` on `localhost` | One-line change | Cookies with `domain=localhost` are spec-undefined and work inconsistently per browser |

**Recommendation**: Option A — a `*.hospeda.local` local hosts recipe.
`apps/api/src/lib/auth.ts` is updated to enable `crossSubDomainCookies` when
`process.env.DEV_COOKIE_DOMAIN` is set (e.g. `DEV_COOKIE_DOMAIN=.hospeda.local`), and
`docs/guides/auth-local-dev.md` documents the one-time `/etc/hosts` setup.
This provides a realistic test environment for the web→admin cookie hand-off.

Flagged for user approval (see §8 — the `/etc/hosts` approach may be too onerous; option C
is a valid fallback if the team opts for simplicity).

### Phase 6 — Closeout

- Tests: callbackUrl allowlist unit tests, guard redirect matrix tests (extend existing
  `authed-guard.test.ts`), host-mode CTA state machine tests, staff host-creation permission
  tests.
- Docs: `docs/guides/auth-architecture.md` (new) — canonical reference for the unified auth
  model, role matrix, cross-subdomain cookie, and dev-local setup.
- Manual smoke: web→admin round-trip per role (unauthenticated, tourist, host, staff).
- Flip spec + task indexes to completed on ship.

---

## 6. Acceptance criteria (BDD)

### Phase 1 — Web auth callbackUrl

```
Given the web signin page is loaded with ?callbackUrl=https://admin.hospeda.com.ar/dashboard
  When the user successfully signs in
  Then they are redirected to https://admin.hospeda.com.ar/dashboard (NOT the web locale root)

Given the web signin page is loaded with ?callbackUrl=https://evil.example.com/steal
  When the user signs in
  Then they are redirected to the web locale root (callbackUrl silently ignored)
  And no network request is made to evil.example.com

Given the web signin page is loaded with ?callbackUrl=https://admin.hospeda.com.ar
  When the ALLOWLIST check runs server-side
  Then the URL is accepted (matching subdomain of hospeda.com.ar)
```

### Phase 2 — Admin consumes web auth

```
Given an unauthenticated user visits any admin route
  When the /_authed guard fires
  Then the browser is redirected to {SITE_URL}/{locale}/auth/signin?callbackUrl={adminUrl}
  And NOT to /auth/signin (the deleted admin-own signin page)

Given a user signs in on the web signin page with callbackUrl pointing to admin
  When signin succeeds and the redirect to admin fires
  Then the /_authed guard reads the shared Better Auth session cookie
  And the guard resolves the session as authenticated (fetchAuthSession returns isAuthenticated=true)
  And the user lands on the requested admin page

Given an admin that no longer has /auth/signup
  When a request is made to /auth/signup (direct URL or link)
  Then a 404 or redirect-to-web-auth is returned (route does not exist)
```

### Phase 3 — Staff host-creation

```
Given an authenticated user with USER_CREATE permission in the admin panel
  When they use the in-panel "Create host account" action with valid credentials
  Then a new user is created with role=HOST
  And the response returns the new user id + email

Given an unauthenticated request to the staff host-creation endpoint
  When the request arrives without a valid session cookie
  Then a 401 Unauthorized is returned (not 403)

Given an authenticated user WITHOUT USER_CREATE permission
  When they attempt to call the staff host-creation endpoint
  Then a 403 Forbidden is returned

Given an OAuth signup attempt on admin.hospeda.com.ar (any OAuth provider)
  When the OAuth callback fires
  Then the user is created with role=USER (Better Auth default)
  And they are redirected to the web signin (or the tourist funnel — not the deleted signup page)
  [BETA-57 is resolved: the admin signup page that caused the confusion is gone]
```

### Phase 4 — Host-mode CTA

```
Given a tourist (role=USER) is authenticated on the web
  When they see the navigation "Publicar" CTA
  Then the CTA links to /{locale}/publicar/ (listing landing / funnel)

Given a host (role=HOST) is authenticated on the web
  When they see the navigation CTA
  Then the CTA label shows "Modo anfitrión" / "Host mode" / "Modo anfitrião"
  And the CTA links to the admin panel URL

Given an unauthenticated user sees the navigation
  When they see the "Publicar" CTA
  Then it links to /{locale}/publicar/ (same as tourist)
```

### Phase 5 — Dev-local cookie

```
Given DEV_COOKIE_DOMAIN=.hospeda.local is set in apps/api/.env.local
  And /etc/hosts maps web.hospeda.local and admin.hospeda.local to 127.0.0.1
  When a developer signs in at http://web.hospeda.local:4321/{locale}/auth/signin
  Then the session cookie is set with domain=.hospeda.local
  And navigating to http://admin.hospeda.local:3000 sends the same cookie
  And the admin /_authed guard resolves the session as authenticated
```

---

## 7. Key file pointers

| File | Relevance |
|------|-----------|
| `apps/web/src/pages/[lang]/auth/signin.astro` | Add `callbackUrl` query param support + allowlist check |
| `apps/web/src/lib/middleware-helpers.ts` | `buildLoginRedirect` — extend or add `buildAdminLoginRedirect` |
| `apps/admin/src/routes/_authed.tsx:78` | Change `redirect-signin` target to web auth URL |
| `apps/admin/src/lib/authed-guard.ts` | No logic change needed; consumer in `_authed.tsx` changes |
| `apps/admin/src/routes/auth/signin.tsx` | DELETE |
| `apps/admin/src/routes/auth/signup.tsx` | DELETE |
| `apps/admin/src/routes/auth/forbidden.tsx` | KEEP |
| `apps/admin/src/routes/auth/change-password.tsx` | KEEP |
| `apps/admin/src/routes/auth/callback.tsx` | KEEP (OAuth callback handler) |
| `apps/admin/src/routes/auth/index.tsx` | UPDATE redirect target to web auth |
| `apps/api/src/routes/auth/signup-as-host.ts` | Migrate Origin-check → permission-check (`USER_CREATE`) |
| `apps/api/src/routes/auth/index.ts` | Update route wiring if endpoint moves to protected |
| `apps/api/src/lib/auth.ts:454` | Add `DEV_COOKIE_DOMAIN` support for local dev |
| `apps/web/src/components/shared/navigation/UserMenu.client.tsx` | Wire `hostMode` item to admin URL for role=HOST |
| `apps/web/src/components/sections/HostLandingCta.client.tsx` | Extend for host-mode state |
| `apps/web/src/components/shared/navigation/MobileMenuIsland.astro` | Header CTA three-state logic |
| `packages/schemas/src/enums/permission.enum.ts` | Potentially add `HOST_ONBOARD` (decision pending, see §8) |
| `docs/guides/auth-architecture.md` | NEW — canonical auth reference |
| `docs/guides/auth-local-dev.md` | NEW — dev-local cookie workaround recipe |

---

## 8. Design decisions — flagged for owner approval before implementation

The following points have meaningful tradeoffs. Implementation MUST NOT begin on these items
until the owner makes a call:

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Permission for staff host-creation | A. `USER_CREATE` (exists) B. New `HOST_ONBOARD = 'host.onboard'` | A (YAGNI — add dedicated perm when roles diverge) |
| D2 | Staff host-creation UI placement | A. Dedicated `/users/create-host` route B. Modal on users list C. Modal on accommodations list | B (lowest friction — staff already on users list) |
| D3 | Host CTA "has published accommodation" check | A. Extra API call B. Derive from `role === 'HOST'` | B (role=HOST implies ≥1 published; simpler) |
| D4 | Dev-local cookie workaround | A. `*.hospeda.local` + `/etc/hosts` B. Document "log in separately" | A (realistic) — but owner may prefer B |
| D5 | `callbackUrl` param name | A. `callbackUrl` B. `returnUrl` (already used in web-internal flows) C. `redirect` (used in admin guard search) | A (`callbackUrl` — semantically distinct from same-app `returnUrl`) |

---

## 9. Risks and coupling notes

### Cross-app coupling (new)

After this spec, **admin auth depends on web availability**. If the web app is down,
unauthenticated admin users cannot sign in. This is an intentional architectural trade-off
(same as Airbnb / MercadoLibre) but must be documented in the architecture doc and in the
runbook. Mitigation: deploy web and admin together; Coolify health checks on both.

### Dev-local caveat

The web→admin session hand-off does NOT work out of the box in local dev without the
`DEV_COOKIE_DOMAIN` recipe (Phase 5). Developers who skip Phase 5 setup will need to sign in
to admin separately. Document this clearly.

### OAuth users (no regression)

OAuth users (e.g. Google) who sign in via the web signin page continue to work correctly —
the `callbackUrl` param is preserved through the OAuth redirect cycle by storing it in the
OAuth `state` parameter or in a short-lived server-side session (Astro `Astro.cookies`).
Implementation detail to resolve during Phase 1 work.

### Admin `callback.tsx` (KEEP)

The OAuth callback route at `/auth/callback` must be kept because OAuth providers redirect
back to the configured redirect URI — changing that URI requires updating the OAuth app config
in each provider's dashboard. For now, `callback.tsx` stays and continues to handle the
OAuth code exchange. After signin it redirects to `/dashboard` (authenticated flow, not the
deleted signup page).

---

## 10. Open questions (unresolved)

| Question | Status |
|----------|--------|
| Should `callbackUrl` be preserved through the OAuth flow? (see §9) | Needs Phase 1 investigation |
| If `HOST_ONBOARD` permission is added (D1-B), which roles get it seeded? | Depends on D1 decision |
| Should the admin `auth/index.tsx` catch-all redirect to web auth or 404? | Resolve in Phase 2 |
