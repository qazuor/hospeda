---
spec-id: SPEC-240
title: Experiencias y Servicios (tourism services & experiences)
type: feature
complexity: medium
status: draft
created: 2026-06-15T00:00:00Z
tags: [experiences, services, commerce, subscription, tourism, web, public]
---

# SPEC-240 — Experiencias y Servicios (tourism services & experiences)

## Overview

**Goal.** Introduce a new public-facing section `/experiencias` for discovering
tourism services and experiences (car rentals, guided tours, excursions, etc.)
in Concepcion del Uruguay and the Litoral region of Argentina.

**Relationship to SPEC-239.** This spec is a **consumer of the shared
commerce-listing core** defined in SPEC-239 (BaseCommerceListingService,
base schemas, binary subscription sub-system, admin-sells flow, COMMERCE_OWNER
role, polymorphic reviews/FAQs/hours/amenities/destination). **SPEC-239 MUST be
completed before this spec starts.** This spec describes **only what is new and
specific** to the `experiences` entity. All shared infrastructure, patterns, and
sub-systems are referenced here by name; do not re-specify them.

**What this spec adds (entity-specific).**

- Table `experiences` with entity-specific fields: `type` enum, `priceFrom`
  (number), and `unit` enum (per_day / per_hour / per_person / per_group).
- Public section at `/experiencias` (index + detail pages).
- No booking — info and contact only (WhatsApp / contact form).
- Same admin-sells flow, same binary subscription, same reviews/FAQs/hours/
  amenities/destination as the SPEC-239 core.

**Audience.** Tourists (primary). Hosts may also browse. No self-service owner
registration — admin sells and creates.

---

## Locked design decisions (from design session "panel 1.1", 2026-06-15)

1. **Admin-sells model.** No self-service. Flow: web lead form → admin contacts/
   sells → admin creates COMMERCE_OWNER user + experience record from the panel →
   email with credentials → force password change on first login → owner edits
   ONLY operational fields thereafter.
2. **Binary subscription.** Active subscription = experience ficha visible. 1
   plan, MercadoPago preapproval recurring. Reuses SPEC-239 MP machinery and
   `billing_subscriptions` with a `product_domain` marker so the accommodation
   entitlement engine ignores it.
3. **Pricing model.** `priceFrom` (numeric, centavos integer) + `unit` enum:
   `per_day | per_hour | per_person | per_group`. Differs from Gastronomía's
   `priceRange` ($-$$$$).
4. **No booking.** Info + contact only. No reservation flow, calendar, or payment
   within Hospeda. Contact via WhatsApp or the owner's contact details.
5. **Type enum.** `CAR_RENTAL | BIKE_RENTAL | KAYAK_RENTAL | QUAD_RENTAL |
   TOUR_GUIDE | GUIDED_VISIT | EXCURSION | BOAT_TRIP | FISHING_CHARTER |
   BIRD_WATCHING | CULTURAL_TOUR | WINE_TASTING | OUTDOOR_ADVENTURE | OTHER`.
   Classification by type; additional features/amenities as polymorphic amenity
   badges (not a second rigid enum).
6. **Shared sub-systems from SPEC-239.** Reviews (moderated), FAQs
   (owner-editable), structured opening hours (by day with shifts), polymorphic
   amenities/features, destination many-to-one.
7. **Owner edits operational only.** Schedule/hours, contact info, social links,
   media, short description, FAQ content. Admin controls identity/core (name,
   slug, location, destination, type, subscription status).
8. **Tarjeta Hospeda hook.** Subscription visibility is the v1 coupling.
   The "being on the Tarjeta" benefit hook is wired but implemented in SPEC-242.

---

## Baseline (verified against `origin/staging`, 2026-06-15)

- SPEC-239 (shared commerce-listing core) is the prerequisite. Assumes it
  provides: `BaseCommerceListingService`, base commerce schemas, binary
  subscription bridging, COMMERCE_OWNER role + permissions, polymorphic hours/
  amenities/reviews/FAQs, destination FK pattern.
- No `experiences` or `services` table, schema, or route exists today.
- `BaseCrudService` lives in `packages/service-core/src/services/base/`.
- Accommodation is the reference entity (patterns to mirror): schemas in
  `packages/schemas/src/entities/accommodation/`, DB in
  `packages/db/src/schemas/accommodation/`, service in
  `packages/service-core/src/services/accommodation/`, routes in
  `apps/api/src/routes/accommodation/`.
- Web styling: CSS Modules / scoped Astro `<style>`, design tokens
  (`var(--space-N)`, `var(--core-foreground)`). No Tailwind on web.
  i18n via `createTranslations(locale)`.
- Admin styling: Tailwind CSS v4. TanStack Query + TanStack Form.
- Migrations: structural carril (`packages/db/src/migrations/` via
  `db:generate` + `db:migrate`); extras carril for triggers/partial indexes.

---

## Domain model (experience-specific fields on top of the SPEC-239 core)

### `experiences` table

Extends the SPEC-239 `BaseCommerceListing` columns (id, slug, name, summary,
description, contactInfo, socialNetworks, media, isFeatured, lifecycleState,
moderationState, adminInfo, destination FK, SEO fields, audit fields, soft delete,
`hasActiveSubscription` denormalized flag).

**Entity-specific columns:**

```
type            ExperienceTypeEnum (see locked decisions #5)
priceFrom       integer notNull            -- integer centavos; 0 = free / on_request
priceUnit       ExperiencePriceUnitEnum    -- per_day | per_hour | per_person | per_group
isPriceOnRequest boolean default false     -- when true, priceFrom is ignored on display
                                           -- (contact for pricing)
```

**Relations (all from SPEC-239 core):**

```
destination         FK destinations.id (many-to-one)
reviews             experience_reviews (polymorphic, moderated)
faqs                experience_faqs (owner-editable, ordered)
hours               experience_hours (structured, by day + shifts)
amenities           r_experience_amenity (polymorphic join)
features            r_experience_feature (polymorphic join)
owner               FK users.id (COMMERCE_OWNER role)
```

### Subscription bridging

No new columns. The SPEC-239 binary-subscription pattern marks
`billing_subscriptions.product_domain = 'experience'` so the accommodation
entitlement engine ignores those rows. `hasActiveSubscription` on `experiences`
is the denormalized hot-path flag (flipped by the SPEC-239 subscription lifecycle
hooks).

---

## User Stories & Acceptance Criteria

### US-1 — Tourist discovers experiences on the public index

GIVEN a visitor on `/experiencias`,
WHEN they land on or search the experiences listing,
THEN they see cards for active (subscription on), visible experiences, filterable
by type and destination.

- **AC-1.1** Only experiences with `lifecycleState = ACTIVE` and
  `hasActiveSubscription = true` are shown.
- **AC-1.2** Filters: type (ExperienceTypeEnum), destination.
- **AC-1.3** Each card shows: name, thumbnail, type badge, `priceFrom` + unit
  (or "Consultar" when `isPriceOnRequest`), destination badge, aggregate rating
  if reviews exist.
- **AC-1.4** Page is SSR (Astro), i18n es/en/pt.

### US-2 — Tourist views an experience detail page

GIVEN a visitor on `/experiencias/:slug`,
WHEN the page loads,
THEN they see full experience info: gallery, description, type, pricing, hours,
amenity/feature badges, FAQs, reviews, and contact options (WhatsApp link /
contact form).

- **AC-2.1** No booking widget. Contact only: WhatsApp button (deep link) and/or
  the owner's contact info.
- **AC-2.2** Reviews section (public, moderated) mirrors the accommodation
  reviews UX — aggregate rating + review list.
- **AC-2.3** Opening hours block shows structured schedule by day.
- **AC-2.4** 404 for inactive / subscription-off experiences.

### US-3 — Tourist submits a review

GIVEN an authenticated tourist who has no pending review for this experience,
WHEN they submit a rating + text via the reviews section,
THEN the review is saved as `moderationState = PENDING` and visible to the owner
and admin; it becomes public once approved.

- **AC-3.1** One review per user per experience (enforced at DB + service layer).
- **AC-3.2** Rating is a numeric score 1-5 (matches SPEC-239 review base).
- **AC-3.3** Moderation flow identical to the SPEC-239 core (admin approves/
  rejects; auto-approve configurable per destination).

### US-4 — Owner edits operational fields via the admin panel

GIVEN an authenticated COMMERCE_OWNER for this experience,
WHEN they access the experience edit section,
THEN they can update: hours, contact info, social links, media, short description,
FAQ entries, and `isPriceOnRequest` flag.

- **AC-4.1** Owner cannot edit: slug, name (legal identity), destination,
  type, or subscription status. Admin-only.
- **AC-4.2** UI warns when `hasActiveSubscription = false` (experience is hidden).

### US-5 — Admin creates and manages experiences

GIVEN an admin user,
WHEN they create an experience from the admin panel,
THEN they can set all fields including the COMMERCE_OWNER user, type, priceFrom,
priceUnit, destination, and can activate/suspend the subscription.

- **AC-5.1** Admin CRUD: create / list / view / update / soft-delete / restore.
- **AC-5.2** Admin can assign or change the COMMERCE_OWNER user.
- **AC-5.3** Admin can toggle subscription visibility via the binary flag
  (triggers the SPEC-239 lifecycle hook to flip `hasActiveSubscription`).
- **AC-5.4** Admin can manage reviews (approve / reject / delete), FAQs, hours.

### US-6 — Tarjeta Hospeda visibility hook (wired, not active until SPEC-242)

GIVEN an experience with an active subscription,
WHEN the Tarjeta Hospeda card feature is implemented (SPEC-242),
THEN the experience is automatically included as an adhered merchant without
additional configuration.

- **AC-6.1** The `hasActiveSubscription` flag is the only coupling point.
  No other Tarjeta columns on `experiences` in this spec.

---

## Technical Approach

### Schemas (`@repo/schemas`, new entity dir `experience/`)

All schemas follow the accommodation schema split pattern. New schemas:

**`experience.schema.ts`** — main entity schema:

```typescript
// Spreads BaseCommerceListingSchema from SPEC-239
// Entity-specific additions:
ExperienceTypeEnumSchema      // z.enum([...]) see type enum above
ExperiencePriceUnitEnumSchema // z.enum(['per_day','per_hour','per_person','per_group'])

ExperienceSchema = z.object({
  id: ExperienceIdSchema,
  type: ExperienceTypeEnumSchema,
  priceFrom: z.number().int().nonnegative(),
  priceUnit: ExperiencePriceUnitEnumSchema,
  isPriceOnRequest: z.boolean().default(false),
  // ...spread BaseCommerceListingSchema fields
})
```

**`experience.crud.schema.ts`** — create / update / patch variants (mirror
`accommodation.crud.schema.ts` pattern: `CreateExperienceSchema`,
`UpdateExperienceSchema`, `PatchExperienceSchema`).

**`experience.http.schema.ts`** — public / protected / admin response shapes
and request body schemas for each endpoint (mirror `accommodation.http.schema.ts`
split into public-tier / admin-tier).

**`experience.query.schema.ts`** — list/filter query params: `type`, `destination`,
`page`, `pageSize`, `sort`.

**`experience.relations.schema.ts`** — with reviews, faqs, hours, amenities,
features, destination (mirrors `accommodation.relations.schema.ts`).

**`experience.admin-search.schema.ts`** — admin list filter (includes
`hasActiveSubscription`, `ownerId`, `lifecycleState`, `moderationState`).

Enums exported from `packages/schemas/src/enums/`:

- `ExperienceTypeEnum` (PG enum + Zod schema)
- `ExperiencePriceUnitEnum` (PG enum + Zod schema)

### Service (`@repo/service-core`, `src/services/experience/`)

**`experience.service.ts`** — extends `BaseCommerceListingService` (from SPEC-239):

```typescript
export class ExperienceService extends BaseCommerceListingService<
  Experience,
  CreateExperienceInput,
  UpdateExperienceInput
> {
  // Entity-specific overrides:
  // - validateType(): type enum guard
  // - pricingBlock(): format priceFrom + unit vs isPriceOnRequest
  // Inherits: review/FAQ/hours/amenity lifecycle, subscription toggle hook,
  //           owner-scoping guards, permission checks
}
```

**`experience.permissions.ts`** — maps PermissionEnum values for
EXPERIENCE_VIEW_ALL, EXPERIENCE_UPDATE_OWN, EXPERIENCE_CREATE, EXPERIENCE_DELETE,
EXPERIENCE_MANAGE_REVIEWS (mirrors `accommodation.permissions.ts` pattern).

**`experience.helpers.ts`** — slug generator, price formatting, type-label
i18n key resolution.

**`experience.normalizers.ts`** — input normalization (slug → lowercase+dash,
priceFrom → integer coercion).

### DB (`@repo/db`, `packages/db/src/schemas/experience/`)

**`experience.dbschema.ts`** — main table:

```typescript
export const experiences = pgTable('experiences', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  summary: text('summary').notNull(),
  description: text('description').notNull(),
  type: ExperienceTypePgEnum('type').notNull(),
  priceFrom: integer('price_from').notNull().default(0),
  priceUnit: ExperiencePriceUnitPgEnum('price_unit').notNull(),
  isPriceOnRequest: boolean('is_price_on_request').notNull().default(false),
  // From BaseCommerceListing (SPEC-239):
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  destinationId: uuid('destination_id').references(() => destinations.id),
  hasActiveSubscription: boolean('has_active_subscription').notNull().default(false),
  contactInfo: jsonb('contact_info').$type<ContactInfo>(),
  socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
  media: jsonb('media').$type<Media>(),
  location: jsonb('location').$type<ExperienceLocationType>(),
  seo: jsonb('seo').$type<Seo>(),
  adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
  isFeatured: boolean('is_featured').notNull().default(false),
  lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('DRAFT'),
  moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
});
```

Indexes: `(slug)`, `(destination_id)`, `(owner_id)`, `(type)`,
`(has_active_subscription, lifecycle_state)` (hot-path public filter).

**Related tables (parallel to accommodation pattern):**

- `experience_reviews.dbschema.ts` — `id, experienceId FK, userId FK, title, content,
  rating jsonb, averageRating numeric, lifecycleState, moderationState, audit fields`
- `experience_faqs.dbschema.ts` — `id, experienceId FK, question, answer, category,
  displayOrder int, lifecycleState, audit fields`
- `experience_hours.dbschema.ts` — `id, experienceId FK, dayOfWeek enum,
  openTime time, closeTime time, isClosed bool, shiftName text nullish`
- `r_experience_amenity.dbschema.ts` — join table with `amenities`
- `r_experience_feature.dbschema.ts` — join table with `features`

**PG enums** (in `packages/db/src/schemas/enums.dbschema.ts`):

```typescript
export const ExperienceTypePgEnum = pgEnum('experience_type', [
  'CAR_RENTAL', 'BIKE_RENTAL', 'KAYAK_RENTAL', 'QUAD_RENTAL',
  'TOUR_GUIDE', 'GUIDED_VISIT', 'EXCURSION', 'BOAT_TRIP',
  'FISHING_CHARTER', 'BIRD_WATCHING', 'CULTURAL_TOUR',
  'WINE_TASTING', 'OUTDOOR_ADVENTURE', 'OTHER'
]);

export const ExperiencePriceUnitPgEnum = pgEnum('experience_price_unit', [
  'per_day', 'per_hour', 'per_person', 'per_group'
]);
```

**Migration:** `db:generate` → commit → `db:migrate` → `db:apply-extras`
(no extras needed at launch unless trigger for `has_active_subscription` is
implemented as a DB trigger rather than service-layer).

### API (`apps/api/src/routes/experience/`)

Mirrors the `accommodation/` route directory structure:

```
apps/api/src/routes/experience/
├── index.ts              # mount all sub-routers
├── public/
│   ├── index.ts          # GET /api/v1/public/experiences
│   ├── getById.ts        # GET /api/v1/public/experiences/:id
│   ├── getBySlug.ts      # GET /api/v1/public/experiences/slug/:slug
│   └── reviews/
│       └── index.ts      # GET /api/v1/public/experiences/:id/reviews
├── protected/
│   ├── index.ts
│   ├── updateOwn.ts      # PATCH /api/v1/protected/experiences/:id (operational only)
│   ├── reviews/
│   │   ├── create.ts     # POST /api/v1/protected/experiences/:id/reviews
│   │   └── delete.ts     # DELETE /api/v1/protected/experiences/:id/reviews/:reviewId
│   └── faqs/
│       └── list.ts       # GET /api/v1/protected/experiences/:id/faqs
└── admin/
    ├── index.ts
    ├── create.ts          # POST /api/v1/admin/experiences
    ├── list.ts            # GET /api/v1/admin/experiences
    ├── getById.ts         # GET /api/v1/admin/experiences/:id
    ├── update.ts          # PATCH /api/v1/admin/experiences/:id
    ├── delete.ts          # DELETE /api/v1/admin/experiences/:id
    ├── restore.ts         # POST /api/v1/admin/experiences/:id/restore
    ├── toggleSubscription.ts # POST /api/v1/admin/experiences/:id/toggle-subscription
    ├── faqs/
    │   ├── list.ts
    │   ├── create.ts
    │   ├── update.ts
    │   ├── delete.ts
    │   └── reorder.ts
    ├── hours/
    │   ├── list.ts
    │   ├── upsert.ts      # upsert full week schedule
    │   └── delete.ts
    └── reviews/
        ├── list.ts
        ├── approve.ts
        └── reject.ts
```

**Three-tier architecture (from `apps/api/docs/route-architecture.md`):**

| Tier | Pattern | Auth |
|------|---------|------|
| Public | `GET /api/v1/public/experiences*` | None |
| Protected | `PATCH /api/v1/protected/experiences/:id` | User session + COMMERCE_OWNER |
| Admin | `* /api/v1/admin/experiences*` | Admin + permissions |

All routes use `createSimpleRoute` / `createOpenApiRoute` / `createListRoute`
factories. Business logic delegated to `ExperienceService`.

**Key permissions:**

| Permission | Route(s) |
|-----------|---------|
| `EXPERIENCE_VIEW_ALL` | Admin list/getById |
| `EXPERIENCE_CREATE` | Admin create |
| `EXPERIENCE_UPDATE_ALL` | Admin update (all fields) |
| `EXPERIENCE_UPDATE_OWN` | Protected update (operational fields only) |
| `EXPERIENCE_DELETE` | Admin delete/restore |
| `EXPERIENCE_MANAGE_REVIEWS` | Admin review approve/reject/delete |
| `EXPERIENCE_MANAGE_SUBSCRIPTION` | Admin toggle-subscription |

### Web (`apps/web`, Astro + React islands)

**New pages:**

```
apps/web/src/pages/[lang]/experiencias/
├── index.astro            # /experiencias — public listing
└── [slug].astro           # /experiencias/:slug — detail
```

**Components (CSS Modules, no Tailwind):**

```
apps/web/src/components/experience/
├── ExperienceCard.astro           # card for index grid
├── ExperienceGrid.astro           # responsive grid wrapper
├── ExperienceFilters.client.tsx   # type + destination filter island
├── ExperienceHero.astro           # detail hero: name, type, pricing
├── ExperienceInfo.astro           # hours, amenities, features, contact
├── ExperienceFaqs.astro           # FAQ accordion (static SSR)
├── ExperienceReviews.client.tsx   # reviews section (interactive island)
├── ExperiencePriceTag.astro       # renders priceFrom + unit or "Consultar"
└── ExperienceContactCTA.astro     # WhatsApp deep link + contact block
```

**SSR data fetching.** Index page: public list endpoint (paginated, filtered).
Detail page: `getBySlug` public endpoint (404 guard for inactive/subscription-off).

**WhatsApp CTA** — deep link: `https://wa.me/<phone>?text=<encoded message>`.
Phone from `contactInfo.whatsapp` on the experience. No booking state required.

**i18n keys** — new namespace `experience.json` under each locale
(`packages/i18n/src/locales/{es,en,pt}/experience.json`):

```json
{
  "meta": { "title": "...", "description": "..." },
  "index": { "heading": "...", "emptyState": "..." },
  "detail": { "contact": "...", "whatsapp": "...", "hours": "..." },
  "type": {
    "CAR_RENTAL": "Alquiler de autos",
    "BIKE_RENTAL": "Alquiler de bicicletas",
    "KAYAK_RENTAL": "Alquiler de kayak",
    "QUAD_RENTAL": "Alquiler de cuadriciclos",
    "TOUR_GUIDE": "Guía turístico",
    "GUIDED_VISIT": "Visita guiada",
    "EXCURSION": "Excursión",
    "BOAT_TRIP": "Paseo en lancha",
    "FISHING_CHARTER": "Pesca deportiva",
    "BIRD_WATCHING": "Avistamiento de aves",
    "CULTURAL_TOUR": "Tour cultural",
    "WINE_TASTING": "Degustación de vinos",
    "OUTDOOR_ADVENTURE": "Aventura al aire libre",
    "OTHER": "Otro"
  },
  "priceUnit": {
    "per_day": "por día",
    "per_hour": "por hora",
    "per_person": "por persona",
    "per_group": "por grupo"
  },
  "priceOnRequest": "Consultar precio",
  "filters": { "type": "Tipo", "destination": "Destino" },
  "reviews": { "submit": "Dejar reseña", "empty": "Todavía no hay reseñas" },
  "faq": { "heading": "Preguntas frecuentes" }
}
```

### Admin UI (`apps/admin`, TanStack Start)

**New routes:**

```
apps/admin/src/routes/
├── _auth/
│   └── experiencias/
│       ├── index.tsx          # list with filters + pagination
│       ├── $id.tsx            # detail / view
│       ├── $id.edit.tsx       # edit (admin: all fields)
│       ├── new.tsx            # create
│       ├── $id.reviews.tsx    # review moderation list
│       └── $id.faqs.tsx       # FAQ management (reorder, CRUD)
```

Uses TanStack Query for server state, TanStack Form + Zod for forms, Shadcn UI
components. Tailwind CSS v4 styling.

Separate section for owner-facing edit (operational fields only) — accessed via
the protected route when the logged-in user has `COMMERCE_OWNER` role.

### i18n

All user-facing strings in `@repo/i18n`. New keys added under:

- `packages/i18n/src/locales/es/experience.json` (primary, Argentina Spanish)
- `packages/i18n/src/locales/en/experience.json`
- `packages/i18n/src/locales/pt/experience.json`

Admin-panel strings added under the existing `admin-common` namespace pattern.

### Env / config

No new env vars specific to this entity. Inherits:

- Binary subscription infra env from SPEC-239.
- Existing `HOSPEDA_DATABASE_URL`, auth, etc.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SPEC-239 core not landed | High | Strict dependency — do not start this spec until SPEC-239 tasks are complete and merged |
| `BaseCommerceListingService` API changes during SPEC-239 | Medium | Coordinate closely; SPEC-240 should be scoped to start after SPEC-239 Phase 1-3 are merged |
| PG enum migration irreversibility | Medium | Define all enum values up front (including `OTHER` as catch-all); adding values later is a separate migration |
| `priceFrom` integer centavos confusion | Low | Clear JSDoc + Zod `.int()` + admin UI shows formatted currency with unit |
| WhatsApp deep link abuse | Low | Phone stored owner-side (opt-in); no server-side generation needed |
| Duplicate type classification | Low | `type` enum for primary classification; amenity/feature badges for nuance — document clearly in admin UI |
| Subscription entitlement bleed-over | High | `product_domain = 'experience'` marker on `billing_subscriptions` ensures accommodation entitlement engine ignores experience subs (confirmed pattern from SPEC-239) |

---

## Out of Scope

- Booking, reservation, or payment flow within Hospeda.
- Real-time availability calendar.
- Self-service owner registration (admin-only).
- Multi-destination experiences (single destination FK; future scope).
- Importing existing external listings.
- Discount/coupon codes for experiences.
- SPEC-242 (Tarjeta Hospeda) coupling beyond the `hasActiveSubscription` hook.
- Mobile app UI (SPEC-243).
- SEO structured data (JSON-LD for `TouristAttraction` / `Product`) — follow-up.

---

## Suggested Tasks (phased)

### Phase 1 — Enums + Schemas

- **T-001** Add `ExperienceTypePgEnum` and `ExperiencePriceUnitPgEnum` to
  `packages/db/src/schemas/enums.dbschema.ts`.
- **T-002** Create `ExperienceTypeEnumSchema` and `ExperiencePriceUnitEnumSchema`
  in `packages/schemas/src/enums/`.
- **T-003** Write `experience.schema.ts` (main entity, spreading
  `BaseCommerceListingSchema` from SPEC-239).
- **T-004** Write `experience.crud.schema.ts` (create/update/patch variants).
- **T-005** Write `experience.http.schema.ts` (public/protected/admin response
  shapes).
- **T-006** Write `experience.query.schema.ts` + `experience.admin-search.schema.ts`.
- **T-007** Write `experience.relations.schema.ts` (with reviews, faqs, hours,
  amenities, features, destination).

### Phase 2 — DB

- **T-008** Create `experiences.dbschema.ts` (main table + relations).
- **T-009** Create `experience_reviews.dbschema.ts`.
- **T-010** Create `experience_faqs.dbschema.ts`.
- **T-011** Create `experience_hours.dbschema.ts`.
- **T-012** Create `r_experience_amenity.dbschema.ts` +
  `r_experience_feature.dbschema.ts`.
- **T-013** Run `db:generate`, review migration, commit migration file, run
  `db:migrate` + `db:apply-extras`.
- **T-014** Add seed data for experiences (at least 3-5 entries covering
  different types, for local dev).

### Phase 3 — Service

- **T-015** Create `experience.permissions.ts` (PermissionEnum values + role
  assignments).
- **T-016** Create `experience.helpers.ts` + `experience.normalizers.ts`.
- **T-017** Create `experience.service.ts` (extends `BaseCommerceListingService`).
  Unit tests: CRUD operations, owner-scoping guard, subscription toggle hook,
  pricing formatting.
- **T-018** Create `experience.types.ts` (service input/output types).

### Phase 4 — API Endpoints

- **T-019** Public routes: `GET /experiences`, `GET /experiences/:id`,
  `GET /experiences/slug/:slug`, `GET /experiences/:id/reviews`.
- **T-020** Protected routes: `PATCH /experiences/:id` (operational fields),
  review create/delete.
- **T-021** Admin routes: full CRUD + toggle-subscription + FAQs + hours +
  review moderation.
- **T-022** Integration tests for all endpoints. Update endpoint-gate-matrix.

### Phase 5 — Web UI

- **T-023** i18n keys: `experience.json` for es/en/pt.
- **T-024** `ExperienceCard.astro` + `ExperiencePriceTag.astro`.
- **T-025** `ExperienceGrid.astro` + `ExperienceFilters.client.tsx`.
- **T-026** `/[lang]/experiencias/index.astro` (listing page, SSR).
- **T-027** `ExperienceHero.astro` + `ExperienceInfo.astro` +
  `ExperienceContactCTA.astro`.
- **T-028** `ExperienceFaqs.astro` + `ExperienceReviews.client.tsx`.
- **T-029** `/[lang]/experiencias/[slug].astro` (detail page, SSR).
- **T-030** Component tests (Vitest + testing-library where applicable).

### Phase 6 — Admin UI

- **T-031** Admin experience list page (`/experiencias/index.tsx`).
- **T-032** Admin experience create/edit form (all fields; subscription toggle).
- **T-033** Admin experience detail + view page.
- **T-034** Admin FAQ management section (reorder, CRUD — reuse
  `FaqManager` pattern from SPEC-177 if available).
- **T-035** Admin review moderation list (approve/reject).
- **T-036** Owner-scoped edit form (protected, operational fields only).

### Phase 7 — Docs + Closeout

- **T-037** Update `apps/api/docs/route-architecture.md` with new experience
  routes.
- **T-038** Update endpoint-gate-matrix for experience permissions.
- **T-039** Smoke test: create 1 experience via admin, toggle subscription on,
  verify public listing + detail page, submit a review, approve it.
- **T-040** Update `.qtm/specs/index.json` + `tasks/index.json` +
  `specs-prioritization.csv` to reflect completed status.

---

## Open micro-decisions (defaults applied — flag if you disagree)

1. **`priceFrom` unit.** Spec uses integer centavos (matching the codebase's
   "Money = integer (centavos)" rule). **Default: integer centavos.** If the
   display layer should store it as units (e.g. "1500" for $15.00), adjust the
   admin form and normalizer. Flag if different behavior is expected.
2. **`isPriceOnRequest` behavior.** When `true`, the UI shows "Consultar precio"
   and hides the numeric value. **Default: always store `priceFrom = 0` when
   `isPriceOnRequest = true` to avoid confusion.** Flag if a non-zero price
   should be stored as an internal reference.
3. **Review auto-approve.** Same configurable auto-approve as SPEC-239 base
   (admin can toggle per destination). **Default: moderation required
   (`moderationState = PENDING` on submit).**
4. **Single destination only.** Each experience has one `destinationId`.
   **Default: one-to-one.** Multi-destination (junction table) is out of scope
   unless owner requests.
5. **`ExperienceHours` entity.** Structured (table) vs JSONB column (simpler).
   **Default: structured table** (consistent with the SPEC-239 core pattern
   chosen for all commerce-listing entities to allow per-day queries).
6. **Admin UI owner edit surface.** Owner edits via the admin panel (protected
   section) vs a dedicated `/mi-cuenta/experiencia/:id` page on the web.
   **Default: admin panel protected section** (follow wherever accommodation
   owner editing lives today; confirm at implementation).

---

## Dependencies

| Dependency | Type | Reason |
|-----------|------|--------|
| **SPEC-239** (commerce-listing core + Gastronomía) | Hard | Provides `BaseCommerceListingService`, base schemas, binary subscription pattern, COMMERCE_OWNER role, polymorphic sub-systems |
| `@repo/schemas` accommodation entity | Reference | Mirror the schema split pattern (schema / crud / http / query / relations / admin-search) |
| `BaseCrudService` in `@repo/service-core` | Indirect (via SPEC-239) | Foundation extended by `BaseCommerceListingService` |
| `@repo/db` accommodation pattern | Reference | Mirror DB schema structure (main table + related tables) |
| `amenities` + `features` tables | Reuse | Polymorphic join tables already exist; `r_experience_amenity` + `r_experience_feature` reference them |
| `destinations` table | Reuse | FK for destination many-to-one |
| `billing_subscriptions` + QZPay machinery | Reuse (via SPEC-239) | Binary subscription infra |
| **SPEC-242** (Tarjeta Hospeda) | Soft (future) | Consumes `hasActiveSubscription` from this spec; no inverse coupling |
| **SPEC-243** (Mobile app) | Soft (future) | Consumes public API endpoints from this spec |

---

## Key Learnings

1. SPEC-239 (the shared commerce core) does not yet exist at spec-writing time — it will be the predecessor spec. SPEC-240 is purposely thin, delegating all shared machinery to that core.
2. The `experiences` entity uses integer centavos for `priceFrom` (matching the project-wide "Money = integer" rule), with `isPriceOnRequest` as a display override flag — this avoids nullable money fields.
3. The type enum was expanded beyond the original 5 types (CAR_RENTAL, BIKE_RENTAL, TOUR_GUIDE, GUIDED_VISIT, EXCURSION) to include Litoral-region-specific types (KAYAK_RENTAL, QUAD_RENTAL, BOAT_TRIP, FISHING_CHARTER, BIRD_WATCHING) and an `OTHER` catch-all — all fitting the Argentina Litoral tourism context.
4. No booking flow is in scope; the WhatsApp deep link pattern is the entire CTA surface, keeping the entity simple.
5. The PG enum `experience_type` and `experience_price_unit` must be added to `enums.dbschema.ts` (centralized with other entity enums) — not inline in the table definition.
6. SPEC-241 (host trades directory), SPEC-242 (Tarjeta Hospeda), and SPEC-243 (mobile app) directories were already created as empty stubs in the spec directory, suggesting the spec numbering is pre-allocated even before the spec bodies are written.
