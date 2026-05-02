---
spec-id: SPEC-098
title: Favorites & Collections MVP
type: feature
complexity: medium
status: draft
created: 2026-05-02T04:04:18Z
effort_estimate_hours: 52-68
tags: [favorites, bookmarks, collections, web, api, schemas, service-core]
---

# SPEC-098: Favorites & Collections MVP

## Part 1 -- Functional Specification

---

### 1. Overview & Goals

**Goal:** Extend the existing bookmarks system (SPEC-096) so that authenticated users can organize
their saved items into named collections, add inline notes to individual bookmarks, and see social
proof counters ("Saved by N people") on listing cards and detail pages. The feature also closes the
guest experience gap by showing an `AuthRequiredPopover` whenever an anonymous user tries to
interact with a favorite heart.

**Motivation:**

- Users already save accommodations, destinations, events, and posts to a flat favorites list.
  Without organization, the list becomes unusable as it grows. Collections are the lowest-effort
  organizing mechanism that solves real trip-planning workflows (e.g., "Weekend in Concepcion",
  "Budget options").
- The public "Saved by N people" counter adds social proof at zero privacy cost and increases
  booking confidence, particularly on accommodation detail pages.
- The "Most saved" sort option gives the platform a rankings signal derived from user behavior
  rather than editorial curation.
- Anonymous users who click a heart see a hard dead-end today (the heart does nothing). An
  `AuthRequiredPopover` converts that intent into a registration/login action.

**Success Metrics:**

- At least 30% of authenticated users have created at least one collection within 30 days of
  launch.
- Average session duration on the `/favoritos` page increases (baseline to be set at launch).
- Detail pages with a "Saved by 10+" counter show a measurable CTR increase on the primary CTA
  (contact / inquire) compared to pages without.
- Zero server errors related to cross-user bookmark access after launch (security metric).
- 90%+ code coverage on all new backend code.

**Target Users:**

Authenticated travelers planning multi-day trips in the Litoral region who need to organize
research across multiple entity types (accommodations, destinations, events, blog articles).

---

### 2. Out of Scope

The following items are explicitly excluded from this MVP and must NOT be implemented:

| Excluded Item | Rationale |
|---|---|
| Admin UI for collections / bookmarks | Low priority; `VIEW_ANY` permission is scaffolded but orphaned until needed. |
| Sharing collections publicly (public links) | Requires privacy model decisions; deferred to a future spec. |
| Anonymous bookmarks via localStorage + migration on login | Product complexity not justified in MVP. |
| Bulk operations (bulk-delete, bulk-move) | Can be added post-MVP if user research shows demand. |
| Price-drop or availability notifications on bookmarked items | Depends on a notification spec not yet written. |
| Denormalization of entity name/image into bookmark row | YAGNI -- entity joins are acceptable at this traffic level. |
| Cross-device sync beyond DB persistence | DB-level persistence already provides cross-device sync. No additional work needed. |
| ATTRACTION entity type | Current seed data is sparse; defer until attraction pages are built. |
| Inline rich-text notes (markdown, formatting) | Plain textarea is sufficient for MVP. |
| Collection sorting / reordering | MVP uses creation-date order. |
| Export / print collections | Out of scope; no defined use case yet. |

---

### 2a. Phase 0 Audit Findings

The four Phase 0 setup tasks (T-001..T-004) completed audits before implementation. Key findings that altered the original spec:

**T-001 (AuthRequiredPopover):** `title` and `message` props were already absent from the component interface. They were added with backward-compatible defaults during the audit task. No API or behavioral change resulted; the component is ready for favorites context reuse.

**T-002 (DestinationCard extraction):** The audit confirmed that no standalone `DestinationCard.astro` exists. Inline card JSX is duplicated in `DestinationsIsland.client.tsx` (lines ~209-269) and `destinos/index.astro` (lines ~96-113). The original spec deferred extraction as a follow-up TODO. Given the FavoriteButton integration requires a stable card anchor, the extraction was promoted to IN SCOPE (tasks T-DC1..T-DC4).

**T-003 (Limit middleware + path):** The audit found that `enforceFavoritesLimit` for bookmarks lives in `apps/api/src/middlewares/` (plural -- not `middleware/`). It is plan-based. For collections, the original spec proposed a separate `enforceCollectionsLimit` middleware. After audit, the decision was revised: the limit guard lives in `UserBookmarkCollectionService._canCreate`, reads `HOSPEDA_MAX_COLLECTIONS_PER_USER` env var (default 10), and returns error payload `{ currentCount, maxAllowed }` so the UI can render a live counter. No separate middleware is created.

**T-004 (Public count endpoint):** The audit confirmed the endpoint `GET /api/v1/public/user-bookmarks/count` does not exist anywhere in the API codebase. The folder `apps/api/src/routes/user-bookmark/public/` does not exist either. T-028 was rewritten to build from scratch rather than verify/extend.

---

### 3. User Stories & Acceptance Criteria

#### US-01 -- Authenticated user adds a favorite from a listing card

**As** an authenticated traveler,
**I want** to save an accommodation (or event / destination / post) to my favorites directly
from the listing card,
**So that** I can bookmark it without leaving the listing page.

**AC-01.1 -- Toggle heart on card (authenticated)**

- **Given** I am logged in and browsing `/alojamientos`,
  **When** I click the heart icon on an `AccommodationCard`,
  **Then** the heart fills immediately (optimistic update) and a POST to
  `/api/v1/protected/user-bookmarks` is sent in the background; the bookmark is created and
  a toast "Guardado en favoritos" appears.

- **Given** the accommodation is already bookmarked,
  **When** I click the filled heart on its card,
  **Then** the heart empties immediately (optimistic update) and the bookmark is toggled off
  (soft-deleted); a toast "Eliminado de favoritos" appears.

- **Given** the API call fails (network error or 5xx),
  **When** the error response arrives,
  **Then** the heart reverts to its pre-click state and a toast "Error al actualizar
  favoritos" appears.

**AC-01.2 -- Toggle heart on EventCard, ArticleCard, DestinationCard (same behavior)**

- **Given** I am browsing `/eventos`, `/publicaciones`, or `/destinos`,
  **When** I click the heart on any card,
  **Then** the same optimistic-toggle behavior applies as AC-01.1 for the respective
  `entityType` (EVENT, POST, DESTINATION).

- **Note:** `DestinationCard` does not exist as a standalone Astro component today. The heart
  must be integrated wherever destination cards render inside
  `DestinationsIsland.client.tsx`. This integration is tracked as a Phase 6 task and must
  be resolved before this AC can be tested end-to-end.

**AC-01.3 -- Heart renders correct initial state on page load**

- **Given** I am logged in and a listing page loads,
  **When** the page renders with a list of cards,
  **Then** a bulk-check call is made to
  `POST /api/v1/protected/user-bookmarks/check-bulk` with the entity IDs visible in the
  viewport, and each heart reflects the correct saved/unsaved state before user interaction.

---

#### US-02 -- Anonymous user clicks heart and sees AuthRequiredPopover

**As** a guest (not logged in),
**I want** to see a clear prompt when I try to save something,
**So that** I understand I need an account and can easily create one.

**AC-02.1 -- Guest clicks heart**

- **Given** I am not logged in and browsing any listing or detail page,
  **When** I click a heart icon on any card or in the DetailHeader,
  **Then** an `AuthRequiredPopover` appears anchored to the heart; no HTTP request is sent to
  the bookmarks API; no bookmark is created.

**AC-02.2 -- Popover content**

- **Given** the `AuthRequiredPopover` is open,
  **Then** it shows:
  - A contextual title: "Inicia sesion para guardar favoritos"
  - A short message: "Crea una cuenta gratuita y organiza tus lugares favoritos del Litoral."
  - A primary CTA button: "Registrarse" (links to `/auth/signup`)
  - A secondary link: "Ya tengo cuenta" (links to `/auth/signin`)

**AC-02.3 -- Popover closes on outside click or Escape**

- **Given** the popover is open,
  **When** I click outside it or press Escape,
  **Then** the popover closes and the heart returns to its empty unfilled state.

---

#### US-03 -- Authenticated user creates a collection

**As** an authenticated traveler,
**I want** to create a named collection to group related favorites,
**So that** I can organize my saved items by trip, theme, or category.

**AC-03.1 -- Create collection from favorites page**

- **Given** I am on `/favoritos` and have not reached the collection limit (default 10, configurable),
  **When** I click "Nueva coleccion",
  **Then** a modal opens with: name field (required, max 50 chars), description field
  (optional, max 200 chars), color picker (10 swatches), and icon picker (subset of
  @repo/icons).

**AC-03.2 -- Submit valid collection**

- **Given** the modal is open and I have filled in a unique name,
  **When** I click "Crear",
  **Then** the collection is created via
  `POST /api/v1/protected/user-bookmark-collections`, the modal closes, the new collection
  appears at the top of "Mis colecciones", and a toast "Coleccion creada" appears.

**AC-03.3 -- Duplicate name validation**

- **Given** I already have a collection named "Viaje al Litoral",
  **When** I try to create another with the same name,
  **Then** the API returns 409 and the modal shows an inline error: "Ya tenes una coleccion
  con ese nombre".

**AC-03.4 -- Collection limit**

- **Given** I already have reached the maximum active collections (default 10, configurable via `HOSPEDA_MAX_COLLECTIONS_PER_USER`),
  **When** I try to create another,
  **Then** the API returns 422 with `COLLECTION_LIMIT_REACHED` (body: `{ currentCount, maxAllowed }`) and the "Nueva coleccion"
  button is disabled showing "Ya alcanzaste el maximo de colecciones (X / X)" from the usage counter in the page header.

---

#### US-04 -- Authenticated user edits a collection

**As** an authenticated traveler,
**I want** to rename or update the description/color/icon of an existing collection,
**So that** I can correct a typo or reorganize my categories.

**AC-04.1 -- Edit from collections grid**

- **Given** I am on `/favoritos` and I open the context menu on a collection card,
  **When** I select "Editar",
  **Then** the same create/edit modal opens pre-filled with the collection's current name,
  description, color, and icon.

**AC-04.2 -- Submit valid edit**

- **Given** the edit modal is open and I change the name to a unique value,
  **When** I click "Guardar",
  **Then** a `PATCH /api/v1/protected/user-bookmark-collections/:id` is sent, the modal
  closes, the collection card updates with the new name/color/icon, and a toast "Coleccion
  actualizada" appears.

**AC-04.3 -- Edit duplicate name**

- **Given** I rename a collection to match the name of a different existing collection,
  **Then** the same duplicate-name error as AC-03.3 applies.

---

#### US-05 -- Authenticated user deletes a collection

**As** an authenticated traveler,
**I want** to delete a collection I no longer need,
**So that** I can keep my organization tidy without losing the bookmarks inside.

**AC-05.1 -- Delete collection -- bookmarks preserved**

- **Given** I open the context menu on a collection that has 5 bookmarks,
  **When** I select "Eliminar" and confirm the dialog,
  **Then** a `DELETE /api/v1/protected/user-bookmark-collections/:id` is sent; the collection
  is soft-deleted; its 5 bookmarks remain in my favorites (their `collectionId` is set to
  NULL via FK `ON DELETE SET NULL`); those bookmarks appear in the "Sin coleccion" section.

**AC-05.2 -- Confirmation dialog content**

- **Given** I click "Eliminar" on a collection,
  **Then** a confirmation dialog shows: "Eliminar la coleccion '[name]'? Los favoritos que
  contiene se conservaran en Sin coleccion."

**AC-05.3 -- Empty collection delete**

- **Given** the collection has 0 bookmarks,
  **When** I delete it,
  **Then** it is removed without showing the bookmarks-preserved message (simplified dialog).

---

#### US-06 -- Authenticated user moves a bookmark to a collection

**As** an authenticated traveler,
**I want** to assign a bookmark to a collection,
**So that** I can organize my favorites without re-saving them.

**AC-06.1 -- Move via "Mover a coleccion" menu on favorites page**

- **Given** I am on `/favoritos` and I open the context menu on a bookmark card,
  **When** I select "Mover a coleccion",
  **Then** a modal opens listing my collections as radio buttons, with "Sin coleccion" as the
  first option and "+ Nueva coleccion" as the last option.

**AC-06.2 -- Select existing collection**

- **Given** the move modal is open,
  **When** I select a collection and click "Mover",
  **Then** a `POST /api/v1/protected/user-bookmark-collections/:id/bookmarks/:bookmarkId`
  is sent; the bookmark moves to that collection; the modal closes; a toast "Movido a
  [collection name]" appears.

**AC-06.3 -- Move to "Sin coleccion"**

- **Given** a bookmark is currently in a collection,
  **When** I select "Sin coleccion" in the move modal and click "Mover",
  **Then** a DELETE request to the collection bookmarks sub-resource is sent; the bookmark's
  `collectionId` is set to NULL; it reappears in "Sin coleccion".

**AC-06.4 -- Create collection inline during move**

- **Given** the move modal is open,
  **When** I click "+ Nueva coleccion",
  **Then** a mini inline form (name only, required) expands within the modal; upon submit the
  collection is created and immediately selected; the bookmark is moved to it.

---

#### US-07 -- Authenticated user removes a bookmark from a collection

**As** an authenticated traveler,
**I want** to remove a bookmark from a collection without deleting the bookmark entirely,
**So that** I can reorganize without losing a saved item.

**AC-07.1 -- Remove from collection detail page**

- **Given** I am on `/favoritos/colecciones/:id`,
  **When** I open the context menu on a bookmark card and select "Quitar de esta coleccion",
  **Then** a DELETE request to the collection bookmarks sub-resource is sent; the bookmark
  disappears from the collection view but remains accessible from `/favoritos` under
  "Sin coleccion"; a toast "Quitado de la coleccion" appears.

---

#### US-08 -- Authenticated user adds inline notes to a bookmark

**As** an authenticated traveler,
**I want** to write personal notes on a saved item,
**So that** I can record why I saved it or what to check before booking.

**AC-08.1 -- Expand notes editor**

- **Given** I am on `/favoritos` or `/favoritos/colecciones/:id`,
  **When** I click the "Agregar nota" button on a bookmark card (or the existing note text if
  one exists),
  **Then** a textarea expands inline below the card content with the current note pre-filled
  (empty if no note exists yet).

**AC-08.2 -- Save note**

- **Given** the textarea is open and I have typed a note (max 500 chars),
  **When** I click "Guardar" or press Ctrl+Enter,
  **Then** a `PATCH /api/v1/protected/user-bookmarks/:id` is sent with the note content;
  the textarea collapses; the first line of the note is shown as a truncated preview on the
  bookmark card.

**AC-08.3 -- Delete note**

- **Given** a bookmark has an existing note,
  **When** I clear the textarea and click "Guardar",
  **Then** the note is set to NULL/empty; the "Agregar nota" button reappears.

**AC-08.4 -- Character limit**

- **Given** the textarea is open,
  **When** I type more than 500 characters,
  **Then** a character counter turns red and the save button is disabled until under the
  limit.

---

#### US-09 -- Public "Saved by N people" counter on detail page

**As** any visitor (authenticated or not),
**I want** to see how many people have saved an accommodation (or other entity),
**So that** I can use social proof to assess its popularity.

**AC-09.1 -- Counter always visible on detail page**

- **Given** any published accommodation, destination, event, or post detail page,
  **When** the page loads,
  **Then** a "Guardado por N personas" counter is visible in the `DetailHeader` next to the
  favorite heart, regardless of whether the visitor is logged in and regardless of the count
  value (even if count is 0: "Se el primero en guardarlo").

**AC-09.2 -- Counter accuracy**

- **Given** a user saves an accommodation at time T,
  **Then** within one page load after T, the counter on the detail page reflects the new
  count (no manual refresh required beyond the next page load; real-time push is out of
  scope).

**AC-09.3 -- Counter is public (no auth required)**

- **Given** the count endpoint
  `GET /api/v1/public/user-bookmarks/count?entityType=ACCOMMODATION&entityId=:id`,
  **Then** it returns `{ count: N }` without requiring an Authorization header.

---

#### US-10 -- "Saved by N" counter on listing cards (threshold)

**As** any visitor browsing a listing page,
**I want** to see a save-count pill on popular accommodations,
**So that** I can quickly identify high-demand properties.

**AC-10.1 -- Counter appears only when count >= 3**

- **Given** an `AccommodationCard` (or `EventCard`, `ArticleCard`) is rendered,
  **When** the entity has fewer than 3 active bookmarks,
  **Then** NO counter pill is shown (avoids showing "1 person saved this" which lacks social
  proof value).

- **Given** the same card when the entity has 3 or more active bookmarks,
  **Then** a pill "N guardados" is visible in the card (bottom-left or suitable corner).

**AC-10.2 -- Count is loaded efficiently**

- **Given** a listing page renders N cards,
  **Then** the counts are loaded as part of the entity list response (service-level join or
  subquery) rather than N individual API calls.

---

#### US-11 -- "Most Saved" sort option on listings

**As** any visitor browsing accommodations, events, or posts,
**I want** to sort results by how many people have saved them,
**So that** I can discover the most popular options first.

**AC-11.1 -- Sort option in listing UI**

- **Given** I am on `/alojamientos`, `/eventos`, or `/publicaciones`,
  **When** I open the sort dropdown,
  **Then** I see a "Mas guardados" option alongside existing sort options.

**AC-11.2 -- Sort applies correctly**

- **Given** I select "Mas guardados",
  **Then** the listing re-fetches with `sortBy=bookmarkCount&sortOrder=desc` and returns
  entities ordered by their active bookmark count from highest to lowest.

**AC-11.3 -- Index requirement (non-functional)**

- **Given** the "Mas guardados" sort is live,
  **Then** the query uses the compound index on
  `user_bookmarks(entityId, entityType, deletedAt)`; page load time at p95 does not degrade
  vs. the default sort.

---

#### US-12 -- Favorites page: tabs + uncollected section + collections grid

**As** an authenticated traveler,
**I want** to see all my favorites organized by entity type AND by collection on a single
page,
**So that** I can quickly navigate to the right category or trip plan.

**AC-12.1 -- Entity type tabs**

- **Given** I am on `/favoritos`,
  **Then** I see tabs: "Alojamientos", "Destinos", "Eventos", "Blog" (only tabs with at
  least one bookmark are shown; empty tabs may optionally be hidden per UX decision).

**AC-12.2 -- "Sin coleccion" section**

- **Given** I have bookmarks not assigned to any collection,
  **Then** under the active tab I see a "Sin coleccion" section listing those bookmark cards.

**AC-12.3 -- "Mis colecciones" section**

- **Given** I have at least one collection with bookmarks of the active entity type,
  **Then** below "Sin coleccion" I see a "Mis colecciones" section with collection cards
  (name, color accent, icon, bookmark count for current type, preview thumbnails).

**AC-12.4 -- Empty state**

- **Given** I have no bookmarks at all,
  **Then** I see an empty state: "Todavia no guardaste nada. Empieza a explorar!" with a
  "Explorar alojamientos" CTA.

**AC-12.5 -- Pagination**

- **Given** I have more than the page size (default 12) bookmarks in a tab,
  **Then** a "Cargar mas" button appears; clicking it appends the next page without full
  page reload.

---

#### US-13 -- Collection detail page

**As** an authenticated traveler,
**I want** to view all bookmarks inside a specific collection, filtered by entity type,
**So that** I can plan a trip using only the items I grouped together.

**AC-13.1 -- Collection detail page loads**

- **Given** I navigate to `/favoritos/colecciones/:id`,
  **Then** the page shows the collection's name, description, color, icon, and a grid of
  its bookmarks; the page header matches the collection color.

**AC-13.2 -- Entity type filter**

- **Given** the collection has bookmarks of multiple entity types,
  **Then** filter chips allow me to show "Todos", "Alojamientos", "Destinos", "Eventos",
  "Blog".

**AC-13.3 -- Not owner**

- **Given** I navigate to a collection that belongs to another user,
  **Then** the API returns 403 and I see a "No tienes acceso a esta coleccion" error page.

**AC-13.4 -- Deleted entity in bookmark**

- **Given** a bookmarked accommodation has been soft-deleted or unpublished after I saved
  it,
  **Then** the bookmark card renders a fallback state: "Este alojamiento ya no esta
  disponible" with a "Eliminar de favoritos" button.

---

#### US-14 -- Bookmark limit respected

**As** the platform,
**I want** the existing `enforceFavoritesLimit` middleware to continue preventing unlimited
bookmark creation,
**So that** the system stays within plan-defined usage limits.

**AC-14.1 -- Limit enforced on toggle/create**

- **Given** an authenticated user is at their bookmark limit,
  **When** they attempt to save a new item (POST to `/api/v1/protected/user-bookmarks`),
  **Then** the API returns 422 with code `FAVORITES_LIMIT_EXCEEDED` and a toast "Alcanzaste
  el limite de favoritos para tu plan" is shown.

---

### 4. UX Considerations & Wireframes

#### 4.1 AccommodationCard with heart icon

```
+-------------------------------------------+
|  [thumbnail image]              [hrt | 12]|  <- heart top-right, count pill if >=3
|                                             |
|  Nombre del alojamiento                     |
|  * 4.8  *  $15,000 / noche                 |
|  Concepcion del Uruguay                     |
+-------------------------------------------+

When saved:
+-------------------------------------------+
|  [thumbnail image]         [HEART(red)|12]|  <- filled heart
|  ...                                        |
+-------------------------------------------+
```

Notes:
- Heart is always visible (not just on hover) to signal affordance on mobile.
- Count pill "12 guardados" uses a light badge style; hidden when count < 3.
- The `FavoriteButton.client.tsx` React island handles the optimistic state independently
  of the Astro card shell.

#### 4.2 LocationMap popup with heart

```
+------------------------------+
|  [thumbnail]                 |
|  Nombre del alojamiento [hrt]|
|  $15,000/noche               |
|  [Ver detalle >]             |
+------------------------------+
```

The heart inside the map popup follows the same authenticated/guest logic as the card.

#### 4.3 DetailHeader with heart and counter

```
+---------------------------------------------------------+
|  Nombre del Alojamiento                                  |
|  * 4.8  (24 resenas)   *   Concepcion del Uruguay        |
|                                                          |
|  [Compartir]  [hrt Guardado]  [12 personas lo guardaron]|
+---------------------------------------------------------+

When not saved (authenticated):
|  [Compartir]  [hrt Guardar]   [12 personas lo guardaron]|

Counter label rules:
  count = 0: "Se el primero en guardarlo"
  count = 1: "1 persona lo guardo"
  count >= 2: "N personas lo guardaron"
```

#### 4.4 AuthRequiredPopover (guest clicks heart)

```
  +=========================================+
  |  [lock] Guarda tus favoritos            |
  |                                         |
  |  Inicia sesion para guardar lugares     |
  |  y crear tus colecciones de viaje.      |
  |                                         |
  |  [Registrarse gratis]  [Ya tengo >]    |
  +=========================================+
         ^ anchored below/beside heart
```

The existing `AuthRequiredPopover.client.tsx` (at `apps/web/src/components/auth/`) must
support a `title` and `message` prop override for this context-specific copy. Verify the
current props interface before assuming compatibility; if `title`/`message` props are not
present, add them.

#### 4.5 `/favoritos` page

```
+=============================================================+
|  Mis Favoritos                       [+ Nueva coleccion]    |
+=============================================================+
|  [Alojamientos] [Destinos] [Eventos] [Blog]                 |
+=============================================================+
|  Sin coleccion                                              |
|  +--------+ +--------+ +--------+                          |
|  | card   | | card   | | card   |                          |
|  +--------+ +--------+ +--------+                          |
|                                                             |
|  Mis colecciones              [2 / 10 colecciones usadas]  |
|  +---------------+ +---------------+ +---------------+     |
|  | [sun] Verano  | | [tent] Escape | | + Nueva       |     |
|  | 3 alojam.     | | 5 destinos    |   coleccion     |     |
|  | [img previews]| | [img previews]|                 |     |
|  +---------------+ +---------------+ +---------------+     |
+=============================================================+
```

#### 4.6 `/favoritos/colecciones/[id]` page

```
+=============================================================+
|  <- Volver a Favoritos                   [...Opciones]      |
+=============================================================+
|  [sun] Verano en el Litoral                                 |
|  "Opciones para el viaje de enero con la familia"           |
+=============================================================+
|  [Todos] [Alojamientos (3)] [Destinos (2)] [Eventos (1)]    |
+=============================================================+
|  +--------------------+ +--------------------+             |
|  | AccommodationCard  | | AccommodationCard  |             |
|  | [nota: "Llamar..."]| | [+ Agregar nota]   |             |
|  +--------------------+ +--------------------+             |
+=============================================================+
```

#### 4.7 Create/Edit Collection Modal

```
+=========================================+
|  Nueva coleccion                   [X]  |
+=========================================+
|  Nombre *                               |
|  +-------------------------------------+|
|  | Mi coleccion                        ||
|  +-------------------------------------+|
|  (max 50 caracteres)                    |
|                                         |
|  Descripcion (opcional)                 |
|  +-------------------------------------+|
|  |                                     ||
|  +-------------------------------------+|
|                                         |
|  Color                                  |
|  [o] [o] [o] [o] [o] [o] [o] [o] [o] [o]|
|                                         |
|  Icono (opcional)                       |
|  [beach] [tent] [wave] [house] [party]  |
|                                         |
|        [Cancelar]  [Crear coleccion]    |
+=========================================+
```

Color palette (10 swatches -- hex values):
- `#E57373` coral
- `#FF8A65` orange
- `#FFD54F` amber
- `#AED581` light green
- `#4DB6AC` teal
- `#4FC3F7` sky (default)
- `#7986CB` indigo
- `#BA68C8` purple
- `#F06292` pink
- `#90A4AE` slate

Default color: `#4FC3F7`. Default icon: none (null).

#### 4.8 Move to Collection Modal

```
+=========================================+
|  Mover a coleccion                 [X]  |
+=========================================+
|  ( )  Sin coleccion                     |
|  (*)  [sun] Verano en el Litoral        |
|  ( )  [tent] Escapadas rurales          |
|  ---------------------------------      |
|  ( )  + Nueva coleccion                 |
|       +--------------------+            |  <- expands inline when selected
|       | Nombre coleccion   |            |
|       +--------------------+            |
|                                         |
|        [Cancelar]  [Mover]              |
+=========================================+
```

#### 4.9 Inline Notes on Bookmark Card

```
Collapsed state:
+--------------------------------------------+
|  [thumb]  Nombre del lugar                 |
|           * 4.8  $15,000                   |
|           [note] "Llamar antes de....."    |
|           [Editar nota] [...Menu]           |
+--------------------------------------------+

Expanded state (after "Agregar nota" / "Editar nota" click):
+--------------------------------------------+
|  [thumb]  Nombre del lugar                 |
|           --------------------------------- |
|           +------------------------+       |
|           | Llamar antes de...     |       |
|           |                        |       |
|           +------------------------+       |
|           450/500  [Cancelar] [Guardar]    |
+--------------------------------------------+
```

#### 4.10 Edge Cases

| Scenario | UI Behavior |
|---|---|
| Empty favorites page (no bookmarks) | Full-page empty state with CTA to explore |
| Empty collection | Collection detail page shows "Esta coleccion esta vacia" + "Explorar" CTA |
| Loading state on favorites page | Skeleton cards (3x3 grid) while API loads |
| Optimistic toggle (intermediate state) | Heart shows a spinner overlay; re-clicks are debounced |
| Deleted entity in bookmark | Card shows greyed fallback: "Ya no disponible" + delete button |
| Collection with 0 bookmarks of active tab filter | "No hay [entityType] en esta coleccion" |
| Rollback after network error | Heart/card reverts; toast with retry option |
| Very long collection name (50 chars) | Truncated with ellipsis in collection card; full name in modal header |
| Screen reader | All heart buttons have `aria-label` "Guardar [entity name]" or "Quitar de favoritos [entity name]"; modals use `role="dialog"` with `aria-labelledby` |
| Keyboard navigation | Heart button focusable; Enter/Space triggers toggle; modals trap focus; Escape closes |

---

## Part 2 -- Technical Analysis

---

### 4a. Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Collections limit: env-configurable via `HOSPEDA_MAX_COLLECTIONS_PER_USER` (default 10), NOT plan-based. Guard in `UserBookmarkCollectionService._canCreate`. Error response includes `{ currentCount, maxAllowed }` for UI counter. | Collections are an organizational UX tool, not a monetization lever. Pre-beta, simpler is better. Future migration path to plan-based documented in ADR-026. |
| 2 | Backend naming: `UserBookmark` / `UserBookmarkCollection` (technical). User-facing: "Favoritos" / "Mis colecciones". | Avoids confusion between DB/API layer and UI layer naming. |
| 3 | `DestinationCard.astro` extraction: IN SCOPE (T-DC1..T-DC4). | FavoriteButton integration requires a stable card component. Inline duplication in two render contexts is unacceptable long-term. |
| 4 | Public count endpoint: build from scratch in `apps/api/src/routes/user-bookmark/public/`. | Endpoint confirmed absent by Phase 0 audit. |
| 5 | `VIEW_ANY` permission scaffolded for future admin UI but no admin routes built in this spec. | Pre-approved deferral -- low priority, zero admin pages planned for MVP. |
| 6 | Bookmarks limit remains plan-based via `enforceFavoritesLimit` middleware in `apps/api/src/middlewares/`. No change to bookmark limit logic. | Different concern from collections limit; plan-based billing applies here. |
| 7 | No numbered migration files. Schema changes via `pnpm db:fresh-dev`. Manual SQL for partial indexes in `packages/db/src/migrations/manual/`. | Push-only migration policy (pre-beta). |

---

### 5. Architecture Overview

The feature spans seven layers. No new workspace packages are added.

```
+----------------------------------------------------------+
|                 apps/web (Astro + React islands)          |
|                                                           |
|  [FavoriteButton.client.tsx]  <- new React island         |
|    integrated into:                                       |
|    AccommodationCard.astro  EventCard.astro               |
|    ArticleCard.astro        DestinationsIsland.client.tsx |
|    LocationMap.client.tsx   DetailHeader.astro (x4)       |
|                                                           |
|  [pages/[lang]/favoritos/index.astro]  <- refactored      |
|  [pages/[lang]/favoritos/colecciones/[id].astro] <- new  |
|                                                           |
|  [CreateEditCollectionModal.client.tsx]  <- new           |
|  [MoveToCollectionModal.client.tsx]  <- new               |
|  [UserFavoritesList.client.tsx]  <- heavily refactored    |
+----------------------------------------------------------+
          ^ fetch via native fetch / client:only="react"
+----------------------------------------------------------+
|                 apps/api (Hono)                           |
|                                                           |
|  /api/v1/protected/user-bookmark-collections/*  <- new   |
|  /api/v1/protected/user-bookmarks PATCH + check-bulk     |
|  /api/v1/public/user-bookmarks/count  <- verify/expose   |
+----------------------------------------------------------+
          ^ service calls
+----------------------------------------------------------+
|           packages/service-core                           |
|                                                           |
|  [UserBookmarkCollectionService]  <- new                  |
|  UserBookmarkService  <- additions (checkBulk, update)   |
+----------------------------------------------------------+
          ^ DB access via Drizzle models
+----------------------------------------------------------+
|           packages/db                                     |
|                                                           |
|  user_bookmark_collections table  <- new                  |
|  user_bookmarks.collectionId column  <- new               |
|  index on (entityId, entityType, deletedAt)  <- new       |
+----------------------------------------------------------+
```

**Pattern reuse:**
- `BaseCrudService` -- `UserBookmarkCollectionService` extends it.
- `ResponseFactory` -- all routes use it for consistent JSON shapes.
- Route factories (`createSimpleRoute`, `createListRoute`) -- used for collection CRUD routes.
- `AuthRequiredPopover.client.tsx` -- reused with prop extension.
- Optimistic updates with toast rollback -- mirrors the pattern in
  `UserFavoritesList.client.tsx` and messaging (SPEC-085).

#### Seed Data Updates

The example seed layer must be updated alongside schema changes. A new `userBookmarkCollections.seed.ts` is required in `packages/seed/src/example/`, following the `createSeedFactory` pattern used by `bookmarks.seed.ts`. Corresponding JSON fixtures live in `packages/seed/src/data/userBookmarkCollection/` and cover 5-10 realistic collection names per user (e.g. "Fin de semana con amigos", "Ideas luna de miel", "Para volver a ver"). The existing `bookmarks.seed.ts` and its JSON data files are updated to add a `collectionId` field on a subset of bookmarks: some users have all bookmarks uncollected (`collectionId: null`), others have bookmarks distributed across one or more collections. The collections seed must run before the bookmark seed so that the collection IDs are available for ID-mapping. Both `packages/seed/src/example/index.ts` and `packages/seed/src/manifest-example.json` are updated to register the new seed.

---

### 6. Data Model Changes

> **Migration policy note (push-only, pre-beta):** Per Hospeda's push-only migration policy (pre-beta, no prod data, drizzle-kit push), there are no numbered migration files, no rollback SQL, and no pre/post data-integrity migration tests for this spec. Schema changes are applied via `drizzle-kit push` against a wiped DB (`pnpm db:fresh-dev`). The only manual SQL is for the partial unique index and compound index documented in sections 6.1 and 6.3 below, which live in `packages/db/src/migrations/manual/` and are applied via `apply-postgres-extras.sh`.

#### 6.1 New table: `user_bookmark_collections`

```sql
CREATE TABLE user_bookmark_collections (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(50) NOT NULL,
  description   VARCHAR(200),
  color         VARCHAR(7),
  icon          VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  created_by_id UUID        REFERENCES users(id),
  updated_by_id UUID        REFERENCES users(id),
  deleted_by_id UUID        REFERENCES users(id)
);
```

**Drizzle model (packages/db/src/schema/userBookmarkCollection.model.ts):**

```ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.model';

export const userBookmarkCollections = pgTable(
  'user_bookmark_collections',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    description: varchar('description', { length: 200 }),
    color: varchar('color', { length: 7 }),
    icon: varchar('icon', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdById: uuid('created_by_id').references(() => users.id),
    updatedById: uuid('updated_by_id').references(() => users.id),
    deletedById: uuid('deleted_by_id').references(() => users.id),
  }
);
```

**Required indexes (manual SQL -- `drizzle-kit push` will NOT generate partial indexes):**

```sql
-- Composite index for listing a user's active collections (most common query path)
CREATE INDEX idx_user_bookmark_collections_user_active
  ON user_bookmark_collections (user_id, deleted_at);

-- Partial unique index: enforces no duplicate names per user among active collections
CREATE UNIQUE INDEX uq_user_bookmark_collections_user_name_active
  ON user_bookmark_collections (user_id, name)
  WHERE deleted_at IS NULL;
```

File location:
`packages/db/src/migrations/manual/0XXX-user-bookmark-collections-indexes.sql`

#### 6.2 Modified table: `user_bookmarks`

Add a nullable FK column pointing to `user_bookmark_collections`:

```sql
ALTER TABLE user_bookmarks
  ADD COLUMN collection_id UUID
  REFERENCES user_bookmark_collections(id) ON DELETE SET NULL;
```

**Drizzle model addition (userBookmark.model.ts):**

```ts
collectionId: uuid('collection_id')
  .references(() => userBookmarkCollections.id, { onDelete: 'set null' }),
```

The `ON DELETE SET NULL` constraint implements the pre-approved decision: deleting a
collection does not delete its bookmarks; they become "uncollected" automatically.

#### 6.3 New performance index on `user_bookmarks`

Required before the public count endpoint and "Most Saved" sort go live:

```sql
CREATE INDEX idx_user_bookmarks_entity_active
  ON user_bookmarks (entity_id, entity_type, deleted_at);
```

File location:
`packages/db/src/migrations/manual/0XXX-user-bookmarks-entity-index.sql`

**Note on project DB strategy:** Hospeda uses `drizzle-kit push`. Manual SQL files in
`packages/db/src/migrations/manual/` must be applied via
`packages/db/scripts/apply-postgres-extras.sh`. Update that script to include the new files.

---

### 7. API Design

#### Naming clarification

Backend naming: `UserBookmark` + `UserBookmarkCollection` (technical, unambiguous).
User-facing UI / i18n: "Favoritos" + "Mis colecciones".
This split is intentional (pre-approved decision #2). Add comments in route files and
service headers documenting this convention.

---

#### 7.1 `POST /api/v1/protected/user-bookmark-collections`

| Property | Value |
|---|---|
| Auth tier | Protected (session required) |
| Permission | `USER_BOOKMARK_COLLECTION_CREATE` |
| Limit guard | `_canCreate()` in `UserBookmarkCollectionService` (env-configurable, see below) |
| Idempotency | Not idempotent; duplicate names return 409 |

**Request body:**
```json
{
  "name": "Verano en el Litoral",
  "description": "Opciones para enero con la familia",
  "color": "#4FC3F7",
  "icon": "sun"
}
```

**Zod schema:** `CreateUserBookmarkCollectionSchema` (new, in
`packages/schemas/src/entities/userBookmarkCollection/`)

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "name": "Verano en el Litoral",
    "description": "Opciones para enero con la familia",
    "color": "#4FC3F7",
    "icon": "sun",
    "bookmarkCount": 0,
    "createdAt": "2026-05-02T04:04:18Z"
  }
}
```

**Error responses:**
- `409 CONFLICT` -- duplicate name for this user
- `422 UNPROCESSABLE_ENTITY` -- `COLLECTION_LIMIT_REACHED` (body includes `{ currentCount, maxAllowed }`)
- `400 BAD_REQUEST` -- Zod validation failure

---

#### 7.2 `GET /api/v1/protected/user-bookmark-collections`

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_COLLECTION_VIEW` |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Pagination page |
| `pageSize` | integer | 20 | Results per page (max 50) |
| `includeBookmarkCount` | boolean | true | Include total bookmark count per collection |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Verano en el Litoral",
        "description": "...",
        "color": "#4FC3F7",
        "icon": "sun",
        "bookmarkCount": 5,
        "createdAt": "2026-05-02T..."
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20,
    "usage": {
      "current": 3,
      "max": 10
    }
  }
}
```

**Note:** The `usage` block is always present and allows the UI to render an "X / Y used"
counter without a separate API call. `max` reflects the value of `HOSPEDA_MAX_COLLECTIONS_PER_USER`
(default 10).

---

#### 7.3 `GET /api/v1/protected/user-bookmark-collections/:id`

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_COLLECTION_VIEW` (owner-scoped) |

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `bookmarksPage` | integer | 1 | Page of bookmarks inside this collection |
| `bookmarksPageSize` | integer | 12 | Bookmarks per page |
| `entityType` | enum | (all) | Filter bookmarks by entity type |

**Response 200:** Collection object + nested `bookmarks` pagination object.

**Error responses:**
- `403 FORBIDDEN` -- collection belongs to another user
- `404 NOT_FOUND` -- collection does not exist or is soft-deleted

---

#### 7.4 `PATCH /api/v1/protected/user-bookmark-collections/:id`

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_COLLECTION_UPDATE` |
| Idempotency | Idempotent (same PATCH with same values = no change) |

**Request body (all fields optional):**
```json
{
  "name": "Verano Litoral 2027",
  "color": "#E57373"
}
```

**Response 200:** Updated collection object.

---

#### 7.5 `DELETE /api/v1/protected/user-bookmark-collections/:id`

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_COLLECTION_DELETE` |
| Side effect | `user_bookmarks.collection_id = NULL` for all bookmarks in this collection via FK `ON DELETE SET NULL` |

**Response 200:**
```json
{
  "success": true,
  "data": { "affectedBookmarks": 5 }
}
```

---

#### 7.6 `POST /api/v1/protected/user-bookmark-collections/:id/bookmarks/:bookmarkId`

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_COLLECTION_UPDATE` |
| Ownership | Both collection and bookmark must belong to the authenticated user |
| Idempotency | Same collection assignment is a no-op (200) |

**Request body:** Empty.

**Response 200:**
```json
{
  "success": true,
  "data": { "bookmarkId": "uuid", "collectionId": "uuid" }
}
```

---

#### 7.7 `DELETE /api/v1/protected/user-bookmark-collections/:id/bookmarks/:bookmarkId`

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_COLLECTION_UPDATE` |

Removes bookmark from collection (sets `collectionId = NULL`). Does NOT delete the bookmark.

**Response 200:**
```json
{
  "success": true,
  "data": { "bookmarkId": "uuid", "collectionId": null }
}
```

---

#### 7.8 `PATCH /api/v1/protected/user-bookmarks/:id` (NEW endpoint)

Update the `notes` field of a bookmark.

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_UPDATE` (existing) |
| Ownership | Bookmark must belong to authenticated user |

**Request body:**
```json
{
  "notes": "Llamar antes de reservar, solo acepta efectivo"
}
```

**Zod schema extension:** Add `notes: z.string().max(500).optional().nullable()` to
`UpdateUserBookmarkSchema`.

**Response 200:** Updated bookmark object.

---

#### 7.9 `POST /api/v1/protected/user-bookmarks/check-bulk` (NEW endpoint)

Return bookmark status for a batch of entity IDs. Used to hydrate heart states on listing
pages without N individual API calls.

| Property | Value |
|---|---|
| Auth tier | Protected |
| Permission | `USER_BOOKMARK_VIEW` |
| Max batch size | 50 items (Zod validation; 400 if exceeded) |

**Request body:**
```json
{
  "items": [
    { "entityId": "uuid-1", "entityType": "ACCOMMODATION" },
    { "entityId": "uuid-2", "entityType": "ACCOMMODATION" },
    { "entityId": "uuid-3", "entityType": "EVENT" }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "results": [
      { "entityId": "uuid-1", "entityType": "ACCOMMODATION", "saved": true, "bookmarkId": "uuid" },
      { "entityId": "uuid-2", "entityType": "ACCOMMODATION", "saved": false, "bookmarkId": null },
      { "entityId": "uuid-3", "entityType": "EVENT", "saved": true, "bookmarkId": "uuid" }
    ]
  }
}
```

**Implementation note:** `checkBookmarksBulk` must use a single
`WHERE (entity_id, entity_type) IN (...)` query to avoid N+1. Never call
`findExistingBookmark` in a loop from a route handler.

---

#### 7.10 `GET /api/v1/public/user-bookmarks/count`

Public endpoint returning active bookmark count for a single entity.

| Property | Value |
|---|---|
| Auth tier | Public |
| Auth required | No |
| Cache-Control | `max-age=60, stale-while-revalidate=300` |

**Query params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `entityType` | enum | Yes | ACCOMMODATION, DESTINATION, EVENT, POST |
| `entityId` | UUID | Yes | The entity's ID |

**Response 200:**
```json
{
  "success": true,
  "data": { "count": 42 }
}
```

**Implementation note:** Calls `UserBookmarkService.countBookmarksForEntity()` which already
exists. The endpoint does NOT exist in the codebase -- `apps/api/src/routes/user-bookmark/public/`
folder must be created from scratch (Phase 0 audit T-004 confirmed absence). Use the
`createPublicRoute` factory consistent with `apps/api/src/routes/accommodation/public/` as a
reference pattern. Register in `apps/api/src/routes/user-bookmark/index.ts` and the central
router at `apps/api/src/routes/index.ts`. The compound index on
`(entity_id, entity_type, deleted_at)` must be present before this endpoint powers the
"Most Saved" sort.

---

### 8. Permissions

Five new permissions. Add to `packages/schemas/src/enums/permission.enum.ts`:

```ts
// USER_BOOKMARK_COLLECTION: Permissions for user bookmark collection management
USER_BOOKMARK_COLLECTION_CREATE = 'userBookmarkCollection.create',
USER_BOOKMARK_COLLECTION_UPDATE = 'userBookmarkCollection.update',
USER_BOOKMARK_COLLECTION_DELETE = 'userBookmarkCollection.delete',
USER_BOOKMARK_COLLECTION_VIEW = 'userBookmarkCollection.view',
USER_BOOKMARK_COLLECTION_VIEW_ANY = 'userBookmarkCollection.viewAny',
```

**Role assignments** (add to `packages/db/src/seeds/rolePermissions.seed.ts`):

| Permission | USER | OWNER | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| `USER_BOOKMARK_COLLECTION_CREATE` | yes | yes | yes | yes |
| `USER_BOOKMARK_COLLECTION_UPDATE` | yes | yes | yes | yes |
| `USER_BOOKMARK_COLLECTION_DELETE` | yes | yes | yes | yes |
| `USER_BOOKMARK_COLLECTION_VIEW` | yes | yes | yes | yes |
| `USER_BOOKMARK_COLLECTION_VIEW_ANY` | no | no | yes | yes |

Note: `VIEW_ANY` is scaffolded for future admin UI support; no admin routes are built in
this spec (pre-approved decision #7).

---

### 9. Service Layer Design

#### 9.1 `UserBookmarkCollectionService`

Location: `packages/service-core/src/services/userBookmarkCollection/`

Extends `BaseCrudService<UserBookmarkCollection>`.

```ts
/**
 * Service for managing user bookmark collections.
 *
 * NAMING NOTE: "UserBookmarkCollection" is the backend/technical name.
 * User-facing UI calls these "Mis colecciones" / "My collections".
 * This naming split is intentional -- see SPEC-098 decision log, item 2.
 */
export class UserBookmarkCollectionService
  extends BaseCrudService<UserBookmarkCollection> {

  /**
   * Create a new collection for the authenticated user.
   * Enforces the collection limit (HOSPEDA_MAX_COLLECTIONS_PER_USER, default 10) via _canCreate before insert.
   */
  async createCollection(args: {
    userId: string;
    input: CreateUserBookmarkCollectionInput;
  }): Promise<Result<UserBookmarkCollection>>;

  /**
   * List active collections for a user with optional bookmark counts.
   */
  async listCollectionsByUser(args: {
    userId: string;
    pagination: PaginationInput;
    includeBookmarkCount?: boolean;
  }): Promise<Result<PaginatedResult<UserBookmarkCollectionWithCount>>>;

  /**
   * Get a single collection, owner-verified.
   * Returns error if collection belongs to a different user.
   */
  async getCollectionById(args: {
    id: string;
    userId: string;
    bookmarkPagination?: PaginationInput;
    entityTypeFilter?: BookmarkEntityTypeEnum;
  }): Promise<Result<UserBookmarkCollectionWithBookmarks>>;

  /**
   * Update name/description/color/icon of a collection.
   * Enforces unique-name constraint for this user.
   */
  async updateCollection(args: {
    id: string;
    userId: string;
    input: UpdateUserBookmarkCollectionInput;
  }): Promise<Result<UserBookmarkCollection>>;

  /**
   * Soft-delete a collection.
   * Returns the count of bookmarks uncollected via FK ON DELETE SET NULL.
   */
  async deleteCollection(args: {
    id: string;
    userId: string;
  }): Promise<Result<{ affectedBookmarks: number }>>;

  /**
   * Move a bookmark into this collection.
   * Verifies ownership of both bookmark and collection.
   */
  async addBookmarkToCollection(args: {
    collectionId: string;
    bookmarkId: string;
    userId: string;
  }): Promise<Result<{ bookmarkId: string; collectionId: string }>>;

  /**
   * Remove a bookmark from its collection (set collectionId = NULL).
   * Does NOT delete the bookmark.
   */
  async removeBookmarkFromCollection(args: {
    collectionId: string;
    bookmarkId: string;
    userId: string;
  }): Promise<Result<{ bookmarkId: string; collectionId: null }>>;

  /**
   * Count active collections for a user.
   * Used by the _canCreate guard within this service (not by any middleware).
   */
  async countActiveCollections(args: {
    userId: string;
  }): Promise<Result<number>>;
}
```

**Key error codes:**
- `COLLECTION_NOT_FOUND` -- collection does not exist or is soft-deleted.
- `COLLECTION_ACCESS_DENIED` -- collection belongs to another user.
- `COLLECTION_LIMIT_REACHED` -- user has reached max active collections (payload: `{ currentCount, maxAllowed }`). Limit is `HOSPEDA_MAX_COLLECTIONS_PER_USER` env var (default 10). Guard lives in `_canCreate`, NOT in a middleware.
- `COLLECTION_NAME_DUPLICATE` -- name collision within user's active collections.
- `BOOKMARK_NOT_FOUND` -- bookmark does not exist.
- `BOOKMARK_ACCESS_DENIED` -- bookmark belongs to another user.

#### 9.2 `UserBookmarkService` additions

```ts
/**
 * Update notes (and optionally other user-editable fields) on a bookmark.
 */
async updateBookmark(args: {
  id: string;
  userId: string;
  input: UpdateUserBookmarkInput;
}): Promise<Result<UserBookmark>>;

/**
 * Bulk-check bookmark status for a list of (entityId, entityType) pairs.
 * Uses a single IN query -- NEVER calls findExistingBookmark in a loop.
 */
async checkBookmarksBulk(args: {
  userId: string;
  items: Array<{ entityId: string; entityType: BookmarkEntityTypeEnum }>;
}): Promise<Result<BulkCheckResult[]>>;
```

**`BulkCheckResult` type:**
```ts
type BulkCheckResult = {
  readonly entityId: string;
  readonly entityType: BookmarkEntityTypeEnum;
  readonly saved: boolean;
  readonly bookmarkId: string | null;
};
```

---

### 10. Frontend Components

#### 10.1 `FavoriteButton.client.tsx` (NEW)

**Location:** `apps/web/src/components/shared/ui/FavoriteButton.client.tsx`

A standalone React island for the toggle heart behavior. Embedded in Astro card components
via `client:visible`.

**Props:**
```ts
interface FavoriteButtonProps {
  readonly entityId: string;
  readonly entityType: 'ACCOMMODATION' | 'DESTINATION' | 'EVENT' | 'POST';
  readonly entityName: string;
  readonly initialSaved?: boolean;
  readonly initialCount?: number;
  readonly showCount?: boolean;
  readonly countThreshold?: number; // default 3
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}
```

**Behavior:**
1. On mount: if `initialSaved` is undefined, calls single-item check endpoint (fallback).
2. On click (authenticated): optimistic update -> API call -> toast OR rollback on error.
3. On click (guest): opens `AuthRequiredPopover` anchored to the button; no API call.
4. Auth detection: reads from the shared auth context (same as `UserNav.client.tsx`).

**Integration targets:**
- `AccommodationCard.astro` -- `client:visible`, `showCount=true`, hydrated from bulk-check.
- `EventCard.astro`, `ArticleCard.astro` -- same pattern.
- `DestinationsIsland.client.tsx` -- inline integration (no standalone Astro card).
- `LocationMap.client.tsx` popup -- rendered inside Leaflet popup JSX.
- `DetailHeader.astro` -- `client:idle`, `showCount=true`, `countThreshold=0`.

#### 10.2 `/favoritos` page redesign

**File:** `apps/web/src/pages/[lang]/favoritos/index.astro`

`UserFavoritesList.client.tsx` is **heavily refactored** (not replaced) to support:
- Entity type tab navigation.
- "Sin coleccion" section.
- "Mis colecciones" section with collection grid (name, color, icon, count, previews).
- `CreateEditCollectionModal.client.tsx` trigger.
- Pagination ("Cargar mas" pattern).

#### 10.3 `/favoritos/colecciones/[id]` page (NEW)

**File:** `apps/web/src/pages/[lang]/favoritos/colecciones/[id].astro`

- Server-side: validates session; redirects to `/auth/signin?next=...` if no session.
- Fetches collection metadata SSR (name, description, color, icon).
- Renders client component for paginated bookmark grid with entity type filter.

#### 10.4 `CreateEditCollectionModal.client.tsx` (NEW)

**Location:** `apps/web/src/components/account/CreateEditCollectionModal.client.tsx`

Controlled modal; `collection` prop is null for create, populated for edit. Calls POST or
PATCH based on mode. Handles API-level duplicate name error inline.

#### 10.5 `MoveToCollectionModal.client.tsx` (NEW)

**Location:** `apps/web/src/components/account/MoveToCollectionModal.client.tsx`

Receives `bookmarkId`, `currentCollectionId`, and the user's collections list. Handles the
inline "create collection" expansion per wireframe 4.8.

#### 10.6 `AuthRequiredPopover.client.tsx` -- prop extension

**Path:** `apps/web/src/components/auth/AuthRequiredPopover.client.tsx`

Verify that `title?: string` and `message?: string` props exist. Add them if absent with
backward-compatible defaults. The popover is reused for the favorites context without
changing any existing usage.

#### 10.7 DestinationCard extraction (now in scope)

Phase 0 audit (T-002) confirmed that no standalone `DestinationCard.astro` exists. The card
is rendered inline in two places:
- `apps/web/src/components/sections/DestinationsIsland.client.tsx` (carousel, lines ~209-269)
- `apps/web/src/pages/[lang]/destinos/index.astro` (listing, lines ~96-113)

**This extraction is now IN SCOPE** (tasks T-DC1 through T-DC4):
- `T-DC1`: Create `DestinationCard.astro` mirroring `AccommodationCard.astro`, pre-wired with `FavoriteButton`.
- `T-DC2`: Refactor `destinos/index.astro` to use the new component.
- `T-DC3`: Refactor `DestinationsIsland.client.tsx` -- React islands cannot directly import Astro components; replicate card markup inside JSX or extract a shared CSS module.
- `T-DC4`: Visual smoke test for both render contexts.

`T-DC1` must complete before `T-043` (FavoriteButton in DestinationsIsland) and `T-044` (LocationMap convergence).

---

### 11. i18n Keys

All new keys go into `packages/i18n/src/locales/{es,en,pt}/account.json` under the
`favorites` top-level key. The sort key goes in `accommodations.json` (or a shared sort
namespace if one exists).

#### 11.1 `account.favorites.button.*`

| Key | ES | EN | PT |
|---|---|---|---|
| `button.save` | Guardar | Save | Salvar |
| `button.saved` | Guardado | Saved | Salvo |
| `button.ariaLabel` | Guardar {{name}} | Save {{name}} | Salvar {{name}} |
| `button.ariaLabelSaved` | Quitar de favoritos {{name}} | Remove {{name}} from favorites | Remover {{name}} dos favoritos |

#### 11.2 `account.favorites.counter.*`

| Key | ES | EN | PT |
|---|---|---|---|
| `counter.zero` | Se el primero en guardarlo | Be the first to save it | Seja o primeiro a salvar |
| `counter.one` | 1 persona lo guardo | 1 person saved it | 1 pessoa salvou |
| `counter.other` | {{count}} personas lo guardaron | {{count}} people saved it | {{count}} pessoas salvaram |
| `counter.pill` | {{count}} guardados | {{count}} saved | {{count}} salvos |

#### 11.3 `account.favorites.collections.*`

| Key | ES | EN | PT |
|---|---|---|---|
| `collections.title` | Mis colecciones | My collections | Minhas colecoes |
| `collections.new` | Nueva coleccion | New collection | Nova colecao |
| `collections.empty` | Todavia no creaste ninguna coleccion | You haven't created any collections yet | Voce ainda nao criou nenhuma colecao |
| `collections.emptyAction` | Organiza tus favoritos en colecciones de viaje | Organize your favorites into trip collections | Organize seus favoritos em colecoes de viagem |
| `collections.bookmarks` | {{count}} favorito | {{count}} favorite | {{count}} favorito |
| `collections.bookmarks_plural` | {{count}} favoritos | {{count}} favorites | {{count}} favoritos |
| `collections.usage` | {{current}} de {{max}} colecciones usadas | {{current}} of {{max}} collections used | {{current}} de {{max}} colecoes usadas |
| `collections.limit_reached` | Ya alcanzaste el maximo de {{max}} colecciones | You have reached the maximum of {{max}} collections | Voce atingiu o maximo de {{max}} colecoes |
| `collections.limitReached` | Limite de {{max}} colecciones alcanzado | {{max}} collections limit reached | Limite de {{max}} colecoes atingido |
| `collections.create.title` | Nueva coleccion | New collection | Nova colecao |
| `collections.create.name` | Nombre | Name | Nome |
| `collections.create.namePlaceholder` | Mi coleccion de viaje | My trip collection | Minha colecao de viagem |
| `collections.create.nameMaxLength` | Maximo 50 caracteres | Maximum 50 characters | Maximo 50 caracteres |
| `collections.create.description` | Descripcion (opcional) | Description (optional) | Descricao (opcional) |
| `collections.create.color` | Color | Color | Cor |
| `collections.create.icon` | Icono (opcional) | Icon (optional) | Icone (opcional) |
| `collections.create.submit` | Crear coleccion | Create collection | Criar colecao |
| `collections.edit.title` | Editar coleccion | Edit collection | Editar colecao |
| `collections.edit.submit` | Guardar cambios | Save changes | Salvar alteracoes |
| `collections.delete.title` | Eliminar coleccion | Delete collection | Excluir colecao |
| `collections.delete.message` | Eliminar la coleccion "{{name}}"? Los favoritos se conservaran en Sin coleccion. | Delete collection "{{name}}"? Favorites inside will be kept in Uncollected. | Excluir a colecao "{{name}}"? Os favoritos serao mantidos em Sem colecao. |
| `collections.delete.confirm` | Eliminar | Delete | Excluir |
| `collections.delete.cancel` | Cancelar | Cancel | Cancelar |
| `collections.uncollected` | Sin coleccion | Uncollected | Sem colecao |

#### 11.4 `account.favorites.move.*`

| Key | ES | EN | PT |
|---|---|---|---|
| `move.title` | Mover a coleccion | Move to collection | Mover para colecao |
| `move.submit` | Mover | Move | Mover |
| `move.newCollection` | + Nueva coleccion | + New collection | + Nova colecao |
| `move.success` | Movido a {{name}} | Moved to {{name}} | Movido para {{name}} |
| `move.uncollected` | Sin coleccion | Uncollected | Sem colecao |
| `move.removeFromCollection` | Quitar de esta coleccion | Remove from this collection | Remover desta colecao |
| `move.removed` | Quitado de la coleccion | Removed from collection | Removido da colecao |

#### 11.5 `account.favorites.notes.*`

| Key | ES | EN | PT |
|---|---|---|---|
| `notes.add` | Agregar nota | Add note | Adicionar nota |
| `notes.edit` | Editar nota | Edit note | Editar nota |
| `notes.placeholder` | Escribe tus notas sobre este lugar... | Write your notes about this place... | Escreva suas notas sobre este lugar... |
| `notes.save` | Guardar | Save | Salvar |
| `notes.cancel` | Cancelar | Cancel | Cancelar |
| `notes.charLimit` | {{count}}/500 | {{count}}/500 | {{count}}/500 |
| `notes.limitExceeded` | Maximo 500 caracteres | Maximum 500 characters | Maximo 500 caracteres |
| `notes.saveSuccess` | Nota guardada | Note saved | Nota salva |
| `notes.saveError` | Error al guardar la nota | Error saving note | Erro ao salvar a nota |

#### 11.6 `account.favorites.toast.*`

| Key | ES | EN | PT |
|---|---|---|---|
| `toast.saved` | Guardado en favoritos | Added to favorites | Adicionado aos favoritos |
| `toast.removed` | Eliminado de favoritos | Removed from favorites | Removido dos favoritos |
| `toast.error` | Error al actualizar favoritos | Error updating favorites | Erro ao atualizar favoritos |
| `toast.limitReached` | Alcanzaste el limite de favoritos para tu plan | You've reached your favorites limit | Voce atingiu o limite de favoritos |
| `toast.collectionCreated` | Coleccion creada | Collection created | Colecao criada |
| `toast.collectionUpdated` | Coleccion actualizada | Collection updated | Colecao atualizada |
| `toast.collectionDeleted` | Coleccion eliminada | Collection deleted | Colecao excluida |
| `toast.collectionError` | Error al actualizar la coleccion | Error updating collection | Erro ao atualizar a colecao |

#### 11.7 `account.favorites.auth.*`

| Key | ES | EN | PT |
|---|---|---|---|
| `auth.title` | Guarda tus favoritos | Save your favorites | Salve seus favoritos |
| `auth.message` | Inicia sesion para guardar lugares y crear tus colecciones de viaje. | Sign in to save places and create your trip collections. | Faca login para salvar lugares e criar suas colecoes de viagem. |
| `auth.register` | Registrarse gratis | Sign up for free | Cadastre-se gratis |
| `auth.login` | Ya tengo cuenta | I already have an account | Ja tenho uma conta |

#### 11.8 Sort key (in `accommodations.json` or shared sort namespace)

| Key | ES | EN | PT |
|---|---|---|---|
| `sort.mostSaved` | Mas guardados | Most saved | Mais salvos |

---

### 12. Testing Strategy

#### 12.1 Unit tests -- schemas

**File:** `packages/schemas/src/entities/userBookmarkCollection/__tests__/`

- `CreateUserBookmarkCollectionSchema`: valid input, name too long (>50), missing required
  name, invalid color hex, name with only whitespace.
- `UpdateUserBookmarkCollectionSchema`: all optional fields, empty object accepted, extra
  fields rejected (strict).
- `BulkCheckInputSchema`: valid array, empty array, array of 51 items expects error.

Coverage target: 100% on all schema files (pure validation logic).

#### 12.2 Unit tests -- service

**File:**
`packages/service-core/src/services/userBookmarkCollection/__tests__/userBookmarkCollection.service.test.ts`

Scenarios:
- `createCollection`: success, duplicate name error, limit exceeded (`COLLECTION_LIMIT_REACHED` with `{ currentCount, maxAllowed }`).
- `listCollectionsByUser`: empty result, paginated, `includeBookmarkCount=true`.
- `getCollectionById`: owner access, cross-user access returns error.
- `updateCollection`: success, duplicate name, not found.
- `deleteCollection`: success (returns affectedBookmarks count), not found, not owner.
- `addBookmarkToCollection`: success, idempotent second call, bookmark not owned,
  collection not owned.
- `removeBookmarkFromCollection`: success, bookmark not in any collection (no-op OK).
- `countActiveCollections`: returns correct count.

**Additions to existing service test file:**

- `checkBookmarksBulk`: 3-item batch all saved; mixed; empty batch; batch > 50.
- `updateBookmark`: update notes success, clear notes (null), note too long, not owner.

#### 12.3 Integration tests -- API routes

**Directory:** `apps/api/test/routes/user-bookmark-collections/`

| Test case | Endpoint(s) |
|---|---|
| 201 success | POST /collections |
| 409 duplicate name | POST /collections |
| 422 limit exceeded | POST /collections |
| 401 unauthenticated | all protected endpoints |
| 403 wrong owner | GET/:id, PATCH/:id, DELETE/:id, POST/:id/bookmarks/:bid, DELETE/:id/bookmarks/:bid |
| 404 not found | GET/:id, PATCH/:id, DELETE/:id |
| 200 + pagination | GET /collections |
| 200 with bookmark count | GET /collections?includeBookmarkCount=true |
| Bookmark collectionId=null after delete | DELETE/:id then verify bookmark row |
| Bulk check mixed results | POST /user-bookmarks/check-bulk |
| Bulk check 51 items (400) | POST /user-bookmarks/check-bulk |
| PATCH notes success | PATCH /user-bookmarks/:id |
| PATCH notes too long (400) | PATCH /user-bookmarks/:id |
| Public count no auth | GET /public/user-bookmarks/count |

#### 12.4 E2E tests

**Directory:** `apps/e2e/tests/spec-098/`

| File | Flow |
|---|---|
| `e2e-01-favorite-toggle-card.spec.ts` | Guest: heart click -> AuthRequiredPopover -> close. Auth: toggle on card -> verify filled -> toggle off -> verify empty. |
| `e2e-02-favorite-toggle-detail.spec.ts` | Toggle from AccommodationDetail, EventDetail, PostDetail. Verify counter updates after toggle. |
| `e2e-03-collections-crud.spec.ts` | Create collection -> edit -> verify rename -> delete -> verify bookmarks appear in uncollected. |
| `e2e-04-move-bookmark.spec.ts` | Save item -> go to favorites -> move to collection -> verify in collection page -> remove from collection -> verify in uncollected. |
| `e2e-05-inline-notes.spec.ts` | Save item -> add note -> verify preview -> edit note -> clear note -> verify removed. |
| `e2e-06-public-counter.spec.ts` | Detail page shows count. Card shows count only when >= 3. Sort by "Mas guardados" returns expected order. |
| `e2e-07-collections-limit.spec.ts` | Create N collections up to limit (default 10) -> verify button disabled and usage counter shows X/X -> attempt create returns error toast with COLLECTION_LIMIT_REACHED. |
| `e2e-08-entity-smoke.spec.ts` | Smoke: toggle favorite for ACCOMMODATION, EVENT, POST, DESTINATION. All succeed without errors. |

**Coverage target:** 90% on all new backend code. E2E covers happy paths + critical error
paths for each new feature area.

---

### 13. Performance & Security

#### 13.1 Performance

| Concern | Mitigation |
|---|---|
| N+1 on bulk-check | `checkBookmarksBulk` uses a single `WHERE (entity_id, entity_type) IN (...)` query. Route handler must never call `findExistingBookmark` in a loop. |
| Public count endpoint (hot path) | Add `Cache-Control: max-age=60, stale-while-revalidate=300` header. No auth lookup -- fast count query only. |
| "Most saved" sort query | `idx_user_bookmarks_entity_active` on `(entity_id, entity_type, deleted_at)` is REQUIRED before enabling this sort. Validate with `EXPLAIN ANALYZE` before release. |
| Listing page count hydration | Service-level LEFT JOIN to `user_bookmarks` count; avoid a separate API call per card. |
| Favorites page initial load | `UserFavoritesList.client.tsx` uses paginated fetch (default 12 items); "Cargar mas" appends next page. |
| Collection list (max 20) | No pagination needed for display; 20 items fit in a single response. |
| FavoriteButton lazy hydration | Use `client:visible` on listing cards and `client:idle` on detail pages. |

#### 13.2 Security

| Concern | Mitigation |
|---|---|
| Cross-tenant bookmark access | `UserBookmarkCollectionService` verifies `userId` on every read and write. A user cannot see or modify another user's collections. |
| Cross-tenant via bulk-check | `checkBookmarksBulk` filters by `userId` AND the item list. A user cannot probe another user's saved state. |
| Collections limit bypass | `_canCreate()` guard in `UserBookmarkCollectionService` reads `HOSPEDA_MAX_COLLECTIONS_PER_USER` (default 10) and wraps count + insert in a DB transaction to prevent concurrent bypass. No separate middleware. |
| Anonymous write prevention | `FavoriteButton.client.tsx` reads auth state client-side and opens `AuthRequiredPopover` before any API call. Server-side, all protected routes require a valid session. |
| Note content rendering | `notes` field is stored as plain text and rendered as escaped text in JSX (plain text node, not raw HTML). Max 500 chars enforced at Zod, DB column, and UI layers. |
| Rate limiting | Existing rate limiting middleware applies to all protected endpoints. No additional rate limiting needed for MVP. |

---

### 14. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| DestinationCard extraction scope creep | Medium | Low | Extraction is now IN SCOPE (T-DC1..T-DC4). React islands cannot directly import Astro components -- T-DC3 must replicate card markup inside JSX or extract a shared CSS module. |
| AuthRequiredPopover props incompatibility | Medium | Low | Verify props interface in Phase 0; add optional props with backward-compatible defaults. |
| "Most saved" index not applied before sort goes live | Medium | High | Phase 1 task: verify index exists; add to `apply-postgres-extras.sh`. Block sort feature on index confirmation in Phase 3. |
| Bulk-check query performance with 50 items | Low | Medium | Compound index on `(entity_id, entity_type, deleted_at)` covers this. Benchmark in integration test. |
| Concurrent collection creation exceeding limit | Low | Medium | DB transaction wraps count + insert in `_canCreate`; no race condition possible. |
| Partial unique index not generated by drizzle-kit push | High | Medium | Place in `manual/` SQL files; update `apply-postgres-extras.sh` explicitly. This is a known pattern in the project. |
| FavoriteButton optimistic state desync after navigation | Medium | Low | React island re-fetches on mount if `initialSaved` is not passed; single-check fallback covers this case. |
| Note content rendered unsafely | Low | High | Render notes as plain text content in JSX. Never use raw HTML insertion for user-generated content. Apply max length at DB, Zod, and UI layers. |
| Active SPEC-092 E2E suite conflicts | Low | Medium | SPEC-098 E2E files go in a separate `spec-098/` subdirectory; no overlap with SPEC-092 test files. |
| account.json i18n key namespace collision | Low | Low | All new keys nested under `favorites.*` sub-namespaces; existing `favorites.tabs.*` and `favorites.empty` preserved. |

---

### 15. Dependencies

#### External dependencies

No new external dependencies. All required packages are already installed in the monorepo.

#### Internal package dependencies

| Package | Role in SPEC-098 |
|---|---|
| `@repo/schemas` | New `userBookmarkCollection` schema directory; permission enum additions; `UpdateUserBookmarkSchema` and bulk-check schema extensions |
| `@repo/service-core` | New `UserBookmarkCollectionService`; additions to `UserBookmarkService` |
| `@repo/db` | New `user_bookmark_collections` table; `collectionId` column on `user_bookmarks`; new indexes in manual SQL |
| `@repo/icons` | Icon picker subset in collection modals |
| `@repo/i18n` | New keys in `account.json` (all 3 locales); `accommodations.json` for sort key |
| `@repo/auth-ui` | `AuthRequiredPopover.client.tsx` -- prop extension (backward-compatible) |
| `apps/api` | 7 new collection routes + 2 bookmark route additions (PATCH, check-bulk) |
| `apps/web` | New `FavoriteButton.client.tsx`; page redesign; new collection detail page; modals |
| `apps/e2e` | 8 new E2E spec files in `tests/spec-098/` |

#### Compatibility with active specs

| Spec | Risk | Note |
|---|---|---|
| SPEC-059 (Transaction Support) | Low | `UserBookmarkCollectionService` should use transactions for multi-step operations (delete collection -> return affected count). SPEC-059 infrastructure is in place. |
| SPEC-063 (Lifecycle State) | Low | Soft-delete on `user_bookmark_collections` follows the same pattern SPEC-063 established for other entities. |
| SPEC-092 (E2E Suite) | Low | Separate test directories; no shared test fixture conflicts expected. |

---

### 16. Implementation Approach (Phased Tasks)

This breakdown is intended to inform the `task-planner` agent. Each phase is independently
testable.

#### Phase 0 -- Setup (~2h)

- Audit `AuthRequiredPopover.client.tsx` props: verify `title`/`message` are supported;
  add if missing (backward-compatible defaults).
- Audit `DestinationsIsland.client.tsx`: identify exact JSX location where destination
  card items render; mark integration point with a comment for Phase 6.
- Verify current bookmark limit value in `enforceFavoritesLimit`; document in spec or
  code comment.
- Verify whether `GET /api/v1/public/user-bookmarks/count` already exists in the public
  router; if so, no new route needed in Phase 3.

#### Phase 1 -- Backend Foundation (~10h)

- Write Drizzle model for `user_bookmark_collections` with all columns and relations.
- Add `collectionId` column to `user_bookmarks` Drizzle model.
- Write manual SQL files for both indexes and partial unique constraint.
- Update `apply-postgres-extras.sh` to include the new SQL files.
- Run `drizzle-kit push` and apply manual SQL in dev; verify schema.
- Write and pass schema-level tests (column types, FK constraints, soft-delete).

#### Phase 2 -- Schemas + Service + Permissions (~8h)

- Create `packages/schemas/src/entities/userBookmarkCollection/` with 5 schema files
  (mirroring `userBookmark/` structure).
- Add `BulkCheckInputSchema` and `BulkCheckResultSchema` to `userBookmark.http.schema.ts`.
- Add `notes` field to `UpdateUserBookmarkSchema`.
- Add 5 new `USER_BOOKMARK_COLLECTION_*` permissions to `permission.enum.ts`.
- Add role assignments to `rolePermissions.seed.ts`.
- Implement `UserBookmarkCollectionService` with all 8 methods.
- Add `checkBookmarksBulk` and `updateBookmark` to `UserBookmarkService`.
- Write unit tests for all service methods (happy paths + error paths).

#### Phase 3 -- Backend Routes (~8h)

- Implement 7 collection routes (POST, GET list, GET detail, PATCH, DELETE,
  POST bookmark, DELETE bookmark).
- Implement `POST /user-bookmarks/check-bulk` route.
- Implement `PATCH /user-bookmarks/:id` route (notes update).
- Create `GET /public/user-bookmarks/count` route from scratch (endpoint confirmed absent by Phase 0 audit).
- Note: NO `enforceCollectionsLimit` middleware -- limit guard lives in service `_canCreate`.
- Register all routes in the protected and public routers.

#### Phase 4 -- Backend Tests (~6h)

- Integration tests for all 10 new/updated endpoints (as listed in section 12.3).
- Verify existing bookmark tests still pass (no regression from `collectionId` column).

#### Phase 5 -- Frontend Foundation (~4h)

- Implement `FavoriteButton.client.tsx` with auth/guest detection, optimistic update,
  toast rollback, and `AuthRequiredPopover` integration.
- Integrate `FavoriteButton` into `AccommodationCard.astro`.
- Implement bulk-check call on `/alojamientos` listing page; hydrate card states.
- Write component unit tests for `FavoriteButton` (mock API, test optimistic behavior).

#### Phase 6 -- Frontend Coverage (~6h)

- Integrate `FavoriteButton` into `EventCard.astro`.
- Integrate `FavoriteButton` into `ArticleCard.astro`.
- Integrate `FavoriteButton` into `DestinationsIsland.client.tsx`.
- Integrate `FavoriteButton` into `LocationMap.client.tsx` popup.
- Integrate `FavoriteButton` + counter into `DetailHeader.astro` for all 4 entity detail
  pages (accommodation, destination, event, post).
- Verify counter display logic (threshold, zero state, singular/plural).

#### Phase 7 -- Frontend Pages and Modals (~10h)

- Refactor `UserFavoritesList.client.tsx`:
  - Entity type tabs.
  - "Sin coleccion" section.
  - "Mis colecciones" section with collection grid.
  - Pagination ("Cargar mas").
- Implement `CreateEditCollectionModal.client.tsx` (create + edit mode).
- Implement `MoveToCollectionModal.client.tsx` with inline new collection form.
- Implement inline notes editor on bookmark cards.
- Create `/favoritos/colecciones/[id].astro` page.
- Implement deleted-entity fallback state on bookmark cards.
- Add "Mas guardados" sort option to listing pages.

#### Phase 8 -- i18n + Frontend Tests (~4h)

- Add all i18n keys to `account.json` for `es`, `en`, `pt`.
- Add `sort.mostSaved` key to `accommodations.json` (or shared sort namespace).
- Write component tests for `CreateEditCollectionModal` and `MoveToCollectionModal`.

#### Phase 9 -- E2E Tests (~3h)

- Implement all 8 E2E spec files in `apps/e2e/tests/spec-098/`.
- Verify they pass against the seeded test database.

#### Phase 10 -- Docs + Cleanup (~1h)

- Add naming split comment to `UserBookmarkCollectionService` and collection route files.
- Update `packages/service-core/CLAUDE.md` to mention `UserBookmarkCollectionService`.
- Update `packages/db/CLAUDE.md` to mention the new table.
- Update `apply-postgres-extras.sh` to document the new manual SQL files.
- Verify no leftover `TODO(SPEC-098)` comments remain.

---

### 17. Success Metrics

Post-launch KPIs (baseline measurement should be established at launch date):

| Metric | Target (90-day) | Measurement Method |
|---|---|---|
| % of authenticated users with at least 1 collection | >= 30% | DB query: users with active collection / total active users |
| Average collections per active user | >= 2 | DB aggregate |
| Average bookmarks per collection | >= 3 | DB aggregate |
| Favorites page session duration | +15% vs. pre-launch baseline | Analytics |
| Detail page conversion (contact CTA) on entities with count >= 10 | +10% lift vs. count < 3 | Segment comparison |
| Error rate on new endpoints | < 0.1% of requests | API monitoring (Sentry) |
| p95 response time for public count endpoint | < 50ms | API monitoring |
| p95 response time for bulk-check endpoint | < 100ms | API monitoring |
| Zero cross-user data access incidents | 0 incidents | Security audit + Sentry |
