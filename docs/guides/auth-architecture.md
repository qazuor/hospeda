# Auth architecture — unified authentication + host-mode access

> Canonical reference for the SPEC-182 unified auth model. Covers the auth
> surfaces, the web→admin hand-off, the role matrix, host provisioning, the
> cross-subdomain session cookie, and the operational coupling this model
> introduces. Related: [auth-local-dev.md](./auth-local-dev.md) (dev cookie
> recipe), ADR-028 / `docs/security/permission-model.md` (SPEC-169
> owner-scoping), `apps/api/docs/route-architecture.md` (API tiers).

## 1. The model in one paragraph

**Consumer auth lives in the web app; the admin panel consumes the shared
session.** The web signin/signup pages (`apps/web/src/pages/[lang]/auth/*`)
are the only auth surface. The admin hosts no signin/signup of its own: its
`/_authed` guard redirects unauthenticated visitors to the web signin with a
`callbackUrl` back into admin, and the session travels between apps via a
cross-subdomain Better Auth cookie. Host status is **earned by action**
(publishing a first accommodation), or provisioned by staff from the admin
back office — never declared on a public signup form. This mirrors the
Airbnb / MercadoLibre pattern and resolved Linear BETA-52 and BETA-57.

## 2. The web→admin hand-off (callbackUrl)

```
unauthenticated user → admin.hospeda.com.ar/accommodations
  └─ /_authed guard (apps/admin/src/routes/_authed.tsx)
       decideAuthedGuard → kind: 'redirect-signin'
       href = {SITE_URL}/{locale}/auth/signin/?callbackUrl={ADMIN_URL}/accommodations
  └─ web signin validates callbackUrl server-side (allowlist)
       • credentials: post-login window.location.replace(callbackUrl)
       • OAuth: callbackUrl passed verbatim as Better Auth callbackURL
  └─ browser lands back on admin; guard reads the shared cookie → allow
```

Key pieces:

| Piece | File | Notes |
|-------|------|-------|
| Guard decision + URL build | `apps/admin/src/lib/authed-guard.ts` | Pure, unit-tested. `redirect-signin` carries the absolute web signin `href`; the callbackUrl is `VITE_ADMIN_URL + pathname`. |
| Guard consumer | `apps/admin/src/routes/_authed.tsx` | `throw redirect({ href })`. All former `/auth/signin` referrers route through `/` → `/dashboard` → guard, so the guard is the single source of the web-signin URL. |
| callbackUrl validation | `apps/web/src/lib/auth-callback.ts` (`validateCallbackUrl`) | Server-side, hostname-based allowlist — NOT regex-on-string (immune to suffix-host, embedded-path, and userinfo `@` attacks). Accepts: configured site/admin origins, `hospeda.com.ar` + subdomains, and (dev only) `localhost` / `*.hospeda.local`. Anything else → locale root. |
| Signin page wiring | `apps/web/src/pages/[lang]/auth/signin.astro` | Reads `?callbackUrl`, validates, takes precedence over `returnUrl`. Passes `externalRedirect` to the island. |
| Island redirect | `apps/web/src/components/auth/SignIn.client.tsx` | With `externalRedirect`, `redirectTo` is used VERBATIM (credentials + OAuth). Without it, the island strips the host and reattaches the browser origin (reverse-proxy workaround) — that strip must never apply to cross-app callbacks. |

`callbackUrl` (cross-app, absolute, allowlisted) is deliberately distinct
from `returnUrl` (same-app, relative path). Do not merge them.

### OAuth

`callbackUrl` survives the OAuth round-trip: the island passes it as Better
Auth's `callbackURL`, and the admin origin is in the API's trusted origins
(`HOSPEDA_ADMIN_URL` / `HOSPEDA_EXTRA_TRUSTED_ORIGINS` →
`apps/api/src/lib/auth-trusted-origins.ts`). OAuth signups on the web get
`role=USER` (the Better Auth default) — correct, because hosts are made by
publishing or by staff, not by signing up.

## 3. Direct admin access — role matrix

Decided by `decideAuthedGuard` (`apps/admin/src/lib/authed-guard.ts`),
covered by `apps/admin/test/lib/authed-guard.test.ts`:

| User state | Decision | Destination |
|-----------|----------|-------------|
| Unauthenticated | `redirect-signin` | Web signin + `callbackUrl={admin URL}` |
| Authenticated, role=USER (tourist), no `ACCESS_PANEL_ADMIN` | `redirect-tourist-funnel` | `{SITE_URL}/{locale}/publicar/?from=admin` |
| role=HOST, has `ACCESS_PANEL_ADMIN` | `allow` | Admin panel, owner-scoped (SPEC-169) — "Modo anfitrión" |
| role=HOST, no `ACCESS_PANEL_ADMIN` | `redirect-forbidden` | `reason=host-missing-permission` (config bug) |
| Staff (ADMIN / SUPER_ADMIN / EDITOR / CLIENT_MANAGER) with `ACCESS_PANEL_ADMIN` | `allow` | Admin panel, full access per role permissions |
| Any role with `passwordChangeRequired` | `redirect-change-password` | `/auth/change-password` (kept in admin) |

Kept admin auth pages: `forbidden.tsx`, `change-password.tsx`,
`callback.tsx` (OAuth landing). Deleted: `signin.tsx`, `signup.tsx`
(BETA-57 dissolved with the latter).

## 4. How someone becomes a HOST

Two paths, both deliberate:

1. **Host-on-publish (self-serve).** A tourist (role=USER) publishes their
   first accommodation via the web funnel (`/{locale}/publicar/`); the
   publish flow promotes them to HOST and creates the trial subscription
   (`apps/api/src/services/accommodation-publish-deps.ts`). Host status is
   earned by action — there is no "sign up as host" form.
2. **Staff provisioning (back office).** Staff with `USER_CREATE` use the
   "Crear host" modal on the admin users list
   (`apps/admin/src/features/users/components/CreateHostAccountAction.tsx`),
   which POSTs to `POST /api/v1/admin/auth/signup-as-host`
   (`apps/api/src/routes/auth/signup-as-host.ts`). The endpoint is
   admin-tier, gated by `PermissionEnum.USER_CREATE` (401 without session,
   403 without the permission — see
   `apps/api/test/integration/auth/signup-as-host.test.ts`), creates the
   user via Better Auth with a temporary password, sets `role=HOST`, and
   audit-logs the mutation. The old public, Origin-checked endpoint is gone.

UI surfaces adapt to host state (D3: `role=HOST` implies ≥1 published
accommodation):

- **UserMenu dropdown** (`UserMenu.client.tsx`): permission-driven —
  `access.panelAdmin` shows the panel item; `access.apiAdmin` discriminates
  "Panel de administración" (staff) vs "Modo anfitrión" (host).
- **/publicar landing CTA** (`HostLandingCta.client.tsx`): HOST → admin
  panel; others → wizard/signin.
- **Mobile menu CTA** (`MobileMenuIsland.astro`): Server Island, resolves the
  role server-side even on cached pages — HOST → admin URL.

## 5. The cross-subdomain session cookie

- **Production**: `crossSubDomainCookies.domain` is pinned to
  `hospeda.com.ar` (`apps/api/src/lib/auth-cookie-domain.ts`), so
  `hospeda.com.ar`, `admin.hospeda.com.ar`, `api.hospeda.com.ar`, and
  `staging.*` all share the Better Auth session cookie. The pin is
  intentional: no env var can rewrite the prod cookie domain.
- **Local dev**: cookies are per-host by default (web and admin sessions are
  separate). To exercise the real web→admin hand-off locally, use the
  `*.hospeda.local` recipe: `HOSPEDA_DEV_COOKIE_DOMAIN=.hospeda.local` +
  `/etc/hosts` entries — full steps in
  [auth-local-dev.md](./auth-local-dev.md).

## 6. Operational coupling (runbook note)

**Admin sign-in depends on web availability.** Since the admin has no signin
page, an unauthenticated admin user cannot start a session while the web app
is down (already-authenticated sessions keep working — the cookie is
validated against the API, not the web). This is an accepted trade-off of the
unified model. Operational consequences:

- Deploy web and admin together; both have Coolify health checks.
- If the web app is hard-down and staff MUST get into admin, restoring the
  web app is the path — there is no admin-local fallback by design.
- The admin's own origin must be configured (`VITE_ADMIN_URL`, build-time
  baked) or the guard cannot build the callbackUrl.

## 7. Environment variables involved

| Var | App | Purpose |
|-----|-----|---------|
| `VITE_SITE_URL` | admin | Web origin for the guard's signin redirect + tourist funnel |
| `VITE_ADMIN_URL` | admin | Admin's own origin → callbackUrl (SPEC-182, build-time) |
| `PUBLIC_ADMIN_URL` / `HOSPEDA_ADMIN_URL` | web / api | Admin origin for web CTAs + allowlist + API CORS/trusted origins |
| `HOSPEDA_DEV_COOKIE_DOMAIN` | api | Dev-only cookie domain override (never set in Coolify) |
| `HOSPEDA_EXTRA_TRUSTED_ORIGINS` | api | Extra CORS + Better Auth trusted origins (staging aliases, dev `.local` hosts) |

All registered in `packages/config` (`pnpm env:check:registry` is the CI
gate).

## 8. Spec lineage

- **SPEC-182** — this model (unified auth, host-mode access). Closed
  BETA-52 (admin redirected to its own dead-end signin) and BETA-57 (admin
  OAuth signup created role=USER — dissolved by deleting the page).
- **SPEC-169** — HOST owner-scoping inside the admin
  (`ACCOMMODATION_VIEW_OWN`, forced server-side). Unchanged by SPEC-182.
- **SPEC-113** — profile-completion guard on the web (orthogonal; runs on
  web routes, not on the admin hand-off).
