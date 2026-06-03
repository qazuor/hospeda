# Sentry Tunnel Worker (SPEC-181 follow-up)

A Cloudflare Worker that tunnels Sentry SDK **envelopes** (errors, traces,
replays) under a **first-party** path (`/api/event`) on the site origin, so
ad-blockers and privacy extensions cannot intercept error reporting. uBlock
Origin blocks Sentry directly with the filter `||sentry.io^$3p`; routing the
envelopes through a same-origin path defeats that.

This is the Sentry sibling of the PostHog reverse proxy
(`infra/cloudflare/posthog-proxy/`). **They are NOT the same and must not be
merged** — see the reserved-paths table below.

## ⚠️ Reserved first-party proxy paths — do not reuse or repurpose

Two distinct origin paths are reserved for ad-blocker-evading reverse proxies.
Each is bound to its OWN Cloudflare Worker and forwards to a DIFFERENT upstream.
**Never point application/API routes at these paths, and never route one
service's traffic through the other's path.**

| Path         | Worker                  | Upstream                                  | Mechanism                                            | SDK wiring                          |
| ------------ | ----------------------- | ----------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| `/api/relay/*` | `posthog-proxy`         | PostHog Cloud (fixed host)                | Blind passthrough; path rewrite `/api/relay`→PostHog | `PUBLIC_POSTHOG_HOST` = `…/api/relay` |
| `/api/event`   | `sentry-tunnel` (this)  | Sentry (host derived per-request from DSN) | Reads envelope, parses DSN, SSRF-guards, forwards    | `PUBLIC_SENTRY_TUNNEL` = `/api/event` |

Key differences (why one Worker can't serve both):

- **PostHog** is a passthrough to a *constant* host. **Sentry's** upstream host
  is *inside each envelope* (the DSN in the first line), so this Worker parses
  it per request.
- The paths bind to *separate* Cloudflare routes; a single route pattern can
  only map to one Worker.

## What it does

`POST /api/event` with a Sentry envelope body:

1. Reads the envelope body and takes its **first line** (a JSON header).
2. Parses the header and extracts `dsn`.
3. Derives `{ host, projectId }` from the DSN.
4. **SSRF guard** — forwards ONLY when `host` is a `*.sentry.io` host **and**
   `projectId` is numeric. Anything else → `403`. This is the most important
   line in the Worker: without it, a crafted envelope could make the tunnel
   forward to an arbitrary host (open proxy).
5. Forwards the raw envelope to `https://<host>/api/<projectId>/envelope/` with
   `Cache-Control: no-store` and the real client IP as `X-Forwarded-For`.

Non-`POST` methods → `405`. Any path other than `/api/event` → `404`.

## ⚠️ CRITICAL: deploy order (CSP coupling)

The web app's CSP (`apps/web/src/lib/middleware-helpers.ts`) and the
`PUBLIC_SENTRY_TUNNEL` env var are coupled to this Worker. **Deploy the Worker
BEFORE flipping the app to the tunnel**, or Sentry breaks silently once the CSP
drops `https://*.sentry.io`.

Correct order:

1. **Deploy this Worker** and configure its routes (below).
2. **Verify** it forwards correctly (see "Verify") — do NOT skip this.
3. **Atomically** in the web app deploy: set `PUBLIC_SENTRY_TUNNEL=/api/event`
   in Coolify. The CSP automatically drops the external `https://*.sentry.io`
   `connect-src` entry whenever `PUBLIC_SENTRY_TUNNEL` is set (the tunnel path
   is same-origin, covered by `'self'`).
4. **Confirm** events arrive in the Sentry dashboard (with uBlock enabled).

Reversing steps 1 and 3 causes a broken window with lost error reports.

> The server-side Sentry SDK (`sentry.server.config.ts`) intentionally does NOT
> use the tunnel — SSR runs in Node, has no ad-blocker and is not subject to the
> browser CSP, so it reports to Sentry directly.
>
> CSP **violation reports** (`report-uri`) still go to `*.sentry.io` directly —
> they are emitted by the browser, not the SDK, so the tunnel doesn't cover them.
> They are security metadata (not user-facing error reports) and an ad-blocker
> dropping them is acceptable. Proxying them too would be a separate follow-up.

## Deploy (owner action)

Requires the `wrangler` CLI (`npm i -g wrangler`) and Cloudflare auth
(`wrangler login`). `wrangler` is intentionally **not** a repo dependency — it
is a one-off operator tool run from your machine or the VPS.

`wrangler.toml` defines two environments; the route is bound automatically per env:

```bash
cd infra/cloudflare/sentry-tunnel

# Staging first (Worker named sentry-tunnel-staging, route staging.hospeda.com.ar/api/event)
wrangler deploy --env staging

# Production later, once staging is verified (route hospeda.com.ar/api/event)
wrangler deploy --env production
```

## Verify

```bash
# A minimal envelope with a valid sentry.io DSN should be forwarded (200/ok):
curl -i -X POST https://staging.hospeda.com.ar/api/event \
  -H 'content-type: application/x-sentry-envelope' \
  --data $'{"dsn":"https://PUBLIC_KEY@oORG.ingest.us.sentry.io/PROJECT_ID"}\n{"type":"event"}\n{}\n'

# A non-sentry DSN must be REJECTED with 403 (SSRF guard):
curl -i -X POST https://staging.hospeda.com.ar/api/event \
  -H 'content-type: application/x-sentry-envelope' \
  --data $'{"dsn":"https://k@evil.example.com/1"}\n{"type":"event"}\n{}\n'
```

In the browser (with uBlock Origin enabled), trigger a client error, open
DevTools → Network and confirm the request to `/api/event` returns 200 and the
event shows up in the Sentry dashboard.

## Test

```bash
pnpm --filter @repo/sentry-tunnel-worker test
```

The unit test (`worker.test.ts`) mocks `fetch` and asserts DSN parsing, the
SSRF guard (non-sentry host / non-numeric project id → rejected), envelope
forwarding, `X-Forwarded-For`, `Cache-Control: no-store`, and method/path
rejection — no network or deploy required.

## Out of scope

- `apps/admin` (internal staff, negligible ad-blocker rate).
- CSP `report-uri` proxying (browser-emitted, separate concern — see note above).
- Self-hosted Sentry / region migration (the SSRF guard already accepts any
  `*.sentry.io` region host).
- CI/CD automation of the Worker deploy (manual operator action).
