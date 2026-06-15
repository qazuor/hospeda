---
spec-id: SPEC-242
title: "Tarjeta Hospeda (benefits card for guests)"
type: epic
complexity: high
status: draft
created: "2026-06-15T00:00:00Z"
tags: ["card", "benefits", "merchants", "guest", "growth", "qr", "survey"]
---

# SPEC-242 — Tarjeta Hospeda (benefits card for guests)

## Overview

**Goal.** Give accommodation hosts a QR-code-based "Tarjeta Hospeda" that unlocks
discounts for their guests at local merchants (gastronomy, experiences, shops).
The card doubles as a **guest-registration growth hook**: scanning the QR requires
login/register on Hospeda. Merchants participate either because they already have
an active Gastronomía/Experiencias subscription (auto-adhered) or because an admin
loaded them as a standalone entry (no Hospeda ficha, no user account).

**Two phases:**

- **Phase 1** — Core: merchants + benefits + host credential (QR) + public benefit
  landing + guest registration flow + "me interesa" intent capture.
- **Phase 2** — Survey: post-use email survey + internal metrics + optional review
  publication for merchants with a Hospeda ficha.

## Locked design decisions

1. **Host-mode only.** One credential per accommodation (not per guest). The host
   displays the QR; all guests of that accommodation share it.
2. **Honor system at merchant.** No PIN, no scanner, no technical gate at the
   merchant side. Solo-tarjeta merchants need no Hospeda user or device.
3. **Registration growth hook.** Viewing the benefit list requires login/register.
   The discount is the incentive to create an account.
4. **Polymorphic merchants.** A merchant either links to a Gastronomía/Experiencias
   ficha (auto-adhered via active subscription, admin assigns benefit) OR is a
   standalone entry (own name/address/logo, no ficha linkage).
5. **Admin-curated benefits.** One main benefit per merchant in v1. Subscription
   owners can REQUEST changes; admin applies them.
6. **QR validity tied to subscription.** If the host's accommodation plan lapses,
   the card endpoint returns an empty/404 response — QR stops working.
7. **Survey outcome.** Internal metrics always. Option to publish a review only for
   merchants that have a public Hospeda ficha (reuses `accommodation_reviews` pattern
   for the review entity, but targets the ficha).
8. **No tourist-mode credential.** Dropped — only host credentials exist.

## Baseline

- Accommodation reviews: `accommodation_reviews` table (`packages/db/src/schemas/
  accommodation/accommodation_review.dbschema.ts`) with userId NOT NULL FK, no
  platform/source field. External reviews use a different system; Hospeda ficha
  reviews (from Phase 2 survey) can reuse this table if the merchant maps to a ficha.
- Billing subscriptions: `billing_subscriptions` with per-customer entitlement
  resolution. Host card active = host has an active accommodation plan subscription.
- Destinations: `destinations` table, many-to-one from accommodations. Benefit list
  is scoped to a destination.
- Admin CRUD pattern: route factories (`createAdminListRoute`, `createSimpleRoute`),
  `BaseCrudService`, `BaseModel` — follow exactly.
- Web CSS: CSS Modules + design tokens (`var(--space-N)`, `var(--core-foreground)`),
  no Tailwind. i18n via `createTranslations(locale)`.
- Cron jobs live in `apps/api/src/cron/jobs/`.

## Domain model

### 1. `hospeda_card_merchants`

Polymorphic: links to a gastronomy/experience ficha OR is standalone.

```
id              uuid PK default random
destination_id  uuid NOT NULL FK → destinations.id
entity_type     enum('gastronomy' | 'experience' | 'standalone') NOT NULL
entity_id       uuid NULLABLE  -- FK to the ficha table (gastronomy/experience)
                               -- NULL when entity_type = 'standalone'
name            text NOT NULL  -- overrideable display name (defaults to ficha name)
address         text NULLABLE
logo_url        text NULLABLE
active          boolean NOT NULL default true
created_at      timestamptz NOT NULL default now()
updated_at      timestamptz NOT NULL default now()
deleted_at      timestamptz NULLABLE  -- soft delete
created_by_id   uuid NULLABLE FK → users.id
updated_by_id   uuid NULLABLE FK → users.id
deleted_by_id   uuid NULLABLE FK → users.id
```

Indexes: `destination_id`, `entity_type`, composite `(destination_id, active, deleted_at)`.

### 2. `hospeda_card_benefits`

One main benefit per merchant in v1 (sort_order for future multi-benefit).

```
id          uuid PK default random
merchant_id uuid NOT NULL FK → hospeda_card_merchants.id ON DELETE CASCADE
title       text NOT NULL  -- e.g. "15% de descuento en consumiciones"
description text NULLABLE
valid_from  date NULLABLE
valid_until date NULLABLE
active      boolean NOT NULL default true
sort_order  integer NOT NULL default 0
created_at  timestamptz NOT NULL default now()
updated_at  timestamptz NOT NULL default now()
deleted_at  timestamptz NULLABLE
created_by_id uuid NULLABLE FK → users.id
updated_by_id uuid NULLABLE FK → users.id
deleted_by_id uuid NULLABLE FK → users.id
```

### 3. `hospeda_card_host_credentials`

One row per accommodation. Deactivated (active = false) when subscription lapses.

```
id               uuid PK default random
accommodation_id uuid NOT NULL UNIQUE FK → accommodations.id ON DELETE CASCADE
qr_token         uuid NOT NULL UNIQUE default random()  -- stable, used in QR URL
active           boolean NOT NULL default true
created_at       timestamptz NOT NULL default now()
updated_at       timestamptz NOT NULL default now()
```

No `deleted_at` — deactivate via `active = false`. No `created_by_id` (system-created).

### 4. `hospeda_card_benefit_intents`

"Me interesa" intent records (guest clicked interest on a benefit).

```
id               uuid PK default random
user_id          uuid NOT NULL FK → users.id ON DELETE CASCADE
merchant_id      uuid NOT NULL FK → hospeda_card_merchants.id ON DELETE CASCADE
benefit_id       uuid NOT NULL FK → hospeda_card_benefits.id ON DELETE CASCADE
accommodation_id uuid NOT NULL FK → accommodations.id ON DELETE CASCADE
created_at       timestamptz NOT NULL default now()
```

UNIQUE constraint on `(user_id, benefit_id)`. Append-only (no updated_at, no soft delete).

### 5. `hospeda_card_surveys` (Phase 2)

Post-use survey. Sent after intent; can arrive without prior intent row.

```
id                       uuid PK default random
intent_id                uuid NULLABLE FK → hospeda_card_benefit_intents.id
user_id                  uuid NOT NULL FK → users.id
merchant_id              uuid NOT NULL FK → hospeda_card_merchants.id
benefit_id               uuid NOT NULL FK → hospeda_card_benefits.id
used                     boolean NOT NULL
rating                   smallint NULLABLE  -- 1-5
comment                  text NULLABLE
published_as_review_id   uuid NULLABLE FK → accommodation_reviews.id
created_at               timestamptz NOT NULL default now()
updated_at               timestamptz NOT NULL default now()
```

## User Stories & Acceptance Criteria

### US-01 — Guest scans QR and sees benefits (public landing)

GIVEN a guest who scans a host's QR code,
WHEN they land on `/tarjeta/:qrToken`,
THEN they see the benefit list for the host's destination, prompting login/register
to mark interest.

- **AC-1.1** `GET /api/v1/public/card/:qrToken` returns destination info + benefit list
  if host credential is active; returns 404 if inactive or not found.
- **AC-1.2** The benefit list is scoped to `destination_id` of the host's accommodation.
- **AC-1.3** Benefits with expired `valid_until` are hidden.

### US-02 — Guest registers and marks "me interesa"

GIVEN an authenticated guest viewing the benefit landing,
WHEN they tap "Me interesa" on a benefit,
THEN an intent row is created (idempotent: a second tap on the same benefit is a no-op).

- **AC-2.1** `POST /api/v1/protected/card/intents` creates or silently ignores a duplicate.
- **AC-2.2** The benefit card shows a "Ya marcaste interés" state for previously marked benefits.
- **AC-2.3** Unauthenticated guests are redirected to login/register with redirect back to `/tarjeta/:qrToken`.

### US-03 — Host sees their QR credential

GIVEN an authenticated host on their accommodation management page,
WHEN they open the "Tarjeta Hospeda" section,
THEN they see their QR code (rendered from `qr_token`) and current active status.

- **AC-3.1** `GET /api/v1/protected/card/host-credential` returns the host's QR token and active state.
- **AC-3.2** If the host's subscription is inactive, active = false is reflected and the QR is shown greyed-out with an explanation.
- **AC-3.3** QR is a deep link to `https://hospeda.com.ar/tarjeta/:qrToken`.

### US-04 — Admin manages merchants

GIVEN an admin in the panel,
WHEN they open Tarjeta → Comercios adheridos,
THEN they can create, edit, activate/deactivate, and soft-delete merchants.

- **AC-4.1** Full CRUD via admin endpoints. Polymorphic form supports entity_type selector.
- **AC-4.2** For `entity_type != standalone`, `entity_id` is required and must reference an existing ficha.
- **AC-4.3** Soft delete hides the merchant and cascades to its benefits (hidden, not deleted).

### US-05 — Admin assigns benefits

GIVEN an admin on a merchant detail page,
WHEN they add or edit a benefit,
THEN the benefit is saved and immediately visible on the public landing.

- **AC-5.1** Full benefit CRUD under a merchant via admin endpoints.
- **AC-5.2** Only benefits with `active = true` and no expired `valid_until` are shown publicly.
- **AC-5.3** Sort_order is respected; first active benefit is the "main" one in v1.

### US-06 — Post-use survey email (Phase 2)

GIVEN a guest who marked "me interesa" on a benefit,
WHEN N hours have passed (configurable, default 48h),
THEN they receive a survey email: "¿Usaste el beneficio? ¿Cómo estuvo?"

- **AC-6.1** Survey cron enqueues email for intents older than `HOSPEDA_CARD_SURVEY_DELAY_HOURS` with no existing survey row.
- **AC-6.2** Survey response is stored in `hospeda_card_surveys`.
- **AC-6.3** Guest can decline to answer (used = false, no rating/comment required).

### US-07 — Publish review from survey (Phase 2)

GIVEN a guest who submitted a survey for a merchant with a Hospeda ficha,
WHEN they opt to publish their experience,
THEN an `accommodation_reviews`-style review is created for the ficha.

- **AC-7.1** Only available if `merchant.entity_id` is not null (ficha exists).
- **AC-7.2** Review goes through normal moderation flow.
- **AC-7.3** Survey row tracks `published_as_review_id` for deduplication.

## Technical Approach

### Schemas (`@repo/schemas`)

New directory: `packages/schemas/src/entities/card/`

- `HospedaCardMerchantEntityTypeEnum` = `'gastronomy' | 'experience' | 'standalone'`
- `HospedaCardMerchantSchema` — full entity (id, destination_id, entity_type, entity_id, name, address, logo_url, active, audit fields)
- `HospedaCardMerchantCreateSchema` — admin create (omit id/audit)
- `HospedaCardMerchantUpdateSchema` — admin update (partial)
- `HospedaCardBenefitSchema` — full entity
- `HospedaCardBenefitCreateSchema` / `HospedaCardBenefitUpdateSchema`
- `HospedaCardHostCredentialSchema` — id, accommodation_id, qr_token, active
- `HospedaCardBenefitIntentCreateSchema` — merchant_id, benefit_id, accommodation_id
- `HospedaCardSurveySchema` / `HospedaCardSurveyCreateSchema` (Phase 2)
- `CardPublicLandingResponseSchema` — destination name + list of merchant+benefit pairs
- `CardIntentPublicSchema` — user_id, benefit_id, created_at (for "ya marcaste interés" check)

### Database (`@repo/db`)

New directory: `packages/db/src/schemas/card/`

Files:

- `hospeda_card_merchant.dbschema.ts`
- `hospeda_card_benefit.dbschema.ts`
- `hospeda_card_host_credential.dbschema.ts`
- `hospeda_card_benefit_intent.dbschema.ts`
- `hospeda_card_survey.dbschema.ts` (Phase 2)
- `index.ts`

New directory: `packages/db/src/models/card/`: `HospedaCardMerchantModel`,
`HospedaCardBenefitModel`, `HospedaCardHostCredentialModel` (all extend `BaseModel`);
`HospedaCardBenefitIntentModel` (lean append-only, no BaseModel audit columns);
`HospedaCardSurveyModel` extends `BaseModel` (Phase 2).

Migration: `db:generate` → new numbered `.sql` for Phase 1 tables.

### Services (`@repo/service-core`)

New directory: `packages/service-core/src/services/card/`

- `hospeda-card-merchant.service.ts` (`HospedaCardMerchantService` extends `BaseCrudService`)
  - `adminList({ destinationId?, entityType?, active? })` → paginated list
  - `adminCreate(data, actor)` → creates merchant row
  - `adminUpdate(id, data, actor)` / `adminPatch` / `adminSoftDelete` / `adminRestore`
  - `getPublicByDestination(destinationId)` → active merchants + active benefits for public landing

- `hospeda-card-benefit.service.ts` (`HospedaCardBenefitService` extends `BaseCrudService`)
  - `adminCreate(merchantId, data, actor)` / `adminUpdate` / `adminPatch` / `adminSoftDelete`
  - `listByMerchant(merchantId)` → active benefits ordered by sort_order

- `hospeda-card-host-credential.service.ts` (`HospedaCardHostCredentialService`)
  - `getOrCreate(accommodationId)` → upsert credential for a host
  - `getByQrToken(qrToken)` → resolve token → accommodation (with active check + subscription check)
  - `deactivateForAccommodation(accommodationId)` → called by subscription-cancel cron/hook

- `hospeda-card-intent.service.ts` (`HospedaCardIntentService`)
  - `markIntent({ userId, merchantId, benefitId, accommodationId })` → INSERT OR IGNORE
  - `getUserIntentsForDestination(userId, destinationId)` → list of benefitIds user has marked

- `hospeda-card-survey.service.ts` (Phase 2) (`HospedaCardSurveyService`)
  - `getEligibleIntents(olderThanHours)` → intents without a survey row
  - `recordSurvey(data)` → insert survey row
  - `publishAsReview(surveyId, actor)` → create accommodation_review from survey

### API — Public endpoints

`apps/api/src/routes/card/public/`

```
GET  /api/v1/public/card/:qrToken
     → CardPublicLandingResponseSchema
     → 200 with { destination, merchants: [{ merchant, benefit }] }
     → 404 if qr_token not found or host credential inactive
     → Checks host subscription active (billing entitlement query)
```

### API — Protected endpoints

`apps/api/src/routes/card/protected/`

```
GET  /api/v1/protected/card/host-credential
     → HospedaCardHostCredentialSchema
     → Permission: ACCOMMODATION_VIEW_OWN (host sees their own)
     → Returns credential for the actor's accommodation

POST /api/v1/protected/card/intents
     → Body: HospedaCardBenefitIntentCreateSchema
     → Permission: authenticated user (any role)
     → Returns 200 (created) or 200 (already exists, idempotent)

GET  /api/v1/protected/card/intents?destinationId=<uuid>
     → Returns list of benefit IDs the user has marked interest in for a destination

POST /api/v1/protected/card/surveys/:intentId
     → Body: HospedaCardSurveyCreateSchema (Phase 2)
     → Permission: authenticated user (must own the intent)

POST /api/v1/protected/card/surveys/:surveyId/publish-review
     → Permission: authenticated user (must own the survey)
     → Only for merchants with entity_id (Phase 2)
```

### API — Admin endpoints

`apps/api/src/routes/card/admin/`

```
GET    /api/v1/admin/card/merchants               (list, paginated, filterable)
POST   /api/v1/admin/card/merchants               (create)
GET    /api/v1/admin/card/merchants/:id           (get by id)
PATCH  /api/v1/admin/card/merchants/:id           (update)
DELETE /api/v1/admin/card/merchants/:id           (soft delete)

GET    /api/v1/admin/card/merchants/:id/benefits  (list benefits for merchant)
POST   /api/v1/admin/card/merchants/:id/benefits  (add benefit)
PATCH  /api/v1/admin/card/benefits/:id            (update benefit)
DELETE /api/v1/admin/card/benefits/:id            (soft delete benefit)

GET    /api/v1/admin/card/host-credentials        (admin list, paginated)
PATCH  /api/v1/admin/card/host-credentials/:id    (activate/deactivate)
```

### Web (Astro + React islands)

New pages:

- `apps/web/src/pages/[lang]/tarjeta/[qrToken].astro`
  — Server-side fetches `/public/card/:qrToken`. If 404 → renders "tarjeta inválida".
  — Shows destination name + merchant/benefit list.
  — Unauthenticated: shows benefit list blurred + CTA "Registrate para ver los beneficios" → `/[lang]/auth/register?redirect=/tarjeta/:qrToken`.
  — Authenticated: shows full list + "Me interesa" buttons (React island).

New components:

- `BenefitCard.astro` — merchant name, logo, benefit title, "Me interesa" CTA.
- `BenefitIntentButton.client.tsx` — React island, calls `POST /protected/card/intents`, shows "Ya marcaste interés" after.
- `HostCardSection.astro` (or `.client.tsx`) — rendered on the host's `/mi-cuenta` page, shows QR image + active state.

CSS Modules + design tokens, no Tailwind. i18n keys under `packages/i18n/src/locales/{es,en,pt}/card.json`.

### Admin (TanStack Start)

New routes under `apps/admin/src/routes/card/`:

- `_layout.tsx` — card section layout, sidebar nav.
- `merchants/index.tsx` — merchant list (TanStack Table, filter by destination + entity_type + active).
- `merchants/new.tsx` / `merchants/$merchantId.tsx` — create/edit with polymorphic entity_type form.
- `benefits/$benefitId.tsx` — benefit edit.

Forms use TanStack Form + card schemas from `@repo/schemas`. Styling via Tailwind CSS v4.

### Notifications (Phase 2)

New cron job: `apps/api/src/cron/jobs/card-survey-dispatch.job.ts`. Schedule:
`HOSPEDA_CARD_SURVEY_CRON` (default `0 9 * * *`). Calls
`HospedaCardSurveyService.getEligibleIntents(delayHours)`, sends `card-survey` template
via `@repo/notifications`, marks `survey_dispatched_at` on each intent (prevent double-send).
Partial index on `hospeda_card_benefit_intents WHERE survey_dispatched_at IS NULL` in extras carril.

### i18n

New locale file: `packages/i18n/src/locales/{es,en,pt}/card.json`

Key namespaces and sample keys:

| Key | Sample (es) |
|-----|-------------|
| `card.landing.title` | "Beneficios exclusivos para huéspedes" |
| `card.landing.subtitle` | "Mostrá la Tarjeta Hospeda y obtené tu descuento." |
| `card.landing.loginCta` | "Registrate para desbloquear los beneficios" |
| `card.benefit.meInteresa` | "Me interesa" |
| `card.benefit.alreadyMarked` | "Ya marcaste interés" |
| `card.benefit.validUntil` | "Válido hasta {{date}}" |
| `card.host.title` | "Tu Tarjeta Hospeda" |
| `card.host.activeLabel` | "Tarjeta activa" |
| `card.host.inactiveLabel` | "Tarjeta inactiva — renovar suscripción" |
| `card.host.qrHint` | "Mostrá este QR en tu alojamiento." |
| `card.survey.subject` | "¿Usaste tu beneficio Hospeda?" |
| `card.survey.used` | "Sí, lo usé" |
| `card.survey.notUsed` | "Todavía no" |
| `card.survey.ratingLabel` | "¿Cómo fue tu experiencia?" |
| `card.survey.publishReview` | "Publicar mi opinión en Hospeda" |
| `card.survey.thankYou` | "¡Gracias por tu respuesta!" |
| `card.invalid.title` | "Código QR inválido o expirado" |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| QR token abuse (anyone can share the URL) | Medium | Honor system is explicit; benefit is UX-only (no financial transaction). Registrations gained even from non-guests are a net positive. Rate-limit intent creation per user per day if needed. |
| Survey response rate too low (Phase 2) | Medium | Short email (1 question: used yes/no), all else optional. Timing configurable. Remind once only. |
| Merchant onboarding friction for solo-tarjeta | Low | Admin-created only; no owner login required. Logo can be a URL (no upload in v1 — see micro-decisions). |
| Review publication consent (Phase 2) | Medium | Explicit opt-in step in survey UI ("Publicar mi opinión"). Pre-filled consent copy in i18n. |
| Phase 2 email deliverability | Low | Reuses existing `@repo/notifications` + email provider. Survey email is transactional. |
| Host subscription status staleness | Medium | Card endpoint queries billing entitlement live (or with short cache). Credential `active` flag is updated by subscription-cancel cron hook. |
| Duplicate intents on re-scan | Low | UNIQUE constraint on `(user_id, benefit_id)` + INSERT OR IGNORE service method. |

## Out of Scope

- Technical validation at merchant (PIN, QR scan by merchant, NFC).
- Per-guest QR codes or one-time-use tokens.
- Multiple benefits per merchant (sort_order prepares for v2; v1 = one main benefit).
- Direct benefit editing by subscription owners (they REQUEST; admin applies).
- Reward points, cashback, or transaction tracking.
- Metrics dashboard UI (analytics is a follow-up spec; Phase 2 stores raw data only).
- Mobile app QR scanner (SPEC-E mobile specs).
- Auto-adhering fichas — admin must explicitly create the merchant row even for ficha-linked entries.

## Suggested Tasks

### Phase 1 — Core infrastructure and guest flow

**T-001** DB schemas — card tables (Phase 1)
Create the 4 Drizzle schemas (`hospeda_card_merchants`, `hospeda_card_benefits`,
`hospeda_card_host_credentials`, `hospeda_card_benefit_intents`) + models in
`packages/db/src/schemas/card/` and `packages/db/src/models/card/`. Run `db:generate`.
Complexity: 2

**T-002** Zod schemas — card entities
Create `packages/schemas/src/entities/card/` with all Phase 1 schemas (merchant,
benefit, host-credential, intent, public landing response). Export from package index.
Complexity: 2

**T-003** Service — merchant CRUD
Implement `HospedaCardMerchantService` in `packages/service-core/src/services/card/`
with `adminList`, `adminCreate`, `adminUpdate`, `adminPatch`, `adminSoftDelete`,
`adminRestore`, and `getPublicByDestination`. Unit tests.
Complexity: 2

**T-004** Service — benefit CRUD
Implement `HospedaCardBenefitService` with benefit CRUD scoped under merchant.
Unit tests including validity filter.
Complexity: 2

**T-005** Service — host credentials
Implement `HospedaCardHostCredentialService` (`getOrCreate`, `getByQrToken`,
`deactivateForAccommodation`). Include subscription-active check via billing entitlement.
Unit tests with mocked billing.
Complexity: 2

**T-006** Service — intent capture
Implement `HospedaCardIntentService` (`markIntent` idempotent via INSERT OR IGNORE,
`getUserIntentsForDestination`). Unit tests.
Complexity: 1

**T-007** API — public card landing endpoint
`GET /api/v1/public/card/:qrToken` — resolves token, checks host credential active,
fetches destination + merchant + benefit list. Returns 404 on inactive/not found.
Integration test.
Complexity: 2

**T-008** API — protected intent endpoints
`POST /api/v1/protected/card/intents` (idempotent) + `GET /api/v1/protected/card/intents`.
Integration tests.
Complexity: 1

**T-009** API — protected host-credential endpoint
`GET /api/v1/protected/card/host-credential` with `ACCOMMODATION_VIEW_OWN` permission
check. Integration test (host sees own, non-host gets 403).
Complexity: 1

**T-010** API — admin merchant CRUD routes
Full CRUD under `/api/v1/admin/card/merchants` using route factories. Integration tests.
Complexity: 2

**T-011** API — admin benefit CRUD routes
Benefit CRUD under merchant + flat benefit endpoints. Integration tests.
Complexity: 2

**T-012** Web — public card landing page
`apps/web/src/pages/[lang]/tarjeta/[qrToken].astro` — SSR fetch, unauthenticated
gate (blur + CTA), authenticated benefit list. CSS Modules + i18n.
Component test.
Complexity: 2

**T-013** Web — "Me interesa" button island
`BenefitIntentButton.client.tsx` React island: calls protected intent endpoint,
toggles to "Ya marcaste interés" state, handles unauthenticated redirect.
Complexity: 2

**T-014** Web — host QR section (mi-cuenta)
`HostCardSection` component on the host `/mi-cuenta` page: fetches protected
host-credential, renders QR image (using a QR lib or `<img>` via a QR API),
shows active/inactive state + explainer.
Complexity: 2

**T-015** Admin — merchant management pages
TanStack Start pages for merchant list + create + edit. Polymorphic form with
entity_type selector. Benefit list inline on merchant detail.
Complexity: 3

**T-016** Admin — benefit management
Benefit add/edit/delete inline on merchant detail page + standalone benefit edit route.
Complexity: 2

**T-017** i18n — card keys (Phase 1)
Add `card.json` locale files for es/en/pt (landing, host, intent, invalid states).
Complexity: 1

### Phase 2 — Survey, metrics, review publication

**T-018** DB schema — survey table
`hospeda_card_surveys` schema + model. Add `survey_dispatched_at` column to
`hospeda_card_benefit_intents` (db:generate + migration). Add partial index for
undispatched intents (extras carril).
Complexity: 2

**T-019** Zod schemas — survey
`HospedaCardSurveySchema`, `HospedaCardSurveyCreateSchema`. Export from package.
Complexity: 1

**T-020** Service — survey dispatch and recording
`HospedaCardSurveyService`: `getEligibleIntents`, `recordSurvey`, `publishAsReview`.
Unit tests including review-publication consent path.
Complexity: 2

**T-021** Cron — survey dispatch job
`apps/api/src/cron/jobs/card-survey-dispatch.job.ts`. Schedule configurable via
`HOSPEDA_CARD_SURVEY_CRON`. Marks `survey_dispatched_at` on processed intents.
Register in cron manifest. Unit test.
Complexity: 2

**T-022** API — survey submission endpoints
`POST /api/v1/protected/card/surveys/:intentId` + `POST .../publish-review`.
Integration tests including authorization (user must own the intent).
Complexity: 2

**T-023** Notifications — survey email template
`card-survey` email template in `@repo/notifications` (es/en/pt). Survey link
in email pointing to web survey page. Test with notification test harness.
Complexity: 2

**T-024** Web — survey submission page
`apps/web/src/pages/[lang]/tarjeta/survey/[intentId].astro` — protected page,
shows survey form, optional review publication step. CSS Modules + i18n.
Complexity: 2

**T-025** i18n — card keys (Phase 2)
Add survey/email keys to `card.json` locale files.
Complexity: 1

## Open micro-decisions

1. **Intent re-marking after expiry.** Current: UNIQUE on `(user_id, benefit_id)` is
   permanent — a user can never re-mark the same benefit. Should the constraint be
   lifted if the original intent is older than N days? Decision needed before T-006.

2. **Survey email timing.** Default 48h after intent. Configurable via
   `HOSPEDA_CARD_SURVEY_DELAY_HOURS`. Should the cron check for last "me interesa"
   or the first? (Currently: first.) Decide before T-021.

3. **Rating mandatory in survey.** Current: rating is nullable (guest can submit
   "used = true" without a rating). Should rating be required when `used = true`?
   Decide before T-019.

4. **Solo-tarjeta merchant logo.** Current spec: `logo_url text NULLABLE` (free URL).
   Alternative: use existing media upload system. Free URL is simpler for v1 (admin
   pastes a URL); upload adds friction. Decision before T-001.

5. **QR render strategy.** The host card section needs to render a QR image.
   Options: (a) server-side render using a Node QR library in the API
   (`GET /protected/card/host-credential/qr.png`), (b) client-side via a JS QR lib,
   (c) third-party QR API URL. Decide before T-014.

6. **Throttle for same user re-scanning.** A user can scan the same QR multiple times.
   Re-scanning is harmless (intent is idempotent), but should there be a rate limit
   on the public landing endpoint per IP? Decide before T-007.

7. **Admin host-credential activation/deactivation.** Should admin be able to
   manually force-activate or deactivate a host credential (override the subscription
   check)? Current: only `PATCH /admin/card/host-credentials/:id`. Confirm scope
   before T-010.

## Dependencies

- **SPEC-239** (Gastronomía core) — required so `entity_type = 'gastronomy'` has a
  real ficha table to link to. Solo-tarjeta merchants work without it, but the
  auto-adhered flow is useless without real fichas.
- **SPEC-240** (Experiencias) — same reason for `entity_type = 'experience'`.
- Billing entitlement check (existing) — used in T-005 to gate host credential active
  state. No new billing spec dependency; reuses current accommodation plan entitlement.
- `@repo/notifications` (existing) — Phase 2 survey email.
