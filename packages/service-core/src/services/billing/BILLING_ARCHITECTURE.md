# Billing Services Architecture Analysis

SPEC-064 Phase 5 — BaseCrudService Alignment Analysis

This document evaluates whether any billing service should be migrated to extend
`BaseCrudService` instead of remaining as a standalone class or module-level
functions. The analysis is read-only: no code changes are made or recommended
as part of this phase.

---

## Summary Table

| Service | Current Shape | Recommendation | Migration Cost | Verdict |
|---|---|---|---|---|
| `BillingSettingsService` | Singleton class, 3 methods | Keep standalone | High | **Keep** |
| `promo-code.crud` | Standalone functions | Keep standalone | Medium | **Keep** |
| `addon-expiration.queries` | Pure query functions | Keep standalone | Very High | **Keep** |
| `addon-user-addons` | Pure query functions | Keep standalone | Very High | **Keep** |

All four services/modules should remain as-is. The rationale for each is
detailed in the sections below.

---

## What BaseCrudService Provides

`BaseCrudService` is a five-generic abstract class built on a mixin chain:

```
BaseService
  -> BaseCrudPermissions  (13 abstract permission hooks, abstract model/schemas)
    -> BaseCrudHooks      (10 before/after lifecycle hook pairs, default no-ops)
      -> BaseCrudRead     (getByField, getById, getBySlug, list, search, count, adminSearch)
        -> BaseCrudWrite  (create, update, softDelete, hardDelete, restore, updateVisibility, setFeaturedStatus)
          -> BaseCrudAdmin (getAdminInfo, setAdminInfo)
            -> BaseCrudService (public entry point)
```

A concrete service extending it must supply:

- `model` — a `BaseModel<TEntity>` Drizzle ORM instance
- `createSchema`, `updateSchema`, `searchSchema` — Zod schemas
- 11 abstract `_can*` permission hooks
- `_executeSearch` and `_executeCount` abstract methods
- `getDefaultListRelations()`

In exchange it gets: standardized CRUD with logging, permission enforcement,
lifecycle hooks, relation loading, `ServiceContext`/transaction propagation,
`hookState` for inter-hook communication, and `adminSearch`.

---

## Service 1: `BillingSettingsService`

**File:** `packages/service-core/src/services/billing/settings/billing-settings.service.ts`

### What it does

Manages a single global settings row in `billing_settings` (key-value table,
key = `'global'`). Exposes three methods: `getSettings`, `updateSettings`,
`resetSettings`. Every write is wrapped in a `withTransaction` that atomically
upserts the settings row and appends an audit log entry.

### What BaseCrudService would add

- Standardized `create` / `update` / `getById` / `list` / `softDelete` pipeline
- Actor-based permission hook enforcement
- Lifecycle hooks (`_beforeUpdate`, `_afterUpdate`, etc.)
- Structured logging via `runWithLoggingAndValidation`
- `ServiceContext` / transaction propagation (this service already does ctx
  propagation manually via `ctx?.tx ?? getDb()`)

### What would be lost or complicated

**There is no entity collection here.** The service manages exactly one row.
`BaseCrudService` is designed for multi-row entities identified by UUID, not for
singleton configuration objects. The misfit is structural:

- `TEntity` would need to be `BillingSettings`, but that type has no `id` or
  `deletedAt` — both are required by the generic constraint
  `TEntity extends { id: string; deletedAt?: Date | null }`.
- `list`, `search`, `count`, `softDelete`, `hardDelete`, `restore` are all
  meaningless for a singleton settings store. They would have to be overridden
  to throw "not supported" errors, adding noise without value.
- The key-value storage pattern (`billingSettings.key = 'global'`, JSONB `value`
  column) does not map to a `BaseModel<TEntity>`. A compliant model would need
  to be fabricated specifically to satisfy the generic.
- The service already implements its own validation (`validateSettings`), its own
  `withTransaction` boundary, and its own audit trail. All three are
  domain-specific concerns that BaseCrudService has no model for.
- The singleton pattern (`getBillingSettingsService`) is intentional: settings
  are read frequently and the instance is cheap to cache.

### Recommendation

**Keep standalone.** The `BillingSettingsService` class is the correct shape for
this domain. It is a configuration manager, not a CRUD resource. Forcing it into
`BaseCrudService` would add 11 no-op abstract method implementations and a
fabricated `BaseModel` wrapper just to satisfy the type contract, with zero
behavioral benefit.

---

## Service 2: `promo-code.crud`

**File:** `packages/service-core/src/services/billing/promo-code/promo-code.crud.ts`

### What it does

A module of six standalone exported functions:
`createPromoCode`, `getPromoCodeByCode`, `getPromoCodeById`, `updatePromoCode`,
`deletePromoCode`, `listPromoCodes`. Each function accepts an optional
`QueryContext` and calls `ctx?.tx ?? getDb()` for transaction enrollment.
All return the `{ success, data } | { success, error }` discriminated union.

There is also a `mapDbToPromoCode` mapper that converts the `QZPayBillingPromoCode`
DB row to the `PromoCode` response DTO.

### What BaseCrudService would add

- Actor-based permission hooks before every operation
- Lifecycle hooks (`_beforeCreate`, `_afterCreate`, etc.)
- Automatic Zod validation on inputs
- Structured logging
- `adminSearch` / paginated list with relations
- Consistent `ServiceOutput<T>` return types

### What would be lost or complicated

**The billing CRUD layer is designed to sit beneath a higher-level orchestration
layer**, not to be consumed directly by API routes carrying an `Actor`. The promo
code CRUD functions are intentionally thin, raw DB wrappers. They are called by
`promo-code.service.ts` (the orchestration module that holds the `Actor`,
applies business rules, and calls permission checks at a higher level).

Migrating to `BaseCrudService` would require:

- Defining a `BaseModel<PromoCode>` backed by `billingPromoCodes`. The existing
  table does not have a `deletedAt` column; "soft delete" is implemented as
  `active = false`. A compliant model would need to fabricate the `deletedAt`
  contract or the generic constraint would not be satisfied.
- Mapping the QZPay column naming conventions (`usedCount`, `validPlans`,
  `newCustomersOnly`) through a `BaseModel` adapter layer.
- Defining three separate Zod schemas (`createSchema`, `updateSchema`,
  `searchSchema`) that align with the QZPay DB shape instead of the existing
  `CreatePromoCodeInput` / `UpdatePromoCodeInput` / `ListPromoCodesFilters`
  types.
- The `livemode` flag on creation (passed via `options.livemode`) does not map
  to any `BaseCrudService` concept.
- The `codeSearch` filter (ILIKE on the code column) is a custom search
  dimension that would require a bespoke `_executeSearch` and `_executeCount`
  implementation anyway, removing the main value of the base class.
- `deletePromoCode` sets `active = false` rather than setting `deletedAt`. This
  semantic difference means `softDelete` from `BaseCrudService` would need to be
  completely overridden.

### Recommendation

**Keep standalone.** The current module-of-functions pattern is appropriate
for a low-level billing CRUD layer that is intentionally decoupled from the
permission/actor model. Migrating would produce a heavily overridden concrete
class that defeats the purpose of the base class while adding significant
structural complexity around a financial-critical module.

---

## Service 3: `addon-expiration.queries`

**File:** `packages/service-core/src/services/billing/addon/addon-expiration.queries.ts`

### What it does

Pure query functions for finding expired and about-to-expire addon purchases from
`billing_addon_purchases`. Exposes: `findExpiredAddons` and `findExpiringAddons`.
Also exports JSONB parsing helpers (`parseLimitAdjustments`,
`parseEntitlementAdjustments`) and the `BATCH_SIZE` constant used by the cron
job.

These functions are designed for background cron job consumption, not for
user-facing API routes.

### What BaseCrudService would add

- Virtually nothing useful. These are read-only, system-triggered queries.
  There are no actors, no permission checks, no create/update/delete operations,
  and no pagination in the `BaseCrudService` sense (the batch size is a memory
  safety cap, not a cursor-based pagination system).

### What would be lost or complicated

- The `status = 'active'` + `expiresAt <= now()` query logic is bespoke time-
  windowed filtering that does not map to any `BaseCrudService` `list` or
  `search` concept.
- `billing_addon_purchases` does not have a `deletedAt` column in a way that
  maps to the generic constraint. The `deletedAt IS NULL` filter is used as a
  safety guard, not as a soft-delete mechanism.
- These functions have no actor. `BaseCrudService` methods require an `Actor`
  argument for every read operation. Wrapping cron-triggered system operations
  inside actor-guarded CRUD pipelines would require fabricating a system actor
  or bypassing permission hooks — both patterns are anti-patterns in the
  existing codebase.
- The JSONB parsing helpers (`parseLimitAdjustments`, `parseEntitlementAdjustments`)
  and the `daysAheadSchema` Zod schema are utility exports unrelated to any CRUD
  concept. They belong in a query utilities module, not in a `BaseCrudService`
  subclass.
- The `BATCH_SIZE` constant is an operational guard for cron job memory safety.
  It has no equivalent in any `BaseCrudService` abstraction.

### Recommendation

**Keep standalone.** This module is a purpose-built cron job data access layer.
It is correct as standalone pure functions. Migrating it to `BaseCrudService`
would force an actor-based permission model onto a system operation, require
fabricating entity types that satisfy the generic constraints, and produce a
class with 11 abstract methods that all throw "not implemented" — a textbook
sign that the wrong base class is being used.

---

## Service 4: `addon-user-addons`

**File:** `packages/service-core/src/services/billing/addon/addon-user-addons.ts`

### What it does

Pure query functions for retrieving a user's active add-ons, checking if a
specific add-on is active, querying raw purchase records, and canceling a single
purchase. Also contains backward-compatibility logic for merging results from
subscription JSON metadata when the `billing_addon_purchases` table does not
have a row for a given addon slug.

Key functions: `queryUserAddons`, `queryAddonActive`,
`queryActiveAddonPurchases`, `cancelAddonPurchaseRecord`.

### What BaseCrudService would add

- Standard list/search/getById patterns
- Permission hooks and actor enforcement
- Lifecycle hooks

### What would be lost or complicated

- `queryUserAddons` accepts a `UserAddonBillingClient` interface (an injected
  billing API client), not just a DB context. This external dependency on a
  billing client abstraction is not a concept `BaseCrudService` can accommodate.
  There is no mechanism in the base class for injecting non-DB dependencies into
  query methods.
- The backward-compatibility logic (`parseMetadataAddons`) merges data from
  two sources: the `billing_addon_purchases` table and JSON metadata embedded in
  subscription records. This multi-source aggregation is fundamentally
  incompatible with the single-model assumption of `BaseCrudService`.
- `cancelAddonPurchaseRecord` updates `status = 'canceled'` rather than
  `deletedAt`. This is a domain-specific state transition, not a soft-delete.
  `BaseCrudService.softDelete` maps to setting `deletedAt`; overriding it
  completely would remove the base class value entirely.
- `queryActiveAddonPurchases` returns `ReadonlyArray<{ id, addonSlug }>` — a
  projection, not a full entity. `BaseCrudService` list operations return full
  `TEntity` instances.
- Like `addon-expiration.queries`, these functions are called by higher-level
  orchestration code that may or may not have an actor. Making the dependency on
  `Actor` mandatory (as the base class requires) would break call sites in the
  cron job and in service-to-service calls.

### Recommendation

**Keep standalone.** The multi-source aggregation, external billing client
injection, and status-based cancellation semantics are all fundamentally
incompatible with `BaseCrudService`. Forcing this module into the base class
would produce a class where every method is either fully overridden or
deliberately broken, providing no architectural benefit and increasing the
risk surface in a financial-critical module.

---

## General Conclusion

`BaseCrudService` is an excellent fit for entities that:

1. Are multi-row collections identified by UUID
2. Have a `deletedAt` column for soft-delete
3. Have a `BaseModel<TEntity>` backed by a Drizzle table
4. Are exposed to actor-aware API routes that carry user permissions
5. Follow the standard create/read/update/delete/list/search lifecycle

None of the four billing services in scope meets all five criteria. The billing
layer is characterized by:

- Singleton or quasi-singleton configuration (`BillingSettingsService`)
- QZPay-owned tables with non-standard column conventions
- System-triggered background operations without actors
- Multi-source aggregation from tables and JSON metadata
- Domain-specific state transitions (`active = false`, `status = 'canceled'`)
  that differ from the standard soft-delete contract

The correct architectural conclusion is that the billing layer intentionally
sits outside the `BaseCrudService` abstraction. This is not a gap — it is the
right design for financial-critical code that requires fine-grained transaction
control, clear separation between system operations and user-facing CRUD, and
minimal coupling to platform-level abstractions.
