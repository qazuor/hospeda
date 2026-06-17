# ADR-035: Commerce Core / Gastronomía Separation (SPEC-239)

## Status

Accepted (2026-06-17)

## Context

SPEC-239 introduces a new product surface — **paid commerce listings** — to the
Hospeda monorepo. The first concrete vertical is Gastronomía (restaurants, bars,
cafés, etc.). A second vertical, Experiencias y Servicios, will follow in
SPEC-240.

The cross-cutting challenge is to ship both the shared infrastructure ("the
CORE") and the first vertical ("GASTRO") in a single spec without coupling them
so tightly that SPEC-240 requires touching CORE internals. Several micro-decisions
emerged from the design session (2026-06-15) that needed to be locked before
implementation began.

The four areas requiring locked decisions were:

1. **How to separate shared CORE from vertical-specific GASTRO code.**
2. **How to integrate commerce subscriptions with the existing accommodation billing
   engine without corrupting host entitlements.**
3. **How the admin-sells flow works end-to-end (no merchant self-onboarding in
   v1).**
4. **What role and permissions model to use for commerce listing owners.**

## Decision

### 1. Core / vertical code separation

`BaseCommerceListingService` (in
`packages/service-core/src/services/commerce/`) contains zero gastronomy logic.
`GastronomyService extends BaseCommerceListingService` and adds only
gastronomy-specific fields (`type`, `priceRange`, `menuUrl`) plus its own
junction-sync wiring for amenity and feature relations.

Generic schemas, enums, and DB helpers live in CORE/common locations:

- Zod field-group spread-helpers (`BaseCommerceIdentityFields`,
  `OpeningHoursSchema`, `CommerceMediaFields`, etc.) in
  `packages/schemas/src/common/`.
- `COMMERCE_*` permissions in `packages/schemas/src/enums/permission.enum.ts`.
- The `COMMERCE_OWNER` role in `packages/schemas/src/enums/role.enum.ts`.

A generic admin Entity-shell config layer (`apps/admin/src/features/commerce/`)
lets verticals register by config via `createCommerceListConfig`,
`createCommerceIdentitySection`, and `createCommerceOperationalSection`. No
shell fork is needed for a new vertical.

**Rationale.** SPEC-240 must be able to add Experiencias by writing only a new
service, new schemas, and new admin config — never by touching CORE internals. The
acceptance gate for that claim is the SPEC-240 reuse checklist in this ADR.

### 2. Binary subscription and `product_domain` isolation

One commerce plan lives in `billing_plans` with `product_domain = 'commerce'`.
That plan is deliberately kept OUT of `ALL_PLANS` (the constant used to seed
`/api/v1/public/plans`) so that the plan catalog served to accommodation hosts
does not include it.

`billing_subscriptions.product_domain` isolates commerce subscriptions from the
accommodation entitlement engine. `loadEntitlements()` and the accommodation
start-paid / subscription-poll / webhook paths filter on
`product_domain = 'accommodation'`, so a host who is also a commerce owner
retains correct accommodation entitlements and is not affected by their commerce
subscription status. This isolation is regression-tested.

Listing **visibility** is driven by a thin **commerce-visibility reconciler** — a
dedicated function that checks whether an active commerce subscription exists for
a given listing. Visibility is NOT routed through the entitlement merge. When the
subscription lapses the reconciler flips `lifecycleState` to `INACTIVE` and
`visibility` to `PRIVATE`; when it is restored they flip back. Data is never
deleted.

The `product_domain` columns on `billing_plans` and `billing_subscriptions` are
added via the **extras carril** (hand-written idempotent SQL in
`packages/db/src/migrations/extras/017-billing-plans-product-domain.column.sql`)
because `@qazuor/qzpay-drizzle` owns those tables and they cannot be expressed in
the Hospeda Drizzle TS schema. See [docs/guides/migrations.md](../guides/migrations.md).

A `commerce_listing_subscriptions` link table (one row per listing, UNIQUE on
`(entity_type, entity_id)`) ties each active commerce subscription to the
concrete listing it covers. This table IS managed by the Hospeda Drizzle schema.

### 3. Admin-sells flow

Merchants do not self-onboard in v1. The flow is:

1. A merchant fills the **public lead form** (`POST /api/v1/public/commerce/leads`
   — no auth required) to express interest.
2. Admin reviews leads via the **lead inbox** (`GET /api/v1/admin/commerce/leads`,
   `POST /api/v1/admin/commerce/leads/:id/handle`).
3. After offline sales, admin calls
   `POST /api/v1/admin/commerce/leads/:id/provision-owner`, which creates a new
   `COMMERCE_OWNER` user with a temporary password (`must_change_password = true`)
   and emails the credentials to the merchant.
4. Admin creates the gastronomy listing in the admin panel, assigning the
   provisioned user as owner.
5. Admin starts the commerce subscription via
   `POST /api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription`
   which provisions a MercadoPago preapproval recurring subscription.
6. Active subscription triggers the visibility reconciler → listing becomes
   publicly visible.

The temporary password is generated server-side, passed to the notification port,
and **never** included in the HTTP response.

### 4. `COMMERCE_OWNER` role and permissions

`COMMERCE_OWNER` is a **new role** and must not be confused with `HOST`. `HOST`
permissions are accommodation-scoped; reusing it would leak
`ACCOMMODATION_VIEW_OWN` and related permissions to commerce owners.

Granular `COMMERCE_*_EDIT_OWN` operational permissions gate the owner-editable
sections:

- `COMMERCE_HOURS_EDIT_OWN` — opening hours / schedule
- `COMMERCE_CONTACT_EDIT_OWN` — contact info
- `COMMERCE_SOCIAL_EDIT_OWN` — social network links
- `COMMERCE_MEDIA_EDIT_OWN` — photos and media
- `COMMERCE_MENU_EDIT_OWN` — `menuUrl` and `priceRange`
- `COMMERCE_DESCRIPTION_EDIT_OWN` — `richDescription`
- `COMMERCE_AMENITIES_EDIT_OWN` — amenity and feature badge assignments
- `COMMERCE_FAQS_EDIT_OWN` — FAQ management

Identity / core / lifecycle / subscription fields are admin-only and are rejected
server-side if a `COMMERCE_OWNER` actor attempts to set them (the owner-update
schema simply does not include those fields — Zod strips them silently).

Forced owner-scoping mirrors the `ACCOMMODATION_VIEW_OWN` pattern introduced for
the `HOST` role in SPEC-169: a `COMMERCE_OWNER` can view and edit only their own
listing via the protected tier.

---

## SPEC-240 Reuse Checklist (AC-9.2)

This section is the acceptance gate for the CORE/GASTRO separation. SPEC-240
(Experiencias y Servicios) MUST be deliverable by writing only the items in the
"ADDS" list below and MUST NOT touch any item in the "MUST NOT TOUCH" list.

### SPEC-240 ADDS (new vertical artifacts only)

- A new experience `type` / category enum value (or a separate enum if needed).
- `ExperienceService extends BaseCommerceListingService` — adds only
  experience-specific fields and its own junction-sync tables. Zero modification
  to `BaseCommerceListingService`.
- Experience schemas composed by spreading from common commerce schema
  field-groups (`BaseCommerceIdentityFields`, `OpeningHoursSchema`,
  `CommerceMediaFields`, etc.) — exactly as `GastronomySchema` does today.
- An admin `experiences` entity registered via `createCommerceListConfig` +
  `createCommerceIdentitySection` / `createCommerceOperationalSection` + one
  experience-specific section. No shell fork.
- Public `/experiencias` web pages (Astro listing + detail).

### SPEC-240 REUSES UNCHANGED

- The single commerce plan (`product_domain = 'commerce'`).
- The `POST /api/v1/admin/commerce/leads/:id/provision-owner` provisioning route
  (lead `domain = 'experience'` is already a valid enum value).
- The commerce-visibility reconciler.
- The lead inbox (`GET /api/v1/admin/commerce/leads`) with `domain` filter.
- The `COMMERCE_OWNER` role and all `COMMERCE_*` permissions.
- The FAQ and review machinery (shared helpers and schema field-groups).
- The generic admin Entity shell and the commerce config layer.

### SPEC-240 MUST NOT TOUCH

- `BaseCommerceListingService` internals — the base class must not be modified to
  accommodate experience-specific logic.
- The commerce-visibility reconciler — no experience-specific branches.
- The `product_domain` isolation in the entitlement engine — no second domain
  value is introduced.
- The generic admin Entity shell — experience registers via config, not a fork.

---

## Consequences

- (+) SPEC-240 can add Experiencias with a single new service, schema files, and
  admin config entry. No CORE internals change.
- (+) `product_domain` isolation protects existing accommodation host entitlements
  from commerce subscription state with zero refactoring of `loadEntitlements()`.
- (+) The admin-sells flow gives the platform full control over merchant
  onboarding in v1 while keeping the provisioning logic testable in isolation via
  injected ports.
- (+) `COMMERCE_OWNER` granular permissions give merchants operational autonomy
  without leaking accommodation-scoped permissions.
- (-) The extras-carril `product_domain` columns are invisible to the Drizzle TS
  schema, meaning column presence cannot be type-checked at compile time. Mitigated
  by idempotent SQL + the `db:apply-extras` step in `hops db-migrate`.
- (-) The admin-sells flow means no self-service merchant onboarding in v1;
  deferred to a future spec when demand justifies it.
- (~) The `commerce_listing_subscriptions` link table adds a join on listing reads
  that need to check visibility — acceptable at current scale.

## Alternatives Considered

### Single-table with JSONB for vertical-specific fields

Rejected. A single `commerce_listings` table with a JSONB `specifics` column
would make it impossible to add type-safe indexes or foreign keys on
vertical-specific fields. Separate tables with a shared service base is the
established Hospeda pattern (mirrors accommodation / destination / event).

### Reuse the `HOST` role for commerce owners

Rejected. `HOST` carries `ACCOMMODATION_VIEW_OWN`, `BILLING_VIEW_OWN`, and other
accommodation-scoped permissions. Assigning it to a restaurant owner would grant
them read access to accommodation admin endpoints and pollute the entitlement
engine.

### Multi-domain entitlement refactor

Rejected. The entitlement engine is global-per-customer and accommodation-centric.
Refactoring it to be multi-domain would touch every billing route, every cron job,
and every entitlement test — a high-risk change orthogonal to shipping commerce
listings. The `product_domain` filter is the minimal, safe seam that achieves
isolation with no refactoring risk.

### Entitlement-based visibility (use `EntitlementKey` for listing visibility)

Rejected. Commerce listing visibility is binary (subscription active = visible)
and is a different concept from plan-level feature entitlements. Routing it
through the entitlement merge would couple listing visibility to the
accommodation billing cycle and make the commerce subscription invisible to the
entitlement cache TTL. A dedicated visibility reconciler is simpler and correct.

## Related Decisions

- [ADR-016](ADR-016-billing-fail-open.md) — Billing fail-open policy. The
  commerce-visibility reconciler degrades gracefully (listing stays visible) on
  transient billing-check errors.
- [ADR-029](ADR-029-versioned-migration-strategy.md) — Versioned migration
  strategy. The extras-carril `product_domain` columns follow the two-carriles
  rule documented there.
- [ADR-034](ADR-034-mobile-app-foundation.md) — Mobile app foundation. The mobile
  client will consume the public gastronomy endpoints introduced here
  (`/api/v1/public/gastronomies/*`) once the mobile app is built.
