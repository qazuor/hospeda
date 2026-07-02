---
specId: SPEC-315
title: Personalized Recommendations
type: feature
complexity: medium
status: draft
created: 2026-06-30T00:00:00Z
base: staging
---

# SPEC-315 — Personalized Recommendations

> **Stub (backlog).** Created from the SPEC-310 plan-packaging audit, which found this feature is advertised in the billing plans but is a phantom gate (`gateRecommendations` PHANTOM-GATE; no recommendations route, service, algorithm, or UI exists; the `/accommodations/:id/similar` endpoint exists but is public, unpersonalized, and unrelated). This stub captures the objective; it must go through full discovery (/task-master:spec-review or /spec) before implementation.

## Overview

Tourist-plus subscribers should receive personalized accommodation recommendations based on their activity (favorites, search history, viewed listings) under the `CAN_VIEW_RECOMMENDATIONS` entitlement. A dedicated recommendations section or widget surfaces these picks on the web app. Note: SPEC-310 moved this entitlement from the free tier to the plus tier — it was never actually implemented when it was "free" either.

## Why now

Part of the SPEC-310 roadmap to stop selling unimplemented features. `CAN_VIEW_RECOMMENDATIONS` was previously listed as a free-tier feature (already unreachable), and SPEC-310 repositioned it as a plus differentiator. The full stack (recommendation logic, route, UI) is missing.

## Scope (to refine in discovery)

- Implement recommendation logic (starting simple: favorites-based similarity or search-history-driven, leveraging SPEC-289 search history data if available).
- Add a protected API route `GET /api/v1/protected/recommendations` gated behind `CAN_VIEW_RECOMMENDATIONS`.
- Surface a "Recommended for you" section in the web tourist UI (home or dashboard), visible only to plus/vip tourists.

## Out of scope (initial)

- Anything beyond the single feature; pricing/limit calibration lives in SPEC-310.

## Open questions

- What signals should drive personalization? Favorites are already stored; search history lands in SPEC-289 (in progress). Are view-tracking events stored anywhere today, or does SPEC-315 need to introduce them?
- Should the initial implementation be a simple heuristic (e.g., "similar to your favorited accommodations by destination/type") or is a real ranking/scoring model required from day one?

## Related

- Parent audit: SPEC-310 (plan packaging recalibration).
- SPEC-289 (search history) — primary personalization signal; SPEC-315 depends on its data being available.
- SPEC-313 (exclusive deals), SPEC-314 (review photos) — sibling tourist-plus phantom gates.
