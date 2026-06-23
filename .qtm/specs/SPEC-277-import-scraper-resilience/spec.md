---
id: SPEC-277
title: Accommodation import — scraper resilience (retry, fallback chain, async, provider mitigation, manual path)
status: draft
type: improvement
complexity: high
dependsOn: [SPEC-258, SPEC-250]
---

# SPEC-277 — Accommodation import: scraper resilience

> Follow-up of **SPEC-258**. SPEC-258 shipped import coverage (workstream A), UX
> field surfacing (workstream B) and **C.1 — failure-mode differentiation** (the
> import now returns a machine-readable `ImportFailureCode` and the clients render
> a localized, cause-specific message instead of one string that blamed the host's
> URL). This spec covers the **remaining resilience work** so a blocked or slow
> scraper never dead-ends the create flow: retry, per-source fallback, an async
> path for slow sources, provider-level mitigation, and a guaranteed manual path.

## 1. Background

External listing imports (Airbnb, Booking, Google Places, MercadoLibre, generic
JSON-LD) run an Apify actor or a fetch behind the scenes. The Airbnb actor returns
an **empty dataset under anti-bot pressure** (observed after ~6 runs in SPEC-237 /
SPEC-258 smokes). C.1 already stopped this from blaming the host's URL: a 2xx-empty
actor result is now classified `source_blocked` and the host sees "the source is
temporarily unavailable, try again in a few minutes, or enter the details manually."

What C.1 did NOT do: actually *recover* from a transient block. Today a
`source_blocked` is terminal for that attempt — the host must retry by hand and the
single blocking request can take 8–120s. This spec makes the importer resilient.

**Contract this builds on (from SPEC-258 C.1):**
`AccommodationImportResponse.failureCode: ImportFailureCode | undefined` where
`ImportFailureCode = 'invalid_url' | 'source_blocked' | 'credentials_missing' |
'provider_error' | 'timeout' | 'nothing_found'`. `runApifyActor` returns
`{ items, failureCode? }`. Retry/fallback decisions key off these codes.

## 2. Goals

- A transient block (`source_blocked` / `timeout`) is retried automatically before
  the host ever sees a failure.
- When the primary source stays blocked, a best-effort partial import is attempted
  from a secondary method instead of returning nothing.
- Slow / rate-limited sources do not hold a request open for 8–120s.
- Ops can swap a blocked actor or route through a residential proxy **without a
  code deploy**.
- Whatever happens, the create form stays fully usable for manual entry.

## 3. Scope — five resilience levers

> Inherited from SPEC-258 §C. **C.1 is DONE** (SPEC-258, PR #1824). **C.4 import
> cache is OUT** — the owner rejected it in SPEC-258 (Q4) on staleness/invalidation
> grounds; it is listed under §5 Out of scope, not here.

| # | Lever | Summary | Effort |
|---|---|---|---|
| R1 | **Retry with backoff** | On a *retryable* failure code (`source_blocked`, `timeout`), retry the actor/fetch 1–2 times with jittered backoff before degrading. Non-retryable codes (`invalid_url`, `credentials_missing`, `nothing_found`) fail fast — retrying them is wasted cost. | Low/Med |
| R2 | **Per-source fallback chain** | When the primary extractor for a source returns empty/blocked, fall back to the Generic adapter (JSON-LD / OpenGraph) against the same URL for a best-effort partial import (name + image + description from OG) instead of nothing. Booking already has a JSON-LD→actor escalation; R2 generalizes the reverse (actor→JSON-LD) as a safety net. | Med |
| R3 | **Async path for slow/contended sources** | Reuse the SPEC-250 Apify async pattern (`startApifyRun` + `getApifyRunStatus` + `getApifyDatasetItems`, already in `apify-client.ts`) so a slow Airbnb/Booking import is a `202 + poll` instead of one blocking 8–120s request. The web/admin form polls and fills in when ready. | High |
| R4 | **Provider-level mitigation (config, no code churn)** | Allow ops to configure a residential-proxy or alternative actor per source via `ctx.credentials.apify*Actor` (the fields already exist) and document the runbook, so a blocked actor is swapped via Coolify env + redeploy, not a code change. | Low (mostly doc/config) |
| R5 | **Graceful manual path** | Whenever extraction yields nothing after retries+fallback, the create form stays 100% usable for manual entry with a clear, non-blaming note. Partially overlaps the C.1 client work; R5 guarantees the invariant end-to-end (no spinner trap, no disabled form). | Low |

### R1 — Retry with backoff (detail)

- Retryable set: `source_blocked`, `timeout`. Everything else fails fast.
- Caps: 1–2 retries, jittered (e.g. base 500ms–1s + random jitter) to avoid
  hammering an anti-bot wall in lockstep. Bounded so a failed import never exceeds
  a hard ceiling (interacts with R3: the slow case goes async instead of retrying
  synchronously).
- Where: closest to the failure (inside the adapter or a thin wrapper around
  `runApifyActor`), so the orchestrator and the response contract are unchanged.

### R2 — Per-source fallback chain (detail)

- Trigger: primary returns `source_blocked` (or empty) AND a Generic extraction of
  the same URL is plausible (the listing page exposes JSON-LD / OG).
- Output: a partial draft tagged with its real per-field `source`/confidence so the
  host still sees what came from where; `partial: true`. Never silently upgrade a
  fallback partial to look like a full import.
- Cost guard: the fallback is a single cheap fetch, not another actor run.

### R3 — Async path (detail)

- Reuses SPEC-250's async helpers verbatim; no new Apify client surface.
- Decision: which sources go async (candidates: Airbnb, Booking — the slow/blocked
  ones) and the client UX for polling (the onboarding mini-form from SPEC-258 B and
  the admin `ImportFromUrlSection`). This is the heaviest lever and may be split to
  its own PR or deferred depending on the owner's answer to Q3.

## 4. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Retry lengthens a failed import | Low/Med | Hard cap (1–2) + jitter; push the slow case to R3 async instead of more sync retries |
| Fallback partial over-promises | Medium | Keep real per-field source/confidence; `partial: true`; never relabel |
| Async path adds UX + state complexity | Medium | Reuse SPEC-250 pattern; consider splitting R3 to its own PR; or defer behind Q3 |
| Retrying a hard failure wastes Apify cost | Low | Retryable set is `source_blocked`/`timeout` ONLY; everything else fails fast |
| Provider mitigation invites config sprawl | Low | Config-only via existing `ctx.credentials` fields + a documented runbook; no new providers |

## 5. Out of scope

- **Import cache (SPEC-258 C.4)** — rejected by the owner on staleness/invalidation
  grounds. Not revisited here.
- **New external providers** beyond what `ctx.credentials` already supports
  (config only).
- **Re-import / re-run of a successful import** — same double-cost + anti-bot
  reasoning as SPEC-258 (single import call).
- **Importing reviews/ratings** — permanently excluded (SPEC-222 hard rule).
- **Failure-mode classification itself** — already shipped in SPEC-258 C.1.

## 6. Tasks (suggested, by lever)

- **R1 Retry:** retryable-code policy + jittered backoff wrapper around the
  actor/fetch call; unit tests asserting retry only on `source_blocked`/`timeout`
  and fail-fast otherwise; cap/ceiling test.
- **R2 Fallback chain:** actor→Generic fallback on block/empty; partial-draft
  source/confidence preservation; tests with a mocked blocked primary + JSON-LD
  secondary.
- **R3 Async path (candidate for its own PR):** wire SPEC-250 async helpers for
  Airbnb/Booking; `202 + poll` route shape; client polling UX in both forms; tests.
- **R4 Provider mitigation:** runbook + config doc for proxy/alternative actor via
  `ctx.credentials.apify*Actor`; no code unless a small config seam is missing.
- **R5 Manual path:** end-to-end invariant test that a fully-failed import leaves
  the create form usable (no spinner trap / disabled state) with a non-blaming note.

## 7. Open questions (resolve before atomizing)

1. **R1 retry budget** — 1 or 2 retries? Backoff base + jitter shape? Confirm the
   retryable set is exactly `{source_blocked, timeout}`.
2. **R2 scope** — always attempt the Generic fallback on a block, or only for
   specific sources (Airbnb/Booking)? Is a partial OG-only draft (name+image+desc)
   worth showing, or does it under-deliver vs. the manual path?
3. **R3 async** — in scope for this spec or split to its own follow-up? Which
   sources go async? What is the polling UX in the onboarding mini-form and the
   admin panel (inline spinner + fill-when-ready vs. background + notify)?
4. **R4** — doc/config only, or is a small code seam needed to select an alternate
   actor at runtime? Which proxy/actor options are actually available on the Apify
   plan?
5. **Sequencing** — chained PRs: R1+R5 first (cheap, high value), then R2, then R3
   (heaviest) — or fold R5 into R1? Confirm the slice.

## Revision history

- 2026-06-23 — Spec created (draft). Carved out of SPEC-258 workstream C after C.1
  (failure-mode differentiation) shipped in SPEC-258 PR #1824 and the import cache
  (C.4) was rejected. Remaining levers R1–R5 documented; open questions for the
  owner pending before task atomization.
