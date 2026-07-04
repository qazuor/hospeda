---
title: "Accommodation import — async extraction path for slow/blocked sources (SPEC-277 R3)"
linear: HOS-50
statusSource: linear
created: 2026-07-01
type: improvement
areas:
  - api
  - web
  - admin
---

# Accommodation import — async extraction path for slow/blocked sources (SPEC-277 R3)

> Migrated from `.qtm/specs/SPEC-281-import-scraper-async-path/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-50.
>
> Follow-up of **SPEC-277**. SPEC-277 shipped four of its five resilience levers
> (R1 retry/backoff, R2 per-source Generic fallback, R4 provider-mitigation
> runbook, R5 guaranteed manual path). **R3 — the async extraction path — was
> deliberately deferred to this spec** because it is the heaviest lever: it adds
> UX and state on two client surfaces and a new route shape, and it is
> independently releasable from R1/R2.

## 1. Background

Apify actors for Airbnb and Booking run **synchronously for 8–120s** via the
`run-sync-get-dataset-items` endpoint. Today the import is one blocking request:
the web onboarding mini-form (SPEC-258 B) and the admin `ImportFromUrlSection`
both wait the full duration with a spinner. R1 (retry) can multiply that wait on
a transient block, and R5 keeps the form usable, but the **request itself still
blocks** for the worst-case window.

SPEC-250 already added the async Apify primitives to `apify-client.ts`:
`startApifyRun` + `getApifyRunStatus` + `getApifyDatasetItems`. They are present
and tested but **not yet wired into the import flow**. R3 wires them so a slow
import becomes a `202 + poll` instead of one long-held request.

## 2. Goals

- A slow Airbnb/Booking import no longer holds an HTTP request open for 8–120s.
- Reuse the SPEC-250 async helpers verbatim — no new Apify client surface.
- The web and admin forms poll and fill in when the run completes, staying
  responsive and cancellable throughout.
- The existing synchronous contract still works for fast sources (no regression
  for Google Places / MercadoLibre / Generic).

## 3. Scope

- **Service / adapter**: an async extraction mode for the Airbnb and Booking
  adapters (or the orchestrator) that calls `startApifyRun`, returns a run handle,
  and exposes a status/result poll that maps `SUCCEEDED` → dataset items →
  `RawExtraction` (reusing the existing mapping) and `FAILED`/`TIMED-OUT`/`ABORTED`
  → the matching `ImportFailureCode` from SPEC-258 C.1.
- **API route**: a `202 + poll` shape for the import endpoint(s) — e.g. a start
  call returning a run id/token and a status call the client polls. Must compose
  with R1 (retry policy on the async path) and R2 (fallback when the async run
  ends blocked).
- **Web**: the onboarding mini-form (SPEC-258 B) polls and fills fields when ready.
- **Admin**: `ImportFromUrlSection` polls and fills the form when ready.
- **Tests**: service async-mode unit tests; route `202 + poll` tests; client
  polling UX tests on both surfaces.

## 4. Open questions — RESOLVED (2026-07-02)

These are the R3 sub-questions deferred from SPEC-277 §7. Resolved after a
codebase audit (see Revision history) rather than by upfront design — most
answers fell out directly of existing structure once the central persistence
question was settled.

**Central decision — persistence model**: the async run is **stateless, no new
DB table, no cron poller**. The start call returns `{ runId, datasetId, source,
startedAt }` directly to the client (nothing written server-side); the client
echoes it back on every poll; the status route calls `getApifyRunStatus` /
`getApifyDatasetItems` live, on demand. Rejected alternative: mirror the
SPEC-237/250 external-reputation pattern (DB-persisted run + cron poller) —
that pattern exists for a background refresh nobody is watching live; its cron
granularity (minutes) would make an actively-watched import spinner feel
broken. Staying stateless also matches this spec's own goal ("reuse the
SPEC-250 async helpers verbatim — no new Apify client surface") and the
pipeline's existing stateless design (`accommodation-import.service.ts`:
"nothing is persisted here").

1. **Which sources go async?** Airbnb → always async (Apify-only adapter).
   Booking → async only on its Apify-fallback branch; its free JSON-LD-first
   attempt stays synchronous, unchanged. Google Places / MercadoLibre / Generic
   → stay fully synchronous, unchanged.
2. **Polling UX shape** — inline fill-when-ready, same surface, no navigation
   away. Web adapts the existing `use-reputation-status.ts` hand-rolled
   `setInterval` hook pattern; admin adapts the existing `refetchInterval`
   TanStack Query pattern (`cron-jobs/hooks.ts`). Both are proven in-repo
   precedent for polling an Apify-backed status; no notification/toast
   infrastructure needed. Poll interval ~5s (faster than reputation's 10s,
   since here the user is actively watching, not backgrounding).
3. **Route shape** — a single endpoint, dual response shape: `POST
   /import-from-url` returns `200` unchanged for fast sources / Booking's
   JSON-LD path, or `202 { runId, datasetId, source, startedAt }` for
   Airbnb/Booking-via-Apify. A `GET .../import-from-url/status` route (mirrors
   the reputation `reputation-status.ts` precedent) takes those params, calls
   the SPEC-250 primitives live, and returns `{ settled: false }` while
   running, or `{ settled: true, draft: ... }` / `{ settled: true, failureCode:
   ... }` on a terminal state. Poll ceiling = the existing `apifyTimeoutMs`
   config (120s default) — past it, the status route stops calling Apify and
   returns `failureCode: 'timeout'`.
4. **Interaction with R1/R2** — R1 (`withRetry`) wraps only the initial
   `startApifyRun` call (a new thin wrapper is needed — the existing
   `with-retry.ts` is coupled to the sync `RunApifyActorResult` shape); polling
   itself is never retried, since an Apify run is either still `RUNNING` or has
   reached an authoritative terminal state. R2 (Generic fallback) runs inside
   the status handler, synchronously, once a poll resolves to a terminal state
   that maps to `source_blocked` — reusing the existing
   `_runFallbackGenericExtract` orchestrator step verbatim. New mapping needed
   (none exists today): `TIMED-OUT` → `timeout`; `FAILED` / `ABORTED` →
   `provider_error`, and — because Apify's run status has no native "blocked"
   signal (unlike the sync path's HTTP-429 inference) — the async path also
   triggers the R2 fallback on `provider_error`, not only on `source_blocked`,
   so a mid-run block (e.g. actor hits a captcha) doesn't silently skip
   fallback. A start-time HTTP 429 on `startApifyRun` still maps to
   `source_blocked` directly, same as the sync path.
5. **Backwards compatibility** — resolved by the single-endpoint design in
   (3): fast sources and Booking's JSON-LD path keep the exact `200` contract
   they have today; only Airbnb and Booking's-Apify-fallback branch shift to
   `202`. No separate endpoint, no client-visible breaking change for callers
   of the fast paths.

## 5. Out of scope

- R1 / R2 / R4 / R5 — already shipped in SPEC-277.
- New external providers beyond what `ctx.credentials` supports.
- The import cache (SPEC-258 C.4) — rejected by the owner on staleness grounds.
- Importing reviews/ratings — permanently excluded (SPEC-222 hard rule).

## 6. Dependencies

- **SPEC-250** — provides `startApifyRun` / `getApifyRunStatus` /
  `getApifyDatasetItems` in `apify-client.ts` (present, tested, unused by import).
- **SPEC-277** — R1 retry + R2 fallback + the `ImportFailureCode` contract the
  async path keys off.

## Revision history

- 2026-06-24 — Spec created (draft). Carved out of SPEC-277 as the deferred R3
  lever (heaviest: two client surfaces + a new route shape). Created in the
  SPEC-277 worktree and appended to PR #1848 at the owner's request. Open
  questions inherited from SPEC-277 §7 R3 sub-questions; resolve before atomizing.
- 2026-07-02 — Open questions resolved after a codebase audit (apify-client.ts,
  accommodation-import.service.ts, both adapters, with-retry.ts, the
  ImportFailureCode schema, the SPEC-237/250 external-reputation 202+poll
  precedent, and both client surfaces). Central decision: stateless run
  (client-held runId/datasetId, no DB, no cron), inline fill-when-ready
  polling on both surfaces, single dual-shape endpoint. See §4 for full
  resolutions. Ready to atomize.
