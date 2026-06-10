# ADR-030: Billing Catalog vs. Structural Definitions

## Status

Accepted (2026-06-04)

**Lineage**: formalises the boundary first drawn in SPEC-168
("Admin Plan Management") and completed by SPEC-192 ("Billing Catalog to DB").
Supersedes the boundary-related portions of [ADR-020](ADR-020-billing-plans-source-of-truth.md)
that predated SPEC-168.

## Context

SPEC-168 migrated plans, prices, and addons from static TypeScript config into
the database so operators can edit them at runtime without a redeploy.
SPEC-192 extended that migration to the remaining catalog entities: addon
definitions, plan-service mappings, and promo codes.

After both specs landed, `packages/billing/src/config/` still contained two
categories of exports that looked superficially similar but have fundamentally
different natures:

1. **DB-backed catalog** — plans, prices, addons, promo codes.
   Definitions that can be edited at runtime by an operator, seeded from code
   on first boot, and read back from the DB at request time.

2. **Code-level structural definitions** — `ENTITLEMENT_DEFINITIONS`,
   `LIMIT_METADATA`, `getDefaultEntitlements`, `getUnlimitedEntitlements`.
   Definitions that are inseparably coupled to TypeScript enums
   (`EntitlementKey`, `LimitKey`) and must stay in code.

Without a clear documented boundary, future contributors risk:

- Attempting to "complete the migration" by moving structural definitions to DB
  (would break type safety and exhausitiveness guarantees).
- Adding runtime-editable data back to code (would reintroduce the
  display-vs-charge mismatch problem ADR-020 was written to prevent).

A related question arose for `packages/service-core`: should `DEFAULT_PROMO_CODES`
(the private startup-path constant in `promo-code-defaults.ts`) move to
`packages/seed`? That was evaluated as part of SPEC-192 T-029 and rejected
(circular dependency risk). That decision is documented here for completeness.

### BETA-58 context

During SPEC-192, an idea was floated to relocate `ENTITLEMENT_DEFINITIONS` and
`LIMIT_METADATA` out of `packages/billing/src/config/` into a separate
sub-path (e.g. `src/structural/`) to make the boundary more visible in the
filesystem. This was rejected — see "Alternatives Considered" below.

## Decision

### 1. DB-backed catalog (runtime-editable, seeded from code)

The following entities live in the database and are seeded from `@repo/billing`
config on first boot:

| Entity | DB table | Seeder | Runtime source |
|--------|----------|--------|----------------|
| Plans | `billing_plans`, `billing_prices` | `billingPlans.seed.ts` | DB via `PlanService` |
| Addons | `billing_addons` | `billingAddons.seed.ts` | DB via `AddonCatalogService` |
| Promo codes | `billing_promo_codes` | `billingPromoCodes.seed.ts` | DB via `PromoCodeService` |
| Entitlement lookup | `billing_entitlements` | `billingEntitlements.seed.ts` | reflected from code |
| Limit lookup | `billing_limits` | `billingLimits.seed.ts` | reflected from code |

Seeding policy (established in SPEC-168): seeds are divergence-respecting.
A re-seed never overwrites runtime edits made via the admin panel. The code
config is the initial state, not an ongoing source of truth after first boot.

### 2. Code-level structural definitions (enum-coupled, must stay in code)

The following exports in `packages/billing/src/config/` are structural and
MUST NOT be moved to the database:

| Export | File | Reason |
|--------|------|--------|
| `ENTITLEMENT_DEFINITIONS` | `entitlements.config.ts` | Coupled to `EntitlementKey` enum; exhaustiveness checked by TypeScript |
| `LIMIT_METADATA` | `limits.config.ts` | `Record<LimitKey, ...>` — compile-time exhaustiveness against `LimitKey` |
| `getDefaultEntitlements()` | `plans.config.ts` | Returns typed `Pick<PlanDefinition, 'entitlements' \| 'limits'>` derived from enum values |
| `getUnlimitedEntitlements()` | `plans.config.ts` | Same — staff / admin fallback that mirrors `getDefaultEntitlements` shape |

These functions and constants appear in TypeScript generics, middleware type
signatures, and permission checks. Moving them to DB would replace compile-time
exhaustiveness with runtime string lookups, defeating the purpose of the enum
design.

The seeder reads `ENTITLEMENT_DEFINITIONS` and `LIMIT_METADATA` to populate
lookup tables (`billing_entitlements`, `billing_limits`) for use in admin UI
list views. Those lookup tables are a reflection of the code definitions, not
an independent authority.

### 3. Startup-only promo code constant in service-core

`DEFAULT_PROMO_CODES` in
`packages/service-core/src/services/billing/promo-code/promo-code-defaults.ts`
is a **private** constant (not exported). It exists in a `CreatePromoCodeInput`
shape (different from the `PromoCodeDefinition` shape in `@repo/billing`) and
is used exclusively by:

- `ensureDefaultPromoCodes()` — called once at API startup
- `getDefaultPromoCodeConfigs()` — read-only accessor for tests

Moving it to `packages/seed` was rejected because `packages/seed` already
imports from `packages/service-core`; inverting the dependency would create a
cycle. The constant stays in service-core, guarded by a JSDoc `@internal` tag
and a module banner documenting the scope constraint.

### 4. Location of structural definitions (T-030 decision)

No relocation within `packages/billing/src/`. `ENTITLEMENT_DEFINITIONS` and
`LIMIT_METADATA` remain in `src/config/` alongside the DB-backed catalog
configs. The boundary is enforced by JSDoc module banners (added in SPEC-192
T-030) rather than filesystem layout, because:

- All consumers import from the `@repo/billing` package barrel, not direct
  file paths. A move would churn only internal barrel files with no external
  benefit.
- The module banners provide the documentation exactly where a contributor
  would look when editing the files.

## Consequences

### Positive

- **Type safety preserved.** Structural definitions stay in TypeScript; enum
  exhaustiveness is caught at compile time. Adding a new entitlement or limit
  key is a compilation error until all switch/record sites are updated.
- **No drift risk.** DB-backed catalog items can diverge from code config by
  design (operators edit them). Structural definitions cannot drift because
  they are not stored anywhere else.
- **Clear contributor guidance.** JSDoc banners on both structural files explain
  why they are code-level and what would break if they were moved to DB.
- **Seeder contract is explicit.** The seeder reads structural definitions
  once to seed lookup tables; it never re-seeds or overwrites. This is
  documented in both the seeder files and here.

### Negative

- **Adding a new entitlement key requires a PR.** Operators cannot create new
  entitlement keys at runtime. This is intentional: new keys affect TypeScript
  generics, middleware, and permission checks — a code change and deploy are
  the correct path.
- **Two `DEFAULT_PROMO_CODES` names exist in the codebase.** The one in
  `@repo/billing` (`PromoCodeDefinition[]`) is the richer seeder-oriented
  format; the private one in `service-core` is the `CreatePromoCodeInput`
  startup format. They are not duplicates but the name collision can confuse.
  The module banners and `@internal` tag are the mitigation.

### Neutral

- The `billing_entitlements` and `billing_limits` lookup tables are populated
  by the seeder and used for admin UI display. They do not gate any runtime
  permission or limit check; those checks read `EntitlementKey` / `LimitKey`
  enum values directly.
- `ALL_PLANS` / `ALL_ADDONS` / `DEFAULT_PROMO_CODES` in `@repo/billing` remain
  as seed-time definitions. Post-seed, operators manage catalog via the admin
  panel; the code config is not re-read at request time.

## Alternatives Considered

### Move structural definitions to a `src/structural/` sub-path (BETA-58 idea)

Evaluated during SPEC-192 T-030. Rejected because:

1. All consumers import from the `@repo/billing` barrel, not `@repo/billing/config/...`.
   The move would not change a single consumer `import` statement.
2. The internal barrel churn (`src/config/index.ts` + `src/index.ts`) is pure
   overhead with no clarity benefit beyond what the module banners already provide.
3. The `src/config/` directory already groups all static configuration. The
   naming makes the category clear; the banners document the subcategory.

### Move `DEFAULT_PROMO_CODES` (service-core) to `packages/seed`

Evaluated during SPEC-192 T-029. Rejected because `packages/seed` imports from
`packages/service-core` (for `PromoCodeService`, `CreatePromoCodeInput`, etc.).
Moving the constant in the opposite direction would invert that dependency and
create a cycle. The `@internal` JSDoc tag is the designated guard instead.

### Store `ENTITLEMENT_DEFINITIONS` / `LIMIT_METADATA` in DB as authoritative

Rejected. These structures are inseparably tied to TypeScript enums. A DB-only
store would require a runtime string-to-enum lookup everywhere a permission or
limit check is evaluated, losing compile-time exhaustiveness. The seeder lookup
tables are a convenience mirror, not a replacement authority.

## References

- SPEC-168: Admin Plan Management (catalog-to-DB first wave)
- SPEC-192: Billing Catalog to DB (completion)
- [ADR-020](ADR-020-billing-plans-source-of-truth.md) — original code-only
  plan decision, superseded by SPEC-168
- `packages/billing/src/config/entitlements.config.ts` — module banner
- `packages/billing/src/config/limits.config.ts` — module banner
- `packages/service-core/src/services/billing/promo-code/promo-code-defaults.ts`
  — module banner + `@internal` tag
- `packages/seed/src/required/billingEntitlements.seed.ts`
- `packages/seed/src/required/billingLimits.seed.ts`
- `packages/seed/src/required/billingPromoCodes.seed.ts`
