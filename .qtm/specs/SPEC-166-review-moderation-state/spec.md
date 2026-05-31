---
specId: SPEC-166
title: Review Moderation State
status: draft
complexity: medium
owner: qazuor
created: 2026-05-27
related:
  - SPEC-155 (admin-dashboards-v1 — origin; feeds ADMIN card F reviews-pending sub-slot)
---

# SPEC-166 — Review Moderation State

> **Status**: DRAFT — phase-2 stub. Extracted from SPEC-155 Phase-1 scout 2026-05-27. Requires a full spec before implementation can begin.

## 1. Origin

Extracted from SPEC-155 Phase-1 scout on 2026-05-27.

**Concrete finding**: SPEC-155 assumed a 🟡 route (T-011 — `GET /api/v1/admin/reviews/pending-count`) that could be built without DB changes. The scout found this to be 🔴: `accommodation_reviews` and `destination_reviews` have a `lifecycleState` column (values: ACTIVE/ARCHIVED), NOT a `moderationState` column. There is no pending-review moderation concept in the current schema. The `REVIEW_MODERATE` permission entry was assumed to exist but must also be verified.

As a result, T-011 was tombstoned in SPEC-155, ADMIN card F retains its unified moderation-pending count (over 4 content entities: accommodations, destinations, posts, events — that route IS buildable), but the reviews-pending sub-slot of card F renders a deferred placeholder pointing to this spec.

## 2. Goal

Add a `moderationState` lifecycle to the review tables so that:

- New reviews can enter a PENDING state before being publicly visible.
- ADMIN/SUPER_ADMIN can approve or reject reviews from the admin panel.
- A pending-review count endpoint is available to feed ADMIN dashboard card F.
- The existing `lifecycleState` (ACTIVE/ARCHIVED) is preserved alongside the new `moderationState`.

Once SPEC-166 ships, ADMIN dashboard card F's reviews-pending sub-slot will automatically upgrade from the deferred placeholder to a live count.

## 3. Scope sketch

The following are starting-point scope boundaries. A full spec must define details before implementation.

**Schema changes**:
- Add `moderationState` column to `accommodation_reviews`: enum `PENDING | APPROVED | REJECTED`.
- Add `moderationState` column to `destination_reviews`: same enum.
- Migration: existing reviews set to `APPROVED` as the safe default (they were already publicly visible).
- Consider whether the column should default to `PENDING` (for new reviews) or `APPROVED` (backward-compatible).

**Permissions**:
- `REVIEW_MODERATE` — must be added to `PermissionEnum` if not already present (verify first).
- Granted to ADMIN and SUPER_ADMIN roles.

**Endpoint required to feed SPEC-155 ADMIN card F**:
- `GET /api/v1/admin/reviews/pending-count` — count across both `accommodation_reviews` and `destination_reviews` where `moderationState = 'PENDING'`; return `{ data: { count: number, byType: { accommodationReviews: number, destinationReviews: number } } }`. Requires `REVIEW_MODERATE`.

**Moderation flow**:
- Admin panel: a review moderation queue listing pending reviews with approve/reject actions.
- When a review is approved: `moderationState` → APPROVED; review becomes publicly visible.
- When a review is rejected: `moderationState` → REJECTED; review hidden from public; optionally notify reviewer.
- Public-facing review listings filter to `moderationState = 'APPROVED'` only.

**Impact on existing routes**:
- All public review listing endpoints must add a `moderationState = 'APPROVED'` filter.
- Admin review listing must expose `moderationState` as a filter and display field.
- Host review listings (HOST dashboard card E) show only APPROVED reviews.

## 4. Open questions

These must be resolved during full spec authoring:

1. **Default for new reviews**: PENDING (safe, requires moderation before display) or APPROVED (backward-compatible, opt-in moderation)? Product decision needed.
2. **Reviewer notification on rejection**: does the user who left the review receive a notification when their review is rejected? If so, which notification channel (in-app, email)?
3. **Re-submission after rejection**: can a rejected review be edited and re-submitted for moderation?
4. **Appeal flow**: is there a way for a reviewer to contest a rejection?
5. **`REVIEW_MODERATE` permission**: does it exist in `PermissionEnum` today? If not, does adding it require a seed change? (Verify before implementing.)
6. **lifecycleState interaction**: should a REJECTED review also flip `lifecycleState` to ARCHIVED, or are the two states independent?
7. **Retroactive moderation of old reviews**: should there be a bulk-approve tool for the existing review corpus when the feature ships?
8. **Destination reviews scope**: the same moderation state applies to destination reviews. Are there any differences in the moderation flow for destination vs. accommodation reviews?
