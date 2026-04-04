# SPEC-051: Dedicated Admin Permission Hook (_canAdminList)

> **Status**: completed
> **Priority**: P3
> **Complexity**: Low-Medium
> **Origin**: SPEC-049 GAP-049-027
> **Created**: 2026-03-21
> **Updated**: 2026-03-21 (second exhaustive review: Appendix A categorization corrections, service count fixes)
> **Reviewed**: 2026-03-22 (third review: PostSponsor permission enum fix, ExchangeRate categorization fix)

## Problem Statement

`adminList()` (defined in `BaseCrudRead` at `packages/service-core/src/base/base.crud.read.ts:297`) uses `_canList()` for permission checking (line 324), sharing the exact same check as the public `list()` method.

All 21 services that extend `BaseCrudService` (17 directly, 4 via `BaseCrudRelatedService` which itself extends `BaseCrudService`) have mostly permissive `_canList()` implementations (15 of 21 are either fully permissive, only check actor existence, or are no-ops; 6 enforce a granular permission check via delegation or inline). For example:

- **AccommodationService**: `checkCanList()` is a no-op (allows any actor)
- **PostService**: only checks that `actor` is truthy (`if (!actor) throw`), no permission verification
- **EventOrganizerService**: returns immediately without any check (`return;`)

While admin routes are protected at the API layer by `adminAuthMiddleware` (which verifies `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN`), the **service layer** does not distinguish between admin and non-admin list access. This creates a defense-in-depth gap: if `adminList()` is ever called from a non-HTTP context (e.g., service-to-service calls, background jobs, future internal APIs), the permission check would not enforce admin access.

### Concrete Risk Scenario

A developer adds a new internal endpoint or cron job that calls `accommodationService.adminList(actor, params)` with an authenticated but non-admin actor. The call succeeds because `_canList()` is permissive, bypassing the admin access gate that only exists at the middleware layer.

## Proposed Solution

Add a **concrete (non-abstract)** `_canAdminList()` hook to `BaseCrudPermissions` with a default implementation that:

1. Verifies the actor has admin access (`ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN`)
2. Then delegates to `_canList()` for any entity-specific checks

Update `adminList()` in `BaseCrudRead` to call `_canAdminList()` instead of `_canList()`.

Services can override `_canAdminList()` for entity-specific admin checks (demonstrated with `AccommodationService`).

## Scope

### In Scope

- Add `_canAdminList()` protected concrete method to `BaseCrudPermissions`
- Default implementation: verify admin access + delegate to `_canList()`
- Update `adminList()` to call `_canAdminList()` instead of `_canList()`
- Add `checkCanAdminList()` to `accommodation.permissions.ts` as override example
- Override `_canAdminList()` in `AccommodationService` calling `checkCanAdminList()`
- Unit tests for the new hook (base class + accommodation override)
- Update existing `adminList()` tests to account for the new permission check

### Out of Scope

- Changing existing `_canList()` implementations
- Adding new values to `PermissionEnum`
- Route-level auth changes
- Adding admin hooks for other methods (`getAdminInfo`, `setAdminInfo` use `_canUpdate()` and are acceptable as-is)
- Overriding `_canAdminList()` in services other than Accommodation (can be done incrementally)

## Technical Design

### 1. New Method in `BaseCrudPermissions`

**File**: `packages/service-core/src/base/base.crud.permissions.ts`

Add the following method after `_canUpdateVisibility()` (after line ~172, before the `// --- Abstract Core Logic Methods ---` section at line 174). The previous instruction incorrectly referenced `_canCount()` at line ~157, but `_canUpdateVisibility()` (lines 159-172) sits between `_canCount()` and the Core Logic section. This keeps all permission hooks grouped together. This is a **concrete method with a default implementation**, NOT abstract:

```typescript
/**
 * Checks if the actor has permission to use admin list operations.
 * Default implementation verifies admin access (ACCESS_PANEL_ADMIN or ACCESS_API_ADMIN)
 * and then delegates to _canList() for entity-specific checks.
 *
 * Override this method in concrete services to add entity-specific admin list permissions.
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} If the permission check fails (FORBIDDEN).
 */
protected _canAdminList(actor: Actor): Promise<void> | void {
    const hasAdmin =
        hasPermission(actor, PermissionEnum.ACCESS_PANEL_ADMIN) ||
        hasPermission(actor, PermissionEnum.ACCESS_API_ADMIN);

    if (!hasAdmin) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Admin access required for admin list operations'
        );
    }

    return this._canList(actor);
}
```

**Note on `this._canList(actor)`**: `_canList()` is an **abstract** method declared in `BaseCrudPermissions` (line 139). The call `this._canList(actor)` inside `_canAdminList()` resolves at runtime to the **concrete implementation** in the specific service (e.g., `AccommodationService._canList()`, `PostService._canList()`, etc.). This is standard polymorphic dispatch.

**Required new imports** in `base.crud.permissions.ts`:

The file currently has these imports (lines 1-6):

```typescript
import type { VisibilityEnum } from '@repo/schemas';
import type { ZodObject, ZodType } from 'zod';
import type { z } from 'zod';
import type { Actor, BaseModel, PaginatedListOutput, ServiceContext } from '../types';
import type { CrudNormalizersFromSchemas } from './base.crud.types';
import { BaseService } from './base.service';
```

Add these imports (following the project's import conventions):

- `PermissionEnum` and `ServiceErrorCode` from `@repo/schemas` (change line 1 from `import type { VisibilityEnum }` to `import { PermissionEnum, ServiceErrorCode, type VisibilityEnum }`)
- `ServiceError` from `'../types'` (change line 4 from `import type { Actor, ... }` to `import { ServiceError, type Actor, type BaseModel, type PaginatedListOutput, type ServiceContext }`)
- `hasPermission` from `'../utils/permission'` (add new line: `import { hasPermission } from '../utils/permission';`)

**Important**: The method MUST NOT be `abstract`. Making it abstract would break all 21 existing services that don't implement it.

### 2. Update `adminList()` in `BaseCrudRead`

**File**: `packages/service-core/src/base/base.crud.read.ts`

**Change line 324** from:

```typescript
await this._canList(validatedActor);
```

to:

```typescript
await this._canAdminList(validatedActor);
```

No other changes needed in this file. The `_canAdminList()` default already delegates to `_canList()`, so the full permission chain is preserved.

### 3. Accommodation Override Example

**File**: `packages/service-core/src/services/accommodation/accommodation.permissions.ts`

Add a new exported function after `checkCanList()` (after line ~151):

```typescript
/**
 * Checks if the actor has permission to use admin list for accommodations.
 * Requires ACCOMMODATION_VIEW_ALL permission in addition to admin access
 * (admin access is verified by the base class default).
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} If the actor lacks ACCOMMODATION_VIEW_ALL permission.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: ACCOMMODATION_VIEW_ALL required for admin list'
        );
    }
}
```

**File**: `packages/service-core/src/services/accommodation/accommodation.service.ts`

Add after the existing `_canList()` override (after line ~220):

```typescript
protected _canAdminList(actor: Actor): void {
    super._canAdminList(actor);
    checkCanAdminList(actor);
}
```

**Note**: The override calls `super._canAdminList(actor)` FIRST to enforce the base admin access check, then adds the entity-specific `ACCOMMODATION_VIEW_ALL` check on top.

**Note on sync vs async**: The override is synchronous (`void`) because `AccommodationService._canList()` is synchronous. Since `super._canAdminList()` calls `this._canList()` (which resolves to AccommodationService's sync implementation), the entire chain is synchronous. If a future service has an async `_canList()`, its `_canAdminList()` override MUST use `async/await`:

```typescript
// Pattern for services with async _canList():
protected async _canAdminList(actor: Actor): Promise<void> {
    await super._canAdminList(actor);
    checkCanAdminList(actor);
}
```

**Defense-in-depth rationale**: The admin accommodation list route (`apps/api/src/routes/accommodation/admin/list.ts`) already checks `ACCOMMODATION_VIEW_ALL` at the HTTP middleware layer via `createAdminListRoute({ requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL] })`. The service-level check is intentionally redundant: it protects against non-HTTP callers (cron jobs, service-to-service calls, background tasks) that bypass the middleware. The cost of an extra `Array.includes()` call is negligible.

### 4. Method Call Flow (Before vs After)

**Before**:

```
adminList(actor, params)
  -> _canList(actor)          // permissive in most services
  -> _executeAdminSearch(...)
```

**After**:

```
adminList(actor, params)
  -> _canAdminList(actor)     // NEW: default checks admin access
    -> hasPermission(actor, ACCESS_PANEL_ADMIN || ACCESS_API_ADMIN)
    -> _canList(actor)        // existing entity-level check preserved
  -> _executeAdminSearch(...) // unchanged
```

**Accommodation override flow**:

```
adminList(actor, params)
  -> _canAdminList(actor)     // overridden in AccommodationService
    -> super._canAdminList(actor)  // base admin access check
      -> hasPermission(actor, ACCESS_PANEL_ADMIN || ACCESS_API_ADMIN)
      -> _canList(actor)           // existing no-op
    -> checkCanAdminList(actor)    // ACCOMMODATION_VIEW_ALL check
  -> _executeAdminSearch(...)      // unchanged
```

### 5. What Does NOT Change

- `_executeAdminSearch()` .. no changes, permission is checked before it runs
- `_canList()` .. remains abstract, no changes to any existing implementation
- `_canSearch()`, `_canCount()` .. unaffected
- `getAdminInfo()`, `setAdminInfo()` .. continue using `_canUpdate()` as-is
- All 20 other services .. use the default `_canAdminList()` without changes (21 total minus AccommodationService)
- `BaseCrudRelatedService` .. extends `BaseCrudService`, inherits `_canAdminList()` automatically. The 4 services using it (Amenity, Attraction, Feature, Tag) need no changes.
- Admin route middleware .. unchanged, still enforces admin access at HTTP layer

## Affected Files

### Modified

| File | Change |
|------|--------|
| `packages/service-core/src/base/base.crud.permissions.ts` | Add `_canAdminList()` concrete method with default admin access check |
| `packages/service-core/src/base/base.crud.read.ts` | Change `_canList()` to `_canAdminList()` in `adminList()` (line 324) |
| `packages/service-core/src/services/accommodation/accommodation.permissions.ts` | Add `checkCanAdminList()` function |
| `packages/service-core/src/services/accommodation/accommodation.service.ts` | Add `_canAdminList()` override |

### New Files

| File | Purpose |
|------|---------|
| `packages/service-core/test/base/crud/adminListPermission.test.ts` | Unit tests for `_canAdminList()` default behavior |
| `packages/service-core/test/services/accommodation/accommodation.adminListPermission.test.ts` | Tests for Accommodation override |

> **Note**: Test file names follow camelCase convention matching existing files in the same directories (e.g., `adminList.test.ts`, `hardDelete.test.ts`, `getById.test.ts`).

### Potentially Modified (test updates)

| File | Change |
|------|--------|
| `packages/service-core/test/base/crud/adminList.test.ts` | Update existing adminList tests: actors must now have admin access permissions (see mockAdminActor section below) |
| `packages/service-core/test/services/accommodation/accommodation.permissions.test.ts` | Add tests for `checkCanAdminList()` |

## Testing Requirements

### Unit Tests: Base `_canAdminList()` Default

**File**: `packages/service-core/test/base/crud/adminListPermission.test.ts`

Test cases:

1. **Rejects actor without admin access permissions** .. actor has no `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN` -> throws `ServiceError(FORBIDDEN)` with message "Admin access required for admin list operations"
2. **Allows actor with ACCESS_PANEL_ADMIN** .. actor has `ACCESS_PANEL_ADMIN` -> delegates to `_canList()`, succeeds if `_canList()` allows
3. **Allows actor with ACCESS_API_ADMIN** .. actor has `ACCESS_API_ADMIN` -> delegates to `_canList()`, succeeds if `_canList()` allows
4. **Allows actor with BOTH admin permissions** .. should succeed
5. **Delegates to `_canList()` after admin check passes** .. verify `_canList()` is called (spy)
6. **Fails if `_canList()` throws after admin check passes** .. admin check passes but `_canList()` throws FORBIDDEN -> error propagates

**Actor construction for these tests** (use `ActorFactoryBuilder` from `test/factories/actorFactory.ts`):

```typescript
// Actor WITHOUT admin access (should fail)
const nonAdminActor = new ActorFactoryBuilder()
    .withId('non-admin-1')
    .withPermissions([PermissionEnum.ACCOMMODATION_VIEW_ALL]) // has entity perm but no admin access
    .build();

// Actor WITH panel admin access (should pass)
const panelAdminActor = new ActorFactoryBuilder()
    .withId('panel-admin-1')
    .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
    .build();

// Actor WITH API admin access (should pass)
const apiAdminActor = new ActorFactoryBuilder()
    .withId('api-admin-1')
    .withPermissions([PermissionEnum.ACCESS_API_ADMIN])
    .build();

// Actor WITH both admin permissions (should pass)
const fullAdminActor = new ActorFactoryBuilder()
    .withId('full-admin-1')
    .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.ACCESS_API_ADMIN])
    .build();
```

### Unit Tests: Accommodation Override

**File**: `packages/service-core/test/services/accommodation/accommodation.adminListPermission.test.ts`

Test cases:

1. **Rejects actor without admin access** .. no admin perms -> throws FORBIDDEN (from super) with message "Admin access required for admin list operations"
2. **Rejects actor with admin access but without ACCOMMODATION_VIEW_ALL** .. has `ACCESS_PANEL_ADMIN` but no `ACCOMMODATION_VIEW_ALL` -> throws FORBIDDEN with message "Permission denied: ACCOMMODATION_VIEW_ALL required for admin list"
3. **Allows actor with admin access AND ACCOMMODATION_VIEW_ALL** .. has both -> succeeds (no throw)
4. **Calls super._canAdminList() before entity check** .. verify order of checks using the following pattern:

```typescript
it('calls super._canAdminList() before checkCanAdminList()', () => {
    const callOrder: string[] = [];

    // Spy on the base class method to track call order
    const superSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(service)),
        '_canAdminList'
    ).mockImplementation(() => {
        callOrder.push('super._canAdminList');
    });

    // Spy on checkCanAdminList to track call order
    const checkSpy = vi.spyOn(accommodationPermissions, 'checkCanAdminList')
        .mockImplementation(() => {
            callOrder.push('checkCanAdminList');
        });

    const actor = new ActorFactoryBuilder()
        .withId('admin-1')
        .withPermissions([
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCOMMODATION_VIEW_ALL
        ])
        .build();

    // Access protected method via type assertion for testing
    (service as unknown as { _canAdminList: (a: Actor) => void })._canAdminList(actor);

    expect(callOrder).toEqual(['super._canAdminList', 'checkCanAdminList']);

    superSpy.mockRestore();
    checkSpy.mockRestore();
});
```

**Actor construction for these tests**:

```typescript
// Admin without entity permission (should fail at entity check)
const adminNoEntityPerm = new ActorFactoryBuilder()
    .withId('admin-no-entity-1')
    .withPermissions([PermissionEnum.ACCESS_PANEL_ADMIN])
    .build();

// Admin WITH entity permission (should pass)
const adminWithEntityPerm = new ActorFactoryBuilder()
    .withId('admin-with-entity-1')
    .withPermissions([
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCOMMODATION_VIEW_ALL
    ])
    .build();
```

### Unit Tests: `checkCanAdminList()` Permission Function

**File**: `packages/service-core/test/services/accommodation/accommodation.permissions.test.ts` (add to existing)

Test cases:

1. **Throws FORBIDDEN without ACCOMMODATION_VIEW_ALL** .. actor lacks permission -> `ServiceError(FORBIDDEN)` with message "Permission denied: ACCOMMODATION_VIEW_ALL required for admin list"
2. **Allows with ACCOMMODATION_VIEW_ALL** .. actor has permission -> no throw

### Integration: `adminList()` Flow

**File**: `packages/service-core/test/base/crud/adminList.test.ts` (update existing)

Verify:

1. **adminList() calls `_canAdminList()` not `_canList()` directly** .. spy on both, verify only `_canAdminList()` is called directly from `adminList()`
2. **Existing adminList tests pass** .. update test actors to include admin access permissions where needed

### `mockAdminActor` Fix Required

**File**: `packages/service-core/test/base/base/base.service.mockData.ts` (lines 52-56)

The current `mockAdminActor` definition is:

```typescript
export const mockAdminActor: Actor = new ActorFactoryBuilder()
    .superAdmin()
    .withId('admin-user-1')
    .withPermissions([PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.ACCOMMODATION_UPDATE_ANY])
    .build();
```

**Problem**: `.superAdmin()` sets `permissions: Object.values(PermissionEnum)` (ALL permissions), but the subsequent `.withPermissions([...])` call **overwrites** the array to only 2 permissions. So `mockAdminActor` does NOT have `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN`.

**Fix**: Add admin access permissions to the `.withPermissions()` array:

```typescript
export const mockAdminActor: Actor = new ActorFactoryBuilder()
    .superAdmin()
    .withId('admin-user-1')
    .withPermissions([
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY
    ])
    .build();
```

**Impact**: This change affects ALL existing tests that use `mockAdminActor`. Since we're ADDING a permission (not removing), existing assertions should not break. However, verify that no test asserts the exact permission set of `mockAdminActor`.

### Test Patterns to Follow

Use the existing test infrastructure:

- `ActorFactoryBuilder` from `test/factories/actorFactory.ts` for constructing actors with specific permissions
- `createBaseModelMock<TEntity>()` from `test/utils/modelMockFactory.ts` for model mocks
- `createServiceTestInstance(ServiceClass, modelMock)` from `test/helpers/serviceTestFactory.ts` for service instantiation
- `asMock()` from `test/utils/test-utils.ts` for type-safe mock casting
- `vi.fn()` and `vi.spyOn()` for method spying
- `expectForbidden(fn, message)` helper pattern (inline, see `accommodation.permissions.test.ts` lines 37-48):

```typescript
const expectForbidden = (fn: () => void, message: string) => {
    try {
        fn();
        throw new Error('Should have thrown');
    } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        if (err instanceof ServiceError) {
            expect(err.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(err.message).toMatch(message);
        }
    }
};
```

## Acceptance Criteria

- [ ] `_canAdminList()` exists as a **concrete** (non-abstract) protected method in `BaseCrudPermissions`
- [ ] Default implementation checks `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN`, then delegates to `_canList()`
- [ ] `adminList()` calls `_canAdminList()` instead of `_canList()` (line 324 of base.crud.read.ts)
- [ ] `AccommodationService` overrides `_canAdminList()` with `ACCOMMODATION_VIEW_ALL` check
- [ ] `checkCanAdminList()` exported from `accommodation.permissions.ts`
- [ ] All 21 existing services continue to work without changes (default covers them)
- [ ] Existing `adminList()` tests pass (actors updated with admin permissions if needed)
- [ ] New unit tests cover: default behavior (6 cases), accommodation override (4 cases), permission function (2 cases)
- [ ] All tests pass with `pnpm test`
- [ ] No biome lint errors (`pnpm lint`)
- [ ] TypeScript compiles without errors (`pnpm typecheck`)

## Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user.

### Prerequisites

**None.** SPEC-051 is fully independent. It can be implemented at any time, in parallel with any other spec.

### Position in the Dependency Graph

```
SPEC-051 is INDEPENDENT ── no blockers, no dependents
```

SPEC-051 does NOT depend on any other spec. No other spec depends on SPEC-051.

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-052 | None | Different files. SPEC-052 touches `AdminSearchExecuteParams`, SPEC-051 touches `BaseCrudPermissions`. |
| SPEC-055 | None | Different layers. SPEC-055 is DB model layer, SPEC-051 is service permissions. |
| SPEC-058 | None | Different scope. SPEC-058 touches `BaseModel` interface, SPEC-051 touches `BaseCrudPermissions`. |
| SPEC-059 | Low | Both touch `base.crud.permissions.ts` but different methods. SPEC-051 adds `_canAdminList()`, SPEC-059 threads `ctx` through existing hooks. If both in-flight, coordinate on this file. |

### Agent Instructions

1. Verify `pnpm typecheck` passes on current `main` before starting
2. Implement all changes (4 files modified, 2 new test files)
3. Run `pnpm typecheck && pnpm test`
4. This spec can be merged independently at any time

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Making method abstract instead of concrete breaks 21 services | Low | High | Spec explicitly states "concrete, NOT abstract". AC verifies all services work. |
| Existing tests fail because actors lack admin permissions | Medium | Low | Update test actors to include `ACCESS_PANEL_ADMIN`. This is a test-only change. |
| System actor calls break (cron jobs, background tasks) | None | N/A | System actors are created via `createSystemActor()` in `apps/api/src/utils/actor.ts` with `permissions: Object.values(PermissionEnum)` (ALL permissions). They pass the admin access check. Verified in code. |
| Override forgets to call `super._canAdminList()` | Low | Medium | Documented pattern shows `super` call first. Code review catch. |

## Future Considerations

- Other admin operations (`getAdminInfo`, `setAdminInfo`) currently use `_canUpdate()` without a dedicated admin hook. If the same defense-in-depth pattern is desired, similar hooks (`_canAdminGetInfo`, `_canAdminSetInfo`) could be added in a follow-up spec.
- Other services can incrementally add `_canAdminList()` overrides as needed (e.g., `PostService` with `POST_VIEW_ALL`, `EventService` with `EVENT_VIEW_ALL`).
- Consider a `_canAdminSearch()` hook if an `adminSearch()` method is ever added.

## Appendix A: Complete Service Inventory and `_canList()` Implementations

All 21 services extending `BaseCrudService` (17 directly + 4 via `BaseCrudRelatedService`), grouped by `_canList()` strictness:

### Fully Permissive (1 service)

| Service | File | `_canList()` Behavior |
|---------|------|-----------------------|
| EventOrganizerService | `services/eventOrganizer/eventOrganizer.service.ts` | Returns immediately, no checks |

### Actor Existence Check Only (3 services)

| Service | File | `_canList()` Behavior |
|---------|------|-----------------------|
| EventLocationService | `services/eventLocation/eventLocation.service.ts` | Inline: `if (!actor) throw` .. else return |
| PostService | `services/post/post.service.ts` | Inline: `if (!actor) throw` .. else return |
| UserBookmarkService | `services/userBookmark/userBookmark.service.ts` | Inline: `if (!actor) throw` .. else return |

### Direct Permission Check (2 services)

| Service | File | `_canList()` Behavior |
|---------|------|-----------------------|
| SponsorshipLevelService | `services/sponsorship/sponsorshipLevel.service.ts` | Checks `PermissionEnum.SPONSORSHIP_VIEW` |
| SponsorshipPackageService | `services/sponsorship/sponsorshipPackage.service.ts` | Checks `PermissionEnum.SPONSORSHIP_VIEW` |

### Delegates to External Permission Function (15 services)

| Service | File | Delegates To | Effective Behavior |
|---------|------|-------------|--------------------|
| AccommodationService | `services/accommodation/accommodation.service.ts` | `checkCanList()` | No-op (allows anyone) |
| AccommodationReviewService | `services/accommodationReview/accommodationReview.service.ts` | `checkCanViewAccommodationReview()` | Actor existence check |
| AmenityService* | `services/amenity/amenity.service.ts` | `checkCanListAmenities()` | Actor existence check |
| AttractionService* | `services/attraction/attraction.service.ts` | `checkCanListAttractions()` | Actor existence check |
| DestinationService | `services/destination/destination.service.ts` | `checkCanListDestinations()` | Actor existence check |
| DestinationReviewService | `services/destinationReview/destinationReview.service.ts` | `checkCanViewDestinationReview()` | Actor existence check |
| EventService | `services/event/event.service.ts` | `checkCanListEvents()` | Actor existence check |
| FeatureService* | `services/feature/feature.service.ts` | `checkCanListFeatures()` | Actor existence check |
| OwnerPromotionService | `services/owner-promotion/ownerPromotion.service.ts` | `checkCanList()` | Actor existence check |
| PostSponsorService | `services/postSponsor/postSponsor.service.ts` | `checkCanManagePostSponsor()` | Permission check (POST_SPONSOR_MANAGE) |
| PostSponsorshipService | `services/postSponsorship/postSponsorship.service.ts` | `checkCanListPostSponsorship()` | Actor existence check |
| SponsorshipService | `services/sponsorship/sponsorship.service.ts` | `checkCanList()` | Permission check (`SPONSORSHIP_VIEW_ANY` or `SPONSORSHIP_VIEW_OWN`) |
| TagService* | `services/tag/tag.service.ts` | `checkCanListTags()` | Actor existence check |
| UserService | `services/user/user.service.ts` | `this._canSearch(actor)` | Permission check (`USER_READ_ALL` via `hasPermission`) |
| ExchangeRateService | `services/exchange-rate/exchange-rate.service.ts` | `checkCanListExchangeRate()` | Permission check (EXCHANGE_RATE_VIEW) |

> \* Services marked with asterisk extend `BaseCrudRelatedService` (which extends `BaseCrudService`), not `BaseCrudService` directly. The inheritance chain is the same, so `_canAdminList()` applies identically.
>
> All file paths are relative to `packages/service-core/src/`. None of these 21 services need modification for this spec .. the default `_canAdminList()` in the base class covers them all.

## Appendix B: Inheritance Chain Reference

```
BaseService
  -> BaseCrudPermissions  (permission hook declarations: _can* + abstract schemas/model)
    -> BaseCrudHooks      (default no-op lifecycle hooks: _before*/_after*)
      -> BaseCrudRead     (getByField, getById, list, search, adminList, count)
        -> BaseCrudWrite  (create, update, softDelete, hardDelete, restore, updateVisibility)
          -> BaseCrudAdmin (getAdminInfo, setAdminInfo)
            -> BaseCrudService (public entry point, combines all mixins)
```

The new `_canAdminList()` method is added to `BaseCrudPermissions` (bottom of the chain) and consumed by `adminList()` in `BaseCrudRead` (three levels up). This follows the same pattern as all other `_can*` hooks.
