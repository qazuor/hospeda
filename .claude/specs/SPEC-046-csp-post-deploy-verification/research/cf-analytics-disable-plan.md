# Cloudflare Web Analytics — Disable Plan (SPEC-046 GAP-046-11)

> **Date**: 2026-05-17
> **Driver**: SPEC-046 T-012 / T-013 (GAP-046-11)
> **Coordination spec**: [SPEC-140 Self-hosted Analytics Stack (Umami)](../../SPEC-140-analytics-stack-umami/spec.md)
> **Status**: ⏳ pending operator action (T-013) — recommendation finalized, see §4

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

## 3. Decision on the overlap window

The original SPEC-046 T-012 description recommended a **1-week overlap window** ("enable Umami first, run both for 1 week, then disable CF"). After researching the actual state of the CF beacon, **that recommendation no longer applies**:

- CF is not collecting client-side analytics today (beacon broken). There is nothing to "overlap with".
- Leaving the broken beacon enabled while Umami deploys gains us nothing and continues to emit known CSP violations.
- Sentry continues to own error monitoring; CF macro counters continue to be available; nothing else depends on the beacon.

**Revised recommendation: disable CF Web Analytics now, independent of SPEC-140 timing.** Specifically:

1. **Disable CF Web Analytics for `hospeda.com.ar`** in the CF dashboard.
2. **Disable CF Web Analytics for `staging.hospeda.com.ar`** in the CF dashboard.
3. Confirm with a fresh page load that `static.cloudflareinsights.com` no longer appears in DevTools → Network.

The Umami rollout (SPEC-140) can happen on its own timeline. There is no analytics gap created by this sequence because there is no analytics being captured today.

## 4. Coordination with SPEC-140

SPEC-140 is currently **status: draft** (not yet started). Its scope includes the same disable step (SPEC-140 §1, item (a)). To avoid two specs racing the same dashboard operation:

- **Owner of the disable**: whoever first acts on either SPEC-046 T-013 or SPEC-140 (a). Both descriptions point to the same action.
- **De-duplication**: once the disable has been done, both specs' acceptance criteria for that action are satisfied. The first one to land records the timestamp in §5 below; the other one marks its step as completed by reference.
- **If SPEC-140 ships its step (a) first**: SPEC-046 T-013 can be closed with a reference to the SPEC-140 commit/runbook entry. No second disable needed.
- **If SPEC-046 T-013 acts first**: SPEC-140's (a) is pre-satisfied. SPEC-140 proceeds to (b) deploy and (c) integration as planned.

## 5. Execution log

| Date | Operator | Action | Verification |
|------|----------|--------|--------------|
| _pending_ | _tbd_ | Disable Web Analytics for `hospeda.com.ar` in CF dashboard | _tbd_ |
| _pending_ | _tbd_ | Disable Web Analytics for `staging.hospeda.com.ar` in CF dashboard | _tbd_ |
| _pending_ | _tbd_ | Browser DevTools check: zero requests to `static.cloudflareinsights.com` on a fresh load of `staging.hospeda.com.ar/es/alojamientos/` | _tbd_ |

This table is updated by whoever performs the disable (SPEC-046 T-013 or SPEC-140 (a)).

## 6. Risks & rollback

- **Risk**: a future contributor enables CF Web Analytics again without realising it conflicts with Umami / CSP. **Mitigation**: SPEC-140 owns documenting the "do not enable CF auto-inject" rule in `apps/web/CLAUDE.md` (or equivalent) when it ships. SPEC-046 verification (T-014) will surface a regression by re-detecting `static.cloudflareinsights.com` in staging traffic.
- **Rollback**: re-enable in CF dashboard. The beacon still fails (CORS + SRI errors), so re-enabling does NOT restore working analytics — but it would re-introduce the CSP violation source. No actual rollback path makes sense; if Umami fails to ship we live without client-side analytics until the next attempt.

## 7. Acceptance for SPEC-046 T-013

The execution-log row for staging (`staging.hospeda.com.ar`) must show:
- Disable timestamp filled in (ISO 8601).
- Operator name filled in.
- Verification confirming zero requests to `static.cloudflareinsights.com` on `staging.hospeda.com.ar/es/alojamientos/` (Network panel screenshot or text confirmation).

Production (`hospeda.com.ar`) disable should also be done — that closes the SPEC-046 verification for the production crawl planned in T-014 once it deploys.
