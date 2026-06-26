---
specId: SPEC-284
title: Personalized Recommendations Feed
type: feat
complexity: medium
status: draft
created: 2026-06-26
tags: [tourist, recommendations, entitlements, web]
---

# SPEC-284 — Personalized Recommendations Feed

> Builds a feature that today is only a **phantom gate**. Surfaced during the
> SPEC-282 (plan comparison table) review.

## 1. Summary

The entitlement `CAN_VIEW_RECOMMENDATIONS` is granted across tourist plans, but the
feature **does not exist**: `gateRecommendations()` in
`apps/api/src/middlewares/tourist-entitlements.ts` carries the literal comment
`// PHANTOM-GATE (SPEC-145): route not built yet`. There is no route, service, DB
table, or web UI.

This spec builds the actual recommendations feature: a tourist-facing feed of
suggested accommodations based on the user's activity/preferences.

## 2. Context

- **Current state:** phantom gate only (verified 2026-06-26). Entitlement exists;
  zero implementation.
- **Why now:** the SPEC-282 comparison table advertises "Recomendaciones" as
  *Próximamente*. This spec is what makes that real.

## 3. Goals

- **G-1** Define and build the recommendation signal (activity/preferences →
  suggested accommodations).
- **G-2** Expose a tourist-facing route + web UI section consuming it.
- **G-3** Mount the (currently phantom) `CAN_VIEW_RECOMMENDATIONS` gate on the new
  route.

## 4. Non-Goals

- No ML/embedding pipeline in v1 unless OQ-2 says otherwise (start with a
  heuristic/rule-based recommender).
- No cross-vertical recommendations (accommodations only in v1).

## 5. Open Questions

- **OQ-1** Recommendation signal: recently viewed + favorites + same destination/
  similar price, or something richer?
- **OQ-2** Heuristic v1 vs an embedding-based recommender — scope/effort tradeoff.
- **OQ-3** Per-plan differentiation: is the feed gated only by the entitlement
  (binary), or do plans differ (e.g. count/freshness)? Confirm at planning.
- **OQ-4** Placement in the web UI (home, post-search, a dedicated section).

## 6. Relationship to SPEC-282

SPEC-282 shows this row as **Próximamente**. When SPEC-284 ships, the badge is
removed and the row reflects the real availability/limits.
