# Cloudflare Web Analytics — Migration Plan (SPEC-046 GAP-046-11)

> **Date**: 2026-05-17
> **Driver**: SPEC-046 T-012 / T-013 (GAP-046-11)
> **Coordination spec**: [SPEC-140 Self-hosted Analytics Stack (Umami)](../../SPEC-140-analytics-stack-umami/spec.md)
> **Status**: ⏳ operator switch pending in CF dashboard (manual setup), code-side migration completed in branch `fix/SPEC-046-cf-web-analytics-manual-snippet`. See §3.

> **PLAN PIVOTED 2026-05-17**: the original recommendation was to disable CF Web Analytics entirely and let Umami (SPEC-140) replace it. After verifying the actual auto-inject state, two new facts surfaced:
> 1. The `cloudflareinsights.com/beacon.min.js` script is no longer auto-injected on production or staging (confirmed via curl on 2026-05-17). Whatever previously enabled it has stopped — likely the SRI hash mismatch caused the feature to silently disable, or someone toggled it off.
> 2. Cloudflare Web Analytics provides Real User Monitoring (Core Web Vitals — FCP, LCP, CLS) data that Umami does NOT cover. Losing it would be a real downgrade.
>
> **Revised plan: switch from Auto Setup to Manual Setup**, keeping CF for RUM while running Umami (SPEC-140) for engagement analytics. Both code-side changes are in this branch; the dashboard switch is the pending operator action.

## 1. Current state

Cloudflare Web Analytics auto-injects `static.cloudflareinsights.com/beacon.min.js` into every HTML response for `hospeda.com.ar` and `staging.hospeda.com.ar`. The beacon is currently **broken in production AND staging**:

- CORS errors on the script fetch.
- Subresource-integrity hash mismatch — the HTML advertises a hash but CF serves a bundle that doesn't match it.

Net effect: **the browser cannot execute the beacon**, so we are NOT collecting any client-side analytics today regardless of whether the auto-inject is "enabled" in the CF dashboard. Cloudflare's server-side macro counters (request totals, top countries) still work because they don't require the beacon — those continue to be available in the CF dashboard even after disable.

Sources:
- SPEC-046 §1C.5 (staging console audit catalogued the beacon failures).
- SPEC-140 §1.Overview (same observation, drove the Umami extraction).

## 2. Target state

- `static.cloudflareinsights.com/beacon.min.js` no longer injected into any response for `hospeda.com.ar` or `staging.hospeda.com.ar`.
- `apps/web` continues to serve full pages without the beacon `<script>` tag (CF performs the auto-inject at edge, so the disable is dashboard-only — no code change in `apps/web` is required).
- A working analytics stack (Umami, per SPEC-140) eventually replaces it. Umami is NOT a hard prerequisite of the disable per §3 below.
- CSP coverage for SPEC-046 Phase 2 enforcement is no longer hostage to a script source we can't fix (the broken beacon was flagged in the spec audit as a `script-src-elem` violation source we couldn't allowlist confidently).

## 3. Revised plan — switch from Auto Setup to Manual Setup

CF Web Analytics has two installation modes:

| Mode | How the beacon is delivered | Issues observed |
|---|---|---|
| **Automatic Setup** (was previously active) | CF proxy injects `<script>` at the edge with an `integrity="sha384-..."` SRI hash | Broken in staging audit 2026-05-16: SRI hash mismatch (CF advertised hash X but served bundle Y) + CORS failure |
| **Manual Setup** (new plan) | Site owner adds the `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"..."}'>` snippet to their own HTML | No SRI, the snippet is generated to match the configured token, controlled origin |

### What changed code-side (this branch)

Branch `fix/SPEC-046-cf-web-analytics-manual-snippet`:

1. **`apps/web/src/layouts/BaseLayout.astro`** — the manual snippet was added inside `<head>`, right before `</head>`. Because the snippet is inline HTML, the middleware walker (SPEC-046 T-002) automatically stamps the `<script>` tag with the per-request nonce. `'strict-dynamic'` in `script-src` then propagates trust to the loaded `beacon.min.js`. No `script-src` allowlist entry is needed.
2. **`apps/web/src/lib/middleware-helpers.ts`** — `buildCspHeader()` now lists `https://cloudflareinsights.com` in `connect-src`. The beacon's RUM telemetry POSTs to that host; without it, the browser blocks the outgoing requests.
3. **`apps/web/test/lib/middleware-helpers.test.ts`** — new assertion locks the `connect-src` allowlist entry so a future change cannot regress it.

### What the operator still needs to do (CF dashboard)

After this branch lands and deploys to staging:

1. **Cloudflare dashboard → Web Analytics**, find the `hospeda.com.ar` site listed.
2. Switch the active installation mode from **Automatic Setup → Manual Setup**. Confirm the displayed snippet token matches the one in `BaseLayout.astro` (currently `2dbd11c61c6a461f9b75acf4a0877a83`); if CF changed the token, update the snippet in code accordingly.
3. Do the same for `staging.hospeda.com.ar` if it appears as a separate site.
4. Wait 5–15 minutes, then check the CF Web Analytics dashboard — it should start receiving RUM events from the manual snippet.

### What did NOT change

- **No `script-src` change**: `strict-dynamic` + per-request nonce on the stamped `<script>` tag covers loading `beacon.min.js`. Adding `static.cloudflareinsights.com` to a host source would be ignored by CSP3 browsers when `'strict-dynamic'` is present, so we leave `script-src` alone.
- **Umami (SPEC-140) plan unchanged** — it deploys when its owner picks it up. CF provides RUM, Umami will provide engagement / pageview analytics. Both stacks coexist; SPEC-140's "replace" framing softens to "complement" but its scope (deploy Umami at `analytics.hospeda.com.ar` + integrate the tracker) is unaffected.

## 4. Coordination with SPEC-140

SPEC-140 is currently **status: draft** (not yet started). Its scope includes the same disable step (SPEC-140 §1, item (a)). To avoid two specs racing the same dashboard operation:

- **Owner of the disable**: whoever first acts on either SPEC-046 T-013 or SPEC-140 (a). Both descriptions point to the same action.
- **De-duplication**: once the disable has been done, both specs' acceptance criteria for that action are satisfied. The first one to land records the timestamp in §5 below; the other one marks its step as completed by reference.
- **If SPEC-140 ships its step (a) first**: SPEC-046 T-013 can be closed with a reference to the SPEC-140 commit/runbook entry. No second disable needed.
- **If SPEC-046 T-013 acts first**: SPEC-140's (a) is pre-satisfied. SPEC-140 proceeds to (b) deploy and (c) integration as planned.

## 5. Execution log

| Date | Operator | Action | Verification |
|------|----------|--------|--------------|
| _pending_ | _tbd_ | Switch `hospeda.com.ar` from Auto Setup → Manual Setup in CF dashboard; confirm token matches `BaseLayout.astro` | _tbd_ |
| _pending_ | _tbd_ | Switch `staging.hospeda.com.ar` from Auto Setup → Manual Setup in CF dashboard | _tbd_ |
| _pending_ | _tbd_ | Browser DevTools check on `staging.hospeda.com.ar/es/alojamientos/`: (a) beacon.min.js loads with no SRI/CORS errors, (b) at least one POST to `cloudflareinsights.com/cdn-cgi/*` returns 2xx | _tbd_ |
| _pending_ | _tbd_ | CF Web Analytics dashboard receives RUM events within 15 min of the switch | _tbd_ |

This table is updated by whoever performs the dashboard switch.

## 6. Risks & rollback

- **Risk**: a future contributor enables CF Web Analytics again without realising it conflicts with Umami / CSP. **Mitigation**: SPEC-140 owns documenting the "do not enable CF auto-inject" rule in `apps/web/CLAUDE.md` (or equivalent) when it ships. SPEC-046 verification (T-014) will surface a regression by re-detecting `static.cloudflareinsights.com` in staging traffic.
- **Rollback**: re-enable in CF dashboard. The beacon still fails (CORS + SRI errors), so re-enabling does NOT restore working analytics — but it would re-introduce the CSP violation source. No actual rollback path makes sense; if Umami fails to ship we live without client-side analytics until the next attempt.

## 7. Acceptance for SPEC-046 T-013 (revised)

The execution-log row for staging (`staging.hospeda.com.ar`) must show:
- Switch timestamp filled in (ISO 8601) — when the operator flipped Auto Setup → Manual Setup in CF dashboard.
- Operator name filled in.
- Verification confirming **two** things on `staging.hospeda.com.ar/es/alojamientos/`:
  1. Exactly ONE request to `static.cloudflareinsights.com/beacon.min.js` (the manual snippet), loaded successfully (no SRI/CORS errors in console).
  2. At least one POST to `cloudflareinsights.com/cdn-cgi/...` succeeded (RUM telemetry going through).

Production (`hospeda.com.ar`) switch should also be done — that closes the SPEC-046 verification for the production crawl planned in T-014 once it deploys.
