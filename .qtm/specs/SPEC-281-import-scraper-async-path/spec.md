---
id: SPEC-281
title: Accommodation import — async extraction path for slow/blocked sources (SPEC-277 R3)
status: draft
type: improvement
complexity: high
dependsOn: [SPEC-250, SPEC-277]
---

# SPEC-281 — Accommodation import: async extraction path (R3)

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

## 4. Open questions (resolve before atomizing)

These are the R3 sub-questions deferred from SPEC-277 §7:

1. **Which sources go async?** Candidates are the slow/blocked ones (Airbnb,
   Booking). Do Google Places / MercadoLibre / Generic stay synchronous?
2. **Polling UX shape** — inline spinner + fill-when-ready in place, or background
   start + notify-when-done (toast / notification)? Same on web and admin, or
   different per surface?
3. **Route shape** — one endpoint returning `202` + a run token the client polls
   on a status endpoint, vs a single long-poll. Poll interval + overall ceiling?
4. **Interaction with R1/R2** — does the async path still retry transient blocks
   (R1) per poll, and does it run the R2 Generic fallback when the async run ends
   blocked/empty?
5. **Backwards compatibility** — keep the synchronous endpoint for fast sources
   and add async only for Airbnb/Booking, or route everything through async?

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
