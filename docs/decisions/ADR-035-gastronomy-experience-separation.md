# ADR-035: Gastronomy / Experience Separation from Accommodation (SPEC-239)

## Status

Accepted (2026-06-17). **Superseded by DEC-ARCH-012** (HOS-1352 program): the
single umbrella grouping this ADR was written around no longer exists. Gastronomy
and experience are two independent verticals, each with its own service, schemas,
owner role and subscription domain. This document is kept as history; the
principles that still hold are the vertical isolation and the `product_domain`
mechanism.

> **Update (HOS-688 / HOS-692 / HOS-695).** This ADR documents the SPEC-239-era
> design, where one shared plan carried a single shared `product_domain` value for
> both new verticals. HOS-688 later split billing into one subscription per owner
> per vertical (`gastronomy` / `experience`), and HOS-692/HOS-695 retired that
> shared value from `ProductDomainEnum` entirely: a row still carrying it
> satisfies neither vertical (see the root `CLAUDE.md`'s gastronomy and experience
> subscription isolation section). The design principles below (CORE vs. vertical
> separation, the `product_domain` isolation mechanism itself) still hold; the
> specific shared value they describe does not exist in production any more.

## Context

SPEC-239 introduces a new product surface, **paid gastronomy and experience
listings**, to the Hospeda monorepo. The first concrete vertical is Gastronomía
(restaurants, bars, cafés, etc.). A second vertical, Experiencias y Servicios,
follows in SPEC-240.

The cross-cutting challenge is to ship both the shared infrastructure ("the
CORE") and the first vertical ("GASTRO") in a single spec without coupling them
so tightly that SPEC-240 requires touching CORE internals. Several micro-decisions
emerged from the design session (2026-06-15) that needed to be locked before
implementation began.

The four areas requiring locked decisions were:

1. **How to separate shared CORE from vertical-specific GASTRO code.**
2. **How to integrate these listing subscriptions with the existing accommodation
   billing engine without corrupting host entitlements.**
3. **How the admin-sells flow works end-to-end (no merchant self-onboarding in
   v1).**
4. **What role and permissions model to use for listing owners.**

## Decision

### 1. Core / vertical code separation

A base listing service (in `packages/service-core/src/services/`) contains zero
gastronomy logic. `GastronomyService` extends it and adds only gastronomy-specific
fields (`type`, `priceRange`, `menuUrl`) plus its own junction-sync wiring for
amenity and feature relations.

Generic schemas, enums, and DB helpers live in CORE/common locations:

- Zod field-group spread-helpers (identity fields, `OpeningHoursSchema`, media
  fields, etc.) in `packages/schemas/src/common/`.
- Owner-edit permissions in `packages/schemas/src/enums/permission.enum.ts`.
- The owner role in `packages/schemas/src/enums/role.enum.ts`.

A generic admin Entity-shell config layer (`apps/admin/src/features/listing/`)
lets verticals register by config via `createListingListConfig`,
`createListingIdentitySection`, and `createListingOperationalSection`. No shell
fork is needed for a new vertical.

**Rationale.** SPEC-240 must be able to add Experiencias by writing only a new
service, new schemas, and new admin config, never by touching CORE internals. The
acceptance gate for that claim is the SPEC-240 reuse checklist in this ADR.

### 2. Binary subscription and `product_domain` isolation

One plan lived in `billing_plans` with its own shared `product_domain` value. That
plan was deliberately kept OUT of `ALL_PLANS` (the constant used to seed
`/api/v1/public/plans`) so that the plan catalog served to accommodation hosts
did not include it.

`billing_subscriptions.product_domain` isolates these subscriptions from the
accommodation entitlement engine. `loadEntitlements()` and the accommodation
start-paid / subscription-poll / webhook paths filter on
`product_domain = 'accommodation'`, so a host who is also a listing owner retains
correct accommodation entitlements and is not affected by the other subscription's
status. This isolation is regression-tested.

Listing **visibility** was driven by a thin **visibility reconciler**, a dedicated
function that checks whether an active subscription exists for a given listing.
Visibility is NOT routed through the entitlement merge. When the subscription
lapses the reconciler flips `lifecycleState` to `INACTIVE` and `visibility` to
`PRIVATE`; when it is restored they flip back. Data is never deleted.

The `product_domain` columns on `billing_plans` and `billing_subscriptions` were
originally added via the extras carril (hand-written idempotent SQL), since
`@qazuor/qzpay-drizzle` owned those tables and the columns could not be expressed
in the Hospeda Drizzle TS schema at the time. As of `@qazuor/qzpay-drizzle` 1.11.0
(HOS-73) they are typed Drizzle columns, accessed via normal typed queries
(HOS-75); the extras file that originally added them has been deleted. See
[docs/guides/migrations.md](../guides/migrations.md).

A link table (one row per listing, UNIQUE on `(entity_type, entity_id)`) tied each
active subscription to the concrete listing it covers. This table IS managed by
the Hospeda Drizzle schema.

> **Superseded in part by HOS-1084 (2026-09-03).** The table is now
> `entity_subscriptions` and serves all three verticals: `entity_type` accepts
> `'accommodation'` alongside `'gastronomy'` and `'experience'`, `subscription_id`
> is nullable (a `status = 'none'` row caches "this owner holds no subscription"),
> and a `plan_id` column lets a public read resolve entitlements without walking
> QZPay. Nothing about the isolation this ADR decided changed: the entitlement
> engine still counts only `'accommodation'` subscriptions, and
> `subscriptionMatchesDomain()` is still the only place that compares a domain.
> What changed is that accommodation now uses the same cache instead of resolving
> its owner's plan live on every public request.

### 3. Admin-sells flow

Merchants do not self-onboard in v1. The flow was:

1. A merchant fills a **public lead form** (no auth required) to express interest.
2. Admin reviews leads via a **lead inbox**.
3. After offline sales, admin provisions the owner, which creates a new owner user
   with a temporary password (`must_change_password = true`) and emails the
   credentials to the merchant.
4. Admin creates the gastronomy listing in the admin panel, assigning the
   provisioned user as owner.
5. Admin starts the subscription, which provisions a MercadoPago preapproval
   recurring subscription.
6. Active subscription triggers the visibility reconciler, and the listing becomes
   publicly visible.

The temporary password is generated server-side, passed to the notification port,
and **never** included in the HTTP response.

> The lead funnel and its endpoints were retired afterwards; gastronomy and
> experience owners now create their listings from the protected tier
> (`POST /api/v1/protected/gastronomies/` and `/experiences/`).

### 4. Listing-owner role and permissions

The listing owner is a **new role** and must not be confused with `HOST`. `HOST`
permissions are accommodation-scoped; reusing it would leak
`ACCOMMODATION_VIEW_OWN` and related permissions to gastronomy and experience
owners.

Granular `*_EDIT_OWN` operational permissions gate the owner-editable sections:

- hours: opening hours / schedule
- contact: contact info
- social: social network links
- media: photos and media
- menu: `menuUrl` and `priceRange`
- description: `richDescription`
- amenities: amenity and feature badge assignments
- faqs: FAQ management

Identity / core / lifecycle / subscription fields are admin-only and are rejected
server-side if an owner actor attempts to set them (the owner-update schema simply
does not include those fields; Zod strips them silently).

Forced owner-scoping mirrors the `ACCOMMODATION_VIEW_OWN` pattern introduced for
the `HOST` role in SPEC-169: an owner can view and edit only their own listing
via the protected tier.

---

## SPEC-240 Reuse Checklist (AC-9.2)

This section is the acceptance gate for the CORE/GASTRO separation. SPEC-240
(Experiencias y Servicios) MUST be deliverable by writing only the items in the
"ADDS" list below and MUST NOT touch any item in the "MUST NOT TOUCH" list.

### SPEC-240 ADDS (new vertical artifacts only)

- A new experience `type` / category enum value (or a separate enum if needed).
- `ExperienceService`, extending the base listing service. It adds only
  experience-specific fields and its own junction-sync tables. Zero modification
  to the base service.
- Experience schemas composed by spreading from the shared field-groups
  (identity fields, `OpeningHoursSchema`, media fields, etc.), exactly as
  `GastronomySchema` does.
- An admin `experiences` entity registered via `createListingListConfig` +
  `createListingIdentitySection` / `createListingOperationalSection` + one
  experience-specific section. No shell fork.
- Public `/experiencias` web pages (Astro listing + detail).

### SPEC-240 REUSES UNCHANGED

- The shared plan and its `product_domain` isolation.
- The owner provisioning route (lead `domain = 'experience'` is already a valid
  enum value).
- The visibility reconciler.
- The lead inbox with its `domain` filter.
- The owner role and all owner-edit permissions.
- The FAQ and review machinery (shared helpers and schema field-groups).
- The generic admin Entity shell and the listing config layer.

### SPEC-240 MUST NOT TOUCH

- The base listing service internals. It must not be modified to accommodate
  experience-specific logic.
- The visibility reconciler: no experience-specific branches.
- The `product_domain` isolation in the entitlement engine: no second shared
  domain value is introduced.
- The generic admin Entity shell: experience registers via config, not a fork.

---

## Consequences

- (+) SPEC-240 can add Experiencias with a single new service, schema files, and
  admin config entry. No CORE internals change.
- (+) `product_domain` isolation protects existing accommodation host entitlements
  from these subscriptions' state with zero refactoring of `loadEntitlements()`.
- (+) The admin-sells flow gives the platform full control over merchant
  onboarding in v1 while keeping the provisioning logic testable in isolation via
  injected ports.
- (+) Granular owner permissions give merchants operational autonomy without
  leaking accommodation-scoped permissions.
- (-) ~~The extras-carril `product_domain` columns are invisible to the Drizzle TS
  schema, meaning column presence cannot be type-checked at compile time. Mitigated
  by idempotent SQL + the `db:apply-extras` step in `hops db-migrate`.~~ Resolved by
  `@qazuor/qzpay-drizzle` 1.11.0 (HOS-73) / HOS-75: `product_domain` is now a typed,
  compile-time-checked Drizzle column on both tables.
- (-) The admin-sells flow means no self-service merchant onboarding in v1;
  deferred to a future spec when demand justifies it.
- (~) The link table (renamed `entity_subscriptions` by HOS-1084, which extended
  it to accommodation as well) adds a join on listing reads that need to check
  visibility. Acceptable at current scale.

## Alternatives Considered

### Single-table with JSONB for vertical-specific fields

Rejected. A single listings table with a JSONB `specifics` column would make it
impossible to add type-safe indexes or foreign keys on vertical-specific fields.
Separate tables with a shared service base is the established Hospeda pattern
(mirrors accommodation / destination / event).

### Reuse the `HOST` role for listing owners

Rejected. `HOST` carries `ACCOMMODATION_VIEW_OWN`, `BILLING_VIEW_OWN`, and other
accommodation-scoped permissions. Assigning it to a restaurant owner would grant
them read access to accommodation admin endpoints and pollute the entitlement
engine.

### Multi-domain entitlement refactor

Rejected. The entitlement engine is global-per-customer and accommodation-centric.
Refactoring it to be multi-domain would touch every billing route, every cron job,
and every entitlement test, a high-risk change orthogonal to shipping these
listings. The `product_domain` filter is the minimal, safe seam that achieves
isolation with no refactoring risk.

### Entitlement-based visibility (use `EntitlementKey` for listing visibility)

Rejected. Listing visibility is binary (subscription active = visible) and is a
different concept from plan-level feature entitlements. Routing it through the
entitlement merge would couple listing visibility to the accommodation billing
cycle and make the subscription invisible to the entitlement cache TTL. A
dedicated visibility reconciler is simpler and correct.

## Related Decisions

- [ADR-016](ADR-016-billing-fail-open.md): Billing fail-open policy. The
  visibility reconciler degrades gracefully (listing stays visible) on transient
  billing-check errors.
- [ADR-029](ADR-029-versioned-migration-strategy.md): Versioned migration
  strategy. The extras-carril `product_domain` columns follow the two-carriles
  rule documented there.
- [ADR-034](ADR-034-mobile-app-foundation.md): Mobile app foundation. The mobile
  client will consume the public gastronomy endpoints introduced here
  (`/api/v1/public/gastronomies/*`) once the mobile app is built.
