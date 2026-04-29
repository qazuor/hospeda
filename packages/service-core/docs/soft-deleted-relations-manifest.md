# Soft-Deleted Related Entities — Per-Service Decision Manifest

> **Spec**: SPEC-082
> **ADR**: [ADR-023](../../../docs/decisions/ADR-023-soft-deleted-related-entities.md)
> **Utility**: `filterSoftDeletedRelations` from `@repo/service-core`

## Purpose

`findOneWithRelations` and `findAllWithRelations` load related entities through
Drizzle's `findFirst({ with })` and `findMany({ with })` regardless of the
related record's `deletedAt` status. Hospeda services do **not** filter
soft-deleted relations at the database layer because some relations
legitimately need the deleted record (audit trails, historical context,
"managed by [deleted user]" UI labels).

ADR-023 chose a per-service decision framework. This file is the manifest
of those decisions.

## How to read this manifest

For each service that loads relations, the table answers two questions:

1. **Filter?** Does the service strip soft-deleted relations from responses?
2. **Why?** Short justification, especially when the answer is "no".

When a service is marked **Filter: yes**, it MUST call
`filterSoftDeletedRelations(entity, [...keys])` from `_afterGetByField`
(single entity) and after `_executeSearch` / `_executeAdminSearch` (lists)
for the listed keys.

## Manifest

| Service | Relations | Filter? | Decision rationale |
|---------|-----------|---------|--------------------|
| `AccommodationService` | `destination`, `owner`, `amenities`, `features`, `reviews`, `faqs`, `tags` | **no** | Owner deletions are rare and the public listing should keep historical attribution. Frontend renders a "Former owner" badge when `owner.deletedAt` is set. Reviews are themselves soft-deleted independently and follow their own visibility rules. |
| `DestinationService` | (hierarchy: parent, children, ancestors) | **no** | Hierarchy traversal needs deleted destinations to maintain `path` integrity. UI suppresses deleted nodes via the visibility filter, not via relation filtering. |
| `EventService` | `destination`, `organizer` | **no** | Organizer history is shown on archived events. Destination deletions are operationally rare and would break event location context. |
| `PostService` | `author`, `relatedAccommodation`, `relatedDestination`, `relatedEvent`, `sponsorship` | **partial — filter `sponsorship`** | Author attribution remains for historical posts. `relatedAccommodation`/`relatedDestination`/`relatedEvent` are intentionally kept so the post stays self-contained. `sponsorship` is filtered because a deleted sponsorship must not surface as an active sponsor on the post. |
| `AccommodationReviewService` | `user`, `accommodation` | **filter `user`** | A deleted reviewer's profile must not be re-exposed. The review text remains; the user reference becomes `null` and the UI renders "Anonymous". |
| `DestinationReviewService` | `user`, `destination` | **filter `user`** | Same reasoning as `AccommodationReviewService`. |
| `UserBookmarkService` | `user`, target entity | **no** | Bookmarks are private to the user and are themselves cascade-deleted by the bookmark trigger when the target entity is hard-deleted. Soft-deleted targets remain visible to the bookmark owner so they can clean up their list. |
| `OwnerPromotionService` | `owner`, `accommodation` | **filter both** | Promotions for deleted owners or accommodations must not be served as active promotions. |
| `SponsorshipLevelService` | `sponsor` | **filter `sponsor`** | A deleted sponsor must not appear as an active sponsorship tier. |
| `PostSponsorshipService` | `sponsor` | **filter `sponsor`** | Same reasoning as `SponsorshipLevelService`. |
| `AttractionService` | `destination` | **no** | Attractions are tied to a destination. If the destination is soft-deleted, the attraction is still surfaced under archived contexts (e.g., admin views). Public listing already filters by destination visibility. |

## Implementing a "filter" decision

```ts
import { filterSoftDeletedRelations } from '@repo/service-core';

protected async _afterGetByField(
    entity: AccommodationReview | null,
    _actor: Actor,
    _ctx: ServiceContext
): Promise<AccommodationReview | null> {
    return filterSoftDeletedRelations(entity, ['user']);
}
```

For list endpoints, apply the filter in the override of `_executeSearch` /
`_executeAdminSearch` after fetching the page:

```ts
protected async _executeSearch(...) {
    const result = await this.model.findAllWithRelations(...);
    return {
        ...result,
        items: result.items.map((item) =>
            filterSoftDeletedRelations(item, ['user'])
        ),
    };
}
```

## Updating this manifest

When adding a new service that loads relations, OR adding a new relation to an
existing service, decide:

1. Will the deleted record cause incorrect or misleading data on the consumer
   side? If yes, **filter** and document the reason here.
2. Otherwise, **don't filter** and document why the historical context is
   valuable.

If the decision is unclear, default to "no filter" (preserve historical
context) and revisit when concrete consumer behavior is defined.
