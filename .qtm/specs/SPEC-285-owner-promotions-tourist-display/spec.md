---
specId: SPEC-285
title: Owner Promotions — Tourist-Facing Display
type: feat
complexity: medium
status: in-progress
created: 2026-06-26
tags: [owner-promotions, tourist, web, api]
---

# SPEC-285 — Owner Promotions — Tourist-Facing Display

> Completes a **partially built** feature. Surfaced during the SPEC-282 review.

## 1. Summary

The owner-create side of listing promotions is **fully built**: the
`owner_promotions` table, `OwnerPromotionService`, the protected routes
(`/api/v1/protected/owner-promotions` gated by `CREATE_PROMOTIONS` +
`MAX_ACTIVE_PROMOTIONS`), and the owner UI under `/mi-cuenta/promociones`.

What is **missing** is the tourist-facing side: a tourist cannot see a running
promotion on a listing. The public list route
(`apps/api/src/routes/owner-promotion/public/list.ts`) **exists in code but is not
registered** in `routes/index.ts`, and the accommodation detail page renders no
promotion component. So an owner can create a promo today, but it is invisible —
the feature is not end-to-end useful.

This spec finishes the loop: register the public route and build the tourist-facing
display.

## 2. Context

- **Current state (verified 2026-06-26):** owner-create BUILT; tourist-view NOT
  built (unregistered public route, no UI).

## 3. Goals

- **G-1** Register the public owner-promotion route and harden it for public use.
- **G-2** Display active promotions on the accommodation detail page (detail page
  only in v1 — see D-1).
- **G-3** Respect promo `validFrom/Until` and `planRestricted` visibility rules.
- **G-4** Emit a domain event when a promotion is created/activated, so SPEC-286
  can consume it without re-touching the owner-create flow (see D-3).

## 4. Non-Goals

- No change to the owner-create flow (already shipped) beyond emitting the event (D-3).
- No promo redemption/checkout mechanics in v1 (D-2).
- No search/listing cards or deals hub in v1 (D-1).

## 5. Resolved Decisions

> Open Questions resolved by the owner on 2026-06-29.

- **D-1 (was OQ-1) — Surfaces:** Detail page **only** in v1. Search/listing cards and
  a deals hub are explicitly deferred to a later spec. Keeps scope away from the
  list/SSR render path (a known source of N+1 and prefetch-amplification issues).
- **D-2 (was OQ-2) — Nature:** Promotions are **purely informational** in v1 — a
  badge/banner (label, discount value, validity window). No CTA, no redeemable
  code, no checkout.
- **D-3 (was OQ-3) — SPEC-286 contract:** Emit a domain event **now** when a
  promotion is created/activated, with **no consumers yet**. This locks the contract
  so SPEC-286 (alerts) can subscribe later without modifying the owner-create flow.
  The concrete event name/payload is defined in the tech analysis.
- **D-4 (surfaced during tech mapping 2026-06-29) — Owner-wide promos:** A promotion
  can have `accommodationId = null`, meaning it applies to ALL of the owner's
  accommodations. The detail page MUST show, for a given accommodation, both: promos
  targeting that `accommodationId` **and** the owner's `accommodationId = null`
  promos (resolved via the accommodation's owner). Showing only the former would
  leave owner-wide promos invisible — the exact gap this spec closes.

## 5b. Implementation Notes (from tech mapping 2026-06-29)

- **Permission blocker:** the public list/getById routes exist but `checkCanSearch`/
  `checkCanView` in `ownerPromotion.permissions.ts` throw FORBIDDEN for the guest
  actor (only `ACCESS_API_PUBLIC`). Must be made permissive for the public path,
  mirroring accommodation's no-op `checkCanList`.
- **Active-window gap:** the service forces `lifecycleState=ACTIVE` +
  `planRestricted=false` but does NOT filter `validFrom <= now <= validUntil`. G-3
  requires adding that window filter in `_executeSearch()`/`_executeCount()`.
- **No event bus:** closest pattern is `addon-lifecycle-events.ts` (in-process,
  log+metrics, TODO stub). G-4 mirrors it via `ownerPromotion.lifecycle-events.ts`.

## 6. Relationship

- **SPEC-282:** the "Promociones" row (owner block) stays *Próximamente* until this
  ships end-to-end.
- **SPEC-286** (Alerts & offers) **depends on this** — promo alerts need promos to
  exist and emit an event.
