# SPEC-083: Service getById Test Infrastructure Alignment

> **Status**: draft
> **Priority**: P1
> **Complexity**: 3
> **Origin**: SPEC-066 GAP-022, GAP-028
> **Depends on**: SPEC-066 (completed)

---

## Problem Statement

After SPEC-066, 10 services with `getDefaultListRelations() !== undefined` now call `model.findOneWithRelations()` in their `getByField()` path. However, their test files still mock/assert on `model.findOne()`, creating false-positive tests that pass without validating the actual relation-loading path.

### GAP-028: False Positive Tests (Mock Wrong Method)

Services WITH relations have tests that:
1. Mock `model.findOne` to return the entity
2. Assert `findOne` was called
3. Never check `findOneWithRelations`

Since `findOneWithRelations` is a `vi.fn()` from `createTypedModelMock` that returns `undefined`, the service treats it as NOT_FOUND.. but the test still passes because `findOne` is also mocked.

### GAP-022: Loose Matchers (Exact Config Not Verified)

Tests that DO mock `findOneWithRelations` use `expect.any(Object)` for the relations parameter:

```typescript
// Current
expect(model.findOneWithRelations).toHaveBeenCalledWith(
    { id: entity.id },
    expect.any(Object),  // <-- should be exact config
    undefined
);
```

If a service's `getDefaultListRelations()` is accidentally changed (e.g., `owner` removed), the test still passes.

### Affected Test Files

Services WITH relations (must assert `findOneWithRelations` with exact config):
- `test/services/accommodation/getById.test.ts` .. `{ destination: true, owner: true }` for list, `{ destination: true, owner: true, amenities: true, features: true, reviews: true, faqs: true, tags: true }` for getById
- `test/services/post/getById.test.ts` .. `{ author: true, relatedAccommodation: true, relatedDestination: true, relatedEvent: true, sponsorship: { sponsor: true } }`
- `test/services/event/getById.test.ts`
- `test/services/attraction/getById.test.ts`
- `test/services/accommodationReview/getById.test.ts`
- `test/services/destinationReview/getById.test.ts`
- `test/services/ownerPromotion/getById.test.ts`
- `test/services/postSponsorship/getById.test.ts`
- `test/services/sponsorshipLevel/getById.test.ts`
- `test/services/userBookmark/getById.test.ts`

Services WITHOUT relations (must assert `findOne` with `(where, undefined)`):
- `test/services/destination/getById.test.ts`
- `test/services/user/getById.test.ts`
- `test/services/tag/getById.test.ts`
- `test/services/amenity/getById.test.ts`
- `test/services/feature/getById.test.ts`
- `test/services/faq/getById.test.ts`
- `test/services/exchangeRate/getById.test.ts`

---

## Implementation Plan

### Phase 1: Fix Services WITH Relations

For each affected service:

1. Mock `findOneWithRelations` (not `findOne`) to return entity with relation stubs
2. Assert `findOneWithRelations` called with exact relation config matching `getDefaultGetByIdRelations()` (or `getDefaultListRelations()` if no override)
3. Assert `findOne` was NOT called
4. Include the tx argument (third parameter) as `undefined` in the assertion

```typescript
// Example: accommodation getById.test.ts
const mockEntityWithRelations = {
    ...mockAccommodation,
    destination: { id: 'dest-1', name: 'Beach City' },
    owner: { id: 'owner-1', displayName: 'John' },
    amenities: [],
    features: [],
    reviews: [],
    faqs: [],
    tags: []
};

asMock(modelMock.findOneWithRelations).mockResolvedValue(mockEntityWithRelations);

// ... call getById ...

expect(asMock(modelMock.findOneWithRelations)).toHaveBeenCalledWith(
    { id: mockAccommodation.id },
    { destination: true, owner: true, amenities: true, features: true, reviews: true, faqs: true, tags: true },
    undefined
);
expect(asMock(modelMock.findOne)).not.toHaveBeenCalled();
```

### Phase 2: Fix Services WITHOUT Relations

For each affected service:

1. Ensure `findOne` is asserted with `(where, undefined)` (the tx arg)
2. Assert `findOneWithRelations` was NOT called

```typescript
expect(asMock(modelMock.findOne)).toHaveBeenCalledWith(
    { id: mockEntity.id },
    undefined
);
expect(asMock(modelMock.findOneWithRelations)).not.toHaveBeenCalled();
```

### Phase 3: Prevent Regression

Add a test helper or lint rule to ensure new service getById tests use the correct pattern.

---

## Acceptance Criteria

- [ ] All 10 services WITH relations: `findOneWithRelations` mocked and asserted with exact config
- [ ] All 7 services WITHOUT relations: `findOne` asserted with `(where, undefined)`
- [ ] No service test uses `expect.any(Object)` for the relations argument
- [ ] All tests pass with zero regressions
- [ ] Typecheck passes

---

## Estimated Scope

- ~17 test files to update
- Mechanical changes: update mock setup + assertion pattern
- Complexity per file: low (copy-paste with config adjustment)
- Total estimated complexity: 3 (volume, not difficulty)

---

## Files Affected

All files under `packages/service-core/test/services/*/getById.test.ts`
