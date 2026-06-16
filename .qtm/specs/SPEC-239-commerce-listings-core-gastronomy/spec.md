---
spec-id: SPEC-239
title: Commerce listing core (merchant-with-subscription) + Gastronomía
type: feature
complexity: high
status: in-progress
created: 2026-06-15T00:00:00Z
tags:
  - commerce
  - gastronomy
  - billing
  - subscription
  - mercadopago
  - core
  - web
  - admin
  - reviews
  - faqs
---

# SPEC-239 — Commerce listing core (merchant-with-subscription) + Gastronomía

## Overview

**Goal.** Introduce a new product surface to Hospeda: **paid commerce listings**
("comercio-con-suscripción"). A merchant (e.g. a restaurant) gets a public **ficha**
on Hospeda that is **visible only while a binary subscription is active**. The
merchant does **not** self-onboard — Hospeda **admin sells and creates** the
listing; the merchant owner then logs in and edits **only operational fields**.

This is the **foundational** spec of a two-spec family. It must ship **two cleanly
separated things**:

- **(A) THE SHARED CORE** — a reusable code layer ("comercio-con-suscripción"):
  a `BaseCommerceListingService` (extends `BaseCrudService`), shared base Zod
  schemas (composed via spread), shared admin Entity shells, a **binary
  subscription sub-system** (one plan, MercadoPago preapproval recurring, reusing
  the existing billing/QZPay machinery), an **admin-sells flow** (lead form →
  admin creates user + entity → emailed credentials → forced password change), and
  a generic **`COMMERCE_OWNER`** role with granular operational-only permissions.
  SPEC-240 (Experiencias y Servicios) will reuse this core **without** re-deriving
  it.

- **(B) GASTRONOMÍA** — the **first concrete consumer** that proves the core:
  a `gastronomies` table, a `GastronomyService extends BaseCommerceListingService`,
  a public section at `/gastronomia` (Astro listing + detail), admin CRUD, reviews,
  FAQs, structured opening hours, amenities/features, destination.

**Key separation discipline.** Every artifact in this spec is tagged **CORE**
(reusable, lives in shared locations / generic base classes) or **GASTRO**
(gastronomy-specific). SPEC-240 must be able to add "Experiencias" by writing only
GASTRO-equivalent artifacts plus one new subscription `productDomain` value — never
by touching CORE internals. This is an acceptance gate, not just a guideline.

**Billing posture (locked).** Binary, single-plan, MercadoPago preapproval
recurring. We **add a `product_domain` column to `billing_subscriptions`** so the
existing accommodation entitlement engine **IGNORES** non-accommodation
subscriptions. We do **NOT** refactor the global-per-customer entitlement engine
to be multi-domain. Subscription active ⇒ ficha visible; expired/cancelled ⇒ ficha
hidden (lifecycle/visibility flips), data preserved.

**Why no entitlement refactor.** The Explore session confirmed the entitlement
engine is global-per-customer and accommodation-centric (`loadEntitlements()` picks
the active subscription, merges accommodation-keyed entitlements). A merchant
subscription that the engine *doesn't filter out* would corrupt a host's
accommodation entitlements. The `product_domain` filter is the minimal, safe seam:
the accommodation engine selects only `product_domain = 'accommodation'`
subscriptions; commerce visibility is decided by a **separate, dead-simple
"is there an active commerce subscription for this listing" check** — not by the
entitlement merge.

## Locked design decisions (from owner design session "panel 1.1", 2026-06-15)

1. **Model = admin-sells-and-creates** (NOT host self-service). Flow: public web
   lead form ("Publicá tu restaurante") → admin contacts/sells offline → admin
   creates a commerce user + the entity from the admin panel → email with
   credentials → **force password change on first login** → owner logs in and edits
   **only operational fields**.
2. **Billing = BINARY.** One plan. **Active subscription = ficha visible.**
   MercadoPago **preapproval recurring**, reusing the existing MP/QZPay machinery
   (`apps/api/src/routes/billing/start-paid.ts`, `packages/billing`,
   `packages/db/src/billing`).
3. **Mark the domain on `billing_subscriptions`** (`product_domain`) so the
   **accommodation entitlement engine IGNORES** commerce subscriptions. **NO
   multi-domain entitlement refactor.**
4. **Separate tables + shared CODE sub-systems.** Project pattern:
   `BaseCommerceListingService extends BaseCrudService`, base schemas composed via
   spread, shared admin Entity shells. **NOT single-table, NOT JSONB-for-specifics.**
5. **Owner edits operational only**: schedule, contact, social, media, menu, short
   description. **Admin controls identity/core**: name, slug, summary/description,
   location, destination, `type`, subscription data, lifecycle/visibility/moderation,
   featured.
6. **Generic role `COMMERCE_OWNER`** with granular operational permissions (a NEW
   role; do NOT overload `HOST`, whose permissions are accommodation-scoped). Owner
   gets `COMMERCE_*_EDIT_OWN`-style section permissions limited to operational
   fields.
7. **Shared entity shape** (reused by SPEC-240): identity (name/slug/summary/
   description/richDescription/i18n), destination many-to-one (RESTRICT), media,
   contactInfo, socialNetworks, structured opening hours (by day, with shifts),
   polymorphic-per-entity amenities/features, reviews (moderated, rating JSONB +
   `averageRating`/`reviewsCount` denormalized), FAQs (`display_order`,
   owner-editable), moderation/lifecycle/visibility/featured.
8. **Gastronomía specifics**: `type` enum (RESTAURANT/BAR/CAFE/PARRILLA/CERVECERIA/
   HELADERIA/PANADERIA/ROTISERIA/FOOD_TRUCK…), `priceRange` enum
   (BUDGET/MID/HIGH/PREMIUM = $-$$$$), `menuUrl` (external link or PDF URL). Cuisine
   & services are **amenity/feature badges**, NOT a second rigid enum. Public route
   `/gastronomia`.
9. **Tarjeta-Hospeda coupling deferred.** In v1 the subscription only grants ficha
   visibility. A "being in the card" hook is implemented in **SPEC-D** (Tarjeta).
   This spec must not implement card adhesion, only keep the boundary clean.

## Baseline (current state vs `origin/staging`, verified 2026-06-15)

- **No commerce/gastronomy entity exists.** No `gastronomies` table, no
  `/gastronomia` route, no commerce service/schemas.
- **Accommodation is the pattern to mirror** across all four layers:
  - Schemas: `packages/schemas/src/entities/accommodation/` — `.schema`, `.crud`,
    `.http`, `.query`, `.access`, `.admin-search`, `.options`, `.relations`,
    `.batch` files; `subtypes/` for faq/rating/feature/amenity. Composition is by
    **spreading `Base*Fields` const objects** into a `z.object` (no `.merge()`):
    `BaseAuditFields`, `BaseLifecycleFields`, `BaseModerationFields`,
    `BaseVisibilityFields`, `BaseReviewFields`, `BaseSeoFields`, `BaseContactFields`,
    `SocialNetworkFields`, `AccommodationEntityMediaFields`, `BaseAdminFields`,
    `TagsFields`. Shared common schemas live in `packages/schemas/src/common/`
    (`contact.schema.ts`, `social.schema.ts`, `media.schema.ts`, `review.schema.ts`,
    `lifecycle.schema.ts`, `moderation.schema.ts`, `audit.schema.ts`, `seo.schema.ts`,
    `faq.schema.ts` [`BaseFaqSchema`], `admin-search.schema.ts`
    [`AdminSearchBaseSchema`]). Enums under `packages/schemas/src/enums/`.
  - Service: `packages/service-core/src/services/accommodation/` —
    `accommodation.service.ts` (extends `BaseCrudService<Entity, Model, Create,
    Update, Search>`), `.permissions.ts` (all `checkCan*` use
    `hasPermission(actor, PermissionEnum.XXX)` — **NEVER role checks**),
    `.junction-sync.ts` (`syncAmenityJunction`/`syncFeatureJunction` inside
    `withServiceTransaction`; `undefined`=no-op, `[]`=clear, `[ids]`=sync),
    `.projections.ts` (public-tier projection / location privacy),
    `.normalizers.ts`, `.helpers.ts`, `.types.ts` (`HookState`). Lifecycle hooks:
    `_beforeCreate/_afterCreate/_beforeUpdate/_afterUpdate/_afterGetByField/
    _afterList/_afterSearch/_executeAdminSearch`. Returns `ServiceOutput<T>`
    (`Result<T>` style).
  - API: `apps/api/src/routes/accommodation/` — `public/`, `protected/`, `admin/`,
    `reviews/{public,protected,admin}/` sub-dirs, each file = one endpoint, an
    `index.ts` per tier re-exports. Route factories from
    `apps/api/src/utils/route-factory.ts`: `createPublicRoute`,
    `createProtectedRoute`, `createAdminRoute`/`createAdminListRoute`,
    `createSimpleRoute`, `createOpenApiRoute`/`createCRUDRoute`. Admin routes pass
    `requiredPermissions: [PermissionEnum.XXX]`. `ResponseFactory` for responses.
  - DB: `packages/db/src/schemas/accommodation/` — `accommodation.dbschema.ts`
    (uuid PK `defaultRandom`, slug unique, jsonb for contact/social/media/seo/
    schedule/admin_info, pg enums for type/visibility/lifecycle/moderation,
    `is_featured`, `owner_id`/`destination_id` FK **`onDelete: 'restrict'`**,
    `reviews_count` int default 0, `average_rating` numeric(3,2) mode number,
    full audit + soft-delete `deleted_at`, many indexes),
    `accommodation_review.dbschema.ts` (FK accommodation cascade, userId set-null,
    `rating` jsonb, `average_rating` numeric, `moderation_state` default `'APPROVED'`,
    UNIQUE(userId, accommodationId)), `accommodation_faq.dbschema.ts` (`display_order`
    int nullable, FK cascade), `r_accommodation_amenity`/`r_accommodation_feature`
    (composite-PK **per-entity** junctions, both FK cascade).
- **Billing.** `billing_subscriptions` comes from `@qazuor/qzpay-drizzle`
  (re-exported via `packages/db/src/billing/`). Columns include `status`,
  `cancelAtPeriodEnd`, `mpSubscriptionId` (MP preapproval id, NULL for annual),
  `plan_id` (varchar storing the plan UUID). **No `product_domain` column today.**
  `billing_plans.id` is UUID; `metadata.category` ∈ {`owner`,`complex`,`tourist`}.
  Entitlement engine (`loadEntitlements()`) is global-per-customer,
  accommodation-keyed, 5-min cache. Start-paid: `start-paid.ts` →
  `initiatePaidMonthlySubscription` (MP preapproval) / `initiatePaidAnnualSubscription`
  (MP Checkout preference); guarded by `idempotencyKeyMiddleware`.
- **Roles/permissions.** `packages/schemas/src/enums/role.enum.ts` (`SUPER_ADMIN`,
  `ADMIN`, `CLIENT_MANAGER`, `EDITOR`, `HOST`, `SPONSOR`, `USER`, `GUEST`, `SYSTEM`
  — **no `COMMERCE_OWNER`**). `packages/schemas/src/enums/permission.enum.ts`
  (`PermissionEnum` + `PermissionCategoryEnum`). Seed mapping in
  `packages/seed/src/required/rolePermissions.seed.ts`. HOST permissions are
  accommodation-scoped (`ACCOMMODATION_*_OWN`, `ACCESS_PANEL_ADMIN`,
  `BILLING_VIEW_OWN`, …).
- **Better Auth.** `apps/api/src/lib/auth.ts`. **No `mustChangePassword` /
  force-password-change mechanism exists** (grep returned zero). Must be built.

---

## Domain model (entities + fields)

> Legend: **[CORE]** = lives in a shared location / generic base, reused by
> SPEC-240. **[GASTRO]** = gastronomy-specific.

### Shared base field groups **[CORE]** — `packages/schemas/src/common/`

A new spread-helper bundle, mirroring accommodation's composition, captures the
fields every commerce listing shares. Reuse existing common helpers where they
already exist; add commerce-only ones:

- Reuse: `BaseAuditFields`, `BaseLifecycleFields`, `BaseModerationFields`,
  `BaseVisibilityFields`, `BaseReviewFields` (averageRating + reviewsCount),
  `BaseSeoFields`, `BaseContactFields`, `SocialNetworkFields`, `BaseAdminFields`,
  `TagsFields`, `BaseFaqSchema`.
- **New [CORE]** `OpeningHoursSchema` + `OpeningHoursFields` —
  `packages/schemas/src/common/opening-hours.schema.ts`. Structured weekly hours:

  ```
  OpeningHoursSchema = z.object({
    timezone: z.string().optional(),                 // default America/Argentina/Buenos_Aires
    days: z.object({
      mon | tue | wed | thu | fri | sat | sun: z.object({
        closed: z.boolean().default(false),
        shifts: z.array(z.object({                   // 0..n shifts per day
          open:  HHmm,                               // "12:00"
          close: HHmm                                // "15:30"
        }))
      })
    }),
    notes: z.string().optional(),                    // "Feriados cerrado", etc.
    notesI18n: I18nText.optional()
  })
  ```

  (Accommodation has a raw `schedule` jsonb with no typed schema; this CORE schema
  is the typed home commerce listings + a future accommodation migration can adopt.)
- **New [CORE]** `CommerceIdentityFields` — `name`, `slug`, `summary`,
  `description`, `richDescription`, plus the matching `*I18n` jsonb fields and
  `translationMeta`. (Same shape as accommodation identity.)

### Entity: `gastronomies` **[GASTRO]** (table) + `GastronomySchema`

| Field | Type | Tier visibility | Editable by | Notes |
| --- | --- | --- | --- | --- |
| `id` | uuid PK | all | system | `defaultRandom()` |
| `name` | text notNull | public | **admin** | identity (core) |
| `slug` | text unique notNull | public | **admin** | generated from name |
| `summary` | text notNull | public | **admin** | |
| `description` | text notNull | public | **admin** | |
| `richDescription` | text nullable | public | **owner** | operational long copy |
| `*I18n` (name/summary/description/richDescription) | jsonb I18nText | public | mixed | translation |
| `type` | `GastronomyTypePgEnum` notNull | public | **admin** | RESTAURANT/BAR/… |
| `priceRange` | `PriceRangePgEnum` nullable | public | **owner** | BUDGET/MID/HIGH/PREMIUM |
| `menuUrl` | text nullable | public | **owner** | link or PDF URL (https-validated) |
| `contactInfo` | jsonb ContactInfo | protected | **owner** | shared schema |
| `socialNetworks` | jsonb SocialNetwork | public | **owner** | shared schema |
| `openingHours` | jsonb OpeningHours | public | **owner** | CORE typed schema |
| `media` | jsonb Media | public | **owner** | shared schema |
| `seo` | jsonb Seo | — | admin | shared schema |
| `adminInfo` | jsonb AdminInfo | admin | admin | |
| `destinationId` | uuid FK→destinations RESTRICT | public (city) | **admin** | many-to-one |
| `ownerId` | uuid FK→users RESTRICT | protected | system | the COMMERCE_OWNER user |
| `isFeatured` | boolean default false | public | admin | |
| `visibility` | `VisibilityPgEnum` default PUBLIC | — | admin (+ system) | flipped by subscription |
| `lifecycleState` | `LifecycleStatusPgEnum` default DRAFT | — | admin (+ system) | DRAFT until subscription active |
| `moderationState` | `ModerationStatusPgEnum` default PENDING | — | admin | |
| `reviewsCount` | integer default 0 | public | system | denormalized |
| `averageRating` | numeric(3,2) default 0 | public | system | denormalized |
| `tags` | TagsFields | public | admin | |
| audit + `deletedAt` | | — | system | soft delete |

### `gastronomy_reviews` **[GASTRO, mirrors CORE pattern]**

`id`, `gastronomyId` FK→gastronomies cascade, `userId` FK→users set-null,
`title` nullable, `content` nullable, `rating` jsonb (commerce rating breakdown —
see below), `averageRating` numeric(3,2), `lifecycleState` default ACTIVE,
`moderationState` default **`PENDING`** (commerce reviews are moderated — owner does
NOT control identity; rationale: external diners, abuse risk), `moderatedById`,
`moderatedAt`, `moderationReason`, full audit, `adminInfo`. UNIQUE(`userId`,
`gastronomyId`). Indexes: gastronomyId, userId, unique, lifecycleState,
(gastronomyId, lifecycleState), moderationState.

> **CORE rating breakdown** `CommerceRatingSchema` —
> `packages/schemas/src/common/commerce-rating.schema.ts`:
> `{ food, service, ambiance, value }` (each 0–5). SPEC-240 reuses the same four
> dimensions (renaming is a micro-decision; default: keep generic).

### `gastronomy_faqs` **[GASTRO, mirrors CORE pattern]**

`id`, `gastronomyId` FK cascade, `question` notNull, `answer` notNull, `category`
nullable, `display_order` int nullable (backfill from createdAt; NULLS LAST read
order — same as accommodation), `lifecycleState` default ACTIVE, `adminInfo`, audit.
**Owner-editable** (operational). Indexes: gastronomyId, category.

### Junctions **[GASTRO, per-entity]**

`r_gastronomy_amenity` (composite PK `(gastronomyId, amenityId)`, FK cascade) +
`r_gastronomy_feature` (composite PK `(gastronomyId, featureId)`, FK cascade). These
reuse the **existing** `amenities` / `features` catalog tables (cuisine & services
are modeled as amenity/feature badges, per decision 8). No new catalog tables.

> **CORE note.** The junction *pattern* (per-entity composite-PK tables + a generic
> `syncAmenityJunction`/`syncFeatureJunction` parametrized by table) is shared.
> SPEC-240 adds `r_experience_amenity`/`r_experience_feature` and reuses the same
> sync helper signature.

### Subscription marker **[CORE]** — `billing_subscriptions.product_domain`

Additive **`product_domain` varchar(32) NOT NULL DEFAULT 'accommodation'** column on
`billing_subscriptions` (or the closest hand-managed supplement if the column lives
in the qzpay library schema — see Technical Approach → Billing). Values:
`'accommodation'` | `'commerce'`. (SPEC-240 does **not** add a value — both gastro
and experiencias are `'commerce'`; the listing entity itself disambiguates which
ficha the subscription belongs to via a `commerce_listing_ref`, see below.)

### Subscription ↔ listing link **[CORE]**

A binary commerce subscription must point at the listing it makes visible. Add a
**CORE link table** `commerce_listing_subscriptions`:
`id`, `subscriptionId` (FK→billing_subscriptions), `productDomain` ('commerce'),
`entityType` (`'gastronomy'` | `'experience'` — extensible), `entityId` (uuid, the
gastronomy/experience id), `status` (mirror of subscription status for fast reads),
`createdAt`/`updatedAt`. UNIQUE(`entityType`, `entityId`). This keeps the qzpay
subscription generic while giving commerce a clean, indexed "is this listing paid?"
lookup that the accommodation engine never touches.

---

## User Stories & Acceptance Criteria

### US-1 [CORE] — Public lead form: "Publicá tu restaurante"

GIVEN a prospective merchant on the public web,
WHEN they submit the lead form (business name, contact name, email, phone,
destination/city, message),
THEN a lead record is stored and the Hospeda team is notified; **no account and no
listing are created** by this action.

- **AC-1.1** Public unauthenticated endpoint accepts the lead; validated by a Zod
  schema; rate-limited / spam-guarded (honeypot or basic throttle).
- **AC-1.2** A notification (email to the ops inbox) fires via `@repo/notifications`.
- **AC-1.3** Leads are listable in admin (simple list, no full CRUD UI required in
  v1 — read + mark-handled).
- **AC-1.4** The form copy is generic enough to be reused by SPEC-240
  ("Publicá tu experiencia") — the lead schema carries a `domain` discriminator
  (`'gastronomy'` default here).

### US-2 [CORE] — Admin creates the commerce owner user + the listing

GIVEN an admin who sold a subscription offline,
WHEN they create the listing from the admin panel,
THEN they (a) create or pick a `COMMERCE_OWNER` user, (b) create the gastronomy
entity with identity/core fields, (c) the system emails the owner credentials, and
(d) the owner is flagged to change the password on first login.

- **AC-2.1** Admin sets identity/core fields: name, slug, summary, description,
  `type`, destination, location, featured, lifecycle/visibility/moderation.
- **AC-2.2** Creating a NEW owner provisions a `users` row with role
  `COMMERCE_OWNER`, a temporary password, and `must_change_password = true`.
- **AC-2.3** An email with credentials + a login link is sent via
  `@repo/notifications` (i18n es/en/pt).
- **AC-2.4** The listing starts in `DRAFT`/non-public until a subscription is
  active (US-4).
- **AC-2.5** Admin can reassign the owner of an existing listing.

### US-3 [CORE] — Force password change on first login

GIVEN a freshly provisioned `COMMERCE_OWNER` with `must_change_password = true`,
WHEN they log in with the temporary credentials,
THEN they are redirected to a "set a new password" screen and **cannot reach any
edit surface** until the password is changed; afterwards the flag clears.

- **AC-3.1** A `must_change_password` boolean column on `users` (default false).
- **AC-3.2** A Better-Auth-integrated gate (session hook or `beforeLoad`/middleware)
  blocks every protected route except the change-password endpoint while the flag
  is true. (Validate Better Auth native support first; otherwise build the flag +
  gate — baseline confirms it does not exist.)
- **AC-3.3** A protected change-password endpoint clears the flag on success and
  enforces the password policy (min length, etc.).
- **AC-3.4** Regression test: a flagged user hitting any other protected route gets
  redirected/403 with a clear `code`.

### US-4 [CORE] — Binary subscription gates ficha visibility

GIVEN a created listing with an owner,
WHEN the admin (or owner via checkout) starts the single commerce plan and the
MercadoPago preapproval becomes active,
THEN the listing flips to publicly visible; WHEN the subscription
expires/cancels/fails dunning, the listing flips hidden (data preserved).

- **AC-4.1** One commerce plan exists (MP preapproval recurring), reusing the
  existing start-paid machinery. The subscription row carries
  `product_domain = 'commerce'`.
- **AC-4.2** A `commerce_listing_subscriptions` link row ties the subscription to
  the gastronomy id (UNIQUE per entity).
- **AC-4.3** **Active** subscription ⇒ listing eligible for public visibility
  (`visibility=PUBLIC`, `lifecycleState=ACTIVE`). **Not active** ⇒ listing hidden
  (public endpoints return 404; admin still sees it).
- **AC-4.4** The accommodation entitlement engine **never** sees this subscription:
  `loadEntitlements()` and the accommodation start-paid/poll/webhook paths filter
  `product_domain = 'accommodation'`. A host who is also a commerce owner keeps
  correct accommodation entitlements (**regression test required**).
- **AC-4.5** Visibility flips are driven by the **subscription lifecycle**
  (webhook + the existing dunning/finalize crons), via a thin commerce-visibility
  reconciler — NOT by the entitlement merge.

### US-5 [CORE] — Owner edits operational fields only

GIVEN an authenticated `COMMERCE_OWNER` who owns a listing,
WHEN they open the edit surface,
THEN they can edit ONLY: opening hours, contactInfo, socialNetworks, media,
`menuUrl`, `priceRange`, `richDescription`, amenities/features, and FAQs — and
CANNOT change name, slug, summary, description, `type`, destination, location,
lifecycle/visibility/moderation, featured, or subscription data.

- **AC-5.1** Granular `COMMERCE_*_EDIT_OWN` permissions gate each operational
  section; identity/core sections are not exposed to the owner and are server-side
  rejected if forged.
- **AC-5.2** A non-owner `COMMERCE_OWNER` editing another listing gets 403/404
  (forced owner scoping, mirroring `ACCOMMODATION_VIEW_OWN`).
- **AC-5.3** Admin (`ADMIN`/`SUPER_ADMIN`) can edit everything via admin routes.

### US-6 [GASTRO] — Public `/gastronomia` listing + detail

GIVEN any visitor,
WHEN they open `/gastronomia`,
THEN they see a listing of **visible** gastronomies (active subscription), filterable
by destination/type/priceRange/amenities, and each detail page shows identity,
hours, contact, social, media, menu link, amenities/features, FAQs, reviews,
averageRating.

- **AC-6.1** Listing paginated, filter by `destinationId`, `type`, `priceRange`,
  amenity/feature ids; sort by rating/name.
- **AC-6.2** Only listings with an active subscription appear (hidden ones 404 on
  detail too).
- **AC-6.3** Detail renders structured opening hours (today highlighted), menu link,
  amenities/features badges, FAQs, reviews block + averageRating.
- **AC-6.4** Web styling = CSS Modules / scoped Astro `<style>` + design tokens, no
  Tailwind. All copy via `@repo/i18n` (es/en/pt).

### US-7 [GASTRO] — Reviews (moderated) + FAQs (owner-editable)

- **AC-7.1** A logged-in tourist can leave one review per gastronomy
  (UNIQUE(userId, gastronomyId)); it enters `moderationState = PENDING` and is not
  shown until approved by admin.
- **AC-7.2** `averageRating`/`reviewsCount` recomputed on review approve/update/
  delete via service hooks (denormalized), from approved rows only.
- **AC-7.3** Owner manages FAQs (add/edit/remove/reorder via `display_order`).
- **AC-7.4** Admin can moderate reviews (approve/reject) via admin routes.

### US-8 [CORE] — Admin CRUD + Entity shells

- **AC-8.1** Admin list/detail/create/edit/soft-delete/restore for the listing,
  reusing the shared admin Entity shells (the same EntityView/EntityEdit shell
  family used by accommodation), parametrized for gastronomy.
- **AC-8.2** Admin search supports destination/type/priceRange/featured/ownerId +
  the standard `AdminSearchBaseSchema` params (`page`,`pageSize`,`search`,`sort`,
  `status`,`includeDeleted`).
- **AC-8.3** The admin shell config is structured so SPEC-240 declares an
  Experiencias shell by config, not by forking shell code.

### US-9 [CORE] — Core/Gastro separation is provable

- **AC-9.1** `BaseCommerceListingService` contains zero gastronomy-specific logic;
  `GastronomyService` extends it and only adds gastro fields (`type`, `priceRange`,
  `menuUrl`) + gastro junction sync wiring.
- **AC-9.2** Shared schemas/enums/db-helpers used by gastronomy live in CORE
  locations (common/, generic base) — documented in the ADR. A checklist in the ADR
  enumerates exactly what SPEC-240 must add (and confirms it touches no CORE
  internals).

---

## Technical Approach

> Each subsection marks **[CORE]** vs **[GASTRO]** artifacts explicitly.

### Schemas (`@repo/schemas`)

**[CORE] — `packages/schemas/src/common/`**

- `opening-hours.schema.ts` → `OpeningHoursSchema`, `OpeningHoursFields`.
- `commerce-rating.schema.ts` → `CommerceRatingSchema` (`food/service/ambiance/value`).
- `commerce-identity.schema.ts` (optional) → `CommerceIdentityFields`.
- Reuse existing: contact/social/media/review/lifecycle/moderation/visibility/
  audit/seo/tags/faq/admin-search.

**[CORE] — enums (`packages/schemas/src/enums/`)**

- `price-range.enum.ts` + `.schema.ts` → `PriceRangeEnum`
  (BUDGET | MID | HIGH | PREMIUM).
- `product-domain.enum.ts` + `.schema.ts` → `ProductDomainEnum`
  (`accommodation` | `commerce`).
- `commerce-entity-type.enum.ts` (`gastronomy` | `experience`) for the link table /
  shell discriminator.

**[GASTRO] — enums**

- `gastronomy-type.enum.ts` + `.schema.ts` → `GastronomyTypeEnum` (RESTAURANT, BAR,
  CAFE, PARRILLA, CERVECERIA, HELADERIA, PANADERIA, ROTISERIA, FOOD_TRUCK, …).

**[GASTRO] — entity dir `packages/schemas/src/entities/gastronomy/`** (mirror
accommodation exactly):

- `gastronomy.schema.ts` — main schema composed by spreading: identity fields +
  gastro fields (`type`, `priceRange`, `menuUrl`) + `BaseContactFields` +
  `SocialNetworkFields` + `OpeningHoursFields` + media + `BaseReviewFields` +
  `BaseLifecycleFields` + `BaseModerationFields` + `BaseVisibilityFields` +
  `BaseSeoFields` + `BaseAdminFields` + `TagsFields` + `BaseAuditFields` +
  `destinationId` + `ownerId` + `isFeatured`.
- `gastronomy.crud.schema.ts` — Create/Update/Patch/Delete/Restore. **Two creators**:
  an **admin create** (identity/core fields, `ownerId`/`destinationId`/`type`,
  optional `amenityIds`/`featureIds`) and an **owner update** that is
  **operational-only** (a `.pick()` restricted to schedule/contact/social/media/
  menuUrl/priceRange/richDescription/amenityIds/featureIds — identity/core fields
  are absent from the schema, so forged values are rejected pre-service).
- `gastronomy.http.schema.ts` — flat HTTP coercion + `httpToDomain*` converters,
  with the compile-time completeness check (`Exclude<DomainFields,
  HttpConversionFields>`).
- `gastronomy.query.schema.ts` — `GastronomySearchSchema` (destination/type/
  priceRange/amenity/feature filters) + list/summary/stats.
- `gastronomy.access.schema.ts` — `GastronomyPublicSchema` / `…ProtectedSchema` /
  `…AdminSchema` (three-tier, same `.pick()`/`.extend()` discipline as
  accommodation; public omits adminInfo/contactInfo-private/audit).
- `gastronomy.admin-search.schema.ts` — `AdminSearchBaseSchema.extend({ type?,
  destinationId?, priceRange?, ownerId?, isFeatured? })`.
- `gastronomy.options.schema.ts`, `gastronomy.relations.schema.ts`,
  `gastronomy.batch.schema.ts`.
- `subtypes/gastronomy.faq.schema.ts` (`BaseFaqSchema.extend({ id, gastronomyId })`
  - Add/Update/Remove/List/Reorder I/O), `subtypes/gastronomy.review.schema.ts`
  (uses `CommerceRatingSchema`).

**[CORE] — lead schema** `packages/schemas/src/entities/commerce-lead/` →
`CommerceLeadSchema` + `CommerceLeadCreateInputSchema` with a `domain` discriminator.

### Service (`@repo/service-core`)

**[CORE] — `packages/service-core/src/services/commerce/`**

- `base-commerce-listing.service.ts` →
  `export abstract class BaseCommerceListingService<Entity, Model, Create, Update,
  Search> extends BaseCrudService<…>`. Holds all the shared behavior:
  - lifecycle hooks for destination CITY validation, slug generation, junction
    capture into hookState (`pendingAmenityIds`/`pendingFeatureIds`), denormalized
    rating recompute on review change, owner-scoping in `_executeAdminSearch`
    (forced `ownerId` for `*_VIEW_OWN`-only actors), public-tier projections.
  - `syncAmenityJunction`/`syncFeatureJunction` made **generic** (parametrized by
    junction table + catalog model) in `commerce.junction-sync.ts` — the
    gastronomy/experience services pass their own tables.
  - **commerce-visibility reconciler** `commerce-visibility.ts`: given a
    subscription-status change for a listing, flip `visibility`/`lifecycleState`.
    Called from the commerce webhook/cron path (US-4). **Independent of the
    entitlement engine.**
  - permissions module pattern `commerce.permissions.ts` exporting generic
    `checkCanEditOperational(actor, listing)` etc. using `hasPermission(actor,
    PermissionEnum.COMMERCE_*)`.
- `commerce-lead.service.ts` (BaseService/stateless-helper style) — create lead +
  notify + admin list/mark-handled.
- `commerce-owner-provisioning.service.ts` — create `COMMERCE_OWNER` user with temp
  password + `must_change_password=true`, email credentials. Reuses Better Auth +
  `@repo/notifications`.

**[GASTRO] — `packages/service-core/src/services/gastronomy/`**

- `gastronomy.service.ts` → `class GastronomyService extends
  BaseCommerceListingService<Gastronomy, GastronomyModel, GastronomyCreateInput,
  GastronomyUpdateInput, GastronomySearchSchema>`. Adds only: gastro field handling,
  its junction tables wiring, gastro search filters.
- `gastronomy.permissions.ts` (thin; delegates to commerce permission helpers with
  the gastronomy permission constants), `gastronomy.faq` helpers, `gastronomy.review`
  helpers, `gastronomy.projections.ts`, `gastronomy.types.ts`.

All methods return `ServiceOutput<T>`; all permission checks via `PermissionEnum`.

### DB (`@repo/db`)

**[CORE]**

- Additive **`billing_subscriptions.product_domain`** (varchar(32) NOT NULL DEFAULT
  `'accommodation'`). If the column cannot be added to the qzpay-library schema via
  `db:generate` (table owned by `@qazuor/qzpay-drizzle`), add it via the **extras
  carril** (`packages/db/src/migrations/extras/`) as a hand-written idempotent
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` + the read paths use raw column access.
  [Micro-decision — confirm at impl which carril; default: extras, since the table
  is library-owned.]
- `commerce_listing_subscriptions.dbschema.ts` — link table (see domain model).
  FK→billing_subscriptions, UNIQUE(entityType, entityId), index on entityId/status.
- `commerce_lead.dbschema.ts` — lead table (domain, businessName, contactName,
  email, phone, destinationId nullable, message, handledAt, handledById, audit).
- `users.must_change_password boolean NOT NULL DEFAULT false` (additive; structural
  carril `db:generate`).

**[GASTRO] — `packages/db/src/schemas/gastronomy/`**

- `gastronomy.dbschema.ts` — table per domain model; FK destination/owner
  **`onDelete: 'restrict'`**; pg enums `gastronomy_type`, `price_range`,
  visibility/lifecycle/moderation reused; `reviews_count` int default 0,
  `average_rating` numeric(3,2) mode number default 0; soft delete; the same index
  set accommodation uses (destination/visibility/featured/type/ownerId/deletedAt/
  moderationState + composite (destinationId, visibility), (ownerId, deletedAt)).
- `gastronomy_review.dbschema.ts`, `gastronomy_faq.dbschema.ts` (with
  `display_order`), `r_gastronomy_amenity.dbschema.ts`,
  `r_gastronomy_feature.dbschema.ts`.
- Migration flow: `db:generate` → commit migration → `db:migrate` →
  `db:apply-extras` (for the `product_domain` ALTER + any partial indexes / triggers).

### API routes (`apps/api`)

**[GASTRO] — `apps/api/src/routes/gastronomy/`** (mirror accommodation tiers):

*Public* (`public/`, `createPublicRoute`):

- `GET /api/v1/public/gastronomies` — list (visible only, filters/pagination).
- `GET /api/v1/public/gastronomies/:id` — detail.
- `GET /api/v1/public/gastronomies/slug/:slug` — detail by slug.
- `GET /api/v1/public/gastronomies/destination/:destinationId` — by destination.
- `GET /api/v1/public/gastronomies/:id/reviews` — approved reviews list.
- `GET /api/v1/public/gastronomies/:id/faqs` — FAQs.
- `GET /api/v1/public/gastronomies/stats` — aggregate stats (optional).

*Protected* (`protected/`, `createProtectedRoute`):

- `PATCH /api/v1/protected/gastronomies/:id` — **owner operational-only** update.
- `GET   /api/v1/protected/gastronomies/:id` — owner view.
- FAQs (owner): `POST/PUT/DELETE /…/:id/faqs[/ :faqId]`, `PUT /…/:id/faqs/reorder`.
- `POST  /api/v1/protected/gastronomies/:id/reviews` — tourist creates a review
  (→ PENDING).
- `POST  /api/v1/protected/commerce/leads` is **public** (US-1) — but the
  **admin lead list** is admin-tier.

*Admin* (`admin/`, `createAdminRoute`/`createAdminListRoute`, `requiredPermissions`):

- `GET/POST /api/v1/admin/gastronomies` (list/create), `GET/PUT/PATCH/DELETE
  /…/:id`, `DELETE /…/:id/hard`, `POST /…/:id/restore`, `POST /…/batch`,
  `GET /…/options`.
- FAQs admin mirror + `PUT /…/:id/faqs/reorder`.
- Reviews admin: `GET /…/reviews`, `GET/PUT/DELETE /…/reviews/:id`,
  `POST /…/reviews/:id/moderate`.
- `POST /api/v1/admin/gastronomies/:id/assign-owner` — set/replace COMMERCE_OWNER.

**[CORE] — `apps/api/src/routes/commerce/`**

- `POST /api/v1/public/commerce/leads` — public lead intake (US-1).
- `GET  /api/v1/admin/commerce/leads` + `POST /…/leads/:id/handle` — admin.
- `POST /api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription`
  — admin starts the binary commerce subscription (reuses start-paid machinery with
  `product_domain='commerce'`). [Or reuse the existing billing start-paid route with
  a `productDomain` param — micro-decision.]
- `POST /api/v1/protected/auth/change-password-required` — clears
  `must_change_password` (US-3). Plus the gate middleware in the protected router.

**[CORE] — Billing webhook/cron seam**: the commerce-visibility reconciler is
invoked from the existing MP webhook + dunning/finalize crons whenever a
`product_domain='commerce'` subscription changes status. The accommodation
entitlement paths add a `product_domain='accommodation'` filter.

### Web (`apps/web`)

**[GASTRO]**

- New section `apps/web/src/pages/[lang]/gastronomia/index.astro` (listing,
  SSR-fetches the public endpoint, filters as querystring) + `[slug].astro`
  (detail). Components: `GastronomyCard.astro`, `OpeningHours.astro`
  (today-highlighted), `GastronomyDetail` blocks (hours/contact/social/menu/
  amenities/FAQs/reviews) reusing existing review/FAQ presentation components where
  possible. CSS Modules / scoped `<style>` + design tokens; **no Tailwind**.
- A public **lead form** page/section ("Publicá tu restaurante") posting to the
  CORE lead endpoint. Native HTML form + small hook (web convention).
- i18n keys under new `gastronomy.json` (+ shared `commerce.json` for the lead form
  and the change-password copy) in es/en/pt.

**[CORE]**

- The change-password-required screen (web) shown when the session flag is set,
  blocking other routes until done.

### Admin (`apps/admin`)

**[CORE]**

- A generic commerce Entity shell config layer so gastronomy (and later
  experiencias) register list/view/edit/create by **config**, reusing the existing
  admin EntityView/EntityEdit shell family. Identity/core sections enabled for
  admin; operational sections shared.
- Lead inbox view (list + mark-handled). Owner-provisioning UX inside the create
  flow (create/pick user → fields → send credentials).

**[GASTRO]**

- Gastronomy admin routes (`apps/admin/src/routes/…/gastronomies/`) declaring the
  shell config + the gastro-specific fields (`type`, `priceRange`, `menuUrl`) and
  filters. TanStack Form + Zod from `@repo/schemas`, Tailwind, shadcn.

### Billing / subscription sub-system **[CORE]**

- One commerce plan seeded (MP preapproval recurring). Reuse
  `initiatePaidMonthlySubscription`; the created subscription row gets
  `product_domain='commerce'`. Create a `commerce_listing_subscriptions` link row.
- **Entitlement-engine isolation** (the crux): every accommodation-side read of
  subscriptions (`loadEntitlements()`, accommodation start-paid/poll/webhook,
  dunning that touches accommodation entitlements) filters
  `product_domain='accommodation'`. Add a **regression test**: a customer with both
  an accommodation sub and a commerce sub resolves accommodation entitlements
  identically to a customer with only the accommodation sub.
- **Visibility lifecycle**: webhook/cron → commerce-visibility reconciler →
  flip listing `visibility`/`lifecycleState`. Active=visible, otherwise hidden.
- **No multi-domain entitlement merge.** Commerce "entitlements" are exactly one bit
  (visible / not visible), derived from subscription status via the link table.

### Admin-sells flow **[CORE]**

1. Public lead form (US-1) → lead row + ops notification.
2. Admin sells offline, then in the admin panel: create/pick `COMMERCE_OWNER` user
   (temp password, `must_change_password=true`) → create the gastronomy entity
   (identity/core) → system emails credentials.
3. Admin (or owner) starts the binary subscription; on active, the listing becomes
   visible.
4. Owner logs in → forced password change → edits operational fields only.

### i18n

- New locale files: `gastronomy.json` (GASTRO) and `commerce.json` (CORE: lead form,
  credentials email, change-password copy, subscription/visibility states) in
  `es/en/pt`. All user-facing strings via `@repo/i18n`. (Credentials email +
  notification templates also i18n.)

### Env / config

- Commerce plan id / MP config: reuse existing billing env (no new MP secret
  expected — same MercadoPago account/preapproval machinery).
- Possible new vars (register in `packages/config/src/env-registry.*.ts` + app
  `env.ts` + `.env.example`, then STOP and ask owner to set in Coolify):
  - `HOSPEDA_COMMERCE_LEAD_NOTIFY_EMAIL` (ops inbox for leads).
  - `HOSPEDA_COMMERCE_PLAN_ID` (the seeded commerce plan UUID) — or seed-derived.
  - Temp-password policy / link base if not already covered by existing auth env.
- Roles/permissions seed: add `COMMERCE_OWNER` to `RoleEnum` + the new
  `PermissionEnum.COMMERCE_*` set + map in `rolePermissions.seed.ts`.

---

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Commerce subscription leaks into the accommodation entitlement engine, corrupting a host's accommodation entitlements | High | `product_domain` filter on every accommodation subscription read; commerce visibility derived from a separate link-table check; explicit regression test (host+commerce customer). |
| `product_domain` column lives on a library-owned (`@qazuor/qzpay-drizzle`) table → can't be added via `db:generate` | Medium | Add via the extras carril (idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`); read via raw column; document in migrations guide. |
| Force-password-change doesn't exist in Better Auth | Medium | Build `must_change_password` column + a session/route gate; validate Better Auth native first; regression test the gate. |
| Owner edits identity/core via forged payload | High | Operational-only **schema** (identity fields absent) + server-side permission checks (`COMMERCE_*_EDIT_OWN`) + forced owner scoping (mirror `ACCOMMODATION_VIEW_OWN`). |
| Core/Gastro entanglement makes SPEC-240 re-derive the core | High (defeats the spec's purpose) | `BaseCommerceListingService` holds all shared logic; AC-9 + ADR checklist enumerate exactly what SPEC-240 adds; gastronomy service has zero shared logic. |
| Public listing of unpaid/hidden merchants | Medium | Public endpoints filter on active subscription/visibility; detail 404s when hidden; reconciler keeps state consistent on lifecycle events. |
| Review abuse on commerce fichas | Medium | Reviews default `PENDING` (moderated), one per user (UNIQUE), admin moderation routes. |
| Slug/identity collisions across commerce entity types | Low | Per-table unique slug (gastronomy vs experience are separate tables/routes); link table UNIQUE(entityType, entityId). |
| Lead-form spam | Low | Honeypot/throttle + server validation; admin mark-handled. |
| Two divergent sponsorship systems already exist | Low | Out of scope; do NOT merge commerce-with-subscription into sponsorship machinery (different pattern: owner + recurring sub vs external sponsor + time window). |

## Out of Scope

- **SPEC-240** Experiencias y Servicios (separate consumer of the CORE).
- **Tarjeta Hospeda** adhesion / card mechanics (SPEC-D); only keep the boundary
  clean (a future `commerce_listing_subscriptions` row is enough to hang adhesion
  off later).
- Multi-domain entitlement-engine refactor (explicitly avoided).
- Booking / reservation / availability for gastronomy.
- Self-service merchant onboarding (admin-sells only in v1).
- Cuisine/services as a rigid second enum (modeled as amenity/feature badges).
- Touching the existing sponsorship systems.
- Mobile app surface (SPEC-E).

## Suggested Tasks (phased)

**Phase 1 — CORE schemas, enums, config, roles/perms.**
`OpeningHoursSchema`, `CommerceRatingSchema`, `PriceRangeEnum`, `ProductDomainEnum`,
`CommerceEntityType`, `CommerceLeadSchema`; add `COMMERCE_OWNER` to `RoleEnum`, the
`COMMERCE_*` permissions + category to `PermissionEnum`, map in
`rolePermissions.seed.ts`; env-registry entries. Unit tests for schemas/enums.

**Phase 2 — GASTRO schemas.** Full `gastronomy/` entity schema dir mirroring
accommodation (schema/crud[admin+operational]/http/query/access/admin-search/
options/relations/batch + subtypes faq/review). Completeness + tier tests.

**Phase 3 — DB.** `product_domain` (extras), `commerce_listing_subscriptions`,
`commerce_lead`, `users.must_change_password` (structural); `gastronomies` +
`gastronomy_reviews` + `gastronomy_faqs` + `r_gastronomy_amenity/feature`;
`db:generate` → migration → `db:migrate` → `db:apply-extras`. Models.

**Phase 4 — CORE services.** `BaseCommerceListingService`, generic junction-sync,
commerce-visibility reconciler, commerce permissions, `commerce-lead.service`,
`commerce-owner-provisioning.service`. Entitlement-engine `product_domain` filter +
**regression test** (host+commerce isolation). Unit tests.

**Phase 5 — GASTRO service.** `GastronomyService extends
BaseCommerceListingService` + permissions/projections/faq/review helpers. Tests
(incl. owner-operational-only enforcement, forced owner scoping, denormalized rating
recompute, reviews moderation).

**Phase 6 — Auth: force-password-change.** `must_change_password` flag + gate
(Better Auth integration) + change-password endpoint + screen. Regression test.

**Phase 7 — API routes.** Gastronomy public/protected/admin tiers + reviews/faqs;
commerce lead intake (public) + admin lead list/handle; assign-owner; commerce
start-subscription (or billing param). Integration tests + endpoint-gate-matrix
rows.

**Phase 8 — Billing wiring.** Seed the commerce plan; start-subscription sets
`product_domain='commerce'` + link row; webhook/cron → visibility reconciler.
Integration tests (active→visible, cancel→hidden). Staging MP smoke per SPEC-143
rules (binding gate for billing surface).

**Phase 9 — Web.** `/gastronomia` listing + detail (Astro, CSS Modules, tokens),
lead form, opening-hours/menu/amenities/FAQs/reviews blocks; change-password screen;
i18n es/en/pt. Component tests.

**Phase 10 — Admin.** Generic commerce Entity shell config + gastronomy admin routes
(fields/filters), lead inbox, owner-provisioning UX. Tests.

**Phase 11 — Docs & ADR.** ADR (core/gastro separation, binary subscription +
`product_domain` isolation rationale, admin-sells flow, COMMERCE_OWNER role); the
**SPEC-240 reuse checklist** (exactly what Experiencias adds, confirming no CORE
internals touched); route-architecture doc rows; CLAUDE.md billing quick-ref note.

## Open micro-decisions (defaults applied — flag if you disagree)

1. **`product_domain` carril**: extras (hand-written ALTER, library-owned table)
   [default] vs structural `db:generate` if the column can be modeled in repo
   schema. Confirm where `billing_subscriptions` is actually defined at impl.
2. **Commerce start-subscription route**: a new `commerce/…/start-subscription`
   route [default] vs adding a `productDomain` param to the existing billing
   `start-paid` route. Default keeps billing core untouched.
3. **`COMMERCE_OWNER` role vs reuse HOST**: new `COMMERCE_OWNER` role [default,
   per decision 6] — HOST permissions are accommodation-scoped and would leak.
4. **Commerce rating dimensions**: generic `food/service/ambiance/value`
   [default] vs gastro-specific names. Default keeps `CommerceRatingSchema` reusable
   by SPEC-240 (a gastro alias can rename labels in i18n only).
5. **Subscription↔listing link**: dedicated `commerce_listing_subscriptions` table
   [default] vs a nullable `commerce_listing_ref` jsonb on the subscription. Default
   table = indexed, UNIQUE-constrained, clean.
6. **Lead admin UX depth**: read + mark-handled only [default] vs full CRUD. Default
   minimal in v1.
7. **Commerce reviews moderation default**: `PENDING` [default, abuse risk] vs
   `APPROVED` like accommodation. Default moderated because diners are external and
   the owner doesn't control identity.
8. **Owner self-checkout vs admin-only subscription start**: admin-only in v1
   [default per "admin sells"] — owner self-renew can come later.

## Dependencies

- **dependsOn: none** (foundational). This spec builds the CORE that **SPEC-240
  Experiencias** depends on.
- **Reuses (does not modify the core of)**: existing billing/QZPay + MercadoPago
  machinery (`packages/billing`, `packages/db/src/billing`,
  `apps/api/src/routes/billing/start-paid.ts`), `@repo/notifications`, Better Auth
  (`apps/api/src/lib/auth.ts`), the admin Entity shell family, `@repo/i18n`,
  `@repo/schemas` common helpers, the `amenities`/`features` catalogs.
- **Downstream**: SPEC-240 (Experiencias) reuses the CORE; SPEC-D (Tarjeta Hospeda)
  hangs adhesion off `commerce_listing_subscriptions`; SPEC-E (Mobile) consumes the
  public gastronomy API.
