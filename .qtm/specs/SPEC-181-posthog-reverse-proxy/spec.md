---
spec-id: SPEC-181
title: PostHog Reverse Proxy — first-party analytics ingestion (web)
type: fix
complexity: low-medium
status: completed
created: 2026-06-02T00:00:00Z
linear: BETA-77
references:
  - SPEC-140 (PostHog initial integration — web snippet + consent)
  - SPEC-142 (CSP phase 2 and coverage)
---

# SPEC-181 — PostHog Reverse Proxy — first-party analytics ingestion (web)

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal.** Route PostHog analytics ingestion through a first-party path on `hospeda.com.ar` so that
ad-blockers and privacy extensions cannot intercept it, recovering the ~25–35% desktop analytics loss
observed in the Argentina market.

**Problem.** The web app currently sends PostHog events directly to `us.i.posthog.com` (ingestion)
and loads `array.js` from `us-assets.i.posthog.com` (static assets). Both hosts appear in major
browser extension blocklists (uBlock Origin, Privacy Badger, Brave Shields), causing a significant
fraction of Argentine desktop users — who have relatively high ad-blocker adoption — to be silently
excluded from analytics. This is **not a functional bug** for end users; it is a **data-quality gap**
that produces undercounted, statistically biased analytics.

**Motivation.** Biased event data makes product decisions unreliable. Feature flags, A/B experiments,
and funnel analysis all degrade when a consistent segment of users (typically more privacy-conscious,
technically sophisticated users) is invisible.

**Solution.** A Cloudflare Worker that proxies PostHog ingestion endpoints under a first-party path
(`/ingest/*`) on `hospeda.com.ar`. Blocklists cannot block first-party paths without breaking the
site itself. Bonus benefits: real client IP is forwarded (PostHog geo-lookup accuracy), and
first-party cookies survive ITP/Safari restrictions longer.

**Scope.** Web app (`apps/web`) ONLY. `apps/admin` is intentionally out of scope — it is used by
internal staff, who have negligible ad-blocker rates, and admin-side data gaps do not affect product
analytics.

**Decisions locked (do not re-litigate).**

- **Cloudflare Worker** is the chosen proxy mechanism (NOT nginx/VPS reverse proxy). Cloudflare
  already fronts the entire site; Workers run at the edge for free at this traffic level (<100k
  req/day); no new infrastructure is required.
- **Route pattern**: `hospeda.com.ar/ingest/*` → Worker. The Worker proxies ingestion
  (`/e/`, `/decide/`, `/flags/`) to `https://us.i.posthog.com` and static assets (`/static/*`)
  to `https://us-assets.i.posthog.com`. Ingestion endpoints must NOT be cached by Cloudflare.
- **CSP coupling**: `apps/web/src/lib/middleware-helpers.ts` hardcodes `us.i.posthog.com` and
  `us-assets.i.posthog.com` in `script-src`, `connect-src`, and `img-src`. Changing
  `PUBLIC_POSTHOG_HOST` to the proxy URL without updating the CSP in the **same deploy** will
  silently break PostHog — once CSP moves to enforce mode (currently Report-Only). The CSP change
  and the env var change must be treated as one atomic update.
- **`PUBLIC_POSTHOG_HOST` env var** already exists in `packages/config/src/env-registry.client.ts`
  and `apps/web/src/env.ts`; no new var registration is needed beyond updating the description/
  default hint to reflect the proxy.
- **apps/admin is OUT OF SCOPE.** `VITE_POSTHOG_HOST` and `VITE_POSTHOG_KEY` (admin) are untouched.

### 2. User Stories & Acceptance Criteria (BDD)

**US-1 — Analytics events reach PostHog through the proxy (happy path).**

- GIVEN `PUBLIC_POSTHOG_HOST=https://hospeda.com.ar/ingest` is set and the Cloudflare Worker is
  deployed with route `hospeda.com.ar/ingest/*`
- WHEN a user (even one with uBlock Origin enabled) visits any page and triggers a pageview or
  custom event
- THEN the event POST reaches `https://us.i.posthog.com/e/` via the Worker
- AND PostHog receives the correct `client_ip` (forwarded from Cloudflare)
- AND the event appears in the PostHog dashboard within normal ingestion delay.

**US-2 — Static asset (`array.js`) loads through the proxy.**

- GIVEN the Worker route is active
- WHEN the PostHog snippet initialises and builds the `array.js` URL from `api_host`
- THEN the request for `/static/array.js` hits the Worker which forwards to `us-assets.i.posthog.com`
- AND the script loads correctly, upgrading `window.posthog` from the stub to the real SDK.

**US-3 — Ingestion endpoints are NOT cached by Cloudflare.**

- GIVEN the Worker handles `/e/`, `/decide/`, `/flags/` requests
- WHEN these endpoints respond
- THEN Cloudflare does NOT cache them (no `Cache-Control: public` or Cloudflare cache artefacts on
  event POSTs — events carry session data that must not be replayed).

**US-4 — CSP allows the proxy host instead of the external PostHog hosts.**

- GIVEN `PUBLIC_POSTHOG_HOST=https://hospeda.com.ar/ingest`
- WHEN the middleware builds the CSP header
- THEN `script-src` contains `hospeda.com.ar` (or the generic site origin) instead of
  `us.i.posthog.com` / `us-assets.i.posthog.com`
- AND `connect-src` allows `hospeda.com.ar/ingest` for event POSTs
- AND `img-src` allows `hospeda.com.ar` for the fallback pixel
- AND NO `us.i.posthog.com` or `us-assets.i.posthog.com` remains in the CSP directives.

**US-5 — Fallback: proxy absent = graceful degradation (not a crash).**

- GIVEN `PUBLIC_POSTHOG_HOST` is unset (dev/local environment) or the Worker is unreachable
- WHEN the snippet tries to init
- THEN the existing behavior applies (snippet skips init when key is empty; network errors from
  the direct PostHog host do not break the page — same as today).

**US-6 — No event loss during the transition.**

- GIVEN the old CSP (direct PostHog hosts) is live until the atomic deploy
- WHEN the deploy that simultaneously sets `PUBLIC_POSTHOG_HOST` to the proxy AND removes the
  external hosts from the CSP is pushed
- THEN events continue flowing without a gap (Worker was already deployed before the app change).

### 3. UX Considerations

This spec has **no user-facing UX changes**. The PostHog snippet on each page renders identically
from the user's perspective; only the destination URL changes.

For the **operator** (person deploying):

- The Worker must be deployed and the Cloudflare route configured BEFORE setting `PUBLIC_POSTHOG_HOST`
  to the proxy URL in Coolify. Reversing this order causes a broken init window.
- The recommended deployment order is: (1) deploy Worker, (2) verify via `curl`/DevTools that
  `hospeda.com.ar/ingest/e/` proxies correctly, (3) update `PUBLIC_POSTHOG_HOST` in Coolify and
  redeploy web, (4) confirm events in PostHog dashboard.

### 4. Out of Scope

- Admin app (`apps/admin`) — VITE_POSTHOG_HOST is not changed.
- Self-hosted PostHog — only the Cloudflare Worker proxy to PostHog Cloud (US) is in scope.
- EU Cloud migration — unrelated to this spec.
- Session recording or feature flags behavior changes — only ingestion routing changes.
- Worker deployment automation via CI/CD — deploy is a manual operator action.
- Changes to the consent / cookie-consent system (SPEC-140 behavior is preserved).

## Part 2 — Technical Analysis

### 5. Architecture

```
Browser (user with ad-blocker)
  │
  │  GET https://hospeda.com.ar/ingest/static/array.js
  │  POST https://hospeda.com.ar/ingest/e/
  ▼
Cloudflare Edge
  ├─ Route: hospeda.com.ar/ingest/*  →  PostHog Proxy Worker
  │    Worker rewrites path, forwards to PostHog Cloud (US)
  │    Adds X-Forwarded-For header for real IP
  │    Sets no-cache headers on ingestion endpoints
  ▼
PostHog Cloud US  (us.i.posthog.com / us-assets.i.posthog.com)
```

The PostHog snippet in `PostHogScript.astro` uses `api_host: posthogHost`. The built-in asset URL
derivation in the stub does:

```js
p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"
```

When `api_host` is `https://hospeda.com.ar/ingest`, the `.replace()` produces
`https://hospeda.com.ar/ingest` (no match — the replacement is a no-op), and the asset URL becomes
`https://hospeda.com.ar/ingest/static/array.js`. The Worker must handle the `/static/*` path and
forward it to `us-assets.i.posthog.com/static/*`. This is verified in the official PostHog Worker
guide and is accounted for in the Worker design below.

### 6. Cloudflare Worker Design

Location: `infra/cloudflare/posthog-proxy/` (proposed — no existing `infra/` dir in the repo).

Files:

- `worker.js` — the proxy script (~50 lines, based on official PostHog Cloudflare Worker template)
- `wrangler.toml` — Wrangler config (name, compatibility_date, route placeholder)
- `README.md` — deploy instructions + the CSP coupling gotcha

Worker logic (official PostHog pattern):

1. Strip the `/ingest` prefix from the incoming URL.
2. Determine the upstream host:
   - Path starts with `/static/` → `us-assets.i.posthog.com`
   - All other paths → `us.i.posthog.com`
3. Forward the request with original method, headers, and body.
4. Forward `X-Forwarded-For` with the real client IP.
5. For ingestion endpoints (`/e/`, `/decide/`, `/flags/`): add `Cache-Control: no-store` on both
   request and response to prevent Cloudflare caching.
6. Return the upstream response unmodified (status, headers, body).

### 7. CSP Changes (`apps/web/src/lib/middleware-helpers.ts`)

Current state (lines 508, 529–530):

- `script-src`: includes `https://us.i.posthog.com https://us-assets.i.posthog.com`
- `img-src`: includes `https://us.i.posthog.com`
- `connect-src`: includes `https://us.i.posthog.com https://us-assets.i.posthog.com`

After this spec:

- Remove all four `us.i.posthog.com` / `us-assets.i.posthog.com` occurrences.
- The proxy path is `hospeda.com.ar/ingest/*`, which is same-origin for the web app — `'self'`
  in `connect-src` and `img-src` already covers it. No new CSP host entry is needed for the
  production domain.
- For staging (`staging.hospeda.com.ar`): also same-origin.
- For local dev: `PUBLIC_POSTHOG_HOST` is unset → snippet does not render → CSP change is
  irrelevant in dev.

The comment block (lines 500–505) referencing SPEC-140 and the PostHog allowlist rationale must
be updated to document the proxy approach.

### 8. `PUBLIC_POSTHOG_HOST` env-registry update

`PUBLIC_POSTHOG_HOST` is already registered in `packages/config/src/env-registry.client.ts`
(lines 184–200). The `description`, `descriptionEs`, `defaultValue`, `exampleValue`, and
`howToObtain`/`howToObtainEs` fields must be updated to:

- State that the recommended value is `https://hospeda.com.ar/ingest` (the Worker route).
- Mention that changing this var requires a matching CSP update in `middleware-helpers.ts`.
- Keep `https://us.i.posthog.com` as the fallback for environments without the Worker.

`apps/web/.env.example` must be updated to show the proxy URL as the recommended value.

### 9. PostHog snippet compatibility

The snippet in `PostHogScript.astro` (line 64) contains the official PostHog stub inline. The
asset URL derivation uses `.replace(".i.posthog.com", "-assets.i.posthog.com")`. When
`posthogHost = "https://hospeda.com.ar/ingest"`, this replace is a no-op, and the asset URL
becomes `https://hospeda.com.ar/ingest/static/array.js` — which is what the Worker must handle.
**No change to the snippet body is required.** The Worker's `/static/*` forwarding takes care of it.

### 10. Dependencies

None new. The Cloudflare Worker uses no npm packages — it is a pure Service Worker / Fetch API
script. `wrangler` CLI is used for deploy but is NOT added to the repo's dependencies (it is a
developer tool used one-off from the VPS or a developer's machine).

### 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| CSP updated before Worker deployed | High — PostHog breaks silently | Deploy Worker first, verify, THEN flip env var + CSP atomically |
| `PUBLIC_POSTHOG_HOST` set before Worker route is live | Medium — events 404 | Same deployment order: Worker first |
| Cloudflare caches event POSTs | High — duplicated/stale events | Worker sets `Cache-Control: no-store` on ingestion endpoints |
| Asset URL derivation broken (array.js 404) | High — SDK stub never upgrades | Worker handles `/static/*` → `us-assets.i.posthog.com`; verified in spec §5 |
| Staging uses wrong host | Low | Each Coolify resource sets its own `PUBLIC_POSTHOG_HOST`; staging uses `staging.hospeda.com.ar/ingest` |
| CSP still allows old PostHog hosts in both-mode transition | Low | Remove old hosts and `'self'` covers the proxy; atomicity is enforced by spec rule |

### 12. Testing Strategy (no tests = not done)

- **Unit test (Worker)**: a Vitest or worker-test-env test that confirms path rewriting for
  `/ingest/e/`, `/ingest/decide/`, `/ingest/static/array.js` hits the correct upstream host with
  correct headers and no-cache on ingestion paths.
- **CSP regression test** (`apps/web/test/lib/middleware-helpers.test.ts` if it exists, or a
  new snapshot test): confirm that the PostHog host strings `us.i.posthog.com` /
  `us-assets.i.posthog.com` are NOT present in the CSP directives produced by
  `buildCspHeader` (or equivalent). This prevents accidental re-introduction.
- **Env-registry validation**: existing `pnpm env:check:registry` CI gate covers that the
  registry and app schemas agree — no new test needed beyond verifying it still passes.
- **Manual smoke** (operator, post-deploy): with uBlock Origin enabled on desktop, open
  `https://hospeda.com.ar`, open DevTools Network, verify requests to `/ingest/e/` return 200
  and events appear in the PostHog dashboard live stream.

## Implementation Approach (phases)

1. **phase-worker** — Author the Cloudflare Worker + wrangler.toml + README in
   `infra/cloudflare/posthog-proxy/`. Worker test. Owner deploys Worker + sets Cloudflare route.
2. **phase-app** — Update CSP in `middleware-helpers.ts` (remove old PostHog hosts, update
   comment). Update `PUBLIC_POSTHOG_HOST` default/hint in env-registry + `.env.example`. CSP
   regression test.
3. **phase-docs** — Document the proxy setup and CSP coupling gotcha (guide in
   `docs/guides/posthog-proxy.md`). Update SPEC-140 reference in docs.
4. **phase-verify** — Operator deploys app changes (Coolify), runs manual smoke with ad-blocker.
   Confirms ingestion endpoints not cached. Flips spec + task indexes to completed.

## Internal Review Notes

- **CSP coupling is the highest-risk item.** The spec mandates the Worker MUST be deployed before
  `PUBLIC_POSTHOG_HOST` is changed in Coolify. Document this clearly in the Worker README and in
  the deployment guide.
- **No new env vars.** `PUBLIC_POSTHOG_HOST` already exists; only its description and example
  value change.
- **apps/admin unchanged.** `VITE_POSTHOG_HOST` is deliberately untouched.
- **Operator actions** are explicitly called out in T-002, T-010, T-011 — these are not
  automatable and require human action in the Cloudflare dashboard and Coolify.
- **Open question (low priority)**: whether `staging.hospeda.com.ar/ingest` needs a separate
  Worker or can reuse the same Worker by checking the `Host` header. Simplest approach: one
  Worker deployed to both `hospeda.com.ar/ingest/*` and `staging.hospeda.com.ar/ingest/*`
  routes. Resolve at deployment time.
