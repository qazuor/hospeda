# Sentry Tunnel

> First-party error ingestion to defeat ad-blockers (SPEC-181 follow-up). Sibling
> of the [PostHog Reverse Proxy](./posthog-proxy.md).

## Reserved first-party proxy paths (read this first)

Hospeda runs **two** first-party reverse proxies that exist purely to stop
ad-blockers from dropping telemetry. They look similar but are **different
mechanisms bound to different paths and Workers**. Do not confuse, merge, or
repurpose them, and never point an application/API route at these paths:

| Path           | Worker                                  | Upstream                          | Mechanism                                          | Web env var to enable it          |
| -------------- | --------------------------------------- | --------------------------------- | -------------------------------------------------- | --------------------------------- |
| `/api/relay/*` | `posthog-proxy` (`@repo/posthog-proxy-worker`) | PostHog Cloud (fixed host)        | Blind passthrough; rewrites `/api/relay`→PostHog   | `PUBLIC_POSTHOG_HOST=…/api/relay` |
| `/api/event`   | `sentry-tunnel` (`@repo/sentry-tunnel-worker`) | Sentry (host derived from DSN)    | Reads envelope, parses DSN, SSRF-guards, forwards  | `PUBLIC_SENTRY_TUNNEL=/api/event` |

Why they can't be one Worker:

- **PostHog** forwards to a *constant* host (a dumb passthrough).
- **Sentry's** upstream host lives *inside each envelope* (the DSN on the first
  line), so the Sentry Worker parses it per request and SSRF-guards it.
- Each path binds to a *separate* Cloudflare route; a route pattern maps to one
  Worker only.

## Why

The web app reports errors with `@sentry/astro`. The browser SDK sends
"envelopes" to `*.sentry.io`, which uBlock Origin blocks via the filter
`||sentry.io^$3p`. Users with an ad-blocker — high adoption in the Argentina
market — silently never report client errors, so the errors that hit exactly the
users we most want to hear from never reach the dashboard.

The tunnel routes envelopes through a **first-party** path (`/api/event`) on the
site origin. Blocklists can't block a first-party path without breaking the site.

## Architecture

```
Browser (even with an ad-blocker)
  │  POST https://hospeda.com.ar/api/event   (Sentry envelope in the body)
  ▼
Cloudflare edge — route hospeda.com.ar/api/event  →  Sentry Tunnel Worker
  │  1. reads the envelope body
  │  2. parses the first line (JSON) → dsn
  │  3. derives { host, projectId } from the dsn
  │  4. SSRF guard: host must be *.sentry.io, projectId numeric → else 403
  │  5. POST raw envelope → https://<host>/api/<projectId>/envelope/
  │     adds X-Forwarded-For (real IP); no-store
  ▼
Sentry
```

The Worker lives in [`infra/cloudflare/sentry-tunnel/`](../../infra/cloudflare/sentry-tunnel/README.md)
(workspace package `@repo/sentry-tunnel-worker`).

### SSRF guard (the important part)

Unlike PostHog, the Sentry upstream is attacker-influenceable: the host comes
from the envelope body. Without validation, anyone could POST an envelope whose
DSN points anywhere and turn the tunnel into an open proxy. The Worker therefore
forwards **only** when the DSN host is a `*.sentry.io` host AND the project id is
numeric. This is covered by `worker.test.ts`.

## Scope: browser only

Only the **browser** SDK (`sentry.client.config.ts`) uses the tunnel. The
server-side SDK (`sentry.server.config.ts`) reports to Sentry directly — SSR runs
in Node, has no ad-blocker, and is not subject to the browser CSP. A relative
tunnel path would have no origin to resolve against in Node anyway.

CSP **violation reports** (`report-uri`) are NOT tunneled either — they are
emitted by the browser (not the SDK) and are independent of `connect-src`. They
still go to `*.sentry.io` directly; an ad-blocker dropping that security metadata
is acceptable. Proxying it would be a separate follow-up.

## ⚠️ The one rule: deploy order (CSP coupling)

The web CSP (`apps/web/src/lib/middleware-helpers.ts`) and `PUBLIC_SENTRY_TUNNEL`
are coupled to the Worker. **Deploy the Worker first**, or Sentry breaks silently
once the CSP drops `https://*.sentry.io`.

1. Deploy the Worker and bind the route — see the [Worker README](../../infra/cloudflare/sentry-tunnel/README.md).
2. Verify it forwards (curl a valid envelope → 200; a non-sentry DSN → 403).
3. **Atomically** in the web deploy: set `PUBLIC_SENTRY_TUNNEL=/api/event` in
   Coolify. Setting it automatically drops the external `https://*.sentry.io`
   `connect-src` entry (the tunnel path is same-origin, `'self'`).
4. Confirm events in the Sentry dashboard (test with an ad-blocker on).

Reversing steps 1 and 3 loses browser error reports.

## Configuration

| Env var | Where | Value |
|---------|-------|-------|
| `PUBLIC_SENTRY_TUNNEL` | Coolify (web, prod) | `/api/event` |
| `PUBLIC_SENTRY_TUNNEL` | Coolify (web, staging) | `/api/event` |
| `PUBLIC_SENTRY_TUNNEL` | local dev | unset (reports directly to Sentry; `*.sentry.io` stays in CSP) |

`apps/admin` is out of scope (internal staff, negligible ad-blocker rate).

## How it's tested

- **Worker**: `pnpm --filter @repo/sentry-tunnel-worker test` — DSN parsing, the
  SSRF guard, envelope forwarding, IP forwarding, `no-store`, method/path
  rejection (no deploy/network needed).
- **CSP regression**: `apps/web/test/lib/middleware-helpers.test.ts` asserts that
  `https://*.sentry.io` is present when the tunnel is OFF and absent when it is
  ON — prevents accidental CSP drift.

## Related

- Worker: [`infra/cloudflare/sentry-tunnel/README.md`](../../infra/cloudflare/sentry-tunnel/README.md)
- Sibling proxy: [PostHog Reverse Proxy](./posthog-proxy.md)
- CSP source: `apps/web/src/lib/middleware-helpers.ts` (`buildCspHeader`)
- Env registry: `packages/config/src/env-registry.client.ts` (`PUBLIC_SENTRY_TUNNEL`)
- SDK init: `apps/web/sentry.client.config.ts` (`tunnel` option)
