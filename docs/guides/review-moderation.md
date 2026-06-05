# Review Moderation

Guide to the review moderation system introduced in SPEC-166. Covers the state
model, the hybrid default policy, public-visibility rules, the admin API
surface, and the `@repo/content-moderation` integration.

---

## Overview

Both `accommodation_reviews` and `destination_reviews` carry a `moderationState`
column (`PENDING | APPROVED | REJECTED`) alongside the pre-existing
`lifecycleState` column (`ACTIVE | ARCHIVED`). The two axes are **independent**:
moderating a review does not alter its lifecycle state, and archiving a review
does not alter its moderation state.

**Public visibility rule** (enforced in service `_executeSearch`, `_executeCount`,
`listByAccommodation`, `listWithUser`):

```
visible = moderationState === 'APPROVED' AND lifecycleState === 'ACTIVE'
```

Any read path accessible to the public tier applies both filters as forced
overrides, making it impossible for a caller-supplied query param to surface
PENDING or REJECTED reviews.

---

## States

| State | Meaning | Set by |
|-------|---------|--------|
| `PENDING` | Awaiting human moderation; not publicly visible. | Service at creation time (default for destination reviews, or when content-mod score >= 0.5). |
| `APPROVED` | Passed moderation; publicly visible (if `lifecycleState = ACTIVE`). | Service at creation time (default for accommodation reviews with clean text), or by admin via `POST …/moderate`. |
| `REJECTED` | Failed moderation; not publicly visible. | Admin via `POST …/moderate`. |

The enum is defined in `packages/schemas/src/enums/moderation-status.enum.ts`
as `ModerationStatusEnum`.

---

## Hybrid Default Policy

The initial `moderationState` for a new review is resolved by
`resolveInitialModerationState` in
`packages/service-core/src/services/moderation/review-moderation.helpers.ts`.

Decision tree (applied in priority order):

1. **Content-moderation hit** (`moderationScore >= 0.5`) → `PENDING`, regardless
   of entity type or verification level.
2. **Verified reviewer** (`verificationLevel === 'verified'`) → `APPROVED`.
   Reserved for a future reservation system; no existing code sets `'verified'`
   in v1, so this branch is currently unreachable in practice.
3. **Entity-type default**:
   - `accommodation` → `APPROVED` (reviewer has a semi-verified relationship
     with the host via the messaging system).
   - `destination` → `PENDING` (no transactional barrier; anyone can write one).

```ts
// Both review services call this in their _beforeCreate hook.
const moderationState = resolveInitialModerationState({
  entityType: 'accommodation',  // or 'destination'
  verificationLevel: 'semi',    // or 'none' for destination
  moderationScore: contentModResult.score,
});
```

The constant `MODERATION_PENDING_THRESHOLD = 0.5` is also exported from the
same helpers file and used by both review services.

### Retroactive rows

Existing rows that were publicly visible before SPEC-166 landed were backfilled
to `moderationState = 'APPROVED'` in the same schema migration so they remain
visible without any additional admin action.

---

## Content-Moderation Gate

At creation time both review services:

1. Concatenate `title` and `content` into a single string.
2. Call `await moderateText({ text, context: 'review' })` from
   `@repo/content-moderation`.
3. Feed `result.score` into `resolveInitialModerationState`.

If the score is `>= 0.5` (in v1: any blocklisted word or domain is present),
the initial state is forced to `PENDING` regardless of the per-entity default.

See `packages/content-moderation/README.md` for the full `moderateText` API,
score semantics, and environment variable reference.

---

## Permissions

| Permission | Enum value | What it gates |
|------------|-----------|---------------|
| `ACCOMMODATION_REVIEW_MODERATE` | `accommodation.review.moderate` | `moderateReview()` and `getPendingCount()` on `AccommodationReviewService`. Also gates the admin moderate route. |
| `DESTINATION_REVIEW_MODERATE` | `destination.review.moderate` | Same for `DestinationReviewService`. |

Both permissions are granted to `ADMIN` and `SUPER_ADMIN` roles in the seed.

The pending-count endpoint (`GET /api/v1/admin/moderation/reviews/pending-count`) uses
**OR semantics**: an actor with either permission gets a partial result. If an
actor lacks `ACCOMMODATION_REVIEW_MODERATE`, that count is `0` (not an error).
A 403 is returned only when the actor lacks **both** permissions.

The general moderation aggregation endpoint (`GET /api/v1/admin/moderation/pending-count`)
requires `ACCOMMODATION_MODERATION_CHANGE` (cross-entity permission, grants
access to any ADMIN/SUPER_ADMIN actor who can change moderation state).

---

## Admin API Surface

### Pending count (reviews only)

```
GET /api/v1/admin/moderation/reviews/pending-count
```

Returns the count of PENDING reviews broken down by type. Cached 60 seconds.

```json
{
  "count": 12,
  "byType": {
    "accommodationReviews": 8,
    "destinationReviews": 4
  }
}
```

Gate: base admin access (ADMIN or SUPER_ADMIN). Each service enforces its own
per-type permission; a denied service contributes `0`.

Source: `apps/api/src/routes/moderation/admin/reviews-pending-count.ts`

### Pending count (all content entities)

```
GET /api/v1/admin/moderation/pending-count
```

Returns the count of PENDING items across accommodations, destinations, posts,
and events. Requires `ACCOMMODATION_MODERATION_CHANGE`.

```json
{
  "total": 31,
  "byEntity": {
    "accommodations": 10,
    "destinations": 15,
    "posts": 5,
    "events": 1
  }
}
```

Source: `apps/api/src/routes/moderation/admin/pending-count.ts`

### Moderate a review

```
POST /api/v1/admin/accommodations/reviews/:id/moderate
POST /api/v1/admin/destinations/reviews/:id/moderate
```

Applies a moderation decision to a single review.

**Request body** (`ReviewModerateInputSchema`):

```json
{
  "decision": "APPROVED",
  "reason": "Looks good."
}
```

| Field | Type | Notes |
|-------|------|-------|
| `decision` | `"APPROVED" \| "REJECTED"` | Required. `PENDING` is not a valid decision — it is the initial system-assigned state. |
| `reason` | `string` (max 1000 chars) | Optional. Expected by convention when decision is `REJECTED`. |

**Response**: the full admin representation of the updated review.

Sets `moderationState`, `moderatedById`, `moderatedAt`, and optionally
`moderationReason`. Does **not** touch `lifecycleState`.

**Errors**:

| Status | Condition |
|--------|-----------|
| 400 | `decision` is not `APPROVED` or `REJECTED`. |
| 403 | Actor lacks the required moderate permission. |
| 404 | Review not found. |

Permission required: `ACCOMMODATION_REVIEW_MODERATE` (accommodation) or
`DESTINATION_REVIEW_MODERATE` (destination).

Sources:

- `apps/api/src/routes/accommodation/reviews/admin/moderate.ts`
- `apps/api/src/routes/destination/reviews/admin/moderate.ts`

### Admin list filter by moderation state

Both admin review list endpoints accept a `moderationState` query parameter
(`PENDING | APPROVED | REJECTED`) to filter the queue directly:

```
GET /api/v1/admin/accommodations/reviews?moderationState=PENDING
GET /api/v1/admin/destinations/reviews?moderationState=PENDING
```

This filter is part of `AccommodationReviewAdminSearchSchema` and
`DestinationReviewAdminSearchSchema`. The admin list path does NOT force-override
`moderationState` the way the public search path does — admins need to query all
states to moderate them.

---

## Service-Core API

### `resolveInitialModerationState(input)`

```ts
import {
  resolveInitialModerationState,
  MODERATION_PENDING_THRESHOLD,
} from '@repo/service-core';
// or directly:
import {
  resolveInitialModerationState,
  MODERATION_PENDING_THRESHOLD,
} from 'packages/service-core/src/services/moderation/review-moderation.helpers';
```

| Input field | Type | Description |
|-------------|------|-------------|
| `entityType` | `'accommodation' \| 'destination'` | Determines the per-entity default when score is below threshold. |
| `verificationLevel` | `'semi' \| 'verified' \| 'none'` | `'verified'` always yields APPROVED (future reservation system slot). |
| `moderationScore` | `number` (0..1) | Score from `@repo/content-moderation/moderateText`. |

Returns `ModerationStatusEnum.PENDING` or `ModerationStatusEnum.APPROVED`.

### `AccommodationReviewService.moderateReview(input)`

```ts
const result = await service.moderateReview({
  id: reviewId,
  decision: ModerationStatusEnum.APPROVED,
  reason: 'Looks legitimate',
  actor,
});
```

Permission gate: `ACCOMMODATION_REVIEW_MODERATE`. Sets `moderationState`,
`moderatedById`, `moderatedAt`, `moderationReason`. Does not touch
`lifecycleState`.

### `AccommodationReviewService.getPendingCount(input)`

```ts
const result = await service.getPendingCount({ actor });
// result.data = { count: 8 }
```

Permission gate: `ACCOMMODATION_REVIEW_MODERATE`.

`DestinationReviewService` exposes the same two methods, gated on
`DESTINATION_REVIEW_MODERATE`.

---

## Deferred (v2)

The following items were explicitly out of scope in SPEC-166:

- **Reviewer notification on rejection** — no in-app notification when a review
  is rejected. Proposed for v2 to avoid coupling to `@repo/notifications`.
- **Re-submission after rejection** — `REJECTED` is terminal in v1. The
  reviewer may create a new review (they cannot edit and resubmit).
- **Appeal flow** — not implemented.

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/content-moderation/README.md` | `@repo/content-moderation` public API, score semantics, env var reference. |
| `packages/content-moderation/src/types.ts` | `ModerationResult`, `ModerateTextInput`, `ModerateText` types; `moderateTextInputSchema`. |
| `packages/content-moderation/src/moderate-text.ts` | v1 stub engine implementation. |
| `packages/service-core/src/services/moderation/review-moderation.helpers.ts` | `resolveInitialModerationState`, `MODERATION_PENDING_THRESHOLD`. |
| `packages/service-core/src/services/moderation/moderation.aggregation.service.ts` | Cross-entity pending-count aggregation. |
| `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` | `moderateReview`, `getPendingCount`, `_beforeCreate` (content-mod gate), `_executeSearch` (APPROVED filter). |
| `packages/service-core/src/services/destinationReview/destinationReview.service.ts` | Same for destination reviews. |
| `packages/schemas/src/enums/moderation-status.enum.ts` | `ModerationStatusEnum` (PENDING/APPROVED/REJECTED). |
| `packages/schemas/src/common/moderation.schema.ts` | `ReviewModerateInputSchema`, `ReviewPendingCountSchema`, `ModerationPendingCountSchema`. |
| `apps/api/src/routes/moderation/admin/reviews-pending-count.ts` | `GET /admin/moderation/reviews/pending-count` — OR-permission gate. |
| `apps/api/src/routes/moderation/admin/pending-count.ts` | `GET /admin/moderation/pending-count` — cross-entity count. |
| `apps/api/src/routes/accommodation/reviews/admin/moderate.ts` | `POST /admin/accommodations/reviews/:id/moderate`. |
| `apps/api/src/routes/destination/reviews/admin/moderate.ts` | `POST /admin/destinations/reviews/:id/moderate`. |
