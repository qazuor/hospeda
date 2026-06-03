# Auth local dev — cross-subdomain cookie recipe (`*.hospeda.local`)

> SPEC-182 (Phase 5, decision D4). Lets you test the **web → admin session
> hand-off** locally: sign in on the web app and land authenticated in the
> admin panel with the same Better Auth cookie, exactly like production.

## Why this exists

In production the session cookie is scoped to the apex domain
(`crossSubDomainCookies.domain = 'hospeda.com.ar'` in
`apps/api/src/lib/auth.ts`), so `hospeda.com.ar`, `admin.hospeda.com.ar`, and
`api.hospeda.com.ar` all share it. In local development the apps run on
`localhost:4321` / `localhost:3000` / `localhost:3001` — different origins —
and `domain=localhost` cookies are spec-undefined, so the web login is NOT
visible to the admin app.

The recipe maps three `*.hospeda.local` hostnames to `127.0.0.1` and scopes
the dev cookie to `.hospeda.local`, mirroring production behavior.

**If you skip this setup nothing breaks**: cookies stay per-host (the
pre-SPEC-182 behavior) and you simply have to sign in to web and admin
separately. The recipe is only needed when you want to exercise the unified
web→admin auth flow (e.g. the `callbackUrl` round-trip).

## One-time setup

### 1. `/etc/hosts`

Add (requires sudo):

```
127.0.0.1 web.hospeda.local
127.0.0.1 admin.hospeda.local
127.0.0.1 api.hospeda.local
```

> The API host is required too: the cookie is minted by the API and scoped to
> `.hospeda.local` — the browser only sends it to hosts under that domain, so
> the API must be reached as `api.hospeda.local`, not `localhost`.

### 2. `apps/api/.env.local`

```bash
# Scope the Better Auth cookie to the shared dev apex
HOSPEDA_DEV_COOKIE_DOMAIN=.hospeda.local

# The API must trust the .local origins (CORS + Better Auth trustedOrigins)
HOSPEDA_EXTRA_TRUSTED_ORIGINS=http://web.hospeda.local:4321,http://admin.hospeda.local:3000

# Point the app URLs at the .local hosts
HOSPEDA_SITE_URL=http://web.hospeda.local:4321
HOSPEDA_ADMIN_URL=http://admin.hospeda.local:3000
HOSPEDA_BETTER_AUTH_URL=http://api.hospeda.local:3001/api/auth
```

### 3. `apps/web/.env.local`

```bash
HOSPEDA_API_URL=http://api.hospeda.local:3001
PUBLIC_API_URL=http://api.hospeda.local:3001
HOSPEDA_SITE_URL=http://web.hospeda.local:4321
PUBLIC_SITE_URL=http://web.hospeda.local:4321
PUBLIC_ADMIN_URL=http://admin.hospeda.local:3000
```

### 4. `apps/admin/.env.local`

```bash
VITE_API_URL=http://api.hospeda.local:3001
HOSPEDA_API_URL=http://api.hospeda.local:3001
VITE_BETTER_AUTH_URL=http://api.hospeda.local:3001/api/auth
VITE_SITE_URL=http://web.hospeda.local:4321
VITE_ADMIN_URL=http://admin.hospeda.local:3000
```

> Adjust ports if your worktree uses non-default ones (worktree setups often
> run the API/admin on alternate ports — use the same ports you normally use,
> only the hostnames change).

## Verification

1. Start the API, web, and admin dev servers as usual.
2. Open `http://web.hospeda.local:4321/es/auth/signin/` and sign in.
3. In DevTools → Application → Cookies, confirm the Better Auth session cookie
   has `Domain=.hospeda.local`.
4. Navigate to `http://admin.hospeda.local:3000` — the `/_authed` guard should
   resolve your session (no redirect to the web signin).
5. Bonus round-trip: sign out, then visit `http://admin.hospeda.local:3000`
   directly — you should be redirected to
   `http://web.hospeda.local:4321/{locale}/auth/signin/?callbackUrl=...` and,
   after signing in, land back in the admin panel.

## Safety notes

- `HOSPEDA_DEV_COOKIE_DOMAIN` is **ignored in production**: the cookie domain
  is pinned to `hospeda.com.ar` in `apps/api/src/lib/auth-cookie-domain.ts`
  precisely so a stray dev value can never break production sessions. Never
  set this variable in Coolify.
- The web signin `callbackUrl` allowlist already accepts `*.hospeda.local`
  in development (`validateCallbackUrl`, SPEC-182 T-002), so the full
  redirect round-trip works under this recipe.
