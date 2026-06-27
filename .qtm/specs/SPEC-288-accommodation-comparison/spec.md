---
specId: SPEC-288
title: Accommodation Comparison
type: feat
complexity: medium
status: draft
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
`// PHANTOM-GATE (SPEC-145): route not built yet`. No compare state, no route, no UI.

This spec builds a working side-by-side accommodation comparison, with **per-plan
functionality/limit differences** (how many items can be compared, and possibly
which attributes).

## 2. Context

- **Verified 2026-06-26:** phantom gate only. `MAX_COMPARE_ITEMS` defined in billing
  config but never enforced (gate not mounted).

## 3. Goals

- **G-1** Build compare selection state (client) + a comparison view (side-by-side
  attribute matrix).
- **G-2** Mount `CAN_COMPARE_ACCOMMODATIONS` + enforce `MAX_COMPARE_ITEMS` per plan.
- **G-3** Define the per-plan differences (item count; OQ-2 for attribute depth).

## 4. Non-Goals

- No cross-vertical comparison (accommodations only in v1).
- No persisted/shareable comparison sets in v1 unless OQ-3 expands scope.

## 5. Open Questions

- **OQ-1** `MAX_COMPARE_ITEMS` per-plan values (confirm at implementation).
- **OQ-2** Functional differences beyond item count (e.g. richer attribute set or
  saved comparisons on higher tiers).
- **OQ-3** Client-only ephemeral state vs persisted comparison sets.

## 6. Relationship to SPEC-282

SPEC-282 shows "Comparar" as *Próximamente* with the intended per-tier availability.
The real per-plan numbers land when SPEC-288 enforces them.
