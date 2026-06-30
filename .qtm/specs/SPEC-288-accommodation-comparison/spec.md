---
specId: SPEC-288
title: Accommodation Comparison
type: feat
complexity: medium
status: in-progress
created: 2026-06-26
tags: [tourist, comparison, entitlements, limits, web]
---

# SPEC-288 — Accommodation Comparison

> Builds a feature that today is only a **phantom gate**. Surfaced during the
> SPEC-282 review.

## 1. Summary

The entitlement `CAN_COMPARE_ACCOMMODATIONS` + limit `MAX_COMPARE_ITEMS` are
granted on paid tourist plans, but the feature **does not exist**: `gateComparator()`
in `apps/api/src/middlewares/tourist-entitlements.ts` is a
`// PHANTOM-GATE (SPEC-145): route not built yet`.

This spec builds a working side-by-side accommodation comparison, with
**per-plan item-count differences**. The state is **client-only ephemeral**
(no DB persistence in v1).

## 2. Context

- **Verified 2026-06-26:** phantom gate only. `MAX_COMPARE_ITEMS` defined in billing
  config but never enforced (gate not mounted).
- **Verified at planning (2026-06-28):** `gateComparator()` is already fully
  implemented (entitlement check + limit check); it only needs a route to mount on.
  Per-plan entitlement/limit definitions already exist in
  `packages/billing/src/config/plans.config.ts`.

## 3. Goals

- **G-1** Build compare selection state (client) + a comparison view (side-by-side
  attribute matrix).
- **G-2** Mount `CAN_COMPARE_ACCOMMODATIONS` + enforce `MAX_COMPARE_ITEMS` per plan.
- **G-3** Apply the per-plan item-count differences.

## 4. Non-Goals

- No cross-vertical comparison (accommodations only in v1).
- No persisted/shareable comparison sets (client-only ephemeral state in v1).
- No per-plan difference in the attribute matrix (same matrix for all plans;
  only the item count differs).

## 5. Resolved Decisions

Decisions taken at planning (2026-06-28), superseding the original open questions:

- **D-1 (was OQ-1) — Per-plan item limits.** New values:
  - `tourist-free`: no access (lacks `CAN_COMPARE_ACCOMMODATIONS`).
  - `tourist-plus`: `MAX_COMPARE_ITEMS = 2` (was 4).
  - `tourist-vip`: `MAX_COMPARE_ITEMS = 4` (was -1 / unlimited).
  - The VIP value lives in `TOURIST_VIP_LIMITS`, inherited by the 6 owner/complex
    plans → they also move to **4** (single source of truth for the VIP tier).
- **D-2 (was OQ-2) — Attribute matrix.** Same attribute matrix for all plans; the
  only per-plan difference is the item count. No premium attribute set, no new
  entitlement.
- **D-3 (was OQ-3) — State model.** Client-only ephemeral state: a singleton
  pub/sub store + `localStorage` (no DB, no migration). A single protected endpoint
  hydrates the comparison data and re-validates the per-plan limit as server-side
  defense.
- **D-4 — Free-plan UX.** The "Comparar" button is shown to everyone. Users without
  the entitlement (free / anonymous) see an **upsell** message ("requires Plus or
  VIP plan") when they try to use it, rather than hiding the button.

## 6. Implementation Plan

### Phase 1 — Billing config (limits) · `packages/billing`

- tourist-plus `MAX_COMPARE_ITEMS` 4 → 2 (`plans.config.ts:462`).
- `TOURIST_VIP_LIMITS.MAX_COMPARE_ITEMS` -1 → 4 (`plans.config.ts:85`) — cascades to
  tourist-vip + 6 owner/complex plans.
- Config tests asserting the new per-plan values.

### Phase 2 — API: comparison endpoint · `apps/api`

- `POST /api/v1/protected/accommodations/compare` mounting
  `entitlementMiddleware()` + `gateComparator()`.
- Handler accepts `ids[]`, sets `currentCompareItemsCount` for the gate, returns the
  N accommodations with the matrix fields.
- Remove the `PHANTOM-GATE` note from `gateComparator()`.
- Integration tests: no entitlement → `ENTITLEMENT_REQUIRED`; over limit →
  `LIMIT_REACHED`; happy path Plus(2)/VIP(4).

### Phase 3 — Web: client state · `apps/web/src/store`

- `compare-store.ts`: singleton pub/sub + `useSyncExternalStore` + `localStorage`
  (pattern: `toast-store.ts`). API: `addToCompare`, `removeFromCompare`,
  `clearCompare`, `useCompareStore`.
- Client-side limit enforcement via `useMyEntitlements`
  (`has('can_compare_accommodations')` + `limit('max_compare_items')`).

### Phase 4 — Web: selection UI · `apps/web/src/components`

- `CompareButton.client.tsx`: island in `acc-card__actions` (pattern:
  `FavoriteButton`), also integrated in `MapCardsSidebar.client.tsx`.
- Floating comparison bar/drawer (selected items + "Comparar ahora" + clear).
- Free / anonymous: button shown with upsell (D-4).

### Phase 5 — Web: comparison view · `apps/web/src/pages`

- Page `/[lang]/alojamientos/comparar` rendering the side-by-side matrix (same
  attributes for all plans), hydrated via the Phase 2 endpoint.
- i18n keys (es/en/pt) for button, bar, matrix and limit/upsell messages.

### Phase 6 — Activation and close

- `PlanComparisonTable.astro:95` row `compare` `status: 'upcoming'` → `'available'`.
- Green suite (typecheck + lint + scoped tests).

## 7. Relationship to SPEC-282

SPEC-282 shows "Comparar" as *Próximamente* with the intended per-tier availability.
The real per-plan numbers land when SPEC-288 enforces them (Phase 6 flips the badge).
