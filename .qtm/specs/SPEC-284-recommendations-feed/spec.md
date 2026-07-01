---
specId: SPEC-284
title: Personalized Recommendations Feed
type: feat
complexity: medium
status: in-progress
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

## 5. Recommendation Signal Design (v1)

> Resolves OQ-1 and OQ-2. Decided 2026-06-30 after a discovery-first inventory of
> which user-signal data actually exists in the codebase.

### 5.1 Approach — heuristic preference profile

v1 is a **heuristic, rule-based content recommender** (no ML/embeddings). All user
signals collapse into a single weighted **preference profile**, and the
accommodation catalog is scored against that profile. Chosen over item-to-item
similarity because search history expresses *criteria*, not a seed item, and only
the profile approach fuses heterogeneous signals cleanly.

### 5.2 Seed signals (with recency)

Three behavioral sources feed the profile. Recency uses a **hard window + cap N**
(no time-decay in v1):

| Signal | Source | Window / cap | Weight |
|---|---|---|---|
| Favorites | `user_bookmarks` (entity_type=ACCOMMODATION) | last 20, no time window | 3 |
| Recently viewed | `entity_views` (visitor_hash=`user:<uuid>`) | last 30 days, cap 25 | 1 |
| Search history | `user_search_history.filters_json` (SPEC-289) | last 30 days, cap 10 | 2 |

Rationale: a favorite is an explicit act that does not expire (no window); a view
is passive and recent by nature; a search expresses time-bound intent, so stale
searches are dropped. Search history is **degradable**: if absent (no data, or
SPEC-289 not yet capturing in prod), the recommender still works on the other two.

### 5.3 Building the profile

Favorites and recently-viewed contribute the **attributes** of their items
(destination, type, price, amenities). Search history contributes its
`filters_json` **directly** (searched destination, price range, amenities). The
result is one weighted profile: preferred destinations, dominant type(s), price
range, frequent amenities.

### 5.4 Scoring candidates

Each candidate accommodation is scored against the profile (weights sum to 100):

| Component | Weight | Notes |
|---|---|---|
| Destination | 40 | Graduated by the destinations materialized-path hierarchy (same city > province > region > country) |
| Type | 20 | Exact / category match |
| Price | 20 | Distance to the profile's price range |
| Amenities | 15 | Jaccard overlap vs frequent amenities |
| Quality | 5 | `average_rating` / `is_featured` — tie-break + editorial boost |

Destination is intentionally dominant: in tourism, *place* is the primary decision
driver. Items the user already bookmarked or viewed are **excluded** from the feed
(surface new discoveries, not the already-known).

### 5.5 Cold-start

A user with no favorites, views, or recent searches has no profile. Fall back to
**popular / featured** accommodations (optionally scoped to a default destination).

### 5.6 Data-layer gap to close

`EntityViewModel` exposes no method to list a user's recently-viewed
accommodations — the data is in `entity_views`, but only aggregate / top-N queries
exist. This spec must add a `getRecentlyViewedByUser()`-style query.

## 6. Open Questions

- **OQ-1** ✅ RESOLVED (§5): favorites + recently-viewed + search-history fused
  into a weighted preference profile.
- **OQ-2** ✅ RESOLVED (§5): heuristic / rule-based v1, no embeddings.
- **OQ-3** ✅ RESOLVED: **binary in v1**. The feed is gated only by the
  `CAN_VIEW_RECOMMENDATIONS` entitlement; every plan that has it sees the same
  feed (same count, same freshness). No per-plan differentiation yet.
- **OQ-4** ✅ RESOLVED: **dedicated page/section** (e.g. `/recomendaciones`,
  "Para vos"), reachable from the logged-in tourist "mi-cuenta" surface (created
  in SPEC-289). Chosen over a home block or post-search slot because it is the
  natural home for a plan-gated feature and keeps the anonymous-shared home clean.
  A home teaser linking to this page can be added later without rework.

## 7. Relationship to SPEC-282

SPEC-282 shows this row as **Próximamente**. When SPEC-284 ships, the badge is
removed and the row reflects the real availability/limits.
