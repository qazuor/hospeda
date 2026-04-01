# SPEC-057 Gaps Report: Admin Response Schema Naming Consistency

> **Spec**: SPEC-057-admin-response-schema-consistency
> **Initial Audit Date**: 2026-03-31
> **Last Updated**: 2026-03-31
> **Total Audit Passes**: 5
> **Auditors (Pass 1)**: Orchestrator + 4 expert sub-agents (schema patterns, route factory, field verification, access tier consistency)
> **Auditors (Pass 2)**: Orchestrator + 4 expert sub-agents (schema file verification, route & factory audit, frontend & test coverage, security & architecture)
> **Auditors (Pass 3)**: Orchestrator + 5 expert sub-agents (schema field-by-field verifier, route deep audit, response pipeline security, test coverage & quality, cross-entity consistency & architecture)
> **Auditors (Pass 4)**: Orchestrator + 5 expert sub-agents (gap status verifier, admin route deep audit, schema architecture analysis, test coverage & quality audit, security & cross-cutting concerns)
> **Auditors (Pass 5)**: Orchestrator + 4 expert sub-agents (access schema file audit, index.ts & export chain audit, admin list route audit, gaps & edge case analysis)
> **Spec Status at audit time**: `draft` (but fully implemented)

---

## Executive Summary

SPEC-057 is **fully implemented**. All 6 access.schema.ts files exist, all 16 admin list routes use `*AdminSchema`, and all entity index.ts files re-export correctly. The spec's field definitions match the actual code with zero discrepancies across all five audit passes.

However, the audit uncovered **31 gaps** (9 in pass 1, 2 new in pass 2, 10 new in pass 3, 9 new in pass 4, 1 new in pass 5) .. issues not declared in the spec that represent inconsistencies, missed opportunities, security risks, test coverage holes, and architectural drift in the broader access schema system.

**Pass 3 key additions**:

- Deep-traced the COMPLETE database-to-HTTP response pipeline with code-line-level evidence
- Discovered DestinationReview restore/hardDelete return wrong schema type (FUNCTIONAL BUG)
- Found OwnerPromotion has ZERO schema test coverage (critical coverage gap)
- Found Sponsorship missing base/CRUD/query schema tests (only admin-search exists)
- Identified NO access schema boundary tests exist for ANY of the 16 entities
- Found EventOrganizer (existing entity) leaks `lifecycleState` in PublicSchema (pattern violation)
- Found userId exposed in PublicSchema for review entities (privacy concern)
- Identified `owner-promotion` directory naming breaks codebase camelCase convention
- Found ProtectedSchema field inclusion drift across entities (createdById/updatedById inconsistent)
- Found Tag's non-nullable createdById/updatedById breaks BaseAuditFields pattern
- Identified lifecycle field naming inconsistency (isActive vs lifecycleState vs status)

**Pass 5 key additions**:

- Re-verified ALL 30 existing gaps: NONE have been fixed since pass 4
- Complete export chain verification: all 6 new access schemas flow correctly through entity index.ts → entities barrel index.ts → main package index.ts → importable from `@repo/schemas`
- Found AccommodationReview and DestinationReview missing admin CREATE routes (unlike other entities with full CRUD)
- Documented exact comment format variation across all 16 entity index.ts files (4 different formats found)
- Confirmed base schema field accuracy for all 6 entities with fresh reads against current code
- Confirmed UserAdminSchema `.extend()` pattern is intentional and documented in spec

**Pass 4 key additions**:

- Re-verified ALL 21 existing gaps: 3 status changes identified (GAP-012 reclassified, GAP-016/017 reassessed as product decisions)
- Found CRITICAL DB-Zod schema mismatches: AccommodationReview DB has `averageRating` + `lifecycleState` NOT in Zod schema
- Found DestinationReview DB has `averageRating` NOT in Zod schema
- Discovered 3 entities missing `.query.schema.ts` files (OwnerPromotion, PostSponsor, Sponsorship)
- Discovered 2 entities missing `.http.schema.ts` files (OwnerPromotion, Sponsorship)
- Found 5 ADDITIONAL entities in codebase that completely lack `access.schema.ts` (beyond the original 6)
- Found import path `.js` extension inconsistency in amenity/tag admin routes vs other 14 routes
- Found OpenAPI tag naming inconsistency in review admin routes
- All 18 new access schema types (6 entities x 3 tiers) are exported but have ZERO usage in codebase
- Found missing `PatchInputSchema` definitions for PostSponsor and Sponsorship CRUD schemas
- Found 5 of 6 SPEC-057 entities lack dedicated API route tests (only Tag has one)

---

## Implementation Status: COMPLETE

| Deliverable | Status | Notes |
|-------------|--------|-------|
| 6 access.schema.ts files created | DONE | All exist with correct three-tier pattern (pass 1 + 2 + 3 confirmed) |
| 6 entity index.ts re-exports added | DONE | All re-export access.schema.ts (pass 1 + 2 + 3 confirmed) |
| 6 admin list routes updated to AdminSchema | DONE | All 16 routes use `*AdminSchema` (pass 1 + 2 + 3 confirmed) |
| TypeScript compilation | DONE | No type errors from these changes (pass 3: @repo/schemas typecheck clean) |
| Field accuracy vs spec | DONE | Zero discrepancies found (pass 3: field-by-field verification per entity complete) |
| Import type consistency | DONE | All 6 new files use `import type { z }` (pass 3 confirmed) |
| JSDoc completeness | DONE | All three schemas in all 6 files have JSDoc (pass 3 confirmed) |
| No circular imports | DONE | Each access schema imports ONLY its own entity's base schema (pass 3 confirmed) |
| Export chain works | DONE | All access schemas accessible via `@repo/schemas` (pass 3 confirmed) |

---

## GAP-057-001: Spec Status Not Updated

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P4 |
| **Complexity** | Trivial |
| **Found in** | Audit pass 1 |
| **Confirmed in** | Audit pass 2, 3 |
| **Category** | Process |

**Description**: The spec file still shows `Status: draft` but all deliverables are fully implemented and working. The spec should be marked as `completed`.

**Proposed Solution**: Update the spec metadata to `Status: completed` and add a completion date.

**Recommendation**: Fix directly. No new SPEC needed.

**Decision (2026-03-31)**: HACER. Fix directo, cambio trivial.

---

## GAP-057-002: Non-List Admin Routes Still Use Base Schema

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Low |
| **Found in** | Audit pass 1 |
| **Updated in** | Audit pass 2 (expanded route inventory), pass 3 (confirmed with code reads) |
| **Category** | Consistency |

**Description**: SPEC-057 only updated the 6 admin **list** routes to use `*AdminSchema`. All other admin routes (getById, create, update, delete, hardDelete, restore, patch, batch) for these 6 entities still reference the base `*Schema` directly.

**Pass 3 Update**: Route audit agent confirmed all findings from pass 2. Complete code reads of all admin route files verified the route inventory is accurate. The existing 10 entities use AdminSchema in ALL their admin routes, making the 6 SPEC-057 entities the ONLY inconsistency.

**Evidence (pass 2+3 .. complete inventory)**:

| Entity | Route | Current responseSchema |
|--------|-------|----------------------|
| AccommodationReview | getById | `AccommodationReviewSchema.nullable()` |
| AccommodationReview | update | `AccommodationReviewSchema` |
| AccommodationReview | restore | `AccommodationReviewSchema` |
| DestinationReview | getById | `DestinationReviewSchema.nullable()` |
| DestinationReview | update | `DestinationReviewSchema` |
| DestinationReview | restore | `DestinationReviewIdSchema` |
| DestinationReview | hardDelete | `DestinationReviewIdSchema` |
| OwnerPromotion | getById | `OwnerPromotionSchema.nullable()` |
| OwnerPromotion | create | `OwnerPromotionSchema` |
| OwnerPromotion | update | `OwnerPromotionSchema` |
| OwnerPromotion | patch | `OwnerPromotionSchema` |
| OwnerPromotion | restore | `OwnerPromotionSchema` |
| PostSponsor | getById | `PostSponsorSchema.nullable()` |
| PostSponsor | create | `PostSponsorSchema` |
| PostSponsor | update | `PostSponsorSchema` |
| PostSponsor | patch | `PostSponsorSchema` |
| PostSponsor | restore | `PostSponsorSchema` |
| Tag | getById | `TagSchema.nullable()` |
| Tag | create | `TagSchema` |
| Tag | update | `TagSchema` |
| Tag | patch | `TagSchema` |
| Tag | restore | `TagSchema` |
| Tag | batch | `TagBatchResponseSchema` (custom) |
| Tag | hardDelete | Inline `z.object({...})` |

Total: 24 admin routes still using base schema instead of AdminSchema.

Since `AdminSchema = BaseSchema` (alias), the runtime behavior is identical, but the naming inconsistency defeats the purpose of SPEC-057.

**Proposed Solutions**:

1. **Quick fix (recommended)**: Update all non-list admin routes for the 6 entities to import `*AdminSchema` instead of `*Schema`. ~24 route changes.
2. **Comprehensive fix**: Audit ALL admin routes across ALL 16 entities and ensure every admin route uses `*AdminSchema`.

**Recommendation**: Can be fixed directly as a follow-up to SPEC-057 (option 1). If a new SPEC is preferred for traceability, option 2 makes it worthwhile.

**Decision (2026-03-31)**: HACER Opción B — auditoría completa de TODAS las rutas admin de las 16 entidades para asegurar consistencia total con `*AdminSchema`.

---

## GAP-057-003: Public/Protected Routes for SPEC-057 Entities Don't Use Access Schema Variants

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Medium |
| **Found in** | Audit pass 1 |
| **Updated in** | Audit pass 2 (clarified scope), pass 3 (full route inventory) |
| **Category** | Consistency / Security (documentation) |

**Description**: The spec explicitly declares this as "Out of Scope", but public and protected routes for the 6 SPEC-057 entities still use the full base schema as their `responseSchema`.

**Pass 3 Update**: The existing 10 entities **DO use PublicSchema/ProtectedSchema** in their routes (131+ references found). The 6 SPEC-057 entities are the ONLY entities whose public/protected routes still use the base schema. Route audit confirmed complete inventory.

**Evidence (pass 2+3)**:

| Entity | Route Tier | Current responseSchema | Should Be |
|--------|-----------|----------------------|-----------|
| AccommodationReview | Public list | `AccommodationReviewSchema` | `AccommodationReviewPublicSchema` |
| AccommodationReview | Protected create | `AccommodationReviewSchema` | `AccommodationReviewProtectedSchema` |
| DestinationReview | Public list | `DestinationReviewSchema` | `DestinationReviewPublicSchema` |
| OwnerPromotion | Public list | `OwnerPromotionSchema` | `OwnerPromotionPublicSchema` |
| OwnerPromotion | Protected create/update/patch/delete | `OwnerPromotionSchema` | `OwnerPromotionProtectedSchema` |
| Sponsorship | Protected create/update/delete/getById/list/analytics | `SponsorshipSchema` | `SponsorshipProtectedSchema` |
| Tag | Public getBySlug | Custom `TagPublicResponseSchema` | Already handled (inline, not using TagPublicSchema) |

**Proposed Solutions**:

1. **New SPEC**: Create a dedicated spec to update ALL public routes to use `*PublicSchema` and ALL protected routes to use `*ProtectedSchema` for the 6 SPEC-057 entities.
2. **Gradual adoption**: Update routes entity-by-entity as they are touched by other work.

**Recommendation**: New SPEC (formal). This is a non-trivial change across many routes and should be planned properly.

**Decision (2026-03-31)**: HACER — combinar con GAP-002 en la misma implementación. Actualizar public/protected/admin routes de las 6 entidades SPEC-057 para usar los access schema variants correctos.

---

## GAP-057-004: No Runtime Response Validation/Stripping (CRITICAL)

| Attribute | Value |
|-----------|-------|
| **Severity** | **Critical** |
| **Priority** | **P1** |
| **Complexity** | High |
| **Found in** | Audit pass 1 |
| **Elevated in** | Audit pass 2 (concrete code-path proof), pass 3 (full pipeline trace with line-level evidence), pass 4 (re-confirmed with fresh analysis) |
| **Category** | Security / Architecture |

**Description**: The `responseSchema` parameter in route factories is **ONLY used for OpenAPI documentation generation**. It is NOT used for runtime validation or field stripping. This means admin-only fields (createdById, updatedById, deletedById, notes, adminInfo, etc.) **can and do leak** to public/protected API responses.

**Pass 4 Update**: Fresh analysis confirmed that `response-validator.ts` exists but uses `z.unknown()` for data fields.. it validates envelope FORMAT (`{success, data, metadata}`) but NOT content. The validator is also disabled in production (`enabled: env.NODE_ENV === 'development' || env.NODE_ENV === 'test'`). This gap remains CRITICAL and is the single most impactful finding across all 4 audit passes.

**Pass 3 Update**: Security pipeline agent performed a COMPLETE 5-layer trace from database to HTTP, confirming NO runtime enforcement at ANY level:

### Complete Code Path Evidence (pass 3)

**Layer 1 - Database (BaseModel)**:

```typescript
// packages/db/src/base/base.model.ts:116
db.select().from(this.table).where(finalWhereClause).$dynamic();
// ← NO column selection, implicit SELECT *
```

**Layer 2 - Service (BaseCrudService)**:

```typescript
// tag.service.ts _executeSearch
return this.model.findAll(filterParams, { page, pageSize });
// ← Returns entire entity, no field filtering
```

**Layer 3 - Handler (route files)**:

```typescript
// admin/list.ts handlers
return { items: result.data?.items || [], pagination: ... };
// ← Raw items passed directly, no schema stripping
```

**Layer 4 - Response Helpers**:

```typescript
// response-helpers.ts createResponse()
const response = { success: true, data, metadata: { ... } };
return c.json(response, statusCode);
// ← data passed as-is, NO .parse(), .safeParse(), .strip()
```

**Layer 5 - Response Validator Middleware**:

```typescript
// response-validator.ts
enabled: env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
// ← DISABLED IN PRODUCTION
// Even when enabled, uses z.unknown() for data field - no field validation
```

### Quantified Exposure (pass 3)

| Tier | Total Routes | Routes With Validation | Routes Leaking Data |
|------|-------------|----------------------|-------------------|
| Public | ~15 | 1 (Tag getBySlug manual) | ~14 (93%) |
| Protected | ~8 | 0 | 8 (100%) |
| Admin | ~32 | 0 | 32 (100%) |
| **Total** | **~55** | **1 (1.8%)** | **~54 (98.2%)** |

### Sensitive Fields at Risk (pass 3 - expanded)

| Field | Entities | Sensitivity | Risk |
|-------|----------|-------------|------|
| `createdById` | All 16 entities | HIGH (PII linkage) | Admin user IDs leaked to public |
| `updatedById` | All 16 entities | HIGH (PII linkage) | Admin user IDs leaked to public |
| `deletedById` | All 16 entities | CRITICAL | Soft-delete audit leaked |
| `deletedAt` | All 16 entities | MEDIUM | Soft-delete state leaked |
| `adminInfo` | 13 entities | HIGH | Admin notes leaked to public |
| `notes` | Tag | HIGH | Internal notes leaked |
| `lifecycleState` | ~10 entities | MEDIUM | Internal state machine leaked |
| `paymentId` | Sponsorship | HIGH | Payment system identifier |

**Proposed Solutions**:

1. **Route factory schema enforcement (recommended)**: Modify `createResponse()` and `createPaginatedResponse()` to accept a `responseSchema` parameter and call `.safeParse()` which auto-strips unknown fields.
2. **Development-only validation**: Same as #1 but only when `NODE_ENV !== 'production'`. Catches leaks in dev without production overhead.
3. **Database column selection**: Add column selection to BaseModel.findAll() so queries only return needed fields.

**Recommendation**: **New SPEC (formal, CRITICAL priority)**. This is the most impactful gap found across all three passes. Option 1 is the right fix. Estimated 2-3 days implementation + tests.

**Decision (2026-03-31)**: HACER en NUEVA SPEC FORMAL — Opción A (runtime `.safeParse()` en response helpers). Es la más robusta: garantía a nivel HTTP de que nunca sale un campo no declarado. Performance negligible (~0.1ms por schema parse). Incluir optimización de parseo lazy (skip cuando AdminSchema = BaseSchema) y cache de schema compilado al startup. Spec dedicado por complejidad high y impacto arquitectural.

---

## GAP-057-005: Frontend Admin Code Uses Base Schema Instead of AdminSchema

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P4 |
| **Complexity** | Low |
| **Found in** | Audit pass 1 |
| **Updated in** | Audit pass 2 (refined), pass 3 (confirmed admin app pattern) |
| **Category** | Consistency |

**Description**: Three admin frontend files import the base `*Schema` directly instead of using the `*AdminSchema` variant.

**Pass 3 Update**: Cross-entity audit confirmed the admin app does NOT consistently use AdminSchema variants anywhere. It primarily imports base schemas via type imports and enums. The entire PublicSchema/ProtectedSchema/AdminSchema architecture is effectively unused in the admin codebase.

| File | Import | Should Be |
|------|--------|-----------|
| `apps/admin/src/features/sponsors/schemas/sponsors.schemas.ts` | `PostSponsorSchema` | `PostSponsorAdminSchema` |
| `apps/admin/src/features/owner-promotions/schemas/owner-promotions.schemas.ts` | `OwnerPromotionSchema` | `OwnerPromotionAdminSchema` |
| `apps/admin/src/features/tags/schemas/tags.schemas.ts` | `TagSchema` | `TagAdminSchema` |

**Proposed Solution**: Update the 3 import statements. Zero behavioral impact.

**Recommendation**: Fix directly. No new SPEC needed.

**Decision (2026-03-31)**: HACER — combinar con GAP-002/003 en la misma implementación de consistencia de schemas.

---

## GAP-057-006: Sponsorship Has No Non-List Admin Routes

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Medium |
| **Found in** | Audit pass 1 |
| **Confirmed in** | Audit pass 2, 3 |
| **Category** | Missing functionality |

**Description**: Sponsorship is the only entity among the 16 that has an admin list route but NO other admin CRUD routes. All other 15 entities have at least getById + list.

**Proposed Solutions**:

1. **Confirm intentional**: If sponsorships are managed through protected flows, document this explicitly
2. **Create missing routes**: Add standard admin CRUD routes if admin management is needed

**Recommendation**: Verify with product requirements. If admin management is needed, create a new SPEC.

> **Decision (2026-03-31)**: POSTERGAR — requiere decisión de producto sobre si admins necesitan gestionar sponsorships directamente o si el flujo protected es suficiente.

---

## GAP-057-007: Index.ts Re-Export Positioning Inconsistency

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P5 |
| **Complexity** | Trivial |
| **Found in** | Audit pass 1 |
| **Updated in** | Audit pass 3 (full 16-entity comparison) |
| **Category** | Code style |

**Description**: The position of the access.schema.ts re-export line varies across entity index.ts files.

**Pass 3 Update**: Complete comparison of all 16 index.ts files shows:

- Early positioned (line 5): attraction, eventOrganizer, feature, user
- Mid-positioned (line 14-21): postSponsor, tag, destinationReview
- Late positioned (line 23-29): accommodation, amenity, destination, event, eventLocation, post, accommodationReview
- Minimal files (line 8): owner-promotion, sponsorship

Comment format also varies from minimal inline to detailed JSDoc-style blocks.

**Proposed Solution**: Standardize the re-export position and comment format across all 16 index.ts files.

**Recommendation**: Fix opportunistically when touching these files. No new SPEC needed.

**Decision (2026-03-31)**: HACER — estandarizar como parte del batch de consistencia (GAP-002/003/005).

---

## GAP-057-008: PostSponsor Access Schema Field Naming Discrepancy in Spec

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P5 |
| **Complexity** | None (documentation only) |
| **Found in** | Audit pass 1 |
| **Confirmed in** | Audit pass 2, 3 |
| **Category** | Documentation accuracy |

**Description**: The spec text describes individual sub-field names (email, phone) which are sub-fields of wrapper objects (contactInfo, socialNetworks). The implementation correctly picks the wrapper objects.

**Recommendation**: No action needed. Documentation-only observation.

**Decision (2026-03-31)**: HACER — corregir la redacción del spec para reflejar los objetos wrapper correctos (contactInfo, socialNetworks).

---

## GAP-057-009: Existing Admin Route Tests Don't Validate Schema Tier Usage

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Medium |
| **Found in** | Audit pass 1 |
| **Updated in** | Audit pass 2 (confirmed), pass 3 (deep test analysis with specific evidence) |
| **Category** | Testing |

**Description**: Admin list route tests verify HTTP 200, response structure, pagination, and authorization, but do NOT verify that response items match the expected schema tier.

**Pass 3 Update**: Test coverage agent performed comprehensive analysis of `admin-list-routes.test.ts`:

- **17 tests total**: 14 table-driven pagination tests + 10 common behavior tests + 2 nested route config tests
- Tests verify: ✓ Response structure, ✓ Pagination fields, ✓ Status codes, ✓ Permission enforcement
- Tests do NOT verify: ✗ Response fields match AdminSchema, ✗ Sensitive fields ARE present in admin responses, ✗ Field boundaries per tier

**Recommendation**: Include as part of the runtime validation SPEC (GAP-057-004).

**Decision (2026-03-31)**: HACER — incluir en la SPEC formal de GAP-004 (runtime response validation). Los tests de boundary validation son el complemento natural del enforcement runtime.

---

## GAP-057-010: SPEC-057 Entity Public/Protected Routes Are the Only Ones Not Using Access Schemas

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Low |
| **Found in** | Audit pass 2 |
| **Confirmed in** | Audit pass 3 |
| **Category** | Consistency |

**Description**: The existing 10 entities already use `*PublicSchema` and `*ProtectedSchema` in their public/protected routes (131+ references). The 6 SPEC-057 entities are the **only entities** not using access schemas in their routes.

**Proposed Solution**: Update ~12 public/protected routes for the 6 SPEC-057 entities to use the newly created access schemas.

**Recommendation**: Combine with GAP-057-002 into a single new SPEC. Schemas already exist, only route imports need updating.

**Decision (2026-03-31)**: HACER — ya cubierto por decisión de GAP-002/003. Marcado como duplicado.

---

## GAP-057-011: AccommodationReview/DestinationReview Admin Routes Missing from Test Suite

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Medium |
| **Found in** | Audit pass 2 |
| **Updated in** | Audit pass 3 (root cause confirmed) |
| **Category** | Testing |

**Description**: The admin list route test file documents that AccommodationReview and DestinationReview admin routes are **not testable** due to a Hono OpenAPI routing conflict.

**Pass 3 Update**: Root cause confirmed from test file lines 7-11 and 73-78:

- Routes nested under parent entity routers (`/accommodations/reviews`, `/destinations/reviews`)
- Parent's `/{id}` parametric route takes priority over `/reviews` subrouter in Hono's OpenAPI routing
- Test workaround only verifies routes are reachable (not 404), cannot verify handler invocation
- **2 of 16 admin list routes have ZERO integration test coverage**

**Proposed Solutions**:

1. **Investigate Hono routing conflict**: Determine if route registration order or path patterns can resolve it
2. **Add unit tests**: Test route handlers directly (bypassing OpenAPI middleware)
3. **Add E2E tests**: Test via full HTTP with Playwright

**Recommendation**: Include in next testing improvement effort. The routing conflict should be investigated first.

**Decision (2026-03-31)**: HACER — investigar conflicto de routing Hono (Opción A) + agregar tests. Incluir en la SPEC de testing junto con GAP-013/014/015/030. El conflicto de routing es potencialmente un bug de producción, no solo un problema de tests.

---

## GAP-057-012: DestinationReview restore/hardDelete Return Wrong Schema (FUNCTIONAL BUG)

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Low |
| **Found in** | **Audit pass 3** |
| **Category** | Functional Bug |

**Description**: DestinationReview's `restore` and `hardDelete` admin routes use `DestinationReviewIdSchema` as their `responseSchema`, meaning they document returning `{id}` instead of the full restored/deleted entity. This differs from ALL other entities which return the full entity schema on restore.

**Evidence (pass 3)**:

| Route | Current responseSchema | Other Entities Use |
|-------|----------------------|-------------------|
| DestinationReview restore | `DestinationReviewIdSchema` | `*Schema` or `*AdminSchema` (full entity) |
| DestinationReview hardDelete | `DestinationReviewIdSchema` | Inline `z.object(...)` or `DeleteResultSchema` |

**Comparison**: AccommodationReview's restore route uses `AccommodationReviewSchema` (correct). This makes DestinationReview the only entity with this discrepancy.

**Impact**: While `responseSchema` is only used for OpenAPI docs (per GAP-057-004), this creates API documentation inconsistency and would become a real bug if/when runtime response validation is implemented.

**Proposed Solution**: Update DestinationReview restore route to use `DestinationReviewAdminSchema` and hardDelete to use a proper response schema matching other entities.

**Pass 4 Update**: Reclassified. The restore route returns `DestinationReviewIdSchema` which is consistent with "return just the ID after operation" pattern. AccommodationReview returns the full schema on restore, making this an inconsistency between the two review entities but not necessarily a bug. Verify whether the intent is to return the full entity or just the ID. If just ID is intentional, AccommodationReview's restore should also use IdSchema for consistency.

**Recommendation**: Verify intent with product/team. If full entity is expected, fix DestinationReview. If ID-only is expected, fix AccommodationReview. Either way, standardize.

**Decision (2026-03-31)**: HACER — estandarizar: restore devuelve entidad completa (AdminSchema), hardDelete devuelve `{success, message}`. Patrón de AccommodationReview como referencia. Incluir en batch de consistencia (GAP-002/003).

---

## GAP-057-013: OwnerPromotion Has ZERO Schema Test Coverage

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 3** |
| **Category** | Testing |

**Description**: OwnerPromotion is the ONLY entity among the 6 SPEC-057 entities with **absolutely zero test files** in `packages/schemas/test/entities/owner-promotion/`. No base schema tests, no CRUD tests, no query tests, no access schema tests.

**Evidence (pass 3)**:

| Entity | Base Test | CRUD Test | Query Test | Access Test |
|--------|-----------|-----------|------------|-------------|
| AccommodationReview | ✓ | ✓ | ✓ | ✗ |
| DestinationReview | ✓ | ✓ | ✓ | ✗ |
| OwnerPromotion | **✗** | **✗** | **✗** | **✗** |
| PostSponsor | ✓ | ✓ | ✗ | ✗ |
| Sponsorship | ✗ | ✗ | ✗ | ✗ |
| Tag | ✓ | ✓ | ✓ | ✗ |

**Impact**: Any schema regression for OwnerPromotion (field changes, validation rule modifications, default value changes) would go completely undetected until runtime failures occur.

**Proposed Solution**: Create complete test suite:

- `owner-promotion.schema.test.ts` (base schema validation, 20+ tests)
- `owner-promotion.crud.schema.test.ts` (CRUD operations, 15+ tests)
- `owner-promotion.query.schema.test.ts` (search/filter, 10+ tests)
- `owner-promotion.access.schema.test.ts` (tier boundary tests)

**Recommendation**: New SPEC or include in a broader test coverage initiative. This is a production risk.

**Decision (2026-03-31)**: HACER — incluir en SPEC de testing junto con GAP-011/014/015/030. Suite completa: base, CRUD, query, access boundary tests.

---

## GAP-057-014: Sponsorship Missing Base/CRUD/Query Schema Tests

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 3** |
| **Category** | Testing |

**Description**: Sponsorship only has a single test file (`admin-search.test.ts` with ~25 tests). Core schema validation (base, CRUD, query) is completely absent.

**Evidence (pass 3)**: The admin-search test validates filter behavior but does NOT test:

- Base schema valid/invalid data acceptance
- CRUD input/output schemas
- Query/search parameter validation
- Access schema tier boundaries

**Impact**: Core sponsorship schema changes (field types, validation rules, defaults) have no test safety net.

**Proposed Solution**: Create missing test files matching the pattern of other entities.

**Recommendation**: Combine with GAP-057-013 into a single test coverage SPEC.

**Decision (2026-03-31)**: HACER — incluir en SPEC de testing junto con GAP-011/013/015/030.

---

## GAP-057-015: No Access Schema Boundary Tests for ANY Entity

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 3** |
| **Category** | Testing / Security |

**Description**: None of the 16 entities have tests validating that access schema tiers correctly separate fields. Zero tests verify that PublicSchema excludes sensitive fields or that AdminSchema includes all fields.

**Evidence (pass 3)**: Test coverage agent searched for:

- ✗ Any file importing `PublicSchema`, `ProtectedSchema`, or `AdminSchema` in test directories
- ✗ Any test named `*access*` or testing field boundaries
- ✗ Any negative assertions ("should NOT contain field X")

**Result**: 0 test files found across all 16 entities.

**What TypeScript compilation catches**: Structural errors (invalid field names in `.pick()`).

**What TypeScript compilation does NOT catch**:

- Missing fields in `.pick()` (a PublicSchema accidentally missing `name` compiles fine)
- Wrong tier assignment (a field in PublicSchema that should be Admin-only)
- Regressions when base schema changes (field added to base, not added to PublicSchema)
- Logical access violations (route using PublicSchema when it should use ProtectedSchema)

**Proposed Solution**: Create access schema boundary test pattern:

```typescript
describe('{Entity}AccessSchemas', () => {
    it('PublicSchema should NOT include sensitive fields', () => {
        const publicFields = Object.keys(PublicSchema.shape);
        expect(publicFields).not.toContain('createdById');
        expect(publicFields).not.toContain('adminInfo');
    });

    it('AdminSchema should include ALL fields from BaseSchema', () => {
        const baseFields = Object.keys(BaseSchema.shape);
        const adminFields = Object.keys(AdminSchema.shape);
        expect(adminFields).toEqual(expect.arrayContaining(baseFields));
    });
});
```

**Recommendation**: New SPEC covering access schema boundary tests for all 16 entities. This is the test-side counterpart to GAP-057-004 (runtime enforcement).

**Decision (2026-03-31)**: HACER — incluir en SPEC de testing junto con GAP-011/013/014/030. Boundary tests para las 16 entidades. Es el complemento de testing del runtime enforcement (GAP-004).

---

## GAP-057-016: EventOrganizer Leaks lifecycleState in PublicSchema (Existing Entity Pattern Violation)

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Low |
| **Found in** | **Audit pass 3** |
| **Category** | Security / Privacy |

**Description**: `EventOrganizerPublicSchema` includes `lifecycleState: true`, making it the **ONLY entity** in the entire codebase that exposes lifecycle state to unauthenticated users.

**Evidence (pass 3)**: Cross-entity audit compared PublicSchema field selections:

| Entity | lifecycleState in PublicSchema? |
|--------|-------------------------------|
| Accommodation | ✗ |
| Post | ✗ |
| Destination | ✗ |
| Event | ✗ |
| Tag | ✗ |
| PostSponsor | ✗ |
| OwnerPromotion | N/A (uses `isActive` instead) |
| **EventOrganizer** | **✓ (VIOLATION)** |

**Impact**: Anonymous users can:

- Enumerate organization states (draft, published, archived)
- Detect soft-deleted/archived organizations
- Infer internal workflow state

**Proposed Solution**: Remove `lifecycleState` from `EventOrganizerPublicSchema` and move it to `EventOrganizerProtectedSchema`.

**Recommendation**: Fix directly. Single-line change. No new SPEC needed. This is a pre-existing issue in an existing entity, not caused by SPEC-057.

**Decision (2026-03-31)**: HACER — remover `lifecycleState` de EventOrganizerPublicSchema, mover a ProtectedSchema. Cambio de 1 línea. Incluir en batch de consistencia (GAP-002/003).

---

## GAP-057-017: userId Exposed in PublicSchema for Review Entities (Privacy Concern)

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Low |
| **Found in** | **Audit pass 3** |
| **Category** | Privacy / Security |

**Description**: `AccommodationReviewPublicSchema` and `DestinationReviewPublicSchema` include `userId: true`, exposing the reviewer's user ID to anonymous users.

**Evidence (pass 3)**: Cross-entity comparison of PublicSchema field philosophies:

| Entity | userId/authorId in PublicSchema? | Justification |
|--------|--------------------------------|---------------|
| Post | ✓ (`authorId`) | Author attribution |
| AccommodationReview | ✓ (`userId`) | Reviewer attribution |
| DestinationReview | ✓ (`userId`) | Reviewer attribution |
| OwnerPromotion | ✗ (`ownerId` hidden) | Business privacy |
| Sponsorship | ✗ (`sponsorUserId` hidden) | Business privacy |

**Privacy Risk**: Exposing user IDs enables:

- User activity enumeration (map user IDs to review counts)
- Cross-entity user profiling (same userId across reviews/posts)
- User tracking without authentication

**Proposed Solutions**:

1. **Move userId to ProtectedSchema**: Show "Anonymous reviewer" in public views
2. **Keep but document**: If reviewer attribution is a product requirement, document this as intentional
3. **Use reviewer display name instead**: Expose a computed display name, not the raw user ID

**Recommendation**: Product decision required. If reviewer attribution is needed publicly, document as intentional. Otherwise, move to ProtectedSchema. This is a design decision, not strictly a bug.

**Decision (2026-03-31)**: DESCARTAR — reviewer attribution es un feature intencional. Exponer userId en PublicSchema de reviews es consistente con el patrón de Post (authorId). Documentado como decisión de producto.

---

## GAP-057-018: owner-promotion Directory Naming Breaks Codebase Convention

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P4 |
| **Complexity** | Medium (rename requires import updates) |
| **Found in** | **Audit pass 3** |
| **Category** | Code Style / Consistency |

**Description**: The directory `packages/schemas/src/entities/owner-promotion/` uses kebab-case naming, while ALL other 15 entity directories use camelCase (`postSponsor/`, `accommodationReview/`, `eventLocation/`, etc.).

**Evidence (pass 3)**: Full directory listing comparison:

```
✓ accommodation/           (camelCase - no hyphen needed)
✓ accommodationReview/     (camelCase)
✓ amenity/                 (camelCase - no hyphen needed)
✓ attraction/              (camelCase - no hyphen needed)
✓ destination/             (camelCase - no hyphen needed)
✓ destinationReview/       (camelCase)
✓ event/                   (camelCase - no hyphen needed)
✓ eventLocation/           (camelCase)
✓ eventOrganizer/          (camelCase)
✓ feature/                 (camelCase - no hyphen needed)
✗ owner-promotion/         (KEBAB-CASE - BREAKS PATTERN)
✓ post/                    (camelCase - no hyphen needed)
✓ postSponsor/             (camelCase)
✓ sponsorship/             (camelCase - no hyphen needed)
✓ tag/                     (camelCase - no hyphen needed)
✓ user/                    (camelCase - no hyphen needed)
```

**Note**: File naming WITHIN the directory correctly matches (`owner-promotion.schema.ts`, `owner-promotion.access.schema.ts`), which is consistent with the CLAUDE.md rule "Utilities: kebab-case.ts". But the **directory** breaks the pattern.

**Proposed Solution**: Rename `owner-promotion/` to `ownerPromotion/` and update all import paths.

**Recommendation**: Fix opportunistically. Medium complexity due to import path updates across the monorepo. Could be combined with other schema-related refactoring.

**Decision (2026-03-31)**: HACER — renombrar ambos directorios kebab-case a camelCase (`owner-promotion/` → `ownerPromotion/`, `exchange-rate/` → `exchangeRate/`) + actualizar imports. Dato nuevo: son DOS directorios, no uno. Incluir en batch de consistencia.

---

## GAP-057-019: ProtectedSchema Field Inclusion Drift Across Entities

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Low |
| **Found in** | **Audit pass 3** |
| **Category** | Consistency / Architecture |

**Description**: Different entities include different audit fields in their ProtectedSchema, creating an inconsistent access control pattern.

**Evidence (pass 3)**:

| Entity | createdAt | updatedAt | createdById | updatedById | Pattern |
|--------|-----------|-----------|-------------|-------------|---------|
| AccommodationReview | ✓ | ✓ | ✗ | ✗ | Standard |
| DestinationReview | ✓ | ✓ | ✗ | ✗ | Standard |
| OwnerPromotion | ✓ | ✓ | ✗ | ✗ | Standard |
| PostSponsor | ✓ | ✓ | ✗ | ✗ | Standard |
| Sponsorship | ✓ | ✓ | ✗ | ✗ | Standard |
| Tag | ✓ | ✓ | ✗ | ✗ | Standard |
| **EventLocation** | ✓ | ✓ | **✓** | **✓** | **OUTLIER** |
| **Destination** | ✓ | ✓ | **✓** | **✓** | **OUTLIER** |

**Issue**: EventLocation and Destination include `createdById`/`updatedById` in their ProtectedSchema while all other entities keep these Admin-only. The SPEC-057 spec acknowledges this: "destination.access.schema.ts is an exception that includes createdById/updatedById in its ProtectedSchema."

**Proposed Solutions**:

1. **Standardize to Admin-only**: Remove `createdById`/`updatedById` from Destination and EventLocation ProtectedSchema
2. **Document as intentional exception**: If these entities have a product reason for showing who created/updated them to authenticated users

**Recommendation**: Document the access schema philosophy in a shared location and decide on one standard. This is an architectural consistency issue.

**Decision (2026-03-31)**: HACER — estandarizar a Admin-only. Remover `createdById`/`updatedById` de EventLocation y Destination ProtectedSchema. Incluir en batch de consistencia (GAP-002/003).

---

## GAP-057-020: Tag Non-Nullable createdById/updatedById Breaks BaseAuditFields Pattern

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 3** |
| **Category** | Schema Correctness |

**Description**: Tag defines its audit fields inline (not using `BaseAuditFields` spread) with **non-nullable** `createdById`/`updatedById`, while the established `BaseAuditFields` pattern makes these `.nullable()`.

**Evidence (pass 3)**:

```typescript
// Tag schema (INLINE - NON-NULLABLE):
createdById: UserIdSchema,       // NOT nullable
updatedById: UserIdSchema,       // NOT nullable

// BaseAuditFields (STANDARD - NULLABLE):
createdById: UserIdSchema.nullable(),    // nullable
updatedById: UserIdSchema.nullable(),    // nullable
```

**BaseAuditFields comment**: "createdById and updatedById are nullable because some records may be created/updated by system processes without a specific user."

**Impact**:

- If a system process creates/updates a Tag without a user context, the non-nullable constraint would cause a database error
- Inconsistent with all other 15 entities that use `BaseAuditFields`
- Creates confusion about the codebase convention

**SPEC-057 spec acknowledges this**: "Tag defines audit fields inline (not via BaseAuditFields spread). The field names are the same, but the nullability differs." However, no action was proposed.

**Proposed Solutions**:

1. **Align Tag with BaseAuditFields**: Make `createdById`/`updatedById` nullable (recommended)
2. **Document as intentional**: If Tags MUST always have a creator user, document why

**Recommendation**: Fix directly or verify with DB schema. If the database column is NOT NULL, this is correct and should be documented. If the column IS NULL, the Zod schema is wrong and should be fixed.

**Decision (2026-03-31)**: HACER — verificado: DB ES nullable, Zod dice non-nullable. Fix: hacer `createdById`/`updatedById` nullable en Tag schema para alinear con DB y BaseAuditFields. Incluir en batch de DB-Zod sync.

---

## GAP-057-021: Lifecycle Field Naming Inconsistency (isActive vs lifecycleState vs status)

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P4 |
| **Complexity** | High (would require schema + DB changes) |
| **Found in** | **Audit pass 3** |
| **Category** | Architecture / Consistency |

**Description**: The 6 SPEC-057 entities use three different approaches for representing entity state:

| Entity | State Field | Type | Pattern |
|--------|-------------|------|---------|
| OwnerPromotion | `isActive` | boolean | Non-standard (simple toggle) |
| PostSponsor | `lifecycleState` | LifecycleStatusEnum | Standard (via BaseLifecycleFields) |
| Tag | `lifecycleState` | LifecycleStatusEnum | Standard (inline) |
| Sponsorship | `status` | SponsorshipStatusEnum | Custom (domain-specific) |
| AccommodationReview | (none) | N/A | No lifecycle field |
| DestinationReview | (none) | N/A | No lifecycle field |

**Impact**: This makes it harder to:

- Build generic admin UI components for status management
- Create consistent filtering across entities
- Reason about entity state across the system

**Proposed Solutions**:

1. **Document as intentional**: Different entities have different lifecycle needs
2. **Standardize on lifecycleState**: Migrate OwnerPromotion from `isActive` to `lifecycleState` (breaking change)

**Recommendation**: Document the current pattern. Migration would be a breaking DB change with limited ROI. The variation exists because each entity has genuinely different lifecycle needs.

**Decision (2026-03-31)**: HACER en NUEVA SPEC FORMAL — estandarizar todas las entidades a usar `lifecycleState: LifecycleStatusEnum` como base. Entidades con estados domain-specific extienden con un campo adicional (ej: Sponsorship mantiene `lifecycleState` base + `sponsorshipStatus` para estados específicos). OwnerPromotion migra `isActive` → `lifecycleState`. Reviews agregan `lifecycleState`. Complejidad alta: migraciones DB + schema + services + rutas.

---

## GAP-057-022: DB-Zod Schema Mismatch - AccommodationReview Missing Fields

| Attribute | Value |
|-----------|-------|
| **Severity** | **Critical** |
| **Priority** | **P1** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 4** |
| **Category** | Schema Correctness / Type Safety |

**Description**: The database schema for `accommodation_reviews` contains fields that do NOT exist in the Zod schema (`AccommodationReviewSchema`). This creates a type safety violation where DB data cannot be validated by the application's schema layer.

**Evidence (pass 4)**:

| Field | DB Schema | Zod Schema | Status |
|-------|-----------|------------|--------|
| `averageRating` | `numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('0')` | MISSING | **MISMATCH** |
| `lifecycleState` | `LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE')` | MISSING | **MISMATCH** |

**DB File**: `packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts` (lines 30-31)
**Zod File**: `packages/schemas/src/entities/accommodationReview/accommodationReview.schema.ts`

**Impact**:

- `averageRating` and `lifecycleState` are returned from DB queries but NOT typed in the application
- Access schemas CANNOT include these fields (they don't exist in the base Zod schema to `.pick()`)
- Admin dashboard cannot properly display or filter by these fields
- If SPEC-056 (Numeric Column Coercion) touches `averageRating`, it will fail to find it in the Zod schema

**Proposed Solutions**:

1. **Add missing fields to Zod schema**: Add `averageRating: z.number()` and `lifecycleState: LifecycleStatusEnumSchema.default('ACTIVE')` to AccommodationReviewSchema
2. **Remove from DB**: If these fields are not used, drop them from the DB schema (verify first)

**Recommendation**: New SPEC or fix directly. This is a data integrity issue. Verify whether `averageRating` is computed from the `rating` sub-fields or stored separately.

**Decision (2026-03-31)**: HACER — agregar `averageRating: z.number()` y `lifecycleState: LifecycleStatusEnumSchema.default('ACTIVE')` al Zod schema. Actualizar access schemas para incluirlos en los tiers correctos. `lifecycleState` se alinea con la decisión de GAP-021. Combinar con GAP-023.

---

## GAP-057-023: DB-Zod Schema Mismatch - DestinationReview Missing averageRating

| Attribute | Value |
|-----------|-------|
| **Severity** | **Critical** |
| **Priority** | **P1** |
| **Complexity** | Low |
| **Found in** | **Audit pass 4** |
| **Category** | Schema Correctness / Type Safety |

**Description**: Same issue as GAP-057-022 but for DestinationReview. The DB has `averageRating` column that is absent from the Zod schema.

**Evidence (pass 4)**:

- **DB File**: `packages/db/src/schemas/destination/destination_review.dbschema.ts` (line 20)
- `averageRating: numeric('average_rating', { precision: 3, scale: 2 }).notNull().default('0')`
- **Zod File**: `packages/schemas/src/entities/destinationReview/destinationReview.schema.ts` .. field MISSING

**Impact**: Same as GAP-057-022. Type safety violation, access schemas cannot expose this field.

**Recommendation**: Fix together with GAP-057-022 in the same change.

**Decision (2026-03-31)**: HACER — agregar `averageRating: z.number()` al Zod schema de DestinationReview. Combinar con GAP-022 en la misma implementación de DB-Zod sync.

---

## GAP-057-024: Missing Query Schemas for 3 SPEC-057 Entities

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 4** |
| **Category** | Schema Completeness |

**Description**: Three of the 6 SPEC-057 entities are missing `.query.schema.ts` files, which define list/search/filter input validation. This means their API search endpoints lack proper input validation schemas.

**Evidence (pass 4)**:

| Entity | Has query.schema.ts? | Has http.schema.ts? | Has PatchInputSchema? |
|--------|---------------------|--------------------|-----------------------|
| AccommodationReview | Yes | Yes | Yes |
| DestinationReview | Yes | Yes | Yes |
| OwnerPromotion | **No** | **No** | No (not in CRUD) |
| PostSponsor | **No** | Yes | **No** |
| Sponsorship | **No** | **No** | **No** |
| Tag | Yes | Yes | Yes |

**Missing files**:

- `packages/schemas/src/entities/owner-promotion/owner-promotion.query.schema.ts`
- `packages/schemas/src/entities/owner-promotion/owner-promotion.http.schema.ts`
- `packages/schemas/src/entities/postSponsor/postSponsor.query.schema.ts`
- `packages/schemas/src/entities/sponsorship/sponsorship.query.schema.ts`
- `packages/schemas/src/entities/sponsorship/sponsorship.http.schema.ts`

**Impact**: Without query schemas, list/search endpoints either use unvalidated input or rely solely on admin-search schemas. HTTP schemas are needed for route-level request/response typing.

**Proposed Solution**: Create missing schema files following the pattern of AccommodationReview/DestinationReview/Tag.

**Recommendation**: New SPEC covering schema completeness for all 6 entities. Medium effort (copy patterns from existing entities).

**Decision (2026-03-31)**: HACER — crear los 5 archivos faltantes (query.schema.ts y http.schema.ts) siguiendo patrones existentes. Batch de schema completeness.

---

## GAP-057-025: Missing PatchInputSchema for PostSponsor and Sponsorship

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | Low |
| **Found in** | **Audit pass 4** |
| **Category** | Schema Completeness |

**Description**: PostSponsor and Sponsorship CRUD schema files do not define `PatchInputSchema`, while AccommodationReview, DestinationReview, and Tag do. This means partial update operations lack proper validation.

**Evidence (pass 4)**:

- `postSponsor.crud.schema.ts` .. no Patch schema
- `sponsorship.crud.schema.ts` .. no Patch schema
- Both entities have admin `patch` routes that would benefit from dedicated validation

**Proposed Solution**: Add `PatchInputSchema` (typically `UpdateInputSchema.partial()`) to both CRUD files.

**Recommendation**: Fix directly or include in schema completeness SPEC.

**Decision (2026-03-31)**: HACER — combinar con GAP-024 en batch de schema completeness.

---

## GAP-057-026: 5 Additional Entities Missing Access Schemas Entirely

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 4** |
| **Category** | Schema Architecture / Completeness |

**Description**: SPEC-057 identified 6 entities needing access schemas and created them. However, pass 4 discovered **5 additional entities** that also lack `access.schema.ts` files entirely, meaning they were missed by SPEC-057's initial audit.

**Evidence (pass 4)**:

| Entity | Has access.schema.ts? | Has Admin Routes? | Severity |
|--------|-----------------------|-------------------|----------|
| exchange-rate | **No** | Yes | High |
| postSponsorship | **No** | Yes | High |
| userBookmark | **No** | Yes | Medium |
| permission | **No** | Admin-only (config) | Low |
| revalidation | **No** | Admin-only (infra) | Low |

**Impact**: These entities have admin routes but no access tier definitions, meaning there's no architectural guidance for what fields should be exposed at each access level.

**Proposed Solution**: Create access.schema.ts for all 5 entities following the SPEC-057 pattern.

**Recommendation**: New SPEC (or extend SPEC-057 scope). Priority for exchange-rate, postSponsorship, userBookmark (which have user-facing routes). Lower priority for permission, revalidation (admin-only infrastructure).

**Decision (2026-03-31)**: HACER — crear access.schema.ts para las 5 entidades. Incluir en batch de schema completeness con GAP-024/025.

---

## GAP-057-027: Import Path .js Extension Inconsistency in Admin Routes

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P4 |
| **Complexity** | Trivial |
| **Found in** | **Audit pass 4** |
| **Category** | Code Style / Consistency |

**Description**: Two of the 16 admin list routes (amenity, tag) use `.js` file extensions in their relative import paths, while the other 14 routes do not.

**Evidence (pass 4)**:

- **With .js extension** (2 routes):
  - `apps/api/src/routes/amenity/admin/list.ts`: `import { getActorFromContext } from '../../../utils/actor.js'`
  - `apps/api/src/routes/tag/admin/list.ts`: `import { getActorFromContext } from '../../../utils/actor.js'`
- **Without .js extension** (14 routes):
  - All others: `import { getActorFromContext } from '../../../utils/actor'`

**Impact**: Minimal.. both patterns resolve correctly with the current bundler configuration. However, inconsistency could cause issues if module resolution settings change.

**Proposed Solution**: Standardize to one pattern across all 16 routes. Prefer the majority pattern (no `.js` extension).

**Recommendation**: Fix opportunistically. No new SPEC needed.

**Decision (2026-03-31)**: HACER — estandarizar al patrón sin `.js` (mayoría). Incluir en batch de consistencia.

---

## GAP-057-028: OpenAPI Tag Inconsistency in Review Admin Routes

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P5 |
| **Complexity** | Trivial |
| **Found in** | **Audit pass 4** |
| **Category** | API Documentation |

**Description**: The two review entity admin routes use different OpenAPI tag patterns compared to each other and the rest of the admin routes.

**Evidence (pass 4)**:

- AccommodationReview admin list: `tags: ['Accommodation Reviews', 'Admin']` (explicit Admin tag)
- DestinationReview admin list: `tags: ['Destinations', 'Reviews']` (no Admin tag, uses parent entity name)
- Other entities: `tags: ['Entity Name']` (single tag, factory auto-adds "Admin - " prefix)

**Impact**: OpenAPI documentation/Swagger UI will group these routes inconsistently.

**Proposed Solution**: Standardize tag format to match the factory's auto-prefix convention.

**Recommendation**: Fix opportunistically. No new SPEC needed.

**Decision (2026-03-31)**: HACER — estandarizar al patrón del factory (tag único con auto-prefix). Incluir en batch de consistencia.

---

## GAP-057-029: All Access Schema Types Exported But Zero Usage in Codebase

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Priority** | P3 |
| **Complexity** | N/A (architectural observation) |
| **Found in** | **Audit pass 4** |
| **Category** | Architecture / Dead Code |

**Description**: All 18 new access schema types (6 entities x 3 tiers: Public, Protected, Admin) are properly exported via the `@repo/schemas` package, but NONE of them are imported or used anywhere in the codebase outside of the schema definition files themselves.

**Evidence (pass 4)**: Searched for all access type names across the entire monorepo:

| Type | Import Count Outside schemas/ |
|------|------|
| `AccommodationReviewPublic` / `Protected` / `Admin` | 0 |
| `DestinationReviewPublic` / `Protected` / `Admin` | 0 |
| `OwnerPromotionPublic` / `Protected` / `Admin` | 0 |
| `PostSponsorPublic` / `Protected` / `Admin` | 0 |
| `SponsorshipPublic` / `Protected` / `Admin` | 0 |
| `TagPublic` / `Protected` / `Admin` | 0 |

**Note**: The `*AdminSchema` (not the type, the schema constant) IS used in the admin list route files. But the inferred **types** (`AccommodationReviewAdmin`, etc.) are never imported.

**Impact**: The types exist for API contract correctness but are effectively dead code. If runtime response filtering (GAP-057-004) were implemented, these types would become critical. Currently they serve only as documentation.

**Proposed Solution**: No immediate action needed. These types become essential when runtime response validation is implemented (GAP-057-004). Document this dependency.

**Recommendation**: Track as architectural debt. Will be resolved when GAP-057-004 is addressed.

**Decision (2026-03-31)**: HACER — se resuelve naturalmente con la implementación de GAP-004 (runtime response validation). No requiere acción independiente.

---

## GAP-057-030: Missing Dedicated API Route Tests for 5 of 6 SPEC-057 Entities

| Attribute | Value |
|-----------|-------|
| **Severity** | **High** |
| **Priority** | **P2** |
| **Complexity** | Medium |
| **Found in** | **Audit pass 4** |
| **Category** | Testing |

**Description**: Only Tag has a dedicated API route test file (`apps/api/test/routes/tag-public.test.ts`). The other 5 SPEC-057 entities have NO entity-specific route tests outside the generic admin-list-routes test.

**Evidence (pass 4)**:

| Entity | Admin List Test | Dedicated Route Tests | Status |
|--------|----------------|----------------------|--------|
| AccommodationReview | Skipped (Hono conflict) | **None** | **CRITICAL** |
| DestinationReview | Skipped (Hono conflict) | **None** | **CRITICAL** |
| OwnerPromotion | Generic only | **None** | Missing |
| PostSponsor | Generic only | **None** | Missing |
| Sponsorship | Generic only | **None** | Missing |
| Tag | Generic only | tag-public.test.ts | Partial |

**Impact**: No tests verify:

- CRUD operations (create, update, delete, restore) for these entities
- Business logic in route handlers
- Error handling edge cases
- Permission enforcement per-route
- Input validation beyond generic admin-list tests

**Proposed Solution**: Create entity-specific route test files for all 5 missing entities.

**Recommendation**: Combine with GAP-057-013/014 into a comprehensive test coverage SPEC.

**Decision (2026-03-31)**: HACER — incluir en SPEC de testing junto con GAP-011/013/014/015. Tests dedicados de rutas para las 5 entidades faltantes.

---

## GAP-057-031: Review Entities Missing Admin CREATE Routes

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Priority** | P4 |
| **Complexity** | Medium |
| **Found in** | **Audit pass 5** |
| **Category** | Missing Functionality / Consistency |

**Description**: Both `AccommodationReview` and `DestinationReview` have admin routes for getById, update, restore, delete, and hardDelete, but neither has an admin CREATE route. Every other entity with full admin CRUD (OwnerPromotion, PostSponsor, Tag) includes a create route.

**Evidence (pass 5)**:

| Entity | Admin Routes Present | Admin CREATE? |
|--------|---------------------|---------------|
| AccommodationReview | list, getById, update, restore, delete, hardDelete | **No** |
| DestinationReview | list, getById, update, restore, delete, hardDelete | **No** |
| OwnerPromotion | list, getById, create, update, patch, restore, delete, hardDelete | Yes |
| PostSponsor | list, getById, create, update, patch, restore, delete, hardDelete | Yes |
| Tag | list, getById, create, update, patch, restore, delete, batch, hardDelete | Yes |
| Sponsorship | list only | No (already GAP-057-006) |

**Assessment**: This is likely **intentional** .. reviews are user-generated content, and admins should moderate (update/delete) but probably shouldn't create reviews on behalf of users. However, this is not explicitly documented anywhere.

**Proposed Solutions**:

1. **Document as intentional**: Add a comment or note in the route directory explaining why admin CREATE is not provided for review entities
2. **Add admin CREATE**: If there's a product need (e.g., seeding test reviews, migrating from another system), create the routes

**Recommendation**: Verify with product/team. Most likely intentional. Document the decision.

**Decision (2026-03-31)**: DESCARTAR — intencional. Reviews son user-generated content; admins moderan (update/delete) pero no crean en nombre de usuarios. Documentar en los route directories.

---

## Gap Summary Table

**Updated with Pass 5 findings:**

| Gap ID | Title | Severity | Priority | Complexity | Found | Pass 5 Status | Recommendation |
|--------|-------|----------|----------|------------|-------|---------------|----------------|
| GAP-057-001 | Spec status not updated | Low | P4 | Trivial | Pass 1 | STILL PRESENT | Fix directly |
| GAP-057-002 | Non-list admin routes use base schema (24 routes) | Medium | P3 | Low | Pass 1 | STILL PRESENT (confirmed 24 routes) | Fix directly or new SPEC |
| GAP-057-003 | Public/protected routes don't use access schemas | Medium | P3 | Medium | Pass 1 | STILL PRESENT | New SPEC |
| **GAP-057-004** | **No runtime response validation/stripping** | **Critical** | **P1** | **High** | **Pass 1** | **STILL PRESENT (5x confirmed)** | **New SPEC (critical)** |
| GAP-057-005 | Frontend imports base schemas directly (3 files) | Low | P4 | Low | Pass 1 | STILL PRESENT | Fix directly |
| GAP-057-006 | Sponsorship missing non-list admin routes | Medium | P3 | Medium | Pass 1 | STILL PRESENT | Verify intent |
| GAP-057-007 | Index.ts re-export position & comment format inconsistency | Low | P5 | Trivial | Pass 1 | STILL PRESENT (pass 5: 4 different comment formats found across 16 entities) | Fix opportunistically |
| GAP-057-008 | PostSponsor field naming in spec text | Low | P5 | None | Pass 1 | N/A (doc only) | No action |
| GAP-057-009 | Tests don't validate schema tier content | Medium | P3 | Medium | Pass 1 | STILL PRESENT | Include in testing SPEC |
| GAP-057-010 | SPEC-057 entities only ones without access schemas in routes | Medium | P3 | Low | Pass 2 | STILL PRESENT | Combine with GAP-057-002 |
| GAP-057-011 | Review admin routes missing from test suite | Medium | P3 | Medium | Pass 2 | STILL PRESENT | Investigate Hono conflict |
| GAP-057-012 | DestinationReview restore/hardDelete return wrong schema | High | P2 | Low | Pass 3 | RECLASSIFIED (may be intentional) | Verify intent |
| **GAP-057-013** | **OwnerPromotion has ZERO schema test coverage** | **High** | **P2** | **Medium** | **Pass 3** | **STILL PRESENT** | **New SPEC (test coverage)** |
| **GAP-057-014** | **Sponsorship missing base/CRUD/query tests** | **High** | **P2** | **Medium** | **Pass 3** | **STILL PRESENT** | **Combine with GAP-057-013** |
| **GAP-057-015** | **No access schema boundary tests for ANY entity** | **High** | **P2** | **Medium** | **Pass 3** | **STILL PRESENT** | **New SPEC (test coverage)** |
| GAP-057-016 | EventOrganizer leaks lifecycleState in PublicSchema | High | P2 | Low | Pass 3 | REASSESSED (may be intentional) | Product decision needed |
| GAP-057-017 | userId in PublicSchema for review entities | Medium | P3 | Low | Pass 3 | REASSESSED (likely intentional) | Product decision needed |
| GAP-057-018 | owner-promotion directory naming convention | Low | P4 | Medium | Pass 3 | REASSESSED (kebab-case for files is project convention) | Verify convention |
| **GAP-057-019** | **ProtectedSchema field inclusion drift** | **Medium** | **P3** | **Low** | **Pass 3** | **STILL PRESENT** | **Document + standardize** |
| **GAP-057-020** | **Tag non-nullable createdById/updatedById** | **High** | **P2** | **Medium** | **Pass 3** | **STILL PRESENT** | **Fix Zod schema** |
| GAP-057-021 | Lifecycle field naming inconsistency | Low | P4 | High | Pass 3 | STILL PRESENT | Document as intentional |
| **GAP-057-022** | **DB-Zod mismatch: AccommodationReview missing averageRating + lifecycleState** | **Critical** | **P1** | **Medium** | **Pass 4** | **STILL PRESENT** | **Fix directly or new SPEC** |
| **GAP-057-023** | **DB-Zod mismatch: DestinationReview missing averageRating** | **Critical** | **P1** | **Low** | **Pass 4** | **STILL PRESENT** | **Fix with GAP-057-022** |
| **GAP-057-024** | **Missing query/HTTP schemas for 3 entities** | **High** | **P2** | **Medium** | **Pass 4** | **STILL PRESENT** | **New SPEC (schema completeness)** |
| GAP-057-025 | Missing PatchInputSchema for PostSponsor/Sponsorship | Medium | P3 | Low | Pass 4 | STILL PRESENT | Fix directly or with GAP-057-024 |
| **GAP-057-026** | **5 additional entities missing access schemas** | **High** | **P2** | **Medium** | **Pass 4** | **STILL PRESENT** | **New SPEC (extend SPEC-057)** |
| GAP-057-027 | Import path .js extension inconsistency | Low | P4 | Trivial | Pass 4 | STILL PRESENT | Fix opportunistically |
| GAP-057-028 | OpenAPI tag inconsistency in review routes | Low | P5 | Trivial | Pass 4 | STILL PRESENT | Fix opportunistically |
| GAP-057-029 | Access schema types exported but zero usage | Medium | P3 | N/A | Pass 4 | STILL PRESENT | Track (resolved when GAP-004 fixed) |
| **GAP-057-030** | **Missing dedicated API route tests for 5/6 entities** | **High** | **P2** | **Medium** | **Pass 4** | **STILL PRESENT** | **Combine with testing SPEC** |
| GAP-057-031 | Review entities missing admin CREATE routes | Low | P4 | Medium | **Pass 5** | **NEW** | Verify intent, document |

---

## Recommended New SPECs (Updated Pass 4)

### 1. CRITICAL: Response Schema Runtime Enforcement (covers GAP-057-004 + GAP-057-009 + GAP-057-015 + GAP-057-029)

**Scope**: Add runtime response validation using the declared `responseSchema` in route factories. Zod's `.safeParse()` auto-strips undeclared fields.
**Implementation approach**:

1. Modify `createResponse()` and `createPaginatedResponse()` to accept `responseSchema` parameter
2. Route factories pass the schema to response helpers
3. Zod strips fields not in the schema automatically
4. Non-breaking: parameter optional, defaults to current behavior
5. Add access schema boundary tests for all 16 entities
6. Add integration tests verifying field presence/absence per tier

**Estimated complexity**: High (architectural, affects all routes, needs performance benchmarks)
**Priority**: **P1 (Critical)**
**Estimated effort**: 3-5 days

### 2. CRITICAL: DB-Zod Schema Synchronization (covers GAP-057-022 + GAP-057-023)

**Scope**: Reconcile DB schemas with Zod schemas for AccommodationReview (`averageRating`, `lifecycleState`) and DestinationReview (`averageRating`). Determine whether these are computed columns, unused columns, or missing Zod definitions.
**Implementation approach**:

1. Investigate whether `averageRating` is a computed/denormalized column from the `rating` sub-object
2. If used: add to Zod schemas, update access schemas to include at appropriate tiers
3. If unused: create migration to drop the columns
4. Investigate AccommodationReview `lifecycleState` purpose (DestinationReview has `isPublished`/`isVerified` instead)

**Estimated complexity**: Medium (requires DB investigation + potential migration)
**Priority**: **P1 (Critical)** .. data integrity issue
**Estimated effort**: 1-2 days

### 3. Admin Route Schema Consistency (covers GAP-057-002 + GAP-057-003 + GAP-057-005 + GAP-057-010)

**Scope**: Update ALL admin routes (not just list) for 6 SPEC-057 entities to use `*AdminSchema`. Update public/protected routes to use `*PublicSchema`/`*ProtectedSchema`. Update 3 admin frontend imports.
**Estimated complexity**: Low (naming changes only, no behavioral impact)
**Priority**: P3
**Estimated effort**: 2-4 hours

### 4. Schema Completeness for SPEC-057 Entities (covers GAP-057-024 + GAP-057-025)

**Scope**: Create missing query schemas (OwnerPromotion, PostSponsor, Sponsorship), missing HTTP schemas (OwnerPromotion, Sponsorship), and missing PatchInputSchema (PostSponsor, Sponsorship). Standardizes all 6 entities to the same schema file set.
**Implementation approach**: Follow patterns from AccommodationReview/DestinationReview/Tag which have complete schema sets.
**Estimated complexity**: Medium
**Priority**: P2
**Estimated effort**: 1-2 days

### 5. Comprehensive Test Coverage (covers GAP-057-013 + GAP-057-014 + GAP-057-015 + GAP-057-030)

**Scope**: Create complete test suites for OwnerPromotion (zero tests) and Sponsorship (only admin-search). Add access schema boundary tests for all 16 entities. Add dedicated API route tests for PostSponsor, OwnerPromotion, Sponsorship.
**Estimated complexity**: Medium-High
**Priority**: P2
**Estimated effort**: 3-4 days

### 6. Extended Access Schema Coverage (covers GAP-057-026)

**Scope**: Create `access.schema.ts` for 5 additional entities discovered in pass 4: exchange-rate, postSponsorship, userBookmark, permission, revalidation.
**Estimated complexity**: Low-Medium (follow SPEC-057 pattern)
**Priority**: P3 (P2 for exchange-rate, postSponsorship, userBookmark)
**Estimated effort**: 1 day

### 7. Review Route Test Coverage (covers GAP-057-011)

**Scope**: Investigate Hono OpenAPI routing conflict for AccommodationReview/DestinationReview. Add test coverage for these 2 entities.
**Estimated complexity**: Medium
**Priority**: P3
**Estimated effort**: 1 day

### 8. Access Schema Privacy & Consistency Review (covers GAP-057-016 + GAP-057-017 + GAP-057-019 + GAP-057-020)

**Scope**: Decide on EventOrganizer lifecycleState in PublicSchema, decide on userId in review PublicSchemas, standardize ProtectedSchema field inclusion, fix Tag audit field nullability (Zod schema says required but DB allows NULL).
**Estimated complexity**: Low-Medium (requires product decisions on some items)
**Priority**: P2
**Estimated effort**: 1 day (after product decisions made)

---

## Quick Fixes (No SPEC Needed)

| Gap | Fix | Effort | Pass 4 Notes |
|-----|-----|--------|-------------|
| GAP-057-001 | Update spec status to `completed` | 1 min | Still needed |
| GAP-057-005 | Update 3 admin frontend imports to `*AdminSchema` | 10 min | Still needed |
| GAP-057-012 | Verify DestinationReview restore/hardDelete intent (IdSchema vs full entity) | 15 min | Reclassified: may be intentional (returns ID only after restore/delete) |
| GAP-057-020 | Fix Tag Zod schema: make `createdById`/`updatedById` nullable to match DB | 15 min | DB allows NULL, Zod says required |
| GAP-057-027 | Standardize .js extension in amenity/tag admin route imports | 10 min | New in Pass 4 |
| GAP-057-028 | Standardize OpenAPI tags in review admin routes | 5 min | New in Pass 4 |
| GAP-057-031 | Document review entities intentionally lack admin CREATE routes | 5 min | New in Pass 5 |

---

## Audit Methodology

### Pass 1 (2026-03-31)

4 specialized expert agents working in parallel:

1. **Schema Existence & Route Agent**: Verified all 6 target files, read all 16 admin list routes, checked all index.ts re-exports
2. **Pattern Consistency Agent**: Read all 16 access.schema.ts files, analyzed non-list admin routes, checked public/protected routes, searched frontend code
3. **Route Factory Agent**: Analyzed createAdminListRoute, createListRoute, createPaginatedResponse, ResponseFactory
4. **Field Verification Agent**: Read all base field spread definitions, verified every field in all 6 base schemas against spec claims

### Pass 2 (2026-03-31)

4 specialized expert agents working in parallel:

1. **Schema File Verification Agent**: Re-read ALL 16 access.schema.ts files, field-by-field comparison against base schemas, verified import types, JSDoc, patterns
2. **Route & Factory Audit Agent**: Read ALL 16 admin list routes, ALL non-list admin routes (discovered 24 routes using base schema), full route factory code-path analysis
3. **Frontend & Test Coverage Agent**: Searched entire apps/admin/ and apps/web/ for schema references, analyzed test coverage, verified TypeScript compilation
4. **Security & Architecture Agent**: Traced complete code path from handler to HTTP response, analyzed service layer column selection, built concrete attack scenario

### Pass 3 (2026-03-31)

5 specialized expert agents working in parallel (deeper scope than previous passes):

1. **Schema Field-by-Field Verifier**: Read ALL 6 new + 4 existing access.schema.ts files, ALL 6 base schemas, ALL 6 index.ts files, base field definitions. Verified per-entity field tables with nullability analysis. Found Tag non-nullable audit fields (GAP-057-020).
2. **Route Deep Audit Agent**: Read EVERY route file for all 6 entities (admin, public, protected). Complete route inventory with responseSchema mapping. Found DestinationReview restore/hardDelete bug (GAP-057-012).
3. **Response Pipeline Security Agent**: Complete 5-layer trace (DB → Service → Handler → Response Helper → HTTP). Quantified exposure at 98.2% of routes. Confirmed response-validator disabled in production. Found BaseModel SELECT * pattern.
4. **Test Coverage & Quality Agent**: Found OwnerPromotion zero coverage (GAP-057-013), Sponsorship gaps (GAP-057-014), zero access schema boundary tests (GAP-057-015). Analyzed admin-list-routes test structure. Evaluated spec's testing strategy claim.
5. **Cross-Entity Consistency & Architecture Agent**: Compared ALL 16 entity index.ts files, PublicSchema field philosophies, naming conventions, export chains, lifecycle patterns. Found EventOrganizer leak (GAP-057-016), userId privacy concern (GAP-057-017), directory naming (GAP-057-018), ProtectedSchema drift (GAP-057-019), lifecycle naming (GAP-057-021).

All agents independently confirmed SPEC-057 implementation is 100% compliant with its declared scope. All 21 gaps are beyond the spec's declared scope but directly related to the access schema system it introduces.

### Pass 4 (2026-03-31)

5 specialized expert agents working in parallel (fresh perspective, deeper architectural focus):

1. **Gap Status Verifier Agent**: Re-verified ALL 21 existing gaps against current codebase state. Read actual files for each gap. Found 3 status changes: GAP-012 reclassified (may be intentional), GAP-016/017 reassessed as product decisions, GAP-018 reassessed (kebab-case may be correct per file naming convention). Confirmed response-validator.ts uses `z.unknown()` for data fields (GAP-004 still critical).
2. **Admin Route Deep Audit Agent**: Analyzed ALL 16 admin list routes for factory usage, permission checks, pagination, response envelopes, import paths, error handling, middleware, registration, OpenAPI metadata. Found .js extension inconsistency (2/16 routes), OpenAPI tag naming inconsistency in review routes. Confirmed 100% consistency in factory usage, permissions, pagination, and error handling.
3. **Schema Architecture Analysis Agent**: Read ALL 6 base schemas, ALL 6 access schemas, ALL 6 CRUD schemas, ALL 6 index.ts files, 4 comparison entity access schemas, 6 DB schemas, and common/base schemas. Found CRITICAL DB-Zod mismatches (averageRating in AccommodationReview/DestinationReview, lifecycleState in AccommodationReview). Found missing query/HTTP/patch schemas. Verified ALL .pick() fields exist in base schemas. Confirmed zero usage of access schema types.
4. **Test Coverage & Quality Audit Agent**: Cataloged ALL test files for all 6 entities with line counts, test counts, and quality assessments. Confirmed OwnerPromotion zero tests, Sponsorship only admin-search, PostSponsor missing query tests. Found only 1/6 entities has dedicated API route tests. Analyzed admin-list-routes.test.ts structure (14 of 16 entities, 2 skipped due to Hono conflict).
5. **Security & Cross-Cutting Concerns Agent**: Traced complete request-response pipeline (DB → Service → Handler → Response Helper → HTTP). Confirmed NO runtime field filtering at any layer. Found 5 additional entities missing access schemas entirely (exchange-rate, postSponsorship, userBookmark, permission, revalidation). Verified export chain works, no circular deps, no type assertions, soft-delete protection present.

All agents confirmed SPEC-057 implementation remains 100% compliant with its declared scope. Pass 4 added 9 new gaps (GAP-057-022 through GAP-057-030), bringing the total to 30. The two most critical NEW findings are the DB-Zod schema mismatches (GAP-022/023) which represent data integrity issues.

### Pass 5 (2026-03-31)

4 specialized expert agents working in parallel (verification + fresh perspective):

1. **Access Schema File Audit Agent**: Re-read ALL 6 new access.schema.ts files field-by-field. Verified import type consistency, JSDoc completeness, AdminSchema alias pattern, PublicSchema .pick() fields, ProtectedSchema .pick() fields. Compared against ALL 6 base schemas for field accuracy. Verified ALL 10 existing access.schema.ts files for pattern consistency. Confirmed UserAdminSchema .extend() exception is documented.
2. **Index.ts & Export Chain Audit Agent**: Read ALL 6 target index.ts files, ALL 10 reference entity index.ts files, entities barrel index.ts, main package index.ts. Verified complete export chain from entity to @repo/schemas. Documented 4 distinct comment format variations across 16 entities: "Access level schemas (public, protected, admin)" (8), "Access control schemas" (2), "Access schemas" (3), "Access schemas (public, protected, admin)" (1). Confirmed all 21 entities properly exported from entities/index.ts.
3. **Admin List Route Audit Agent**: Read ALL 16 admin list route files. Verified ALL use AdminSchema as responseSchema. Verified ALL 6 target files have correct import statements. Documented complete non-list admin route inventory for all 6 entities. Found AccommodationReview/DestinationReview missing admin CREATE routes (GAP-057-031).
4. **Gaps & Edge Case Analysis Agent**: Analyzed ALL non-list admin routes, ALL public/protected routes, ALL base schemas, frontend admin imports, test files, and existing access schemas. Confirmed all 30 existing gaps still present. Verified DB-Zod mismatches from pass 4 still exist. Confirmed 5 additional entities still missing access schemas. Found review admin CREATE gap.

All agents confirmed SPEC-057 implementation remains 100% compliant with its declared scope. Pass 5 added 1 new gap (GAP-057-031), bringing the total to 31. All 30 prior gaps remain unfixed. This pass primarily served as a comprehensive verification that all previous findings are accurate and current.
