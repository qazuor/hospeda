# PostHog Reverse Proxy

> First-party analytics ingestion to defeat ad-blockers (SPEC-181, Linear BETA-77).

## Why

The web app originally sent PostHog events directly to `us.i.posthog.com` and loaded
the SDK from `us-assets.i.posthog.com` (SPEC-140). Both hosts are on major ad-blocker
blocklists (uBlock Origin, Privacy Badger, Brave Shields), so ~25–35% of Argentine
desktop users — who have high ad-blocker adoption — were silently excluded from
analytics. That is not a functional bug; it is a **data-quality** problem that biases
funnels, flags, and experiments.

SPEC-181 routes ingestion through a **first-party** path (`/ingest/*`) on the site
origin. Blocklists cannot block a first-party path without breaking the site itself.
Bonus: the real client IP is forwarded (accurate geo) and first-party cookies survive
ITP/Safari longer.

This **replaces** the SPEC-140 direct-host approach: the external PostHog hosts are no
longer in the web CSP.

## Architecture

```
Browser (even with an ad-blocker)
  │  GET  https://hospeda.com.ar/ingest/static/array.js
  │  POST https://hospeda.com.ar/ingest/e/
  ▼
Cloudflare edge — route hospeda.com.ar/ingest/*  →  PostHog Proxy Worker
  │  strips /ingest, forwards to PostHog Cloud (US):
  │    /static/*  → us-assets.i.posthog.com
  │    /e/,/decide/,/flags/ and the rest → us.i.posthog.com
  │  adds X-Forwarded-For (real IP); no-store on ingestion endpoints
  ▼
PostHog Cloud US
```

The Worker lives in [`infra/cloudflare/posthog-proxy/`](../../infra/cloudflare/posthog-proxy/README.md)
(workspace package `@repo/posthog-proxy-worker`).

## ⚠️ The one rule: deploy order (CSP coupling)

The web CSP (`apps/web/src/lib/middleware-helpers.ts`) and `PUBLIC_POSTHOG_HOST` are
coupled to the Worker. **Deploy the Worker first**, or PostHog breaks silently (most
visibly once CSP moves from Report-Only to enforce).

1. Deploy the Worker and bind the route — see the [Worker README](../../infra/cloudflare/posthog-proxy/README.md).
2. Verify it proxies (curl `/ingest/static/array.js` and `/ingest/e/`).
3. **Atomically** in the web deploy: set `PUBLIC_POSTHOG_HOST=https://<origin>/ingest`
   in Coolify. The CSP already dropped the external hosts (SPEC-181), and the proxy
   path is same-origin (`'self'`), so no CSP host entry is needed.
4. Confirm events in the PostHog dashboard live stream (test with an ad-blocker on).

Reversing steps 1 and 3 causes a broken init window with lost events.

## Configuration

| Env var | Where | Value |
|---------|-------|-------|
| `PUBLIC_POSTHOG_HOST` | Coolify (web, prod) | `https://hospeda.com.ar/ingest` |
| `PUBLIC_POSTHOG_HOST` | Coolify (web, staging) | `https://staging.hospeda.com.ar/ingest` |
| `PUBLIC_POSTHOG_HOST` | local dev | unset (snippet stays off; falls back to `https://us.i.posthog.com`) |

`apps/admin` is out of scope — internal staff have negligible ad-blocker rates, so
`VITE_POSTHOG_HOST` is untouched.

## How it's tested

- **Worker**: `pnpm --filter @repo/posthog-proxy-worker test` — path rewriting, IP
  forwarding, `no-store` on ingestion (no deploy/network needed).
- **CSP regression**: `apps/web/test/lib/middleware-helpers.test.ts` asserts the
  external PostHog hosts are **absent** from every CSP directive — prevents accidental
  re-introduction.

## Related

- Worker: [`infra/cloudflare/posthog-proxy/README.md`](../../infra/cloudflare/posthog-proxy/README.md)
- CSP source: `apps/web/src/lib/middleware-helpers.ts` (`buildCspHeader`)
- Env registry: `packages/config/src/env-registry.client.ts` (`PUBLIC_POSTHOG_HOST`)
- Predecessor: SPEC-140 (initial PostHog integration — web snippet + consent)
