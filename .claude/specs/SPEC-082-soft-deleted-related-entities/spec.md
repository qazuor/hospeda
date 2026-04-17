# SPEC-082: Soft-Deleted Related Entities Behavior Policy

> **Status**: draft
> **Priority**: P2
> **Complexity**: 3
> **Origin**: SPEC-066 GAP-023
> **Depends on**: SPEC-066 (completed)
> **Related**: SPEC-062 (runtime response validation), SPEC-063 (lifecycle state standardization)

---

## Problem Statement

When `findOneWithRelations()` or `findAllWithRelations()` loads related entities, Drizzle's `findFirst({ with: { owner: true } })` returns the related record regardless of its `deletedAt` status. There is no filtering applied to relations.

### Example Scenario

1. Accommodation A has `ownerId = "user-1"`
2. User "user-1" is soft-deleted (`deletedAt = 2026-01-01`)
3. `findOneWithRelations({ id: A }, { owner: true })` returns:
   ```json
   { "id": "A", "owner": { "id": "user-1", "deletedAt": "2026-01-01", "name": "Deleted User" } }
   ```
4. Frontend renders the owner's profile data including a soft-deleted user

### Current Behavior

- **No filtering**: All relation loading methods pass `{ with: { key: true } }` to Drizzle without `where` conditions on relations
- **Access schemas strip fields, not records**: SPEC-062's schema validation removes unauthorized fields but does NOT filter out soft-deleted related entities
- **No service-level post-processing**: Zero services override `_afterGetByField` to filter soft-deleted relations

### Impact

- Soft-deleted related entities "leak" through relation loading to the frontend
- Frontend may display data from deleted users, destinations, or accommodations
- No consistent policy exists across services for handling this
- Not currently causing visible bugs because: (a) soft-deleted entities are rare in dev/staging, (b) frontend displays relation data without checking deletedAt

---

## Proposed Solutions

### Option A: Filter at Drizzle Level (Database layer)

Apply `where: { deletedAt: isNull() }` to all relation configs in `transformRelationsForDrizzle()`:

```typescript
// Transform { destination: true } to:
// { destination: { where: (fields) => isNull(fields.deletedAt) } }
```

- **Pros**: Single implementation point, all services benefit automatically
- **Cons**: Cannot opt-out per service, some relations legitimately need deleted records (e.g., "managed by [deleted user]"), changes query behavior globally

### Option B: Post-process at Service Layer (Service layer)

Use `_afterGetByField` hook to nullify soft-deleted related entities:

```typescript
protected async _afterGetByField(entity, actor, ctx) {
    if (entity?.owner?.deletedAt) entity.owner = null;
    return entity;
}
```

- **Pros**: Per-service control, explicit, no Drizzle changes
- **Cons**: Must be implemented per service, easy to miss new relations

### Option C: Document as Intended Behavior (No code change)

Soft-deleted related entities remain visible as historical context. Frontend code can check `deletedAt` and render appropriately (e.g., "Former owner" badge, grayed out name).

- **Pros**: Zero code changes, preserves data integrity, frontend can make UI decisions
- **Cons**: Frontend must handle soft-deleted relations everywhere

### Option D: Per-Service Decision Framework (Hybrid)

Provide a utility and let each service decide:

1. Add `filterSoftDeletedRelations(entity, keys)` utility to service-core
2. Services that want filtering call it in `_afterGetByField`
3. Default behavior: no filtering (Option C)
4. Document the decision per service in a manifest

- **Pros**: Flexible, opt-in, documented
- **Cons**: Requires per-service evaluation and documentation

---

## Recommendation

**Option D** (per-service decision framework) is the most pragmatic:

- Most services DON'T need filtering (destination, accommodation.. soft-deletes are rare)
- Some services NEED the deleted data (audit trails, "managed by [deleted user]")
- A utility makes the opt-in easy, and the manifest makes the decisions traceable

If the team prefers simplicity over flexibility, **Option C** (document as intended) is the fallback.

**Option A** should be avoided because it changes global behavior and makes it impossible to preserve deleted relation data when needed.

---

## Acceptance Criteria

- [ ] Decision documented as ADR
- [ ] If Option D: `filterSoftDeletedRelations` utility added to `@repo/service-core/utils`
- [ ] If Option D: Per-service manifest documenting filtering decisions for each entity's relations
- [ ] If Option C: JSDoc on `findOneWithRelations` and `findAllWithRelations` updated (already partially done)
- [ ] Frontend guidelines for rendering potentially soft-deleted relation data

---

## Entities with Relations to Evaluate

| Entity | Relations | Soft-Delete Risk |
|--------|-----------|-----------------|
| Accommodation | destination, owner, amenities, features, reviews, faqs, tags | owner can be deleted |
| Post | author, relatedAccommodation, relatedDestination, relatedEvent, sponsorship | author can be deleted, related entities can be deleted |
| Event | destination, organizer | organizer can be deleted |
| AccommodationReview | user, accommodation | user can be deleted |
| DestinationReview | user, destination | user can be deleted |
| UserBookmark | user | N/A (self-referencing) |
| OwnerPromotion | owner, accommodation | both can be deleted |
| SponsorshipLevel | sponsor | sponsor can be deleted |
| PostSponsorship | sponsor | sponsor can be deleted |
| Attraction | destination | destination can be deleted |

---

## Files Likely Affected

- `packages/service-core/src/utils/` (new utility if Option D)
- `packages/service-core/src/base/base.crud.hooks.ts` (JSDoc updates)
- `packages/db/src/base/base.model.ts` (JSDoc updates, already partially done)
- `docs/decisions/` (ADR)
