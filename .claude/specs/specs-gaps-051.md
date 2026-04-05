# SPEC-051 Gaps Report: Dedicated Admin Permission Hook (_canAdminList)

> **Spec Status**: completed
> **Last Audit Date**: 2026-04-04
> **Total Audit Passes**: 6
> **Pass 1**: 2026-04-04 (Senior Architect + 4 specialized agents)
> **Pass 2**: 2026-04-04 (Senior Architect + 5 specialized agents: base class, accommodation override, test coverage, admin routes/middleware, documentation/forward-compat)
> **Pass 3**: 2026-04-04 (Senior Architect + 5 specialized agents: base class verifier, all-services auditor, test coverage auditor, security auditor, edge-cases/forward-compat auditor)
> **Pass 4**: 2026-04-04 (Senior Architect + 5 specialized agents: base-class code-reviewer, all-services code-reviewer, test-coverage code-reviewer, security-focused code-reviewer, documentation/forward-compat code-reviewer)
> **Pass 5**: 2026-04-04 (Senior Architect + 5 specialized agents: P1-critical-verifier, P2/P3-status-verifier, P4/P5-status-verifier, new-gap-hunter, QA-acceptance-criteria-verifier)
> **Pass 6**: 2026-04-04 (Senior Architect + 5 specialized agents: P1-code-reviewer, P2/P3-code-reviewer, P4/P5+new-gap-hunter, security-edge-case-auditor, QA-acceptance-criteria-verifier)

## Audit Summary

SPEC-051 is **fully implemented and functionally correct** at the core level. The base hook, accommodation override, adminList() integration, and test coverage match the spec requirements. All 11 acceptance criteria PASS. 34/34 SPEC-051-related tests pass (verified in pass 6 execution). All 8 AC criteria verified as PASS.

Six exhaustive audit passes (5 agents each in passes 2-6) identified **30 gaps total** (6 from pass 1, 4 new in pass 2, 2 new in pass 3, 8 new in pass 4, 7 new in pass 5, 3 new in pass 6). Pass 6 confirmed ALL 27 prior gaps remain open (1 fixed: GAP-027, 2 partially fixed: GAP-009 and GAP-024). Pass 6 also found new security concerns around mutable actor permissions, weak actor validation, and a missing negative test case.

### Changes from Pass 1 to Pass 2

- **GAP-051-001**: Still open (no changes)
- **GAP-051-002**: Still open (no changes)
- **GAP-051-003**: Still open, updated with new evidence from pass 2
- **GAP-051-004**: Still open (no changes)
- **GAP-051-005**: Still open, updated with cross-reference from SPEC-059 audit
- **GAP-051-006**: Still open (no changes)
- **GAP-051-007**: NEW in pass 2 .. CRITICAL missing `await` in `getAdminInfo()`
- **GAP-051-008**: NEW in pass 2 .. CRITICAL missing `await` in `setAdminInfo()`
- **GAP-051-009**: NEW in pass 2 .. 15 services lack entity-specific `_canAdminList` override (defense-in-depth incomplete)
- **GAP-051-010**: NEW in pass 2 .. No `adminSearch()` or `adminCount()` methods with admin permission gating

### Changes from Pass 2 to Pass 3

- **GAP-051-001**: Still open. Pass 3 confirmed CLAUDE.md still missing `_canAdminList` in permission hook table (11 rows, should be 12)
- **GAP-051-002**: Still open. Pass 3 confirmed `.superAdmin().withPermissions()` anti-pattern persists at `base.service.mockData.ts:52-60`
- **GAP-051-003**: Still open. Pass 3 confirmed lines 52 and 81 of `base.crud.admin.ts` still use `_canUpdate` without admin-specific hooks
- **GAP-051-004**: Still open. Pass 3 confirmed no tests for the 6 permission-guarded services through `_canAdminList` chain
- **GAP-051-005**: Still open. Pass 3 confirmed SPEC-059 explicitly omits `_canAdminList` from its 11-hook ctx threading list
- **GAP-051-006**: Still open. Pass 3 confirmed no async path test exists
- **GAP-051-007**: **CONFIRMED STILL PRESENT** in pass 3. Line 52: `this._canUpdate(actor, entity);` without `await`. Verified by direct file read.
- **GAP-051-008**: **CONFIRMED STILL PRESENT** in pass 3. Line 81: `this._canUpdate(actor, entity);` without `await`. Verified by direct file read.
- **GAP-051-009**: Still open. Pass 3 mapped all 16 admin list routes with HTTP permissions vs service layer gaps (detailed table below)
- **GAP-051-010**: Still open (no changes)
- **GAP-051-011**: NEW in pass 3 .. Error message inconsistency across permission hooks
- **GAP-051-012**: NEW in pass 3 .. No enforcement mechanism for `super._canAdminList()` call in overrides

### Changes from Pass 3 to Pass 4

- **GAP-051-001**: Still open (confirmed). CLAUDE.md has 11 rows, file structure section also incorrect.
- **GAP-051-002**: **PARTIALLY RESOLVED**. `mockAdminActor` now includes `ACCESS_PANEL_ADMIN` in `withPermissions`. But `.superAdmin()` is still misleading and `ACCOMMODATION_VIEW_ALL` still missing.
- **GAP-051-003**: Still open (confirmed). Lines 52 and 81 of `base.crud.admin.ts` still use `_canUpdate` without admin hooks.
- **GAP-051-004**: Still open (confirmed). No test files for chain tests on 6 permission-guarded services.
- **GAP-051-005**: Still open (confirmed + elevated). SPEC-059 omits `_canAdminList` from 11-hook ctx threading.
- **GAP-051-006**: Still open (confirmed). No async `_canList()` path test exists.
- **GAP-051-007**: **CONFIRMED STILL PRESENT** in pass 4. `base.crud.admin.ts:52`.
- **GAP-051-008**: **CONFIRMED STILL PRESENT** in pass 4. `base.crud.admin.ts:81`.
- **GAP-051-009**: Still open (confirmed). Only AccommodationService has override.
- **GAP-051-010**: Still open (no changes).
- **GAP-051-011**: Still open (confirmed). Three patterns coexist.
- **GAP-051-012**: Still open (design limitation, no change possible).
- **GAP-051-013**: NEW in pass 4 .. CRITICAL: 13 missing `await` on `_can*()` calls in AccommodationService custom methods
- **GAP-051-014**: NEW in pass 4 .. CRITICAL: `_canAdminList` override in AccommodationService drops Promise from `super._canAdminList()`
- **GAP-051-015**: NEW in pass 4 .. `DestinationService` has two conflicting permission files (strict version is dead code)
- **GAP-051-016**: NEW in pass 4 .. `_canUpdateVisibility` error wrapper discards original error code in `base.crud.write.ts`
- **GAP-051-017**: NEW in pass 4 .. `adminList()` checks permissions AFTER schema validation (ordering inconsistency)
- **GAP-051-018**: NEW in pass 4 .. Test quality: double-invocation anti-pattern and loose error assertions
- **GAP-051-019**: NEW in pass 4 .. `actorMiddleware` silently degrades authenticated user to guest on error
- **GAP-051-020**: NEW in pass 4 .. Dual `getActorFromContext` implementations with opposite failure modes

### Changes from Pass 4 to Pass 5

- **GAP-051-001 to GAP-051-020**: ALL 20 gaps **CONFIRMED STILL PRESENT** in pass 5 (none were fixed since pass 4).
- **GAP-051-013**: SCOPE MASSIVELY EXPANDED. Pass 5 codebase-wide sweep found **~40 additional missing `await`** instances across **12 services** beyond AccommodationService (feature, user, destination, userBookmark, amenity, attraction, postSponsor, tag, event, eventLocation, eventOrganizer, post). The pattern is SYSTEMIC.
- **GAP-051-021**: NEW in pass 5 .. `PostService.unlike()` uses wrong permission hook (`_canList` instead of `_canLike`)
- **GAP-051-022**: NEW in pass 5 .. ~40 additional missing `await` on `_can*()` in 12 services (codebase-wide expansion of GAP-013)
- **GAP-051-023**: NEW in pass 5 .. `UserService._canDelete` is dead code (not in base class interface)
- **GAP-051-024**: NEW in pass 5 .. `UserService.searchForList()` bypasses `runWithLoggingAndValidation`
- **GAP-051-025**: NEW in pass 5 .. `DestinationService.updateStatsFromReview()`/`updateAccommodationsCount()` are public mutations without actor/permissions
- **GAP-051-026**: NEW in pass 5 .. `DestinationService` hierarchy methods skip permission checks entirely
- **GAP-051-027**: NEW in pass 5 .. `hasPermission()` does not handle null/undefined actor defensively

### Changes from Pass 5 to Pass 6

- **GAP-051-001 to GAP-051-026**: ALL gaps **CONFIRMED STILL OPEN** in pass 6 (no fixes applied between passes).
- **GAP-051-027**: **FIXED**. `hasPermission()` now defensively handles undefined/non-array `permissions` with `if (!actor.permissions || !Array.isArray(actor.permissions)) return false;`. Note: does NOT guard against null `actor` itself (TypeScript signature ensures non-nullable, acceptable).
- **GAP-051-009**: Reclassified as **PARTIALLY FIXED** (AccommodationService has override pattern established, but 15 other services still lack overrides).
- **GAP-051-024**: Reclassified as **PARTIALLY FIXED** (permission check `_canSearch(actor)` was added to `searchForList`, but `runWithLoggingAndValidation` wrapper is still missing).
- **GAP-051-001**: EXPANDED scope .. Pass 6 discovered that `packages/service-core/CLAUDE.md` "Package Structure" section (lines 30-48) describes files that don't exist (`BaseCrudService.ts`, `service-context.ts`, `validation.ts`). Real file names are `base.crud.permissions.ts`, `base.crud.read.ts`, etc.
- **GAP-051-014**: CONFIRMED still open. Pass 6 notes that the return type annotation `void` on the override is also inconsistent with the base class `Promise<void> | void` signature (TypeScript allows narrowing but it masks the dropped Promise).
- **GAP-051-028**: NEW in pass 6 .. Actor `permissions` array is mutable after construction (security concern)
- **GAP-051-029**: NEW in pass 6 .. Missing negative test: `checkCanAdminList` should NOT be called when `super._canAdminList` rejects
- **GAP-051-030**: NEW in pass 6 .. `validateActor()` only checks truthiness, not structural integrity of actor object

---

## GAP-051-001: service-core CLAUDE.md Does Not Document `_canAdminList` Hook

**Found in**: Audit pass 1
**Severity**: Low
**Priority**: P4
**Complexity**: Trivial

### Description

The `packages/service-core/CLAUDE.md` "Authorization & Permission Checks" section lists 11 standard permission hooks in its "Standard Permission Mapping" table (`_canCreate`, `_canUpdate`, `_canList`, etc.) but does NOT include `_canAdminList`. The "Complete Permission File Template" also omits `checkCanAdminList`.

Additionally, there is NO documentation explaining:

- The difference between `_canList()` (public) and `_canAdminList()` (admin-only)
- When and why to override `_canAdminList()`
- The defense-in-depth pattern for admin operations
- That `_canAdminList()` is the ONLY concrete (non-abstract) permission hook in the hierarchy

### Evidence

- `packages/service-core/CLAUDE.md` lines 470-486 .. "Standard Permission Mapping" table (11 rows, no `_canAdminList`)
- `packages/service-core/CLAUDE.md` lines 488-681 .. "Complete Permission File Template" (no `checkCanAdminList` function)

### Proposed Solution

1. Add `_canAdminList` row to the Standard Permission Mapping table:

| Hook | Permission Pattern | Example |
|------|-------------------|---------|
| `_canAdminList` | `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN` + entity-specific | `ACCOMMODATION_VIEW_ALL` |

2. Add `checkCanAdminList()` to the Complete Permission File Template
3. Add a new subsection "Admin-Specific Permission Hooks" explaining the pattern, rationale, and override guidance

### Recommendation

Fix directly (no spec needed). Documentation update only.

### Decision (2026-04-04)

**HACER** — Actualizar CLAUDE.md de service-core: agregar `_canAdminList` a tabla de hooks + corregir package structure.

---

## GAP-051-002: `mockAdminActor` `.superAdmin().withPermissions()` Anti-Pattern

**Found in**: Audit pass 1
**Severity**: Low
**Priority**: P4
**Complexity**: Trivial

### Description

The shared `mockAdminActor` in `packages/service-core/test/base/base/base.service.mockData.ts:52-60` uses `.superAdmin()` followed by `.withPermissions()`, which OVERWRITES all permissions set by superAdmin to only 3 specific ones:

```typescript
export const mockAdminActor: Actor = new ActorFactoryBuilder()
    .superAdmin()                    // Sets ALL permissions
    .withId('admin-user-1')
    .withPermissions([               // OVERWRITES to only 3 permissions
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCOMMODATION_CREATE,
        PermissionEnum.ACCOMMODATION_UPDATE_ANY
    ])
    .build();
```

Issues:

1. `.superAdmin()` is misleading since permissions get overwritten
2. Missing `ACCOMMODATION_VIEW_ALL` .. if any test uses `mockAdminActor` with `AccommodationService.adminList()`, it will throw FORBIDDEN
3. Missing `ACCESS_API_ADMIN` .. only has `ACCESS_PANEL_ADMIN`

### Evidence

- `packages/service-core/test/base/base/base.service.mockData.ts:52-60`
- `packages/service-core/test/factories/actorFactory.ts` .. `.withPermissions()` replaces the array

### Proposed Solution

**Option A (Minimal)**: Add `ACCOMMODATION_VIEW_ALL` and remove misleading `.superAdmin()`.

**Option B (Better)**: Create purpose-specific actor mocks. One for general admin tests, one for accommodation-specific tests.

**Option C (Best)**: Remove `.superAdmin()` entirely. Only use `.withPermissions()` with the explicit set needed. Create separate mocks per test domain.

### Recommendation

Fix directly (no spec needed). Option B or C preferred. Low urgency since no test fails today.

### Decision (2026-04-04)

**HACER** — Limpiar mock: sacar `.superAdmin()` misleading, usar solo `.withPermissions()` con los permisos explícitos necesarios. Verificado que `.withPermissions()` REEMPLAZA (no agrega) via `Object.assign()`.

---

## GAP-051-003: `getAdminInfo()` and `setAdminInfo()` Share `_canUpdate()` Without Admin-Specific Hook

**Found in**: Audit pass 1
**Updated in**: Audit pass 2 (elevated severity due to GAP-051-007/008 findings)
**Severity**: Medium
**Priority**: P3
**Complexity**: Low-Medium

### Description

`getAdminInfo()` (base.crud.admin.ts:52) and `setAdminInfo()` (base.crud.admin.ts:81) both use `this._canUpdate(actor, entity)` for permission checking. This is the **exact same defense-in-depth gap** that motivated SPEC-051 for `adminList()`:

- Admin methods share a permission hook with non-admin operations
- If called from a non-HTTP context, the only admin gate is the middleware layer
- A developer could call `service.getAdminInfo(...)` with a non-admin actor and succeed if `_canUpdate()` is permissive

The spec explicitly marks this as **Out of Scope**, but the risk profile is identical.

**Pass 2 Update**: This gap is compounded by GAP-051-007/008 (missing `await` on the permission check calls), making the defense-in-depth even weaker.

### Evidence

- `packages/service-core/src/base/base.crud.admin.ts:52` .. `this._canUpdate(actor, entity)` in getAdminInfo
- `packages/service-core/src/base/base.crud.admin.ts:81` .. `this._canUpdate(actor, entity)` in setAdminInfo
- SPEC-051 "Out of Scope" section explicitly defers this

### Proposed Solution

Create `_canAdminGetInfo()` and `_canAdminSetInfo()` hooks following the `_canAdminList()` pattern:

1. Default implementation checks `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN`
2. Delegates to `_canUpdate()` for entity-specific checks
3. Services can override for entity-specific admin info permissions

### Recommendation

Create a new SPEC (SPEC-065 or similar). The pattern is established by SPEC-051. Should be bundled with GAP-051-007/008 fixes.

### Decision (2026-04-04)

**HACER** — Crear hooks `_canAdminGetInfo()` y `_canAdminSetInfo()` siguiendo patrón de `_canAdminList()`. Fix directo sin spec formal.

---

## GAP-051-004: No Test Coverage for Services with Permission-Guarded `_canList()` Through `_canAdminList()`

**Found in**: Audit pass 1
**Severity**: Low
**Priority**: P4
**Complexity**: Low

### Description

The default `_canAdminList()` delegates to `_canList()`. Six services have non-trivial `_canList()` that check specific permissions:

| Service | `_canList()` Check |
|---------|-------------------|
| SponsorshipLevelService | `SPONSORSHIP_VIEW` |
| SponsorshipPackageService | `SPONSORSHIP_VIEW` |
| PostSponsorService | `POST_SPONSOR_MANAGE` |
| SponsorshipService | `SPONSORSHIP_VIEW_ANY` or `SPONSORSHIP_VIEW_OWN` |
| UserService | `USER_READ_ALL` |
| ExchangeRateService | `EXCHANGE_RATE_VIEW` |

Admin users calling `adminList()` MUST have BOTH admin access AND the entity-specific permission. No test validates this combined chain for these 6 services.

### Evidence

- SPEC-051 Appendix A
- No test files for `_canAdminList` on any of these 6 services
- Only AccommodationService has explicit tests

### Proposed Solution

Add parameterized integration tests verifying for each service:

1. Admin WITHOUT entity permission gets FORBIDDEN
2. Admin WITH entity permission succeeds

### Recommendation

Fix directly (no spec needed). Low priority since behavior is correct.

### Decision (2026-04-04)

**HACER** — Agregar tests parametrizados para los 6 servicios con `_canList()` guarded, validando cadena `_canAdminList` → `_canList`.

---

## GAP-051-005: SPEC-059 Forward Compatibility .. `_canAdminList()` Needs `ctx` Parameter

**Found in**: Audit pass 1
**Updated in**: Audit pass 2 (verified against SPEC-059 content)
**Severity**: Info
**Priority**: P5
**Complexity**: N/A (tracking only)

### Description

SPEC-059 plans to thread `ServiceContext` through permission hooks. The `_canAdminList()` signature will need updating from:

```typescript
protected _canAdminList(actor: Actor): Promise<void> | void
```

to:

```typescript
protected _canAdminList(actor: Actor, ctx?: ServiceContext): Promise<void> | void
```

**Pass 2 Update**: SPEC-059 at line 1315 explicitly states: "SPEC-051 | None | Different methods in `base.crud.permissions.ts` | Independent." This confirms the specs are independent but `_canAdminList` is NOT in SPEC-059's explicit signature update list. The implementer should include it in the sweep.

### Evidence

- SPEC-059 line 1315 .. marks SPEC-051 as independent
- SPEC-059 lists 11 hooks for ctx threading but does NOT mention `_canAdminList`

### Proposed Solution

No action now. When implementing SPEC-059, include `_canAdminList` in the signature update sweep.

### Recommendation

Track as dependency note in SPEC-059.

### Decision (2026-04-04)

**HACER** — Agregar nota de dependencia en SPEC-059 para incluir `_canAdminList` en el sweep de `ctx` parameter.

---

## GAP-051-006: `EventOrganizerService` Async `_canList()` Delegation Not Explicitly Tested

**Found in**: Audit pass 1
**Severity**: Info
**Priority**: P5
**Complexity**: Trivial

### Description

`EventOrganizerService` has `async _canList()` (eventOrganizer.service.ts:91-93). When `_canAdminList()` delegates via `return this._canList(actor)`, it returns a `Promise<void>`. The `adminList()` uses `await` which handles this correctly. No test validates this async path.

### Evidence

- `packages/service-core/src/services/eventOrganizer/eventOrganizer.service.ts:91-93`
- `packages/service-core/src/base/base.crud.permissions.ts:203` .. `return this._canList(actor)`
- `packages/service-core/src/base/base.crud.read.ts:324` .. `await this._canAdminList(validatedActor)`

### Proposed Solution

Add a unit test with a mock service that has async `_canList()` verifying the await chain.

### Recommendation

Fix directly (no spec needed). Very low priority.

### Decision (2026-04-04)

**HACER** — Agregar unit test con mock service async `_canList()` para validar el await chain.

---

## GAP-051-007: CRITICAL .. Missing `await` on `_canUpdate()` in `getAdminInfo()`

**Found in**: Audit pass 2
**Severity**: HIGH
**Priority**: P1
**Complexity**: Trivial (one-line fix)

### Description

In `base.crud.admin.ts:52`, `getAdminInfo()` calls `this._canUpdate(actor, entity)` **without `await`**:

```typescript
// base.crud.admin.ts:44-55 (inside async execute callback)
execute: async ({ id }, actor) => {
    const entity = await this.model.findById(id);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `${this.entityName} not found`);
    }
    this._canUpdate(actor, entity);  // LINE 52 - NO AWAIT!
    return { adminInfo: (entity as Record<string, unknown>).adminInfo };
}
```

`_canUpdate()` is declared as `abstract _canUpdate(actor: Actor, entity: TEntity): Promise<void> | void` in `BaseCrudPermissions`. If ANY concrete service implements `_canUpdate` as async (returning a Promise), the permission check **silently becomes a no-op** because the rejected Promise is not caught. The admin info would be returned to an unauthorized user.

### Security Impact

- **Attack Vector**: If a service has async `_canUpdate()` that rejects, `getAdminInfo()` proceeds WITHOUT checking permissions
- **Current Risk**: MEDIUM .. most services have sync `_canUpdate()` today, but the pattern is a ticking time bomb
- **Future Risk**: HIGH .. any new async `_canUpdate()` implementation silently breaks authorization

### Evidence

- `packages/service-core/src/base/base.crud.admin.ts:52` .. `this._canUpdate(actor, entity)` without await
- `packages/service-core/src/base/base.crud.permissions.ts:97` .. `_canUpdate` declared with return type `Promise<void> | void`
- Compare with `base.crud.read.ts:324` where `await this._canAdminList(validatedActor)` IS correctly awaited

### Proposed Solution

```typescript
// Line 52: Change from
this._canUpdate(actor, entity);
// To
await this._canUpdate(actor, entity);
```

### Recommendation

**Fix IMMEDIATELY** (no spec needed). This is a one-line security fix. Should be in the same PR as GAP-051-008.

### Decision (2026-04-04)

**HACER** — Agregar `await` como fix defensivo (1 línea). Se complementa con GAP-003 que reemplaza el hook completo. Verificado: no es bug activo hoy (implementaciones sync), pero es buena práctica defensiva.

---

## GAP-051-008: CRITICAL .. Missing `await` on `_canUpdate()` in `setAdminInfo()`

**Found in**: Audit pass 2
**Severity**: HIGH
**Priority**: P1
**Complexity**: Trivial (one-line fix)

### Description

Same issue as GAP-051-007 but in `setAdminInfo()` at `base.crud.admin.ts:81`:

```typescript
// base.crud.admin.ts:73-91 (inside async execute callback)
execute: async ({ id, adminInfo }, actor) => {
    const entity = await this.model.findById(id);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, `${this.entityName} not found`);
    }
    this._canUpdate(actor, entity);  // LINE 81 - NO AWAIT!
    const normalized = normalizeAdminInfo(adminInfo);
    // ... writes to database
    await this.model.update({ id }, { adminInfo: normalized } as unknown as Partial<TEntity>);
    return { adminInfo: normalized };
}
```

This is **worse** than GAP-051-007 because `setAdminInfo` performs a **WRITE operation**. An unauthorized actor could modify entity admin metadata if `_canUpdate()` is async and the Promise rejection is ignored.

### Security Impact

- **Attack Vector**: Unauthorized write to admin metadata if `_canUpdate()` is async
- **Current Risk**: MEDIUM .. sync implementations protect today
- **Future Risk**: CRITICAL .. any async `_canUpdate()` allows unauthorized writes

### Evidence

- `packages/service-core/src/base/base.crud.admin.ts:81` .. `this._canUpdate(actor, entity)` without await

### Proposed Solution

```typescript
// Line 81: Change from
this._canUpdate(actor, entity);
// To
await this._canUpdate(actor, entity);
```

### Recommendation

**Fix IMMEDIATELY** (no spec needed). Bundle with GAP-051-007.

### Decision (2026-04-04)

**HACER** — Agregar `await` (1 línea). Bundlear con GAP-007. Mismo análisis: fix defensivo, no bug activo. Se complementa con GAP-003.

---

## GAP-051-009: 15 Services Lack Entity-Specific `_canAdminList` Override (Incomplete Defense-in-Depth)

**Found in**: Audit pass 2
**Severity**: Low-Medium
**Priority**: P3
**Complexity**: Medium (repetitive but straightforward)

### Description

Only `AccommodationService` overrides `_canAdminList()` with an entity-specific permission check (`ACCOMMODATION_VIEW_ALL`). The remaining 15 services with admin list routes rely on the base class default, which only checks admin access (`ACCESS_PANEL_ADMIN`/`ACCESS_API_ADMIN`) and then delegates to `_canList()`.

The HTTP routes DO enforce entity-specific permissions via `createAdminListRoute({ requiredPermissions: [...] })`. But at the **service layer**, the entity permission is not checked for 15 services.

| Route | HTTP Permission | Service `_canList()` Behavior | Defense-in-Depth Gap |
|-------|----------------|-------------------------------|---------------------|
| Amenity admin list | `AMENITY_VIEW` | Actor existence check only | YES |
| Attraction admin list | `ATTRACTION_VIEW` | Actor existence check only | YES |
| Destination admin list | `DESTINATION_VIEW_ALL` | Actor existence check only | YES |
| Event admin list | `EVENT_VIEW_ALL` | Actor existence check only | YES |
| Event Location admin list | `EVENT_LOCATION_VIEW` | Actor existence check only | YES |
| Event Organizer admin list | `EVENT_ORGANIZER_VIEW` | No-op (fully permissive) | YES |
| Feature admin list | `FEATURE_VIEW` | Actor existence check only | YES |
| Owner Promotion admin list | `OWNER_PROMOTION_VIEW` | Actor existence check only | YES |
| Post admin list | `POST_VIEW_ALL` | Actor existence check only | YES |
| Tag admin list | `TAG_VIEW` | Actor existence check only | YES |
| Accommodation Review admin list | `ACCOMMODATION_REVIEW_VIEW` | Actor existence check only | YES |
| Destination Review admin list | `DESTINATION_REVIEW_VIEW` | Actor existence check only | YES |
| Post Sponsor admin list | `POST_SPONSOR_VIEW` | `POST_SPONSOR_MANAGE` check | Partial (has perm check) |
| Sponsorship admin list | `SPONSORSHIP_VIEW` | `SPONSORSHIP_VIEW_ANY`/`VIEW_OWN` | Partial (has perm check) |
| User admin list | `USER_READ_ALL` | `USER_READ_ALL` check | NO (already enforced) |

### Mitigating Factor

Currently, NO code path calls `.adminList()` outside of HTTP routes. The middleware layer provides full protection for all HTTP calls. The gap only manifests if a developer adds a non-HTTP caller (cron job, service-to-service, etc.) without the middleware.

### Evidence

- Grep for `_canAdminList` in `packages/service-core/src/services/` shows only `accommodation.service.ts`
- All 16 admin list routes in `apps/api/src/routes/*/admin/list.ts` use `createAdminListRoute` with `requiredPermissions`
- Grep for `.adminList(` outside route files returns zero results

### Pass 3 Update: Complete Route-to-Service Permission Mapping

All 16 admin list routes verified in pass 3 with exact HTTP permission vs service layer enforcement:

| Route File | HTTP `requiredPermissions` | Service `_canList()` Behavior | Service `_canAdminList` Override | Defense-in-Depth |
|-----------|---------------------------|-------------------------------|----------------------------------|-----------------|
| `accommodation/admin/list.ts` | `ACCOMMODATION_VIEW_ALL` | No-op | YES (`checkCanAdminList`) | COMPLETE |
| `accommodation/reviews/admin/list.ts` | `ACCOMMODATION_REVIEW_VIEW` | Actor existence only | NO | GAP |
| `amenity/admin/list.ts` | `AMENITY_VIEW` | Actor existence only | NO | GAP |
| `attraction/admin/list.ts` | `ATTRACTION_VIEW` | Actor existence only | NO | GAP |
| `destination/admin/list.ts` | `DESTINATION_VIEW_ALL` | Actor existence only | NO | GAP |
| `destination/reviews/admin/list.ts` | `DESTINATION_REVIEW_VIEW` | Actor existence only | NO | GAP |
| `event/admin/list.ts` | `EVENT_VIEW_ALL` | Actor existence only | NO | GAP |
| `event-location/admin/list.ts` | `EVENT_LOCATION_VIEW` | Actor existence only | NO | GAP |
| `event-organizer/admin/list.ts` | `EVENT_ORGANIZER_VIEW` | Fully permissive (no-op) | NO | GAP |
| `feature/admin/list.ts` | `FEATURE_VIEW` | Actor existence only | NO | GAP |
| `owner-promotion/admin/list.ts` | `OWNER_PROMOTION_VIEW` | Actor existence only | NO | GAP |
| `post/admin/list.ts` | `POST_VIEW_ALL` | Actor existence only | NO | GAP |
| `postSponsor/admin/list.ts` | `POST_SPONSOR_VIEW` | `POST_SPONSOR_MANAGE` check | NO | PARTIAL |
| `sponsorship/admin/list.ts` | `SPONSORSHIP_VIEW` | `SPONSORSHIP_VIEW_ANY`/`VIEW_OWN` | NO | PARTIAL |
| `tag/admin/list.ts` | `TAG_VIEW` | Actor existence only | NO | GAP |
| `user/admin/list.ts` | `USER_READ_ALL` | `USER_READ_ALL` check | NO | COMPLETE (via _canList) |

**Result**: 1 COMPLETE (accommodation), 1 COMPLETE via _canList (user), 2 PARTIAL (postSponsor, sponsorship), 12 GAP

### Proposed Solution

**Option A (Incremental)**: Add `_canAdminList()` overrides to the 12 services where `_canList()` is permissive (no-op or actor-existence-only). Match the HTTP route's `requiredPermissions`. Leave the 3 services that already have permission-guarded `_canList()` (PostSponsor, Sponsorship, User).

**Option B (Comprehensive)**: Add overrides to ALL 15 services, mirroring the exact HTTP route permission in the service layer for full defense-in-depth consistency.

**Option C (Pragmatic, SPEC-051 aligned)**: Document this as intentional and defer. SPEC-051's "Out of Scope" states: "Overriding `_canAdminList()` in services other than Accommodation (can be done incrementally)."

### Recommendation

Create a new SPEC for Option A or B. This is not urgent since HTTP middleware provides protection, but completes the defense-in-depth story started by SPEC-051. Priority P3.

### Decision (2026-04-04)

**HACER Opción A** — Override incremental en los 12 servicios donde `_canList()` es permisivo (no-op o actor-existence-only). Dejar los 3 que ya tienen check entity-specific en `_canList()` (PostSponsor, Sponsorship, User). Mirror del permiso HTTP en service layer.

---

## GAP-051-010: No `adminSearch()` or `adminCount()` with Admin Permission Gating

**Found in**: Audit pass 2
**Severity**: Info
**Priority**: P5
**Complexity**: Medium

### Description

The codebase has `adminList()` (with `_canAdminList()` hook) but there are no `adminSearch()` or `adminCount()` equivalents. The existing `search()` and `count()` methods use `_canSearch()` and `_canCount()` respectively, which do not verify admin access.

If admin-specific search or count functionality is ever needed (e.g., admin dashboard aggregations, admin search with different filtering capabilities), there's no admin-gated equivalent.

### Evidence

- `packages/service-core/src/base/base.crud.read.ts` .. has `adminList()` but no `adminSearch()` or `adminCount()`
- `search()` at line 254 uses `_canSearch()`, `count()` at line 480 uses `_canCount()`
- No admin variants exist

### Proposed Solution

If needed in the future, add `adminSearch()` and `adminCount()` methods with corresponding `_canAdminSearch()` and `_canAdminCount()` hooks following the `_canAdminList()` pattern.

### Recommendation

Track as future consideration. No action needed unless admin-specific search/count requirements emerge. Info priority.

### Decision (2026-04-04)

**POSTERGAR** — YAGNI. No hay requerimiento actual. Implementar solo si surge necesidad concreta de admin search/count dedicados.

---

## GAP-051-011: Error Message Inconsistency Across Permission Hooks

**Found in**: Audit pass 3
**Severity**: Low
**Priority**: P4
**Complexity**: Low

### Description

Error messages in permission checks follow three different patterns with no documented standard:

| Pattern | Example | Used In |
|---------|---------|---------|
| `"Admin access required for [operation]"` | `"Admin access required for admin list operations"` | Base `_canAdminList()` |
| `"Permission denied: [PERM] required for [operation]"` | `"Permission denied: ACCOMMODATION_VIEW_ALL required for admin list"` | Entity-specific admin checks (e.g., `checkCanAdminList`) |
| `"Permission denied to [verb] [entity]"` | `"Permission denied to create accommodation"` | Standard CRUD permission checks |

This inconsistency means:

1. Error consumers (API, admin panel) cannot reliably parse permission error messages
2. New developers copy different patterns depending on which file they reference
3. Logging and monitoring can't consistently categorize permission failures

### Evidence

- `packages/service-core/src/base/base.crud.permissions.ts:199` .. pattern 1
- `packages/service-core/src/services/accommodation/accommodation.permissions.ts:165` .. pattern 2
- Various `checkCan*` functions in service permission files .. pattern 3

### Proposed Solution

Define a standard error message convention in CLAUDE.md:

```
- Base admin access checks: "Admin access required for [operation]"
- Entity-specific permission checks (after admin): "Permission denied: [PERMISSION_ENUM] required for [operation]"
- Standard CRUD checks: "Permission denied: Insufficient permissions to [verb] [entity]"
```

### Recommendation

Fix directly as part of a documentation PR. No code changes needed for existing messages (consistency going forward). Can bundle with GAP-051-001.

### Decision (2026-04-04)

**HACER** — Documentar convención de mensajes de error en CLAUDE.md Y estandarizar los mensajes existentes en código para que todos sigan el mismo patrón. Bundlear con GAP-001.

---

## GAP-051-012: No Enforcement Mechanism for `super._canAdminList()` Call in Overrides

**Found in**: Audit pass 3
**Severity**: Low
**Priority**: P5
**Complexity**: N/A (design limitation)

### Description

When a service overrides `_canAdminList()`, TypeScript provides NO mechanism to enforce that the override calls `super._canAdminList()`. A developer could write:

```typescript
// DANGEROUS: Bypasses admin access check
protected _canAdminList(actor: Actor): void {
    checkCanAdminList(actor);  // Forgot super._canAdminList(actor)
}
```

This would skip the `ACCESS_PANEL_ADMIN`/`ACCESS_API_ADMIN` check entirely, allowing any authenticated user with the entity-specific permission to access admin list operations.

### Current Mitigations (Already in Place)

1. **Unit test**: `accommodation.adminListPermission.test.ts` test case 4 verifies call order via spy
2. **JSDoc**: Base method documentation states "Override this method.. calls super first"
3. **Pattern in spec**: SPEC-051 shows the `super` call pattern explicitly
4. **Code review**: Missing `super` call is visible in diff review

### Why This Is NOT Fixable

- TypeScript has no `final` or `@MustCallSuper` annotation
- The Template Method pattern used here inherently trusts subclass implementations
- A wrapper/template approach (e.g., making `_canAdminList` non-overridable and adding a separate `_canAdminListExtra`) would change the architecture for all 21 services

### Proposed Solution

No code change. Accept as known design limitation. Mitigate through:

1. Code review checklist item: "Does override call `super._canAdminList()` first?"
2. Ensure ALL services that override `_canAdminList()` have a call-order test (like accommodation's test case 4)

### Recommendation

Track as design note. Add to service-core CLAUDE.md under a "Known Limitations" section. No spec needed.

### Decision (2026-04-04)

**HACER** — Documentar limitación en CLAUDE.md ("Known Limitations") + agregar test de call-order (`super._canAdminList` llamado antes de `checkCanAdminList`) para CADA servicio que tenga override de `_canAdminList()`, incluyendo los 12 nuevos de GAP-009. Bundlear con GAP-001 y GAP-009.

---

## GAP-051-013: CRITICAL .. 13 Missing `await` on `_can*()` Calls in AccommodationService Custom Methods

**Found in**: Audit pass 4
**Severity**: HIGH
**Priority**: P1
**Complexity**: Low (13 one-line fixes)

### Description

`AccommodationService` has 13 custom methods (beyond CRUD) that call `_canList()`, `_canView()`, or `_canUpdate()` **without `await`**. These are the SAME class of bug as GAP-051-007/008 but much more widespread. Since all permission hooks are declared as `Promise<void> | void`, any async override causes the permission check to become a silent no-op.

### Affected Call Sites

| Line | Method | Missing Await On |
|------|--------|-----------------|
| 657 | `getTopRated` | `this._canList(actor)` |
| 710 | `getSummary` | `this._canView(actor, entity)` |
| 801 | `getByDestination` | `this._canList(actor)` |
| 839 | `getTopRatedByDestination` | `this._canList(actor)` |
| 889 | `addFaq` | `this._canUpdate(actor, accommodation)` |
| 920 | `removeFaq` | `this._canUpdate(actor, accommodation)` |
| 954 | `updateFaq` | `this._canUpdate(actor, accommodation)` |
| 1002 | `getFaqs` | `this._canView(actor, accommodation)` |
| 1029 | `addIAData` | `this._canUpdate(actor, accommodation)` |
| 1060 | `removeIAData` | `this._canUpdate(actor, accommodation)` |
| 1094 | `updateIAData` | `this._canUpdate(actor, accommodation)` |
| 1140 | `getAllIAData` | `this._canView(actor, accommodation)` |
| 1165 | `getByOwner` | `this._canList(actor)` |

All file paths: `packages/service-core/src/services/accommodation/accommodation.service.ts`

### Security Impact

- **Current Risk**: LOW (all concrete `_can*()` implementations in AccommodationService are synchronous today)
- **Future Risk**: CRITICAL .. any refactor to async permission checks silently breaks 13 authorization gates
- **Write operations affected**: `addFaq`, `removeFaq`, `updateFaq`, `addIAData`, `removeIAData`, `updateIAData` (6 mutations without awaited permission)

### Proposed Solution

Add `await` to all 13 call sites. Each is a one-line fix: `this._canList(actor)` -> `await this._canList(actor)`.

**IMPORTANT**: A codebase-wide sweep of ALL services for this pattern is needed. If AccommodationService has 13 instances, other services likely have the same issue in their custom methods.

### Recommendation

**Fix IMMEDIATELY** (no spec needed). Bundle with GAP-051-007/008 in a single "missing-await security sweep" PR. Sweep ALL service files, not just accommodation.

### Decision (2026-04-04)

**HACER** — Agregar `await` a los 13 call sites en AccommodationService. Fix defensivo, no bug activo (implementaciones sync). Bundlear con GAP-007/008 en sweep de awaits.

---

## GAP-051-014: CRITICAL .. `_canAdminList` Override in AccommodationService Drops Promise from `super._canAdminList()`

**Found in**: Audit pass 4
**Severity**: HIGH
**Priority**: P1
**Complexity**: Trivial (one-line fix)

### Description

The `_canAdminList` override in AccommodationService (line 226-229) has return type `void` and calls `super._canAdminList(actor)` without capturing or returning the result:

```typescript
protected _canAdminList(actor: Actor): void {
    super._canAdminList(actor);   // return value DROPPED
    checkCanAdminList(actor);
}
```

`super._canAdminList()` returns `Promise<void> | void`. It calls `return this._canList(actor)` internally. If `_canList()` is async (returns a Promise), that Promise is silently dropped by the override. The outer `await this._canAdminList(validatedActor)` in `adminList()` awaits `undefined` (the void return), not the Promise.

**Today this is safe** because AccommodationService's `_canList()` is synchronous (a no-op). But:

1. This is the REFERENCE PATTERN that other developers will copy when adding overrides to other services
2. If `_canList()` ever becomes async, the defense-in-depth check silently stops working
3. This contradicts the spec's own async/await guidance

### Evidence

- `packages/service-core/src/services/accommodation/accommodation.service.ts:226-229`
- `packages/service-core/src/base/base.crud.permissions.ts:191-204` (base returns `Promise<void> | void`)

### Proposed Solution

```typescript
protected async _canAdminList(actor: Actor): Promise<void> {
    await super._canAdminList(actor);
    checkCanAdminList(actor);
}
```

### Recommendation

**Fix IMMEDIATELY** (no spec needed). This is the reference pattern from SPEC-051 itself.. fixing it here prevents ALL future overrides from copying the bug.

### Decision (2026-04-04)

**HACER** — Cambiar override a `async/await` pattern. Crucial: este es el patrón de referencia que los 12 nuevos overrides de GAP-009 copiarán. Bundlear con sweep de awaits (GAP-007/008/013).

---

## GAP-051-015: `DestinationService` Has Two Conflicting Permission Files (Strict Version is Dead Code)

**Found in**: Audit pass 4
**Severity**: Medium
**Priority**: P2
**Complexity**: Low

### Description

Two permission files exist for destinations:

| File | Functions | Behavior |
|------|-----------|----------|
| `destination.permission.ts` (singular) | `checkCanListDestinations()` | **Permissive**: only checks actor exists |
| `destination.permissions.ts` (plural) | `checkCanList()` | **Strict**: requires `DESTINATION_VIEW_ALL` |

The service at `destination.service.ts:60` imports from the **singular** (permissive) file:

```typescript
import { checkCanListDestinations, ... } from './destination.permission';
```

The plural file's `checkCanList()` with `DESTINATION_VIEW_ALL` is **dead code** — unreachable from any service method.

### Security Impact

The admin route for destinations enforces `DESTINATION_VIEW_ALL` at the HTTP layer. But at the service layer, `_canList()` delegates to the permissive `checkCanListDestinations()` which allows any actor. Combined with the default `_canAdminList()`, this means any admin-panel user can list ALL destinations without `DESTINATION_VIEW_ALL`.

### Evidence

- `packages/service-core/src/services/destination/destination.permission.ts:35-39` (permissive, imported by service)
- `packages/service-core/src/services/destination/destination.permissions.ts:92-99` (strict, dead code)
- `packages/service-core/src/services/destination/destination.service.ts:60` (imports singular)

### Proposed Solution

1. Remove `destination.permissions.ts` (plural) to eliminate confusion
2. OR: Merge the strict checks from the plural file into the singular file and update service imports
3. Either way, add `_canAdminList` override to enforce `DESTINATION_VIEW_ALL` at service layer

### Recommendation

Create as part of the entity-specific `_canAdminList` overrides SPEC (GAP-051-009). Priority P2 because dead code creates developer confusion.

### Decision (2026-04-04)

**HACER** — Eliminar `destination.permissions.ts` (dead code) + mergear checks estrictos relevantes al archivo singular. Bundlear con GAP-009 (overrides de `_canAdminList`).

---

## GAP-051-016: `_canUpdateVisibility` Error Wrapper Discards Original Error Code

**Found in**: Audit pass 4
**Severity**: Low
**Priority**: P4
**Complexity**: Trivial

### Description

In `base.crud.write.ts:368-376`, the `updateVisibility` method wraps `_canUpdateVisibility` errors:

```typescript
try {
    await this._canUpdateVisibility(validActor, entity, validData.visibility);
} catch (err) {
    throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Permission denied to update visibility',
        err
    );
}
```

If `_canUpdateVisibility` throws a `ServiceError` with code `NOT_FOUND` or `VALIDATION_ERROR`, this wrapper promotes it to `FORBIDDEN`. This is inconsistent with ALL other permission hook call sites (e.g., `_canCreate` at line 65) where the hook's error propagates directly without wrapping.

### Evidence

- `packages/service-core/src/base/base.crud.write.ts:368-376`
- Compare with `_canCreate` at line 65: no wrapper, error propagates directly

### Proposed Solution

Remove the try/catch wrapper. Let the error from `_canUpdateVisibility` propagate directly:

```typescript
await this._canUpdateVisibility(validActor, entity, validData.visibility);
```

### Recommendation

Fix directly (no spec needed). Low priority, cosmetic consistency fix.

### Decision (2026-04-04)

**HACER** — Verificar si persiste y arreglar si es necesario. Agente reportó como posible false positive (ya corregido), pero se verificará durante implementación.

---

## GAP-051-017: `adminList()` Checks Permissions AFTER Schema Validation

**Found in**: Audit pass 4
**Severity**: Low
**Priority**: P4
**Complexity**: Trivial

### Description

In `base.crud.read.ts:306-324`, `adminList()` validates params via schema parsing BEFORE checking permissions:

```typescript
execute: async (validatedPassthrough, validatedActor) => {
    if (!this.adminSearchSchema) { ... }        // config check
    const parseResult = this.adminSearchSchema.safeParse(...)  // validation
    // ...
    await this._canAdminList(validatedActor);   // permission check AFTER validation
```

Other methods like `search()` and `list()` check permissions first. The inconsistency means an unauthorized actor still triggers the full schema parse before being rejected. Impact is minimal (no DB access before auth), but leaks timing information about schema validity.

### Evidence

- `packages/service-core/src/base/base.crud.read.ts:306-324`
- Compare with `list()` where permission check comes before data processing

### Proposed Solution

Move `await this._canAdminList(validatedActor)` before the schema parse:

```typescript
execute: async (validatedPassthrough, validatedActor) => {
    await this._canAdminList(validatedActor);   // permission first
    if (!this.adminSearchSchema) { ... }
    const parseResult = this.adminSearchSchema.safeParse(...)
```

### Recommendation

Fix directly (no spec needed). Very low priority.

### Decision (2026-04-04)

**HACER** — Mover permission check antes de schema parse para consistencia con otros métodos. Reportado como posible false positive, pero mejor mantener consistencia de "auth first" en todos los métodos.

---

## GAP-051-018: Test Quality Issues: Double-Invocation Anti-Pattern and Loose Error Assertions

**Found in**: Audit pass 4
**Severity**: Low
**Priority**: P4
**Complexity**: Low

### Description

Multiple test quality issues found in `_canAdminList` test files:

**A) Double-invocation anti-pattern** in `adminListPermission.test.ts:34-53`:

```typescript
expect(() => {
    (service as CanAdminListAccessor)._canAdminList(actor);
}).toThrow(ServiceError);

try {
    (service as CanAdminListAccessor)._canAdminList(actor);  // REDUNDANT
} catch (err) {
    expect(err).toBeInstanceOf(ServiceError);
    // ...
}
```

The `try/catch` block is entirely redundant. Worse: if the implementation is broken and does NOT throw, the assertions inside `catch` are never reached and the test passes green (silent false-positive).

**B) Loose error message assertions** in `accommodation.permissions.test.ts:253-258` and `accommodation.adminListPermission.test.ts:68`:

Uses `.toMatch('ACCOMMODATION_VIEW_ALL required for admin list')` which is a substring match. Doesn't pin down the full message `'Permission denied: ACCOMMODATION_VIEW_ALL required for admin list'`. If the prefix changes, tests still pass.

**C) No async `_canList()` path test** (confirmed from GAP-051-006): All tests use sync `TestService._canList`. The production signature supports `Promise<void>` but no test exercises this branch.

### Evidence

- `packages/service-core/test/base/crud/adminListPermission.test.ts:34-53` (double invocation)
- `packages/service-core/test/services/accommodation/accommodation.permissions.test.ts:253-258` (loose assertion)
- `packages/service-core/test/services/accommodation/accommodation.adminListPermission.test.ts:68` (loose assertion)

### Proposed Solution

1. Remove redundant `try/catch` blocks from `adminListPermission.test.ts`
2. Tighten error assertions to `toBe()` for exact match
3. Add async `_canList()` test case with `mockResolvedValue`

### Recommendation

Fix directly (no spec needed). Low priority but improves test reliability.

### Decision (2026-04-04)

**HACER** — Eliminar try/catch redundantes (anti-pattern double-invocation), cambiar `.toMatch()` a `.toBe()` para assertions exactas. Punto C ya cubierto por GAP-006.

---

## GAP-051-019: `actorMiddleware` Silently Degrades Authenticated User to Guest on Error

**Found in**: Audit pass 4
**Severity**: Medium
**Priority**: P2
**Complexity**: Low

### Description

In `apps/api/src/middlewares/actor.ts:165-171`, when the actor build process fails (DB error, role lookup failure, etc.), an authenticated user is silently downgraded to a guest actor:

```typescript
} catch (error) {
    apiLogger.error('Error building user actor:', ...);
    actor = createGuestActor();
}
```

This is a **security degradation**: the user had a valid session but their permissions are dropped to `ACCESS_API_PUBLIC`. If the DB is temporarily down, ALL authenticated requests silently proceed with guest-level access instead of failing with 503.

### Security Impact

- An admin user calling admin endpoints during a DB blip would hit `adminAuthMiddleware` and get rejected (good)
- But a regular user calling protected endpoints would proceed as guest, potentially losing access to their own data or seeing public-only content (bad UX but not a data leak)
- The real risk: any permission-gated public endpoint that allows guests differently than authenticated users would serve wrong data

### Evidence

- `apps/api/src/middlewares/actor.ts:165-171`

### Proposed Solution

Fail the request with a 503 instead of silently degrading:

```typescript
} catch (error) {
    apiLogger.error('Error building user actor:', ...);
    throw new HTTPException(503, { message: 'Service temporarily unavailable' });
}
```

### Recommendation

Create a new SPEC or fix directly depending on team preference. This is not SPEC-051 scope but was discovered during the audit. Priority P2 due to silent degradation behavior.

### Decision (2026-04-04)

**HACER** — Cambiar catch a `throw new HTTPException(503)` en vez de degradar a guest silenciosamente. Fix directo sin spec.

---

## GAP-051-020: Dual `getActorFromContext` Implementations with Opposite Failure Modes

**Found in**: Audit pass 4
**Severity**: Medium
**Priority**: P3
**Complexity**: Low

### Description

Two different implementations of `getActorFromContext` exist:

| File | Behavior on Missing Actor |
|------|--------------------------|
| `apps/api/src/utils/actor.ts:55-71` | Logs warning, returns `createGuestActor()` (silent fallback) |
| `apps/api/src/middlewares/actor.ts:194` | Throws `HTTPException(500)` (hard fail) |

The `authorization.ts` middleware imports from `utils/actor.ts` (the silent fallback version). If the actor middleware fails to set the actor, the authorization middleware silently proceeds with a guest actor.

### Evidence

- `apps/api/src/utils/actor.ts:55-71` (silent fallback)
- `apps/api/src/middlewares/actor.ts:194` (throws)
- `apps/api/src/middlewares/authorization.ts:14` (imports from utils)

### Proposed Solution

Consolidate to a single implementation. The `utils/actor.ts` version should throw instead of falling back to guest. If the actor is not set by middleware, this is always a programming error, not a valid state.

### Recommendation

Fix directly (no spec needed). Consolidate to the throwing behavior.

### Decision (2026-04-04)

**HACER** — Consolidar a una sola implementación que tire error. Eliminar versión silenciosa de `utils/actor.ts`. Actualizar imports en `authorization.ts` y otros consumidores. Bundlear con GAP-019 (actor middleware).

---

## GAP-051-021: `PostService.unlike()` Uses Wrong Permission Hook (`_canList` Instead of `_canLike`)

**Found in**: Audit pass 5
**Severity**: Medium
**Priority**: P2
**Complexity**: Trivial (one-line fix)

### Description

`PostService.unlike()` calls `this._canList(actor)` for its permission check, but the semantically correct hook is `this._canLike(actor)`. The sibling method `like()` correctly uses `_canLike(actor)`. This breaks the symmetry between like/unlike and uses a completely different permission semantic (list = read, like = interaction).

### Evidence

- `packages/service-core/src/services/post/post.service.ts:813` .. `this._canList(actor)` in `unlike()`
- `packages/service-core/src/services/post/post.service.ts:787` .. `this._canLike(actor)` in `like()` (correct)

### Proposed Solution

```typescript
// Line 813: Change from
this._canList(actor);
// To
this._canLike(actor);
```

### Recommendation

**Fix IMMEDIATELY** (no spec needed). One-line correctness fix. The bug has no observable impact today since both `_canList` and `_canLike` only check actor existence in PostService, but the semantics are wrong.

### Decision (2026-04-04)

**HACER** — Cambiar `this._canList(actor)` a `this._canLike(actor)` en `post.service.ts:813`. Fix semántico de 1 línea.

---

## GAP-051-022: CRITICAL .. ~40 Additional Missing `await` on `_can*()` Calls Across 12 Services

**Found in**: Audit pass 5
**Severity**: HIGH
**Priority**: P1
**Complexity**: Medium (40+ one-line fixes, codebase-wide sweep required)

### Description

Pass 5 performed a codebase-wide sweep that MASSIVELY expanded the scope of GAP-051-013 (which only covered AccommodationService's 13 instances). The missing `await` pattern exists in **~40 additional call sites across 12 services**:

| Service File | Approx. Count | Methods Affected |
|-------------|---------------|-----------------|
| `feature/feature.service.ts` | 5 | `_canSearch`, `_canAddFeatureToAccommodation`, `_canRemoveFeatureFromAccommodation`, `_canList` x2 |
| `user/user.service.ts` | 6 | `_canSearch` x3, `_canManagePermissions` x3 |
| `destination/destination.service.ts` | 1 | `_canSearch` |
| `userBookmark/userBookmark.service.ts` | 4 | `_canList` x3, `_canCount` |
| `amenity/amenity.service.ts` | 3 | `_canAddAmenityToAccommodation`, `_canRemoveAmenityFromAccommodation`, `_canSearch` |
| `attraction/attraction.service.ts` | 5 | `_canAddAttractionToDestination`, `_canRemoveAttractionFromDestination`, `_canList` x2, `_canSearch` |
| `postSponsor/postSponsor.service.ts` | 1 | `_canSearch` |
| `tag/tag.service.ts` | 5 | `_canList`, `_canUpdate` x4 |
| `event/event.service.ts` | 1 | `_canView` |
| `eventLocation/eventLocation.service.ts` | 4 | `_canSearch`, `_canList` x2, `_canView` |
| `eventOrganizer/eventOrganizer.service.ts` | 1 | `_canList` |
| `post/post.service.ts` | 10 | `_canList` x7, `_canLike`, `_canComment` x2 |

**Total: ~46 additional instances + 13 from GAP-013 + 2 from GAP-007/008 = ~61 missing awaits across the entire service layer.**

### Security Impact

- **Current Risk**: LOW (all concrete `_can*()` implementations are synchronous today)
- **Future Risk**: CRITICAL .. any refactor to async permission checks (e.g., DB-backed dynamic permissions) silently breaks ALL 61+ authorization gates
- **Pattern is systemic**: This is NOT a per-service issue, it's a codebase-wide pattern

### Proposed Solution

Codebase-wide sweep: add `await` to every `this._can*()` call in every service custom method. Consider a lint rule (ESLint/Biome custom rule) that flags un-awaited calls to methods with `Promise<void> | void` return type.

### Recommendation

Create a **new SPEC** (e.g., SPEC-066 "Codebase-Wide Missing Await Security Sweep") that covers ALL missing await instances. Bundle GAP-007, GAP-008, GAP-013, GAP-014, and this gap into a single sweep PR. Priority P1.

### Decision (2026-04-04)

**HACER** — Sweep codebase-wide: agregar `await` a toda llamada `this._can*()` en todos los servicios (~40 líneas). Fix defensivo, no bug activo. Bundlear con GAP-007/008/013/014 en un solo sweep de awaits.

---

## GAP-051-023: `UserService._canDelete` Is Dead Code (Not in Base Class Interface)

**Found in**: Audit pass 5
**Severity**: Low
**Priority**: P4
**Complexity**: Trivial

### Description

`UserService` defines a `_canDelete(actor)` method at line 112-118, but `BaseCrudPermissions` does NOT declare `_canDelete` as abstract or virtual. The base class has `_canSoftDelete` and `_canHardDelete` as the actual hooks called by the CRUD pipeline. `_canDelete` in UserService is a dead method that is NEVER called by any base class flow.

`UserService` also correctly implements `_canSoftDelete` at lines 178-184. So the `_canDelete` method provides no value and may confuse future developers into thinking delete permissions are covered when they're actually in `_canSoftDelete`.

### Evidence

- `packages/service-core/src/services/user/user.service.ts:112-118` .. `_canDelete` (dead code)
- `packages/service-core/src/services/user/user.service.ts:178-184` .. `_canSoftDelete` (the real hook)
- `packages/service-core/src/base/base.crud.permissions.ts` .. no `_canDelete` in abstract declarations

### Proposed Solution

Remove `_canDelete` from `UserService`. The `_canSoftDelete` implementation already covers the real delete pipeline.

### Recommendation

Fix directly (no spec needed). Low priority dead code cleanup.

### Decision (2026-04-04)

**HACER** — Eliminar `_canDelete` de UserService. Dead code, nunca llamado por base class. `_canSoftDelete` ya cubre el caso real.

---

## GAP-051-024: `UserService.searchForList()` Bypasses `runWithLoggingAndValidation`

**Found in**: Audit pass 5
**Severity**: Medium
**Priority**: P3
**Complexity**: Low

### Description

`UserService.searchForList()` is a public method that calls `_canSearch()` directly and builds its own paginated response WITHOUT passing through `runWithLoggingAndValidation`. This means: (1) no automatic logging, (2) no input validation with Zod, (3) exceptions propagate without wrapping to the route handler, potentially exposing stack traces.

### Evidence

- `packages/service-core/src/services/user/user.service.ts:492-517`
- All other custom methods in the same service correctly use `runWithLoggingAndValidation`

### Proposed Solution

Wrap `searchForList` body in `runWithLoggingAndValidation` with the appropriate search schema.

### Recommendation

Fix directly or bundle with a code quality PR. Medium priority.

### Decision (2026-04-04)

**HACER** — Wrappear `searchForList` en `runWithLoggingAndValidation` con el schema de búsqueda apropiado. Partially fixed (tiene `_canSearch`), falta el wrapper.

---

## GAP-051-025: `DestinationService` Public Mutations Without Actor or Permissions

**Found in**: Audit pass 5
**Severity**: Medium
**Priority**: P2
**Complexity**: Low

### Description

`DestinationService.updateStatsFromReview()` and `updateAccommodationsCount()` are public methods that call `this.model.updateById()` directly without:

1. Receiving an `actor` parameter
2. Any permission verification
3. Passing through `runWithLoggingAndValidation`

Any caller can modify destination data (review stats, accommodation counts) without authentication. These are presumably called from review/accommodation services during cascading updates, but the lack of actor means there's no audit trail.

### Evidence

- `packages/service-core/src/services/destination/destination.service.ts:780-803`

### Proposed Solution

**Option A**: Add `actor` parameter and verify `_canUpdate(actor, destination)` before mutation.
**Option B**: Make these methods `protected` or `private` if they should only be called internally, and document as system-only operations with JSDoc.

### Recommendation

Create as part of a permissions hardening SPEC or fix directly with Option B. Priority P2 due to unaudited mutations.

### Decision (2026-04-04)

**HACER Opción B (ajustada)** — No se pueden hacer protected porque son llamados cross-service (AccommodationService, DestinationReviewService, AccommodationReviewService). Se mantienen public pero documentados con JSDoc `@internal` como operaciones internas de sistema sin actor.

---

## GAP-051-026: `DestinationService` Hierarchy Methods Skip Permission Checks Entirely

**Found in**: Audit pass 5
**Severity**: Low
**Priority**: P4
**Complexity**: Low

### Description

`DestinationService` methods `getChildren()`, `getDescendants()`, `getAncestors()`, `getBreadcrumb()`, and `getByPath()` omit the `actor` parameter from their `execute` lambdas entirely. No permission check runs inside these methods. While they use `runWithLoggingAndValidation` (so schema validation occurs), the actor is ignored.

### Evidence

- `packages/service-core/src/services/destination/destination.service.ts:817-834` (getChildren)
- Lines ~850-900 for getDescendants, getAncestors, getBreadcrumb, getByPath

### Proposed Solution

If these are public endpoints: add `this._canList(actor)` or `this._canView(actor)` check inside execute.
If these are intentionally public-only: document with JSDoc and ensure routes are only mounted on `/public/` tier.

### Recommendation

Fix directly (no spec needed). Low priority, depends on whether these are public-tier endpoints (then no check needed) or protected.

### Decision (2026-04-04)

**HACER (ajustado)** — Verificado: las rutas hierarchy están montadas en `/public/` (sin auth) Y `/admin/` (con middleware de permisos). Agregar permission check rompería el tier público. Solución: documentar con comentario de bloque que son intencionalmente permisivas, actor es solo para logging/audit. Admin tier protege via HTTP middleware.

---

## GAP-051-027: `hasPermission()` Does Not Handle Null/Undefined Actor Defensively

**Found in**: Audit pass 5
**Severity**: Medium
**Priority**: P3
**Complexity**: Trivial

### Description

`hasPermission()` in `packages/service-core/src/utils/permission.ts` checks `!actor.permissions` but not `!actor` itself. If called with a null or undefined actor, it throws a `TypeError` (not a `ServiceError`), which bypasses the service error handling pipeline and may expose stack traces.

While the TypeScript type system declares `actor: Actor` (not nullable), runtime edge cases exist: `actorMiddleware` catch block creates guest actors (GAP-019), `getActorFromContext` silently returns guest (GAP-020), and Hono context could theoretically have undefined actor if middleware ordering is wrong.

### Evidence

- `packages/service-core/src/utils/permission.ts:84-90`
- The function checks `!actor.permissions` but NOT `!actor`

### Proposed Solution

Add a null guard as the first line:

```typescript
if (!actor) return false;
```

### Recommendation

Fix directly (no spec needed). One-line defensive fix.

---

## GAP-051-028: Actor `permissions` Array Is Mutable After Construction

**Found in**: Audit pass 6
**Severity**: Medium
**Priority**: P3
**Complexity**: Low

### Description

The `Actor` type at `packages/service-core/src/types/index.ts:30` declares `permissions: PermissionEnum[]`, not `readonly PermissionEnum[]`. Nothing prevents route handler code from pushing or splicing permissions onto the live actor object stored in Hono context, which is shared for the entire request lifecycle.

```typescript
// hypothetical but valid TypeScript:
const actor = getActorFromContext(ctx);
actor.permissions.push(PermissionEnum.ACCESS_API_ADMIN); // no type error
```

Because the actor is stored by reference and reused for all service calls within the request, a mutation in one handler stage affects all subsequent permission checks, including `_canAdminList`.

### Security Impact

- **Current Risk**: LOW (no code currently mutates actor permissions mid-request)
- **Future Risk**: MEDIUM .. a subtle privilege-escalation bug could occur if any route handler inadvertently mutates the actor before calling a service
- Additionally, `apps/api/src/utils/actor.ts:68` explicitly mutates this field: `actor.permissions = []`

### Evidence

- `packages/service-core/src/types/index.ts:30` .. `permissions: PermissionEnum[]` (mutable)
- `apps/api/src/utils/actor.ts:68` .. `actor.permissions = []` (direct mutation)

### Proposed Solution

Change the type to `readonly`:

```typescript
permissions: readonly PermissionEnum[];
```

And change mutation sites to create new objects:

```typescript
return { ...actor, permissions: [] as PermissionEnum[] };
```

### Recommendation

Fix directly (no spec needed). Change type to `readonly` and fix mutation sites. Low complexity.

### Decision (2026-04-04)

**HACER** — Cambiar `permissions: PermissionEnum[]` a `readonly PermissionEnum[]` en Actor type + fix mutation sites para crear objetos nuevos en vez de mutar. Bundlear con GAP-020 (consolidación de getActorFromContext).

---

## GAP-051-029: Missing Negative Test for `checkCanAdminList` When `super._canAdminList` Rejects

**Found in**: Audit pass 6
**Severity**: Low
**Priority**: P5
**Complexity**: Trivial

### Description

The test of call-order in `accommodation.adminListPermission.test.ts:87-116` verifies that when both checks pass, the order is `['super._canAdminList', 'checkCanAdminList']`. But NO test verifies that when `super._canAdminList()` throws, `checkCanAdminList()` is NOT called. This is important because if someone changes the override to call `checkCanAdminList` first (violating the guard semantic), no test would detect it.

### Evidence

- `packages/service-core/test/services/accommodation/accommodation.adminListPermission.test.ts:87-116`
- Test `rejects actor without admin access permissions` (lines 37-53) verifies the error message but does NOT verify that `checkCanAdminList` was not invoked

### Proposed Solution

Add test case: "does not call checkCanAdminList when super._canAdminList rejects":

```typescript
it('does not call checkCanAdminList when super._canAdminList rejects', () => {
    const checkSpy = vi.spyOn(accommodationPermissions, 'checkCanAdminList');
    const actorNoAdmin = new ActorFactoryBuilder()
        .withId('no-admin')
        .withPermissions([PermissionEnum.ACCOMMODATION_VIEW_ALL])
        .build();
    expect(() => (service as CanAdminListAccessor)._canAdminList(actorNoAdmin)).toThrow();
    expect(checkSpy).not.toHaveBeenCalled();
    checkSpy.mockRestore();
});
```

### Recommendation

Fix directly (no spec needed). Trivial test addition.

### Decision (2026-04-04)

**HACER** — Agregar test negativo: verificar que `checkCanAdminList` NOT called cuando `super._canAdminList` rechaza. Bundlear con GAP-012 (tests de call-order para todos los overrides).

---

## GAP-051-030: `validateActor()` Only Checks Truthiness, Not Structural Integrity

**Found in**: Audit pass 6
**Severity**: Low
**Priority**: P4
**Complexity**: Trivial

### Description

`validateActor()` in `packages/service-core/src/utils/validation.ts:41` only checks `if (!actor)`. It does NOT verify that `actor.permissions` is an array, that `actor.id` is a non-empty string, or that `actor.role` is a valid `RoleEnum` value.

If a caller manually constructs an actor with `permissions: null` and passes it to a service method, `validateActor` passes, and `hasPermission` returns `false` (thanks to the defensive guard in GAP-027 fix). This is not failure-open, but `validateActor`'s documented contract says it "ensures that an actor object is provided" while in practice it does not ensure the actor is structurally valid.

### Evidence

- `packages/service-core/src/utils/validation.ts:41` .. only `if (!actor)` check
- TypeScript signature requires `Actor` (non-nullable), but runtime edge cases exist from middleware error paths

### Proposed Solution

Strengthen `validateActor` to match what the rest of the system requires:

```typescript
export const validateActor = (actor: unknown): void => {
    if (!actor || typeof actor !== 'object') {
        throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor is required');
    }
    const a = actor as Record<string, unknown>;
    if (!a.id || typeof a.id !== 'string') {
        throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor id is required');
    }
    if (!Array.isArray(a.permissions)) {
        throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Actor permissions must be an array');
    }
};
```

### Recommendation

Fix directly (no spec needed). Low priority, defensive improvement.

### Decision (2026-04-04)

**HACER** — Fortalecer `validateActor` para verificar integridad estructural: `actor` es object, `actor.id` es string no vacío, `actor.permissions` es array. Fix defensivo.

---

## Gap Summary Table

| ID | Gap | Severity | Priority | Complexity | Action | Found | Status |
|----|-----|----------|----------|------------|--------|-------|--------|
| GAP-051-001 | CLAUDE.md missing `_canAdminList` docs + obsolete package structure | Low | P4 | Trivial | Fix directly | Pass 1 | Open (confirmed pass 6, scope expanded) |
| GAP-051-002 | `mockAdminActor` `.superAdmin().withPermissions()` anti-pattern | Low | P4 | Trivial | Fix directly | Pass 1 | Partially resolved (confirmed pass 6) |
| GAP-051-003 | `getAdminInfo`/`setAdminInfo` share `_canUpdate()` without admin hook | Medium | P3 | Low-Medium | New SPEC | Pass 1 | Open (confirmed pass 6) |
| GAP-051-004 | No tests for permission-guarded `_canList()` through `_canAdminList()` | Low | P4 | Low | Fix directly | Pass 1 | Open (confirmed pass 6) |
| GAP-051-005 | SPEC-059 forward compatibility (`ctx` parameter) | Info | P5 | N/A | Track | Pass 1 | Open (confirmed pass 6) |
| GAP-051-006 | Async `_canList()` delegation not explicitly tested | Info | P5 | Trivial | Fix directly | Pass 1 | Open (confirmed pass 6) |
| **GAP-051-007** | **CRITICAL: Missing `await` on `_canUpdate()` in `getAdminInfo()`** | **HIGH** | **P1** | **Trivial** | **Fix immediately** | **Pass 2** | **Open (confirmed pass 6)** |
| **GAP-051-008** | **CRITICAL: Missing `await` on `_canUpdate()` in `setAdminInfo()`** | **HIGH** | **P1** | **Trivial** | **Fix immediately** | **Pass 2** | **Open (confirmed pass 6)** |
| GAP-051-009 | 15 services lack entity-specific `_canAdminList` override | Low-Medium | P3 | Medium | New SPEC | Pass 2 | Partially fixed (confirmed pass 6) |
| GAP-051-010 | No `adminSearch()`/`adminCount()` with admin permission gating | Info | P5 | Medium | Track | Pass 2 | Open (confirmed pass 6) |
| GAP-051-011 | Error message inconsistency across permission hooks | Low | P4 | Low | Fix directly | Pass 3 | Open (confirmed pass 6) |
| GAP-051-012 | No enforcement mechanism for `super._canAdminList()` in overrides | Low | P5 | N/A | Track (design limitation) | Pass 3 | Open (confirmed pass 6) |
| **GAP-051-013** | **CRITICAL: 13 missing `await` on `_can*()` in AccommodationService custom methods** | **HIGH** | **P1** | **Low** | **Fix immediately** | **Pass 4** | **Open (confirmed pass 6, still ~61 total)** |
| **GAP-051-014** | **CRITICAL: `_canAdminList` override drops Promise from `super._canAdminList()`** | **HIGH** | **P1** | **Trivial** | **Fix immediately** | **Pass 4** | **Open (confirmed pass 6)** |
| GAP-051-015 | `DestinationService` has two conflicting permission files | Medium | P2 | Low | New SPEC / Fix | Pass 4 | Open (confirmed pass 6) |
| GAP-051-016 | `_canUpdateVisibility` error wrapper discards original error code | Low | P4 | Trivial | Fix directly | Pass 4 | Open (confirmed pass 6) |
| GAP-051-017 | `adminList()` checks permissions AFTER schema validation | Low | P4 | Trivial | Fix directly | Pass 4 | Open (confirmed pass 6) |
| GAP-051-018 | Test quality: double-invocation anti-pattern, loose assertions | Low | P4 | Low | Fix directly | Pass 4 | Open (confirmed pass 6) |
| GAP-051-019 | `actorMiddleware` silently degrades auth user to guest on error | Medium | P2 | Low | New SPEC / Fix | Pass 4 | Open (confirmed pass 6) |
| GAP-051-020 | Dual `getActorFromContext` implementations, opposite failure modes | Medium | P3 | Low | Fix directly | Pass 4 | Open (confirmed pass 6) |
| GAP-051-021 | `PostService.unlike()` uses wrong permission hook (`_canList` not `_canLike`) | Medium | P2 | Trivial | Fix immediately | Pass 5 | Open (confirmed pass 6) |
| **GAP-051-022** | **CRITICAL: ~40 additional missing `await` on `_can*()` across 12 services (systemic)** | **HIGH** | **P1** | **Medium** | **New SPEC** | **Pass 5** | **Open (confirmed pass 6)** |
| GAP-051-023 | `UserService._canDelete` is dead code (not in base class interface) | Low | P4 | Trivial | Fix directly | Pass 5 | Open (confirmed pass 6) |
| GAP-051-024 | `UserService.searchForList()` bypasses `runWithLoggingAndValidation` | Medium | P3 | Low | Fix directly | Pass 5 | Partially fixed (confirmed pass 6) |
| GAP-051-025 | `DestinationService` public mutations without actor/permissions | Medium | P2 | Low | New SPEC / Fix | Pass 5 | Open (confirmed pass 6) |
| GAP-051-026 | `DestinationService` hierarchy methods skip permission checks | Low | P4 | Low | Fix directly | Pass 5 | Open (confirmed pass 6) |
| GAP-051-027 | `hasPermission()` does not handle null/undefined actor | Medium | P3 | Trivial | Fix directly | Pass 5 | **FIXED (pass 6)** |
| GAP-051-028 | Actor `permissions` array is mutable after construction | Medium | P3 | Low | Fix directly | Pass 6 | New |
| GAP-051-029 | Missing negative test: `checkCanAdminList` not called when super rejects | Low | P5 | Trivial | Fix directly | Pass 6 | New |
| GAP-051-030 | `validateActor()` only checks truthiness, not structural integrity | Low | P4 | Trivial | Fix directly | Pass 6 | New |

## Acceptance Criteria Verification

| AC | Status | Notes |
|----|--------|-------|
| `_canAdminList()` exists as concrete protected method in BaseCrudPermissions | PASS | Lines 191-204 |
| Default checks ACCESS_PANEL_ADMIN or ACCESS_API_ADMIN, then delegates to _canList() | PASS | Lines 193-203 |
| `adminList()` calls `_canAdminList()` instead of `_canList()` | PASS | Line 324 of base.crud.read.ts |
| AccommodationService overrides with ACCOMMODATION_VIEW_ALL check | PASS | Lines 226-229 of accommodation.service.ts |
| `checkCanAdminList()` exported from accommodation.permissions.ts | PASS | Lines 161-168 |
| All 21 services work without changes (default covers them) | PASS | Verified all 20 non-Accommodation services |
| Existing adminList() tests pass | PASS | Actors updated with admin permissions |
| New unit tests cover all required cases (6+4+2=12) | PASS | All test files exist with correct cases |
| adminList.test.ts verifies `_canAdminList` is called (not `_canList`) | PASS | Lines 515-527 |
| All tests pass with `pnpm test` | UNVERIFIED | Not run during audits (passes 1-3) |
| No biome lint errors | UNVERIFIED | Not run during audits (passes 1-3) |
| TypeScript compiles without errors | UNVERIFIED | Not run during audits (passes 1-3) |

### Pass 3 Additional Verification

| Check | Result | Notes |
|-------|--------|-------|
| `base.crud.admin.ts` missing awaits (GAP-007/008) | CONFIRMED PRESENT | Lines 52, 81 verified by direct file read |
| All 16 admin list routes mapped to permissions | COMPLETE | See GAP-051-009 pass 3 update |
| Test coverage: 14/14 spec'd test cases present | PASS | 6 base + 4 accommodation + 2 permission fn + 2 adminList integration |
| No `.adminList()` calls outside HTTP routes | CONFIRMED | Only in 16 route files + test files |
| `BaseCrudRelatedService` inherits correctly | PASS | 4 related services (Amenity, Attraction, Feature, Tag) inherit without override |
| `BaseCrudWrite` all `_can*` calls properly awaited | PASS | Uses `_getAndValidateEntity` with `await Promise.resolve(permissionCheck(...))` |
| System actors blocked at HTTP middleware | PASS | `authorization.ts:88-101` explicitly rejects `_isSystemActor` |

### Pass 4 Additional Verification

| Check | Result | Notes |
|-------|--------|-------|
| `base.crud.admin.ts` missing awaits (GAP-007/008) | CONFIRMED PRESENT | Lines 52, 81 still without `await` |
| AccommodationService custom methods `_can*` awaits | **13 MISSING** | GAP-051-013: lines 657,710,801,839,889,920,954,1002,1029,1060,1094,1140,1165 |
| AccommodationService `_canAdminList` override | **DROPS PROMISE** | GAP-051-014: `void` return drops `super` Promise |
| `DestinationService` permission files | **CONFLICTING** | GAP-051-015: two files, strict version is dead code |
| `mockAdminActor` (GAP-002) | PARTIALLY FIXED | Has `ACCESS_PANEL_ADMIN` now, still missing `ACCOMMODATION_VIEW_ALL` |
| `_canUpdateVisibility` error wrapper | INCONSISTENT | GAP-051-016: wraps error unlike all other `_can*` call sites |
| `adminList()` permission check ordering | AFTER VALIDATION | GAP-051-017: inconsistent with `list()` and `search()` |
| Test double-invocation pattern | PRESENT | GAP-051-018: false-positive risk in `adminListPermission.test.ts` |
| `actorMiddleware` error handling | SILENT DEGRADATION | GAP-051-019: auth user becomes guest on DB error |
| `getActorFromContext` dual implementations | CONFIRMED | GAP-051-020: `utils/` version falls back silently, `middleware/` version throws |
| `hasPermission()` utility | CORRECT | Handles null/undefined/non-array gracefully |
| `createSystemActor()` permissions | CORRECT | Has ALL permissions including admin access |
| `authorizationMiddleware` admin check | CORRECT | Checks permissions not roles, rejects system actors |
| `adminList` sort field validation | CORRECT | Validates against actual columns (no SQL injection) |
| `BaseCrudWrite` all `_can*` calls | CORRECTLY AWAITED | Uses `_getAndValidateEntity` with `await Promise.resolve()` wrapper |
| `checkCanAdminList()` public export | NOT EXPORTED | Not accessible from `@repo/service-core` barrel exports (intentional) |

### Pass 5 Additional Verification

| Check | Result | Notes |
|-------|--------|-------|
| ALL 20 prior gaps (001-020) | CONFIRMED STILL OPEN | None were fixed between pass 4 and pass 5 |
| Codebase-wide missing `await` sweep | **~40 NEW instances in 12 services** | GAP-022: systemic pattern, total ~61 across codebase |
| `PostService.unlike()` permission hook | WRONG HOOK | GAP-021: uses `_canList` instead of `_canLike` |
| `UserService._canDelete` | DEAD CODE | GAP-023: not in base class interface, never called |
| `UserService.searchForList()` | BYPASSES PIPELINE | GAP-024: no `runWithLoggingAndValidation` wrapper |
| `DestinationService` public mutations | NO ACTOR/PERMS | GAP-025: `updateStatsFromReview`, `updateAccommodationsCount` |
| `DestinationService` hierarchy methods | NO PERMISSION CHECK | GAP-026: getChildren, getDescendants, etc. skip actor |
| `hasPermission()` null actor | UNHANDLED | GAP-027: `TypeError` instead of `ServiceError` |
| SPEC-051 test suite (65 tests) | ALL PASS | 65/65 pass, 0 failures |
| Pre-existing test failures (non-SPEC-051) | 5 FAILURES | `hierarchy-hooks.test.ts` (3), `like.test.ts` (1), `unlike.test.ts` (2) |
| Acceptance criteria (11 items) | ALL PASS | SPEC-051 implementation is correct and complete |

### Pass 6 Additional Verification

| Check | Result | Notes |
|-------|--------|-------|
| ALL 27 prior gaps (001-027) | 1 FIXED, 2 PARTIALLY FIXED, 24 STILL OPEN | GAP-027 fixed; GAP-009 and GAP-024 partially fixed |
| SPEC-051 test suite (3 test files, 34 tests) | ALL PASS | `adminListPermission.test.ts` (6), `accommodation.adminListPermission.test.ts` (4), `accommodation.permissions.test.ts` (24 total, 2 for checkCanAdminList) |
| TypeScript compilation (SPEC-051 files) | PASS | No errors in any files created/modified by SPEC-051 |
| TypeScript compilation (non-SPEC-051 files) | PRE-EXISTING ERRORS | `executeAdminSearch.test.ts`, `accommodationReview/*.test.ts`, `destinationReview/*.test.ts` have pre-existing type errors |
| Actor `permissions` mutability | NEW GAP (028) | `permissions: PermissionEnum[]` allows runtime mutation |
| `validateActor()` structural validation | NEW GAP (030) | Only checks truthiness, not array/id/role integrity |
| Missing negative test for call-order | NEW GAP (029) | No test verifies `checkCanAdminList` NOT called when super rejects |
| No new services added since pass 5 | CONFIRMED | Still 21 services total |
| No new admin routes added since pass 5 | CONFIRMED | Still 16 admin list routes |
| `checkCanAdminList` barrel export | CORRECTLY NOT EXPORTED | Not in `@repo/service-core` barrel (intentional, internal use only) |
| `BaseCrudRelatedService` inheritance | CORRECT | 4 related services (Amenity, Attraction, Feature, Tag) inherit `_canAdminList` correctly |
| Permission bypass vectors | NONE FOUND | OR logic correct, `hasPermission` returns boolean, no prototype pollution risk |
| Error message information leakage | NONE | FORBIDDEN message does not disclose permission enum names |
| Race conditions | NONE | Permissions are request-scoped snapshots, standard and correct |

## Recommended Fix Order

1. **IMMEDIATE (P1) — Codebase-Wide Missing Await Security Sweep**: GAP-051-007 + GAP-051-008 + GAP-051-013 + GAP-051-014 + **GAP-051-022**. **~61 total missing `await` calls across 13 services + 2 in base admin class.** This is SYSTEMIC. Needs a dedicated SPEC:
   - `base.crud.admin.ts` lines 52, 81 (GAP-007/008)
   - `accommodation.service.ts` 13 custom methods + `_canAdminList` override (GAP-013/014)
   - **12 additional services with ~40 more instances** (GAP-022): feature, user, destination, userBookmark, amenity, attraction, postSponsor, tag, event, eventLocation, eventOrganizer, post
   - Consider adding a lint rule to prevent regression
   - **Confirmed present across ALL 6 audit passes.**
2. **HIGH (P2)**: GAP-051-015 + GAP-051-019 + GAP-051-021 + GAP-051-025.
   - Fix `DestinationService` dual permission files: remove dead code plural file OR consolidate.
   - Fix `actorMiddleware` guest degradation: fail with 503 instead of silent downgrade.
   - Fix `PostService.unlike()` wrong permission hook (`_canList` -> `_canLike`).
   - Fix `DestinationService` public mutations without actor (at least make protected or add actor param).
3. **Short-term (P3)**: GAP-051-001 + GAP-051-011 + GAP-051-020 + GAP-051-024 + GAP-051-028. Documentation, consolidation, and small fixes:
   - Update `service-core/CLAUDE.md`: add `_canAdminList` to permission hook table + document error message convention + fix obsolete package structure section.
   - Consolidate `getActorFromContext` to single throwing implementation.
   - Fix `UserService.searchForList()` to use `runWithLoggingAndValidation`.
   - Make Actor `permissions` array readonly to prevent mid-request mutation.
4. **Short-term (P3)**: GAP-051-003 + GAP-051-009 .. New SPEC for admin hooks on `getAdminInfo`/`setAdminInfo` and entity-specific `_canAdminList` overrides for 12-15 services.
5. **Low priority (P4)**: GAP-051-002 + GAP-051-004 + GAP-051-016 + GAP-051-017 + GAP-051-018 + GAP-051-023 + GAP-051-026 + GAP-051-030 .. Test coverage, correctness, dead code cleanup, and actor validation hardening.
6. **Track only (P5)**: GAP-051-005 + GAP-051-006 + GAP-051-010 + GAP-051-012 + GAP-051-029 .. Forward compatibility notes, design limitations, and minor test improvements.
