---
specId: SPEC-159
title: Cross-Entity View Tracking
status: draft
complexity: high
owner: qazuor
created: 2026-05-26
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — consumer of the view counts)
tags:
  - analytics
  - views
  - tracking
  - accommodation
  - post
  - event
  - backend
  - phase-2
---

# SPEC-159 — Cross-Entity View Tracking

> **Status**: DRAFT — extracted from the 2026-05-26 dashboard redefinition session as "heavy backend". See `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` (Global decision — cross-entity view tracking).

## 1. Origin

Three dashboard widgets across two roles want "views" with no backing data: HOST accommodation views, EDITOR post views, EDITOR event views. PostHog tracks these client-side (`accommodation_viewed` etc.) but **nothing is persisted in our DB** — there is no `viewCount` column anywhere. SPEC-155 deferred all three view widgets to phase 2 and consolidated them into this single piece so the tracking is built ONCE, not three times.

## 2. Goal

Provide a single cross-entity mechanism to count and expose views for **accommodation, post, and event**, scoped appropriately (HOST = own accommodations; EDITOR = all posts/events). Surface **unique visitors + total visits** over **7/30-day** windows.

## 3. Scope

### IN
- View tracking/storage for accommodation, post, event.
- Unique-visitor dedup (by session/user) + total counts.
- 7d / 30d windowed aggregation.
- Read endpoints scoped per role (HOST own, EDITOR all).

### OUT
- Search-impression tracking (only detail-page views).
- Real-time counters (batch/near-real-time is fine for V1).

## 4. Key architectural decision (to resolve in tech-analysis)

Two viable approaches — NOT yet decided:
1. **Own DB table + server-side capture** — a `entity_views` table (polymorphic entityType + entityId, session/user, timestamp), populated by a server-side capture endpoint or a write from the web app; aggregations query it directly (optionally denormalize a `viewsCount`).
2. **Query the PostHog API server-side** — keep PostHog as the source of truth and proxy/aggregate its events (depends on events carrying entity ids; adds external latency + rate-limit considerations).

Decision drivers: data ownership, latency, PostHog rate limits, whether unique-dedup is reliable from PostHog.

## 5. Enables (SPEC-155 widgets, phase 2)

- HOST · Card G · "Vistas de mi alojamiento" (unique + total, 7/30d).
- EDITOR · Card E · "Vistas por post".
- EDITOR · Card F · "Vistas por evento".

## 6. Dependencies

- SPEC-155 is the CONSUMER (its view widgets render the output). This spec is independent backend that 155's view widgets depend on.

## 7. Next steps

Needs tech-analysis (resolve §4) + task atomization before implementation.
