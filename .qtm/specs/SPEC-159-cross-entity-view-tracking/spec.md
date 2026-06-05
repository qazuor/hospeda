---
specId: SPEC-159
title: Cross-Entity View Tracking
status: in-progress
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

> **Status**: IN-PROGRESS — extracted from the 2026-05-26 dashboard redefinition session as "heavy backend". See `.claude/audit/admin-redesign/proposals/03c-dashboards-redefinition.md` (Global decision — cross-entity view tracking). Tech-analysis completed and §4 resolved on 2026-06-04.

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

## 4. Key architectural decision — RESOLVED (2026-06-04)

**Decision: Option 1 — own `entity_views` table + first-party server-side capture.** Approved by the user after tech-analysis (see [`tech-analysis.md`](tech-analysis.md) §7 for the full options comparison).

Decisive findings:

- PostHog only has `accommodation_viewed`; no `post_viewed`/`event_viewed` events exist, so Option 2 (PostHog proxy) could not serve 2 of the 3 widgets without new client events anyway.
- PostHog is configured anonymous-hostile (`person_profiles: 'identified_only'`, memory persistence without consent, `respect_dnt`), making unique-visitor dedup from it unreliable.
- The codebase already has every pattern Option 1 needs: polymorphic entity table (`user_bookmarks`), public rate-limited POST (`contact/submit.ts`), matview + cron (`search-index-refresh.job.ts`).

Approved sub-decisions (detail in tech-analysis §4–§5):

- **Lean append-only table, NOT extending `BaseModel`** (no audit/soft-delete columns); retention via TTL purge cron (~95 days). Deliberate, documented deviation.
- Cookieless server-side `visitorHash` (salted daily hash; no raw IP stored, no consent banner needed).
- Insert-always + dedup-at-aggregation; query-time aggregation for V1.
- Existing PostHog client events keep firing unchanged (additive).

## 5. Enables (SPEC-155 widgets, phase 2)

- HOST · Card G · "Vistas de mi alojamiento" (unique + total, 7/30d).
- EDITOR · Card E · "Vistas por post".
- EDITOR · Card F · "Vistas por evento".

## 6. Dependencies

- SPEC-155 is the CONSUMER (its view widgets render the output). This spec is independent backend that 155's view widgets depend on.

## 7. Next steps

- [x] Tech-analysis (resolved §4 — Option 1 approved 2026-06-04)
- [x] Task atomization
- [x] Implementation
