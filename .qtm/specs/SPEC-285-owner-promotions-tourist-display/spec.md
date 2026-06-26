---
specId: SPEC-285
title: Owner Promotions — Tourist-Facing Display
type: feat
complexity: medium
status: draft
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
- **G-2** Display active promotions on the accommodation detail page (and any
  listing surfaces — search cards? OQ-1).
- **G-3** Respect promo `validFrom/Until` and `planRestricted` visibility rules.

## 4. Non-Goals

- No change to the owner-create flow (already shipped).
- No promo redemption/checkout mechanics in v1 unless OQ-2 expands scope.

## 5. Open Questions

- **OQ-1** Surfaces: detail page only, or also search/listing cards + a deals hub?
- **OQ-2** Is a promotion purely informational (a badge/banner), or does it carry a
  redeemable action?
- **OQ-3** Interaction with SPEC-286 (alerts): promo creation should emit the event
  that SPEC-286 turns into a tourist alert. Define the contract.

## 6. Relationship

- **SPEC-282:** the "Promociones" row (owner block) stays *Próximamente* until this
  ships end-to-end.
- **SPEC-286** (Alerts & offers) **depends on this** — promo alerts need promos to
  exist and emit an event.
