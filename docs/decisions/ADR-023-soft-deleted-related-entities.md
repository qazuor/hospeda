# ADR-023: Soft-Deleted Related Entities Behavior Policy

**Status**: Accepted
**Date**: 2026-04-29
**Spec**: SPEC-082

## Context

Hospeda uses soft-delete (`deletedAt` timestamp) on most entities. When a
service loads related entities through `findOneWithRelations` or
`findAllWithRelations`, Drizzle's `findFirst({ with: { owner: true } })`
returns the related record regardless of its `deletedAt` status. There is
no `where` filter applied to relations.

### Concrete scenario

1. Accommodation A has `ownerId = "user-1"`.
2. User "user-1" is soft-deleted (`deletedAt = 2026-01-01`).
3. `findOneWithRelations({ id: A }, { owner: true })` returns:

   ```json
   { "id": "A", "owner": { "id": "user-1", "deletedAt": "2026-01-01", "name": "Deleted User" } }
   ```

4. The frontend may render the deleted user's name and avatar as if the
   account were still active.

### Why a single global rule does not fit

- Some relations legitimately need the deleted record. Audit-trail UI shows
  "managed by [deleted user]". Posts retain authorship attribution. Event
  history keeps the original organizer label.
- Other relations must hide the deleted record. A deleted reviewer's
  profile must not be re-served. A deleted sponsor must not surface as an
  active sponsorship tier.

A blanket database-level filter (option A in the spec) would be wrong
because it would erase legitimate historical context. A blanket "do
nothing" (option C) would be wrong because consumer-side handling would
need to be re-implemented across every UI surface.

## Considered Options

### Option A — Filter at the Drizzle layer (rejected)

Apply `where: (fields) => isNull(fields.deletedAt)` to every relation key
in `transformRelationsForDrizzle`. Single implementation point; all services
benefit automatically.

- Cannot opt out per service or per relation.
- Erases legitimate historical context (audit trails, attribution).
- Changes query semantics globally — invisible to readers of any service.
- Rejected.

### Option B — Post-process per service (partially adopted)

Use `_afterGetByField` (and equivalent list hooks) to nullify or strip
soft-deleted relations.

- Per-service control, explicit at the call site.
- Risk: easy to forget for a newly added relation.
- Adopted as the implementation mechanism for services that DO filter.

### Option C — Document as intended, no code change (partially adopted)

Soft-deleted relations remain visible. Frontend handles them per-surface.

- Adopted as the default for services that need historical context.
- The default per ADR-023 is "no filter".

### Option D — Per-service decision framework with utility (adopted)

Provide `filterSoftDeletedRelations(entity, keys)` from
`@repo/service-core`, document the per-service decisions in a manifest,
and let each service decide explicitly.

- Adopted as the framing decision.

## Decision

Adopt **Option D**, the per-service decision framework, with these rules:

1. **Default behavior**: services do NOT filter soft-deleted relations.
   This preserves historical context, which is the safe default for an
   early-stage product where consumer behavior is still settling.
2. **Opt-in filtering**: services that decide to hide soft-deleted
   relations call `filterSoftDeletedRelations(entity, [...keys])` from
   `_afterGetByField` (single entity) and after `_executeSearch` /
   `_executeAdminSearch` (lists), passing the relation keys to filter.
3. **Manifest of decisions**: every service that loads relations is listed
   in `packages/service-core/docs/soft-deleted-relations-manifest.md`
   with its filter decision and rationale. Adding a new service or a new
   relation requires updating the manifest.
4. **No database-level filter**: `transformRelationsForDrizzle` does not
   inject `deletedAt` predicates. Filtering, when applied, happens at the
   service layer where the per-service decision is documented.
5. **Frontend guidance**: when a service is configured NOT to filter (the
   default), the frontend MUST handle the possible `deletedAt` on relation
   data — typically by rendering a "Former …" label or graying out the
   reference. The web app's component library is the canonical place for
   this rendering policy.

## Utility contract

```ts
import { filterSoftDeletedRelations } from '@repo/service-core';

// Single relation: nullified when soft-deleted
filterSoftDeletedRelations(entity, ['owner']);

// Array relation: soft-deleted entries removed
filterSoftDeletedRelations(entity, ['amenities']);
```

The utility is non-mutating, returns the original reference when nothing
changed, and accepts `null` entities (passes through). It is purely a
service-layer helper — there is no model-layer or schema-layer
counterpart.

## Consequences

### Positive

- Decisions are explicit, traceable in the manifest, and reviewable.
- The default ("preserve historical context") matches the product reality
  of an early-stage app where soft-deletes are rare.
- Filtering is opt-in and applies only to the relations a service chooses,
  not to every relation it loads.
- The utility is small (~30 lines) and unit-tested in isolation.

### Negative

- Adding a new relation to a service requires updating the manifest. A
  forgetful contributor can ship a relation that surfaces deleted records
  without realizing it.
- The manifest can drift from the actual code if reviewers don't enforce
  it. Mitigation: the manifest is part of the service-core docs, so it is
  visible from the package's README and quick-start.

### Neutral

- Existing services do not change behavior on adoption. The utility is new
  and used only when a service explicitly opts in.

## References

- `packages/service-core/src/utils/relations.ts` — `filterSoftDeletedRelations` and `isSoftDeleted`
- `packages/service-core/test/utils/relations.test.ts` — unit tests
- `packages/service-core/docs/soft-deleted-relations-manifest.md` — per-service decisions
- `packages/db/src/base/base.model.ts` — JSDoc on `findOneWithRelations` and `findAllWithRelations` references this ADR
- ADR-022 — Service return type safety with relations (companion decision)
- SPEC-066 — getById relation loading consistency
- SPEC-082 — Soft-deleted related entities behavior policy
