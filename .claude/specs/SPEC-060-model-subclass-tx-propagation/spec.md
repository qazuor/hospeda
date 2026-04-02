# SPEC-060: Model Subclass Transaction Propagation

> **Status**: draft
> **Priority**: P1
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-023, GAP-024, GAP-032, GAP-067, GAP-068)
> **Created**: 2026-04-01
> **Depends on**: SPEC-058

## Problem Statement

50+ custom model methods across all entity model subclasses call `getDb()` directly, bypassing any transaction context. When these methods are called within a transaction, they silently escape to the main connection pool, violating ACID guarantees.

Additionally, 5 `findWithRelations` overrides drop the `tx` parameter entirely, and narrow the `relations` type breaking Liskov Substitution Principle.

## Affected Models

| Model | Methods with bare `getDb()` | findWithRelations override |
|-------|----------------------------|---------------------------|
| AccommodationModel | countByFilters, search, searchWithRelations, findTopRated, updateStats | Yes (drops tx) |
| DestinationModel | findAllByAttractionId, searchWithAttractions, search, findChildren, findDescendants, findAncestors, findByPath, updateDescendantPaths, countByFilters | Yes (drops tx) |
| EventModel | - | Yes (drops tx) |
| SponsorshipModel | findActiveByTarget, findBySlug | Yes (drops tx) |
| PostSponsorshipModel | - | Yes (drops tx) |
| REntityTagModel | findAllWithTags, findAllWithEntities, findPopularTags | - |
| ExchangeRateModel | findLatestRate, findLatestRates, findRateHistory, findManualOverrides, findAllWithDateRange | - |
| RevalidationLogModel | deleteOlderThan, findWithFilters, findLastCronEntry | - |
| SponsorshipLevelModel | findBySlug | - |
| OwnerPromotionModel | findBySlug | - |
| RAccommodationAmenityModel | countAccommodationsByAmenityIds | - |

## Proposed Solution

For each method:

1. Add `ctx?: QueryContext` as last parameter (from SPEC-058 types)
2. Replace `getDb()` with `this.getClient(ctx?.tx)`
3. For `findWithRelations` overrides: match base class `relations` type (`Record<string, boolean | Record<string, unknown>>`)

## Acceptance Criteria

- [ ] ALL custom model methods accept `ctx?: QueryContext`
- [ ] ALL `getDb()` calls replaced with `this.getClient(ctx?.tx)`
- [ ] 5 `findWithRelations` overrides accept `tx` and use `this.getClient(tx)`
- [ ] `relations` parameter type matches base class in all overrides (LSP compliance)
- [ ] Existing callers compile without changes (ctx is optional)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

## Estimated Effort

3-5 days (mechanical but large scope: 50+ method signatures)

## Risks

- Large number of files touched. Use search-and-replace with manual verification.
- Some methods may have complex `getDb()` usage (subqueries, joins) that need careful conversion.

## Out of Scope

- Service-layer tx propagation (SPEC-059)
- BaseModel interface changes (SPEC-058)
