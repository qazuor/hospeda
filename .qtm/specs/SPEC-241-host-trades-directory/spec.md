---
spec-id: SPEC-241
title: "Host trades/services directory (24h emergency trades for hosts)"
type: feature
complexity: low
status: in-progress
created: 2026-06-15T00:00:00Z
tags: ["host", "directory", "admin-curated", "web", "mi-cuenta", "trades"]
---

# SPEC-241 — Host trades/services directory (24h emergency trades for hosts)

## Overview

**Goal.** Give authenticated hosts a private, geo-filtered directory of local
tradespeople (plumbers, locksmiths, HVAC, etc.) available on short notice — a
retention perk to keep hosts engaged on the platform. Providers do **not** pay;
this is entirely admin-curated, similar to how Destinos are managed. Only hosts
can see it, inside the `/mi-cuenta` web area.

**What it is (scope).**

- Admin creates/edits/deletes trade entries from the admin panel.
- Authenticated hosts with at least one accommodation see the directory at
  `/mi-cuenta/directorio-proveedores`, automatically filtered by the destinations
  of their accommodations. Multiple accommodations across multiple destinations
  mean they see all applicable trades.
- Each trade entry shows: name, category badge, contact (click-to-call /
  WhatsApp), benefit text (plain text, e.g. "10% off mentioning Hospeda"), is24h
  badge, and optional schedule text.
- No reviews, no FAQs, no subscriptions, no codes, no transaction tracking.
- The page has a client-side React island for filtering by category.

**What it is not.** This spec is explicitly **decoupled** from Tarjeta Hospeda
(SPEC-242). The `benefit` field is free text only — no codes, no redemption
tracking, no merchant payments.

## Locked design decisions (from scoping with product owner, 2026-06-15)

1. **Admin-curated**: no owner model, no billing. The provider does NOT pay.
   Pattern follows Destinos (no `ownerId`, no subscription FK on the table).
2. **Private read — hosts only**: visible only to authenticated users with the
   `HOST` role (or `ACCOMMODATION_VIEW_OWN` permission) inside `/mi-cuenta`. Not
   public, not a staff-admin-panel-only page.
3. **Geo-filtered automatically**: the protected API endpoint resolves the calling
   host's destination IDs from their accommodations server-side and returns only
   matching trade rows. No client-side destination filter UI. A host with no
   accommodations gets an empty state with an explanatory message.
4. **`benefit` is plain text**: free-form string like "10% descuento mencionando
   Hospeda". No codes, no tracking, no transactions.
5. **Category enum** (SCREAMING\_SNAKE\_CASE): `CERRAJERIA`, `PLOMERIA`,
   `ELECTRICIDAD`, `GAS`, `CLIMATIZACION`, `LIMPIEZA`, `FLETES`, `VIDRIERIA`,
   `CARPINTERIA`, `PILETA_JARDIN`, `PLAGAS`, `INTERNET`, `ALBANILERIA`.
6. **Admin CRUD**: full `BaseCrudService`-based admin entity (create, update, patch,
   delete, restore, hardDelete, list). Admin entity shells in `apps/admin`.
7. **Host-facing API endpoint**: `GET /api/v1/protected/host-trades` — resolves
   destinations server-side, returns filtered and active trades only.
8. **Web page**: `apps/web/src/pages/[lang]/mi-cuenta/directorio-proveedores/` —
   Astro SSR page + React island for category filtering. Card layout per trade.
9. **i18n**: all user-facing strings in es/en/pt via `@repo/i18n`.
10. **`dependsOn`**: none. Fully independent spec.

## Baseline (verified against `origin/staging`, 2026-06-15)

- `/mi-cuenta` host area lives in
  `apps/web/src/pages/[lang]/mi-cuenta/`. Existing sub-pages:
  `consultas/`, `consultas-propietario/`, `favoritos/`, `propiedades/`,
  `suscripcion/`, etc. A new `directorio-proveedores/` sub-page follows the same
  pattern.
- `destinations` table has `id`, `slug`, `name`. Accommodations reference
  `destinationId` (many-to-one FK). The host's destinations are derived by querying
  `accommodations WHERE ownerId = actorId AND deletedAt IS NULL` → `SELECT DISTINCT
  destinationId`.
- `PermissionEnum` is defined in
  `packages/schemas/src/enums/permission.enum.ts`. New values for this entity must
  be added there following the `<ENTITY>_<ACTION>` convention and exposed through
  `packages/db/src/schemas/enums.dbschema.ts` (the `PermissionPgEnum` wraps all
  values via `enumToTuple`).
- Admin route factory: `createAdminListRoute`, `createAdminRoute` in
  `apps/api/src/utils/route-factory.ts`. Pattern: thin handler + service call +
  `ResponseFactory`.
- DB enum pattern: new pg enum via `pgEnum('host_trade_category_enum',
  enumToTuple(HostTradeCategoryEnum))` in `enums.dbschema.ts`.
- Migrations: structural via `packages/db/src/migrations/` (`db:generate` +
  `db:migrate`); idempotent extras via `packages/db/src/migrations/extras/`.
- Web styling: CSS Modules + design tokens, no Tailwind. i18n via
  `createTranslations(locale)`. React islands with `client:idle` or
  `client:visible` directives.
- Admin app styling: Tailwind CSS v4. Forms: TanStack Form + Zod
  `schema.safeParse()`.

---

## Domain model

### `host_trades` table (single new entity)

One row per trade provider listing, many-to-one FK to a destination.

```
id              uuid          PK default random
slug            text          NOT NULL UNIQUE
name            text          NOT NULL
category        host_trade_category_enum  NOT NULL
contact         text          NOT NULL        -- phone or WhatsApp number/link
benefit         text          NOT NULL        -- plain text, e.g. "10% off"
destinationId   uuid          FK → destinations(id) ON DELETE RESTRICT
is24h           boolean       NOT NULL default false
scheduleText    text          NULL            -- optional free-form schedule note
isActive        boolean       NOT NULL default true
createdAt       timestamptz   NOT NULL default now()
updatedAt       timestamptz   NOT NULL default now()
createdById     uuid          FK → users(id) ON DELETE SET NULL
updatedById     uuid          FK → users(id) ON DELETE SET NULL
deletedAt       timestamptz   NULL            -- soft delete
deletedById     uuid          FK → users(id) ON DELETE SET NULL
```

**No `ownerId`** — this is admin-curated. No subscription FK.

### Category enum (`HostTradeCategoryEnum`)

```ts
export enum HostTradeCategoryEnum {
    CERRAJERIA      = 'CERRAJERIA',
    PLOMERIA        = 'PLOMERIA',
    ELECTRICIDAD    = 'ELECTRICIDAD',
    GAS             = 'GAS',
    CLIMATIZACION   = 'CLIMATIZACION',
    LIMPIEZA        = 'LIMPIEZA',
    FLETES          = 'FLETES',
    VIDRIERIA       = 'VIDRIERIA',
    CARPINTERIA     = 'CARPINTERIA',
    PILETA_JARDIN   = 'PILETA_JARDIN',
    PLAGAS          = 'PLAGAS',
    INTERNET        = 'INTERNET',
    ALBANILERIA     = 'ALBANILERIA',
}
```

### New `PermissionEnum` values

```ts
// HOST_TRADE: Permissions for the host trade directory
HOST_TRADE_VIEW  = 'hostTrade.view',     // Authenticated host can read active trade listings
HOST_TRADE_CREATE = 'hostTrade.create',  // Admin: create a trade entry
HOST_TRADE_UPDATE = 'hostTrade.update',  // Admin: update a trade entry
HOST_TRADE_DELETE = 'hostTrade.delete',  // Admin: soft-delete a trade entry
HOST_TRADE_RESTORE = 'hostTrade.restore', // Admin: restore a soft-deleted entry
HOST_TRADE_HARD_DELETE = 'hostTrade.hardDelete', // Admin: permanently delete
HOST_TRADE_VIEW_ALL = 'hostTrade.viewAll', // Admin: list all trades (including inactive/deleted)
```

And add `HOST_TRADE = 'HOST_TRADE'` to `PermissionCategoryEnum`.

---

## User Stories & Acceptance Criteria

### US-1 — Host browses the trade directory

GIVEN an authenticated host with at least one accommodation,
WHEN they navigate to `/mi-cuenta/directorio-proveedores`,
THEN they see a list of active trades filtered by their accommodation destinations.

- **AC-1.1** Only `isActive = true` and `deletedAt IS NULL` trades are returned.
- **AC-1.2** Only trades whose `destinationId` is in the host's accommodation
  destinations are shown (server-side scoping).
- **AC-1.3** A host with accommodations in multiple destinations sees all matching
  trades (union, not intersection).
- **AC-1.4** Each card shows: name, category badge (i18n label), contact
  (click-to-call/WhatsApp link), benefit text, is24h badge (if true), and
  scheduleText (if present).
- **AC-1.5** The server returns a stable order: `name ASC` within each category
  (the `category` column sorts by pg-enum declaration order, which is not
  meaningful on its own). The **client island groups trades by category and
  sorts the category groups alphabetically by their localized i18n label**, so
  the visible order is alphabetical in the user's locale (es/en/pt). Decision
  2026-06-15: ordering-by-localized-label is a client concern, not a server
  `ORDER BY category::text` — the displayed labels differ per locale.

### US-2 — Host filters trades by category

GIVEN a host on the directory page with trades from multiple categories,
WHEN they select a category from the filter,
THEN only trades of that category are shown (client-side, no server round-trip).

- **AC-2.1** A "Todos" / "All" option resets the filter.
- **AC-2.2** Category labels are i18n strings.
- **AC-2.3** Empty state is shown if no trades exist for the selected category.

### US-3 — Host with no accommodations sees an empty state

GIVEN an authenticated host with no (non-deleted) accommodations,
WHEN they navigate to `/mi-cuenta/directorio-proveedores`,
THEN they see an empty-state message explaining they need an accommodation to
unlock the directory.

- **AC-3.1** The empty-state copy is i18n and refers to creating an accommodation.
- **AC-3.2** No error or crash; the API returns `[]` and the page renders
  gracefully.

### US-4 — Admin manages trade entries (full CRUD)

GIVEN an admin user with `HOST_TRADE_CREATE/UPDATE/DELETE` permissions,
WHEN they use the admin panel,
THEN they can create, edit, soft-delete, restore, and hard-delete trade entries.

- **AC-4.1** Admin list shows all trades (active + inactive + soft-deleted if
  `includeDeleted=true`), paginated with `page` + `pageSize`.
- **AC-4.2** Admin list is filterable by `destinationId`, `category`, `isActive`,
  `search` (name/contact), `includeDeleted`.
- **AC-4.3** Create form requires: name, category, contact, benefit, destinationId,
  is24h. `scheduleText` and `slug` are optional (slug auto-generated from name if
  omitted).
- **AC-4.4** Soft delete sets `deletedAt`; restore clears it. Hard delete is
  permanent.
- **AC-4.5** All mutations are audited (`createdById`, `updatedById`).

### US-5 — Unauthenticated or non-host users cannot access the directory

- **AC-5.1** `GET /api/v1/protected/host-trades` returns `401` for unauthenticated
  requests and `403` for authenticated users without `HOST_TRADE_VIEW`.
- **AC-5.2** The Astro page redirects unauthenticated users to the login page (same
  pattern as other `/mi-cuenta` pages).
- **AC-5.3** Tourist-role users who reach the page see a 403 / access-denied
  state, not trade data.

---

## Technical Approach

### Schemas (`@repo/schemas`, new entity dir `entities/host-trade/`)

New files following the standard entity schema file convention:

- **`host-trade.schema.ts`** — `HostTradeSchema`: all fields including
  `HostTradeCategoryEnum` field, `is24h`, `scheduleText`, `destinationId`, audit
  fields. Export `type HostTrade`.
- **`host-trade.crud.schema.ts`** — `CreateHostTradeSchema` (omit id, timestamps,
  soft-delete, require name/category/contact/benefit/destinationId/is24h; slug
  optional with `.optional()`) and `UpdateHostTradeSchema` (all fields optional).
- **`host-trade.query.schema.ts`** — `HostTradeQuerySchema`: filter by
  `destinationId`, `category`, `is24h`, pagination.
- **`host-trade.admin-search.schema.ts`** — extends `AdminSearchBaseSchema` with
  `destinationId`, `category`, `isActive`, `is24h` filters.
- **`host-trade.http.schema.ts`** — `HostTradePublicSchema` (host-facing read
  shape, strips audit internals), admin create/update request/response schemas,
  `HostTradeAdminSchema` (full shape for admin responses).
- **`index.ts`** — re-exports all.

`HostTradeCategoryEnum` (Zod enum schema) lives in
`packages/schemas/src/enums/host-trade-category.enum.ts` and is re-exported from
`packages/schemas/src/enums/index.ts`. The TypeScript enum `HostTradeCategoryEnum`
must also be added there for the pgEnum wrapper.

### Service (`@repo/service-core`, `services/hostTrade/`)

`HostTradeService extends BaseCrudService<HostTrade>`. Key operations:

- `adminList(actor, filters)` — admin paginated list; respects `includeDeleted`.
- `adminGetById(actor, { id })` — admin detail.
- `adminCreate(actor, data)` — requires `HOST_TRADE_CREATE`.
- `adminUpdate(actor, { id }, data)` — requires `HOST_TRADE_UPDATE`.
- `adminPatch(actor, { id }, data)` — partial update.
- `adminDelete(actor, { id })` — soft delete; requires `HOST_TRADE_DELETE`.
- `adminRestore(actor, { id })` — requires `HOST_TRADE_RESTORE`.
- `adminHardDelete(actor, { id })` — requires `HOST_TRADE_HARD_DELETE`.
- **`listForHost(actor)`** — host-facing. Resolves actor's accommodation
  destination IDs, returns active trades for those destinations ordered by
  `category ASC, name ASC`. Requires `HOST_TRADE_VIEW`.

Permission checks use `PermissionEnum` only (never role-check directly).

### DB (`@repo/db`)

- **`packages/db/src/schemas/host-trade/host_trade.dbschema.ts`** — Drizzle table
  `hostTrades` (snake\_case table name `host_trades`). Uses
  `HostTradeCategoryPgEnum = pgEnum('host_trade_category_enum',
  enumToTuple(HostTradeCategoryEnum))` defined in `enums.dbschema.ts`. Columns
  match the domain model above. Relations: `one(destinations)`, `one(users,
  createdBy)`, `one(users, updatedBy)`.
- **`packages/db/src/schemas/host-trade/index.ts`** — re-exports.
- **`packages/db/src/models/hostTrade/host-trade.model.ts`** — `HostTradeModel
  extends BaseModel<HostTrade>`. Custom method: `findForHost(destinationIds:
  string[])` — returns active, non-deleted trades where `destinationId IN
  (destinationIds)` ordered by `category ASC, name ASC`.
- Migration: run `pnpm db:generate` after adding the schema file; review and
  commit the generated `.sql`. No extras needed (no triggers/matviews).
- Update `packages/db/src/schemas/index.ts` and `packages/db/src/models/index.ts`
  to re-export the new files.

### API

**Protected (host-facing):**

```
GET /api/v1/protected/host-trades
```

Route: `apps/api/src/routes/host-trade/protected/list.ts`.
Permission: `HOST_TRADE_VIEW`. No query params (destinations resolved server-side
from actor's accommodations). Response: array of `HostTradePublicSchema`.
Auth: `getActorFromContext` → `accommodationService.getDistinctDestinationIdsByOwner(actorId)`
→ `hostTradeService.listForHost(actor)`.

Route registration in `apps/api/src/routes/index.ts`:

```
app.route('/api/v1/protected/host-trades', protectedHostTradeRoutes);
app.route('/api/v1/admin/host-trades', adminHostTradeRoutes);
```

**Admin CRUD:**

```
GET    /api/v1/admin/host-trades          — list (paginated, filterable)
GET    /api/v1/admin/host-trades/:id      — get by ID
POST   /api/v1/admin/host-trades          — create
PUT    /api/v1/admin/host-trades/:id      — update
PATCH  /api/v1/admin/host-trades/:id      — partial update
DELETE /api/v1/admin/host-trades/:id      — soft delete
POST   /api/v1/admin/host-trades/:id/restore    — restore
DELETE /api/v1/admin/host-trades/:id/hard       — hard delete
```

Routes follow the `createAdminRoute` / `createAdminListRoute` factory pattern.
Required permissions per operation as defined in `PermissionEnum`.

Add matrix rows to `docs/billing/endpoint-gate-matrix.md` for all new routes
(Decision: `none` for host-facing list — no entitlement gate; `HOST_TRADE_*`
permissions for admin routes).

### Web (`apps/web`)

New page: `apps/web/src/pages/[lang]/mi-cuenta/directorio-proveedores/index.astro`.

Pattern:

1. Astro SSR: check session (redirect to login if unauthenticated). Call
   `GET /api/v1/protected/host-trades` (internal fetch with session cookie).
2. Pass `trades` array (or empty) to a React island
   `TradesDirectory.client.tsx` (`client:idle`).
3. The React island renders:
   - A category filter bar (pill buttons, i18n labels). "Todos" resets.
   - A card grid. Each `TradeCard` shows: name, category badge, contact link
     (tel: or wa.me/), benefit text, is24h badge, scheduleText.
4. Empty state: if `trades.length === 0` and actor has no accommodations, show
   "Necesitás tener alojamientos registrados para ver este directorio." If the
   host has accommodations but no trades exist for their destinations, show
   "No hay proveedores disponibles para tus destinos por ahora."

Styling: CSS Modules (`TradesDirectory.module.css`, `TradeCard.module.css`),
design tokens, no Tailwind. Same pattern as other `/mi-cuenta` sub-pages.

i18n key namespace: `host-trades` (keys under
`packages/i18n/src/locales/{es,en,pt}/host-trades.json`).

### Admin (`apps/admin`)

New entity shells following the Phase 6 / SPEC-154 admin Entity pattern:

- `apps/admin/src/routes/platform/host-trades/` (or `directory/host-trades/`) —
  file-based routing: `index.tsx` (list), `$id.tsx` (view/edit), `new.tsx` (create).
- TanStack Query for data fetching. Shadcn UI components.
- Form fields: name (text), category (select with i18n labels), contact (text),
  benefit (textarea), destinationId (select/search from destination list),
  is24h (checkbox), scheduleText (textarea, optional), isActive (checkbox).
- Slug: auto-generated from name client-side, editable.
- Uses `createAdminRoute` + `HostTradeAdminSchema` for type safety.

### i18n (`@repo/i18n`)

New locale file: `packages/i18n/src/locales/{es,en,pt}/host-trades.json`.

Keys to cover (minimum set):

```json
{
  "page.title": "Directorio de proveedores",
  "page.subtitle": "Proveedores locales de confianza para tu alojamiento",
  "filter.all": "Todos",
  "emptyState.noAccommodations": "Necesitás tener alojamientos registrados para ver este directorio.",
  "emptyState.noTrades": "No hay proveedores disponibles para tus destinos por ahora.",
  "card.is24h": "Disponible 24hs",
  "card.benefit": "Beneficio para hosts",
  "card.contact": "Contactar",
  "categories.CERRAJERIA": "Cerrajería",
  "categories.PLOMERIA": "Plomería",
  "categories.ELECTRICIDAD": "Electricidad",
  "categories.GAS": "Gas",
  "categories.CLIMATIZACION": "Climatización",
  "categories.LIMPIEZA": "Limpieza",
  "categories.FLETES": "Fletes",
  "categories.VIDRIERIA": "Vidriería",
  "categories.CARPINTERIA": "Carpintería",
  "categories.PILETA_JARDIN": "Pileta y Jardín",
  "categories.PLAGAS": "Control de plagas",
  "categories.INTERNET": "Internet / TV",
  "categories.ALBANILERIA": "Albañilería"
}
```

### Seed (`@repo/seed`, example data)

Add example `host_trades` rows so the directory is populated out-of-the-box after
`pnpm db:seed` / `pnpm db:fresh-dev`, mirroring how Destinos and other entities
are seeded.

Pattern (follows the existing example-seed convention):

- **Data files**: `packages/seed/src/data/hostTrade/*.json` — one JSON per trade
  row, numbered like the other entities (e.g.
  `001-host-trade-cerrajeria-uruguay.json`). Provide a realistic spread:
  **at least 2 trades per seeded destination across several categories**
  (CERRAJERIA, PLOMERIA, ELECTRICIDAD, GAS, CLIMATIZACION at minimum), with a mix
  of `is24h: true/false` and some with `scheduleText`, some without. Reference
  existing seeded `destinationId`s (Concepción del Uruguay, Colón, Concordia,
  Gualeguaychú, etc.) so the host-side geo-filter has data to match.
- **Manifest**: add a `"hostTrades"` array listing those filenames to
  `packages/seed/src/manifest-example.json`.
- **Loader**: `packages/seed/src/example/hostTrades.seed.ts` — reads the data
  files, validates against the seed schema, inserts via the model/service.
  Register it in `packages/seed/src/example/index.ts` **after** destinations and
  users (FK to `destinations`, `createdById` to `users`).
- **Seed schema**: add the host-trade entry to `packages/seed/src/schemas/` if the
  seed package validates rows against a per-entity schema (match the existing
  convention there).
- `createdById` / `updatedById` on seeded rows point to a seeded admin/super-admin
  user; `isActive: true`, `deletedAt: null`.

Acceptance: after `pnpm db:fresh-dev`, a seeded host with accommodations in a
seeded destination sees a non-empty directory at
`/mi-cuenta/directorio-proveedores`.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Host's accommodation destinations change after page load | Low | Server resolves destinations at request time; stale data only lasts one page visit. |
| `benefit` field misused as a promo code or tracking URL | Low | Plain text only; no URL validation; admin responsibility. |
| Permission enum grows unbounded | Low | 7 new values follows existing pattern; no structural change to the enum file. |
| Admin forgets to set `destinationId` | Low | `destinationId` is required at both schema and DB level. |
| pg enum migration is irreversible (can't remove values) | Low | Only add enum values; never remove. Enum additions are forward-safe. |

## Out of Scope

- Public (unauthenticated) access to the trade directory.
- Tourist or staff-admin-panel access.
- Reviews, FAQs, or ratings on trade entries.
- Any form of code, QR, or transaction tracking (see SPEC-242 / Tarjeta Hospeda
  for that path).
- Provider self-registration or payment.
- Push/email notifications to hosts when new trades are added.
- Mobile app integration (deferred to SPEC-E mobile sub-specs).
- Multi-destination filter UI on the web page (geo-filter is fully server-side).

## Suggested Tasks (phased)

### Phase 1 — Enums, schemas, i18n (complexity 2)

**T-001** Add `HostTradeCategoryEnum` to `@repo/schemas/src/enums/` and re-export.
(complexity 1)

**T-002** Add `HOST_TRADE_*` values to `PermissionEnum` and `HOST_TRADE` to
`PermissionCategoryEnum` in `permission.enum.ts`. (complexity 1)

**T-003** Create `entities/host-trade/` schema files: `host-trade.schema.ts`,
`host-trade.crud.schema.ts`, `host-trade.query.schema.ts`,
`host-trade.admin-search.schema.ts`, `host-trade.http.schema.ts`, `index.ts`.
Write Vitest schema tests. (complexity 2)

**T-004** Create i18n locale files `host-trades.json` for es/en/pt with all keys
defined in the spec. (complexity 1)

### Phase 2 — DB: table, model, migration (complexity 2)

**T-005** Add `HostTradeCategoryPgEnum` to `packages/db/src/schemas/enums.dbschema.ts`
and update `PermissionPgEnum` (picks up via `enumToTuple`, no manual change
needed if the enum is added in T-002). (complexity 1)

**T-006** Create `packages/db/src/schemas/host-trade/host_trade.dbschema.ts` with
Drizzle table definition and relations. Update schema `index.ts`. (complexity 2)

**T-007** Run `pnpm db:generate`, review and commit migration file. Verify with
`pnpm db:migrate` locally. (complexity 1)

**T-008** Create `packages/db/src/models/hostTrade/host-trade.model.ts` extending
`BaseModel` with `findForHost(destinationIds)` method. Update model `index.ts`.
Write integration tests. (complexity 2)

**T-008b** Add example seed data: `packages/seed/src/data/hostTrade/*.json`
(≥2 trades per seeded destination across several categories, mixed `is24h` and
`scheduleText`), register filenames in `manifest-example.json`, create the
`example/hostTrades.seed.ts` loader and wire it into `example/index.ts` **after**
destinations and users (FK order). Add the seed schema entry if the package
validates rows. Verify with `pnpm db:fresh-dev` that the directory is non-empty
for a seeded host. (complexity 2)

### Phase 3 — Service + API (complexity 2)

**T-009** Create `packages/service-core/src/services/hostTrade/host-trade.service.ts`
extending `BaseCrudService`. Implement `listForHost(actor)` (resolve destinations
from actor's accommodations, delegate to model). **On create/update, de-duplicate
the slug**: the `slug` column is globally `UNIQUE`, so auto-generated slugs that
collide (same provider name in different destinations) must be suffixed
incrementally (`-2`, `-3`, …) before insert. Write unit tests for all operations,
including the slug-collision case. (complexity 2)

**T-010** Create admin API routes (`list`, `getById`, `create`, `update`, `patch`,
`delete`, `restore`, `hardDelete`) in `apps/api/src/routes/host-trade/admin/`.
Register in `routes/index.ts`. (complexity 2)

**T-011** Create protected host API route (`GET /api/v1/protected/host-trades`) in
`apps/api/src/routes/host-trade/protected/`. Register in `routes/index.ts`. Write
API integration tests (mocked actor, destination resolution, 401/403 guards).
(complexity 2)

**T-012** Add matrix rows to `docs/billing/endpoint-gate-matrix.md` for all new
routes. (complexity 1)

### Phase 4 — Web host UI (complexity 2)

**T-013** Create `apps/web/src/pages/[lang]/mi-cuenta/directorio-proveedores/index.astro`:
SSR auth check, fetch protected endpoint, pass data to island. Handle empty states
(no accommodations vs. no trades). (complexity 2)

**T-014** Create `TradesDirectory.client.tsx` React island: category filter bar +
card grid. Implement `TradeCard` component. CSS Modules. Use i18n keys.
(complexity 2)

**T-015** Write component tests for `TradesDirectory` and `TradeCard` (vitest +
testing-library). (complexity 1)

### Phase 5 — Admin UI (complexity 2)

**T-016** Create admin entity list page `apps/admin/src/routes/platform/host-trades/index.tsx`:
TanStack Query, paginated table, filters (category, destination, isActive,
search). (complexity 2)

**T-017** Create admin create/edit form
`apps/admin/src/routes/platform/host-trades/new.tsx` and
`apps/admin/src/routes/platform/host-trades/$id.tsx`: TanStack Form +
`HostTradeAdminSchema.safeParse()`. All required fields. (complexity 2)

**T-018** Write admin entity tests (TanStack Query mocks, form submit, error
handling). (complexity 1)

---

## Open micro-decisions (defaults applied — flag if you disagree)

1. **Admin navigation placement**: `Plataforma > Directorio de oficios` (default)
   vs. a new top-level nav item. Default: under Plataforma alongside Destinos.
2. **Slug generation**: auto-generated from name on create if not provided (default:
   slugify(name)); always editable by admin. Default: auto + editable.
3. **Contact field format**: plain text string (phone or URL like `wa.me/54...`)
   with no validation (default). Alternative: split into `contactPhone` +
   `contactWhatsapp`. Default: single `contact` text field — simpler, admin
   controls content.
4. **Host access gate**: requires `HOST_TRADE_VIEW` permission (default). The role
   assignment strategy (which roles get this permission by default) is a role-config
   detail confirmed at implementation time — likely `HOST` role gets it; `TOURIST`
   and above-HOST staff do not.
5. **Category filter UI**: client-side pill buttons (default) vs. server-round-trip
   query params. Default: client-side (array is small, latency matters for UX).

## Dependencies

- **None** — this spec is fully independent.
- SPEC-242 (Tarjeta Hospeda) will reference this spec's trade entries as optional
  "benefit providers", but SPEC-241 has no dependency on SPEC-242.
- The `destinations` table and `accommodations` table are existing; no schema
  changes to them are required.
