# PostHog Reverse Proxy Worker (SPEC-181)

A Cloudflare Worker that proxies PostHog ingestion and static assets under a
**first-party** path (`/api/relay/*`) on the site origin, so ad-blockers and privacy
extensions cannot intercept analytics. Recovers the ~25–35% desktop analytics loss
observed in the Argentina market (Linear BETA-77).

## What it does

After stripping the `/api/relay` prefix:

| Incoming path                  | Forwarded to                          | Cached? |
| ------------------------------ | ------------------------------------- | ------- |
| `/api/relay/static/*`             | `https://us-assets.i.posthog.com/*`   | yes (assets) |
| `/api/relay/e/`                   | `https://us.i.posthog.com/e/`         | **no-store** |
| `/api/relay/decide/`              | `https://us.i.posthog.com/decide/`    | **no-store** |
| `/api/relay/flags/`               | `https://us.i.posthog.com/flags/`     | **no-store** |
| anything else                  | `https://us.i.posthog.com/*`          | passthrough |

It also forwards the real client IP as `X-Forwarded-For` (from Cloudflare's
`cf-connecting-ip`) so PostHog geo-lookup stays accurate.

## ⚠️ CRITICAL: deploy order (CSP coupling)

The web app's CSP (`apps/web/src/lib/middleware-helpers.ts`) and the
`PUBLIC_POSTHOG_HOST` env var are coupled to this Worker. **Deploy the Worker
BEFORE flipping the app to the proxy**, or PostHog breaks silently (especially
once CSP moves from Report-Only to enforce).

Correct order:

1. **Deploy this Worker** and configure its routes (below).
2. **Verify** it proxies correctly (see "Verify" below) — do NOT skip this.
3. **Atomically** in the web app deploy: set `PUBLIC_POSTHOG_HOST=https://<origin>/api/relay`
   in Coolify **and** ensure the CSP no longer lists `us.i.posthog.com` /
   `us-assets.i.posthog.com` (the proxy path is same-origin, covered by `'self'`).
4. **Confirm** events arrive in the PostHog dashboard live stream.

Reversing steps 1 and 3 causes a broken init window with lost events.

## Deploy (owner action — T-010)

Requires the `wrangler` CLI (`npm i -g wrangler`) and Cloudflare auth
(`wrangler login`). `wrangler` is intentionally **not** a repo dependency — it is
a one-off operator tool run from your machine or the VPS.

`wrangler.toml` defines two environments; the route is bound automatically per env:

```bash
cd infra/cloudflare/posthog-proxy

# Staging first (Worker named posthog-proxy-staging, route staging.hospeda.com.ar/api/relay/*)
wrangler deploy --env staging

# Production later, once staging is verified (route hospeda.com.ar/api/relay/*)
wrangler deploy --env production
```

## Verify

```bash
# Static asset (should return the PostHog array.js, 200):
curl -i https://hospeda.com.ar/api/relay/static/array.js

# Ingestion endpoint (should proxy to us.i.posthog.com, no-store):
curl -i -X POST https://hospeda.com.ar/api/relay/e/ \
  -H 'content-type: application/json' --data '{}'
```

In the browser (with uBlock Origin enabled), open DevTools → Network and confirm
requests to `/api/relay/e/` return 200 and events show up in the PostHog dashboard.

## Test

```bash
pnpm --filter @repo/posthog-proxy-worker test
```

The unit test (`worker.test.ts`) mocks `fetch` and asserts path rewriting, the
`X-Forwarded-For` forwarding, and `Cache-Control: no-store` on ingestion endpoints —
no network or deploy required.

## Out of scope

- `apps/admin` (internal staff, negligible ad-blocker rate) — `VITE_POSTHOG_HOST`
  is untouched.
- Self-hosted PostHog / EU Cloud migration.
- CI/CD automation of the Worker deploy (manual operator action).
