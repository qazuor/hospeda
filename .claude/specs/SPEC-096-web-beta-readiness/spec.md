# SPEC-096: Web App Beta-Readiness

> **Status**: in-progress
> **Priority**: P0 (critical, beta-blocking)
> **Complexity**: XL
> **Origin**: Page-by-page audit of `apps/web` revealed broken navigation, orphan pages, blocked account pages, and infrastructure gaps from SPEC-075. Absorbs all pending work from SPEC-075 (archived 2026-04-29).
> **Affected**: `apps/web`, `apps/api`, `apps/admin`, `packages/{db,schemas,service-core,i18n}`
> **Created**: 2026-04-29
> **Estimated effort**: ~55 atomic tasks across 11 phases (~3-4 weeks)
> **Related specs**: SPEC-075 (MERGED INTO THIS SPEC, archived 2026-04-29), SPEC-085 (messaging), SPEC-092 (host onboarding + E2E delegation), SPEC-095 (destination refactor)

---

## Overview

Audit of the `apps/web` Astro frontend (72 routes / 53 unique pages) found the platform 70% beta-ready: most pages were built across SPEC-075/085/092/095 but a measurable set of gaps remains:

- **1 broken internal link** (Footer → `/propietarios/`).
- **10 orphan pages** with no navigation entry (filter sub-routes, mis-categorized turistas, attraction pages).
- **5 blocked pages** in `/mi-cuenta/*` rendering "Contenido en desarrollo" placeholders.
- **3 pages blocked by missing backend** (`/busqueda/`, `/contacto/`, `/publicaciones/autor/`).
- **7 pages with polish gaps** (map placeholders, share buttons, missing counts).
- **Pending SPEC-075 infrastructure**: ISR exclude regex bug, missing dynamic sitemap, stale entity path mapper.

This spec closes those gaps in a single coordinated effort. Out of scope: interactive map components (postponed to v1.1), Lighthouse 90+ optimization (post-beta with real metrics), favorites for non-accommodation entities (post-beta), `/eventos/ubicacion/[slug]/` sub-route (deferred — `destinationId` filter from REQ-096-02 covers the geographic filtering need).

The work spans **3 apps and 4 packages** because some decisions (theme/language separation, profile editing) require cross-app coordination. SPEC-075 has been **absorbed into this spec and archived**: foundational layouts (T-001 to T-008) and page migrations (T-009 to T-012) verified complete in code; sub-routes and marketing/legal pages exist with content (need only the polish covered here); backend prerequisites and account islands are mapped 1:1 to REQs below.

---

## Goals

- Eliminate all known navigation gaps: 0 broken links, 0 orphan pages discoverable through normal navigation paths.
- Unblock the 5 `/mi-cuenta/*` placeholder pages with functional UI islands.
- Implement the 4 backend prerequisites that block search, contact, author, and amenity-filtering features.
- Centralize cross-app concerns: profile schema in `@repo/schemas`, theme/language separated per app, subscription with role-conditional escalation.
- Restore SPEC-075 infrastructure: working ISR cache for filters, dynamic sitemap of all published entities, accurate path mapper for revalidation.
- Consolidate shared UI components without breaking existing instances (regression-tested).
- Validate JSON-LD across all detail pages with Google Rich Results Test.
- Reach Lighthouse 80+ on Performance, SEO, Accessibility, BestPractices on representative pages.
- Full i18n coverage in es/en/pt before close.

### Success Metrics

| Metric | Target | How verified |
|---|---|---|
| Broken internal links | 0 | Re-run audit agent, diff against pre-spec report |
| Orphan pages (no inbound link) | 0 | Same audit |
| `/mi-cuenta/*` placeholder pages | 0 (all 5 functional) | Manual flow walk-through |
| Backend prereq endpoints live | 4/4 (T-014, T-015, T-016, T-017) | API tests + manual smoke |
| Lighthouse score per category | ≥ 80 on 5 representative pages | Lighthouse CI run |
| JSON-LD validity | 100% on detail pages | Google Rich Results Test |
| i18n keys missing in es/en/pt | 0 | CI check |
| Tests passing | typecheck + lint + unit + integration green | `pnpm typecheck && pnpm lint && pnpm test` |
| Dynamic sitemap entries | All published entities × 3 locales | Manual XML inspection |

---

## Phases

Phases are listed in dependency order. Items within a phase can run in parallel.

| # | Phase | Blocks |
|---|---|---|
| 1 | Backend prerequisites (T-014, T-015, T-016, T-017) | All UI consuming these endpoints |
| 2 | Schema changes (theme/language split, profile schema, contact schema) | Phases 4, 5, 7 |
| 3 | Shared components (Breadcrumbs, EmptyState, ShareButtons, FilterSidebar, ErrorBanner, ImageGallery) | Phases 4-6 |
| 4 | Global navigation (Header redesign, Footer redesign, UserMenu, TagChips, CategoryTiles) | Phase 9 (i18n) |
| 5 | `/mi-cuenta/*` islands (Edit, Favorites, Reviews, Subscription, Preferences) | Phase 9 |
| 6 | Polish pages (events/destinations/posts share buttons, destination counts, map placeholders, author page) | Phase 9 |
| 6.5 | Marketing/Legal polish (AboutPage/PriceSpecification/FAQPage JSON-LD, EmptyState fallback) — absorbed from SPEC-075 | Phase 10 |
| 7 | Cross-app coordination (admin profile editable, admin settings adapted to 4 fields) | — |
| 8 | Infrastructure (ISR regex, dynamic sitemap, entity path mapper) | — |
| 9 | i18n full pass (es/en/pt) | Phase 10 |
| 10 | JSON-LD pass + Lighthouse audit | Phase 11 |
| 11 | E2E tests specification (delegated to SPEC-092 for execution) | Closure |

---

## Phase 1: Backend Prerequisites

### REQ-096-01: Amenity/feature JOIN filtering at model layer (T-014)

**Problem**: `apps/web` filter sub-routes `/alojamientos/comodidades/{slug}/` and `/alojamientos/caracteristicas/{slug}/` exist, accept the `amenities`/`features` query params at HTTP and service layer, but the model `search()` and `searchWithRelations()` methods silently ignore them. The filter pages return unfiltered results.

**Acceptance Criteria**

```
Given a request to GET /api/v1/public/accommodations?amenities={uuid}
When the model search method runs
Then the SQL query includes a JOIN on r_accommodation_amenity filtered by the amenity ID and only matching accommodations are returned.

Given a request with multiple amenity IDs (?amenities=uuid1&amenities=uuid2)
When the model search method runs
Then accommodations matching ALL provided amenities are returned (intersection).

Given a request with both amenities and features filters
When the model search method runs
Then both JOINs apply and results match BOTH the amenity and feature filters.
```

**Implementation**: `packages/db/src/models/accommodation/accommodation.model.ts`. Add JOINs to `r_accommodation_amenity` and `r_accommodation_feature`. Maintain pagination, sorting, soft-delete filter. Update existing tests + add integration tests for combined filtering.

---

### REQ-096-02: Event destinationId FK + backfill (T-015)

**Problem**: Events have no relationship with destinations. `EventLocation.city` is a free text. The page `/destinos/{slug}/eventos/` cannot reliably filter events by destination.

**Acceptance Criteria**

```
Given the events table
When migration runs
Then events.destinationId column exists (UUID, nullable, FK → destinations.id).

Given existing events with eventLocation.city values
When the backfill script runs
Then events.destinationId is populated by matching eventLocation.city against destination.name (case-insensitive).

Given a GET /api/v1/public/events?destinationId={uuid} request
When the handler processes the filter
Then only events with that destinationId are returned.

Given a destination is deleted (soft delete)
When the cascade rule applies
Then events.destinationId becomes NULL (events are not deleted).
```

**Implementation**:
- DB migration in `packages/db/src/migrations/manual/{timestamp}_event_destination_fk.sql` (postgres-specific, applied via `apply-postgres-extras.sh`).
- Schema update: `EventSearchHttpSchema` and `EventSearchSchema` accept `destinationId`.
- Handler/model: process the filter.
- Backfill script committed in `packages/db/scripts/`.

---

### REQ-096-03: Public user-by-slug endpoint (T-016)

**Problem**: `/publicaciones/autor/{slug}/` exists but there's no public endpoint to resolve user slug to profile. Author links currently 404.

**Acceptance Criteria**

```
Given a GET /api/v1/public/users/by-slug/{slug} request
When the user with that slug exists and is not deleted
Then the response includes id, displayName, slug, avatar, bio (no sensitive fields like email, phone, role, settings).

Given a GET /api/v1/public/users/by-slug/{slug} request
When the user does not exist or is deleted
Then the response is 404 with a clear error message.

Given the endpoint is rate-limited
When more than 60 requests/min from same IP
Then HTTP 429 is returned.
```

**Implementation**: `apps/api/src/routes/user/public/getBySlug.ts`. Pattern from `apps/api/src/routes/tag/public/getBySlug.ts`. Add to public router index.

---

### REQ-096-04: Unified public search endpoint (T-017)

**Problem**: `/busqueda/` page is built but shows a "coming soon" placeholder because no cross-entity search endpoint exists.

**Acceptance Criteria**

```
Given a GET /api/v1/public/search?q={query} request with q.length >= 2
When the handler runs
Then the response includes 4 entity groups: { accommodations: { items, total }, destinations, events, posts }.

Given each item in the response
When inspected
Then it contains: id, slug, name (or title), coverImage, type (or category) — minimal fields for a card.

Given a GET request with q.length < 2
When validated
Then HTTP 400 is returned with a "query too short" error.

Given the endpoint is rate-limited
When more than 30 requests/min from same IP
Then HTTP 429 is returned.

Given the search uses LIKE patterns
When the query reaches the DB
Then `safeIlike()` from @repo/db is used (no raw `ilike`).
```

**Implementation**:
- `apps/api/src/routes/search/public/search.ts` — new route file
- `packages/schemas/src/search/query.ts` — Zod schemas for query and response
- Service layer queries 4 entities in parallel with `Promise.all`. Each query limited to top 5 (configurable up to 20 via `?limit=N`).
- Add to public router index.

---

## Phase 2: Schema Changes

### REQ-096-05: User settings schema separated per app

**Problem**: Currently `user.settings` has `darkMode` and `language` as single fields. Web and admin should be configurable independently.

**Acceptance Criteria**

```
Given a user.settings JSON object
When the new schema applies
Then it has these fields: themeWeb ('system'|'light'|'dark'), themeAdmin ('system'|'light'|'dark'), languageWeb ('es'|'en'|'pt'), languageAdmin ('es'|'en'|'pt'), notifications {...}, newsletter (boolean).

Given an existing user with legacy darkMode/language
When the migration runs
Then both legacy values are copied: darkMode → themeWeb + themeAdmin, language → languageWeb + languageAdmin.

Given web reads/writes settings
When PATCH /api/v1/protected/users/{id} is called
Then web is only allowed to update *Web fields (themeWeb, languageWeb, notifications, newsletter).

Given admin reads/writes settings
When PATCH /api/v1/admin/users/{id} is called
Then admin can update all 4 theme/language fields.
```

**Implementation**:
- `packages/schemas/src/user/preferences.ts` — update Zod schema.
- DB migration to backfill legacy values.
- API handler: enforce field-level permissions per scope.

---

### REQ-096-06: Centralized profile edit schema

**Problem**: Web and admin both need to edit user profile (decision in Bloque 5). Schema must be a single source of truth.

**Acceptance Criteria**

```
Given a profile edit form (web or admin)
When validating input
Then the same Zod schema from @repo/schemas/user/profile is used.

Given the schema definition
When inspected
Then editable fields are: displayName (1-100), firstName (1-100), lastName (1-100), bio (max 1000), avatarUrl (URL or empty), phone (E.164 or empty).

Given a PATCH request with extra fields (e.g., role, email)
When validated
Then those fields are rejected (strict object).
```

**Implementation**: `packages/schemas/src/user/profile.ts`. Export `ProfileEditSchema` and `ProfileEditInput` type.

---

### REQ-096-07: Contact submission schema

**Acceptance Criteria**

```
Given a contact form submission
When validated against the schema
Then required fields are: firstName (1-100), lastName (1-100), email (valid), message (10-2000), type ('general'|'accommodation'). accommodationId required only if type='accommodation'.

Given a submission with website honeypot field non-empty
When the API receives it
Then it is silently discarded with a fake-success response.
```

**Implementation**: `packages/schemas/src/contact/submit.ts`. Honeypot in API handler.

---

## Phase 3: Shared Components

### REQ-096-08: Breadcrumbs component

**Acceptance Criteria**

```
Given a page renders <Breadcrumbs items={[...]} />
When inspected
Then the visible HTML is a nav with role="navigation" aria-label="breadcrumb" and an ordered list of links.

Given the same component
When inspected for SEO
Then a BreadcrumbList JSON-LD block is emitted in the page head with itemListElement matching the visible breadcrumbs.

Given the component on mobile (<640px)
When rendered
Then long breadcrumbs collapse to "first … last" with a tooltip showing the full path.
```

**Implementation**: `apps/web/src/components/Breadcrumbs.astro`. Props: `items: Array<{label, href?}>` (last item has no href). Locale-aware via `apps/web/src/lib/i18n.ts`.

---

### REQ-096-09: EmptyState component

**Acceptance Criteria**

```
Given a page uses <EmptyState icon={Icon} title="..." description="..." action={...} />
When rendered
Then the component shows: icon (40-80px), bold title, muted description, optional CTA slot/button.

Given the component is used without action
When rendered
Then the action area is omitted (no empty container).

Given the component on mobile
When rendered
Then content is centered with max-width 500px.
```

**Implementation**: `apps/web/src/components/EmptyState.astro`. Slot-based for flexible CTA. Used in: listings (no results), favorites (no items), reviews (no reviews), search (no results), messages (no conversations).

---

### REQ-096-10: ShareButtons component

**Acceptance Criteria**

```
Given <ShareButtons url={...} title={...} /> on mobile
When the share button is clicked
Then navigator.share() is invoked with the page title and URL.

Given the same component on desktop or mobile without Web Share API
When the share button is clicked
Then a popover shows links to: WhatsApp, Facebook, X, Telegram, "Copy URL".

Given the user clicks "Copy URL"
When the action completes
Then the URL is copied to clipboard and a toast confirms "Link copiado".
```

**Implementation**: `apps/web/src/components/ShareButtons.client.tsx` (React island, `client:visible`). Used in `/eventos/[slug]/`, `/publicaciones/[slug]/`, `/alojamientos/[slug]/`.

---

### REQ-096-11: FilterSidebar consolidated

**Acceptance Criteria**

```
Given existing FilterSidebar variants in current code
When refactored to a single component with variants
Then all current call sites continue to work without visual regression.

Given the consolidated component with prop position='left'
When rendered on desktop
Then the filter panel is to the left of the content area.

Given prop position='top'
When rendered
Then the filter panel is above the content area as a horizontal bar.

Given the component on mobile (<768px)
When rendered
Then the panel collapses behind a "Filtros" button that toggles a drawer.

Given a regression test snapshot
When the consolidated version renders
Then it matches the pre-refactor screenshot (visual diff under threshold).
```

**Implementation**: Audit current uses, screenshot all instances, then refactor into a single `<FilterSidebar position={...} filters={...} />` keeping all variants. Reject merge if visual diff fails.

---

### REQ-096-12: ErrorBanner component

**Acceptance Criteria**

```
Given <ErrorBanner variant="error" message="..." onRetry={...} />
When rendered
Then the banner shows an error icon, message, and "Reintentar" button.

Given variant="warning"
When rendered
Then the banner uses a yellow palette and warning icon.

Given variant="info"
When rendered
Then the banner uses a blue palette and info icon.
```

**Implementation**: `apps/web/src/components/ErrorBanner.astro`. Used in pages where SSR fetch fails partially (e.g., listing renders shell, banner explains data couldn't be loaded, retry triggers full reload).

---

### REQ-096-13: ImageGallery generalized

**Acceptance Criteria**

```
Given the existing accommodation gallery
When extracted to a shared component
Then the accommodation detail page renders identically (visual regression test passes).

Given the component used in a destination detail page
When the destination has 5+ images
Then a lightbox grid with thumbnails and a full-screen viewer is shown.

Given the component on a post (cover + gallery)
When rendered
Then the cover is featured with optional inline gallery below.
```

**Implementation**: Extract from `apps/web/src/components/accommodation/...` to `apps/web/src/components/ImageGallery.client.tsx`. Props: `images: Array<{url, alt, caption?}>`, `variant?: 'detail' | 'cover-plus-grid'`.

---

## Phase 4: Global Navigation

### REQ-096-14: Fix Footer broken link

**Acceptance Criteria**

```
Given the footer renders
When the "Propietarios" link is clicked
Then the user lands on /{locale}/suscriptores/propietarios/ (HTTP 200, not 404).
```

**Implementation**: `apps/web/src/layouts/Footer.astro:35`. Change `path: "/propietarios/"` to `path: "suscriptores/propietarios"`.

---

### REQ-096-15: Footer 5-column reorganization

**Acceptance Criteria**

```
Given the footer renders on desktop (>= 768px)
When inspected
Then 5 columns are visible: Explorar | Categorías | Destinos | Propietarios+Turistas | Hospeda.

Given the "Categorías" column
When inspected
Then it contains 5-7 links to top accommodation types and event categories (e.g., Cabañas, Hoteles, Casas, Gastronomía, Cultura, Naturaleza).

Given the "Propietarios+Turistas" column
When inspected
Then both subscriber landing pages are present, no longer mixed under "Propietarios".

Given the "Explorar" column
When inspected
Then `/busqueda/` is added as a link.

Given the footer on mobile
When rendered
Then columns stack vertically with collapsible accordions.
```

**Implementation**: `apps/web/src/layouts/Footer.astro`. Top categories pre-defined (no API call at render time; static curated list).

---

### REQ-096-16: Header redesign + UserMenu + Publicar prominente

**Acceptance Criteria**

```
Given the header renders on desktop
When inspected
Then it shows: logo, nav (Alojamientos, Destinos, Eventos, Publicaciones, Contacto), search icon, "Publicar" CTA button (NOT hidden under 1200px), UserMenu.

Given the user is not authenticated
When the UserMenu is shown
Then it is a single button "Iniciar sesión" linking to /{locale}/auth/signin.

Given the user is authenticated
When the UserMenu is shown
Then it is an avatar + dropdown with: Mi cuenta, Editar perfil, Mis propiedades, Mis mensajes, Mis favoritos, Cerrar sesión.

Given the header on mobile (<768px)
When inspected
Then the nav collapses into a hamburger menu, but "Publicar" and search icon stay visible outside.

Given the hamburger menu is open
When the user is authenticated
Then it includes "Mi cuenta" entry below the public nav links.
```

**Implementation**:
- `apps/web/src/layouts/Header.astro` — restructure markup
- `apps/web/src/components/UserMenu.client.tsx` — new React island (`client:load` for auth state hydration)

---

### REQ-096-17: TagChips on listing pages

**Acceptance Criteria**

```
Given /{locale}/alojamientos/ renders
When inspected below the page header
Then a horizontal row of 5-8 chip links is visible with top accommodation types (e.g., Cabañas, Hoteles, Casas).

Given /{locale}/eventos/ renders
When inspected
Then chips show top event categories (Música, Cultura, Gastronomía, Festivales, etc).

Given /{locale}/publicaciones/ renders
When inspected
Then chips show top blog categories.

Given a chip is clicked
When the user navigates
Then they land on the corresponding sub-route (e.g., /alojamientos/tipo/cabin/).
```

**Implementation**: `apps/web/src/components/TagChips.astro`. Static curated list per listing context. Locale-aware.

---

### REQ-096-18: CategoryTiles section on homepage

**Acceptance Criteria**

```
Given /{locale}/ renders
When inspected
Then a new section "Explorá por categoría" is visible with visual tiles linking to filter sub-routes.

Given the section
When clicked
Then tiles link to: /alojamientos/tipo/{type}/, /eventos/categoria/{category}/, /publicaciones/categoria/{category}/.

Given the tile component
When rendered
Then each tile has: icon or image, title, brief description, link.
```

**Implementation**: `apps/web/src/components/CategoryTiles.astro`. Insert into `apps/web/src/pages/[lang]/index.astro` between existing sections. Position: after FeaturedAccommodationsSection, before NextEventsSection (or based on UX call).

---

### REQ-096-19: Breadcrumbs everywhere

**Acceptance Criteria**

```
Given any sub-route or detail page (e.g., /alojamientos/[slug]/, /destinos/[...path]/, /eventos/[slug]/, /publicaciones/[slug]/, /alojamientos/tipo/[type]/, /alojamientos/comodidades/[slug]/, etc.)
When the page renders
Then <Breadcrumbs /> is present above the main content showing the navigation path.

Given the breadcrumbs in any rendered page
When inspected for SEO
Then a BreadcrumbList JSON-LD block is emitted.

Given the breadcrumb path on mobile
When rendered
Then long paths collapse with the visual pattern from REQ-096-08.
```

**Implementation**: Add `<Breadcrumbs items={...} />` to all pages listed above. Items computed at page level from URL params and entity data.

---

## Phase 5: `/mi-cuenta/*` Islands

All islands in this phase are React, loaded with `client:load` (data needed immediately on page load).

### REQ-096-20: ProfileEditForm island

**Acceptance Criteria**

```
Given the user lands on /{locale}/mi-cuenta/editar/
When the page renders
Then the form is pre-populated with the user's current displayName, firstName, lastName, bio, avatarUrl, phone.

Given the user changes a field and saves
When the PATCH /api/v1/protected/users/{id} call succeeds
Then a success toast appears and the form reflects the saved state.

Given the user provides invalid input (e.g., displayName empty)
When the form is submitted
Then inline validation errors are shown next to the offending fields and submission is blocked.

Given the avatar upload component
When a file is selected
Then a preview is shown before submit (upload happens on form submit, not immediately).
```

**Implementation**:
- `apps/web/src/components/account/ProfileEditForm.client.tsx`
- Schema from `@repo/schemas` (REQ-096-06).
- Avatar upload via existing media handler (Cloudinary integration from SPEC-078).

---

### REQ-096-21: UserFavoritesList island (accommodations only in beta)

**Acceptance Criteria**

```
Given the user lands on /{locale}/mi-cuenta/favoritos/
When the page renders
Then a grid of accommodation cards is shown for each bookmarked accommodation, fetched from GET /api/v1/protected/user-bookmarks/?type=accommodation.

Given a card has a "Quitar" button
When clicked
Then the bookmark is removed via DELETE and the card disappears with optimistic update.

Given the user has no accommodation bookmarks
When the page renders
Then <EmptyState> shows with icon, "Aún no tenés alojamientos favoritos", and a CTA to /alojamientos/.

Given the user has 13+ favorites
When pagination is rendered
Then 12 are shown per page with prev/next navigation.
```

**Implementation**:
- `apps/web/src/components/account/UserFavoritesList.client.tsx`.
- Backend `user-bookmarks` API supports multi-entity but UI limits filter to `type=accommodation` for beta.

---

### REQ-096-22: UserReviewsList island (read-only)

**Acceptance Criteria**

```
Given the user lands on /{locale}/mi-cuenta/resenas/
When the page renders
Then a list of cards is shown with: review text, rating, reviewed entity (link to detail), date.

Given a review card
When clicked on the entity link
Then the user navigates to the entity detail page.

Given the user has no reviews
When the page renders
Then <EmptyState> shows with CTA to /alojamientos/.

Given the user has 11+ reviews
When pagination is rendered
Then 10 are shown per page.
```

**Implementation**: `apps/web/src/components/account/UserReviewsList.client.tsx`. Fetches GET /api/v1/protected/users/me/reviews. No edit/delete actions inline (those go via entity detail page).

---

### REQ-096-23: PreferenceToggles island

**Acceptance Criteria**

```
Given the user lands on /{locale}/mi-cuenta/preferencias/
When the page renders
Then it shows: theme select (system/light/dark) for web, language select (es/en/pt) for web, notifications toggles (email, push, sms), newsletter toggle.

Given the user changes any setting
When the toggle is interacted with
Then the change is saved via PATCH (optimistic update) without explicit save button.

Given a save fails
When the API responds with error
Then the toggle reverts to previous state and a toast shows the error.

Given the user is on web only
When inspected
Then there is NO field to edit themeAdmin or languageAdmin (those are admin-only).
```

**Implementation**:
- `apps/web/src/components/account/PreferenceToggles.client.tsx`.
- Only edits `*Web` fields. Themes apply to current page via CSS variable swap.

---

### REQ-096-24: SubscriptionDashboard island + role-conditional escalation

**Acceptance Criteria**

```
Given the user lands on /{locale}/mi-cuenta/suscripcion/
When the page renders
Then it shows: current plan name, plan status, next billing date, payment method (display only), plan features list, link to upgrade (/suscriptores/planes), button to cancel (with confirmation modal), button to download last invoice.

Given the user has role >= HOST
When the page renders
Then a button "Más opciones (panel admin)" is visible linking to ADMIN_URL/billing/settings.

Given the user has role USER
When the page renders
Then the "Más opciones" button is NOT shown.

Given the user clicks "Cancelar suscripción"
When the modal is confirmed
Then POST to cancel endpoint is called, status updates to "cancelled", and a notification confirms.
```

**Implementation**:
- `apps/web/src/components/account/SubscriptionDashboard.client.tsx`.
- Endpoints: GET /protected/users/me/subscription, GET /public/plans (for upgrade reference).

---

## Phase 6: Polish Pages

### REQ-096-25: Real counts on `/destinos/[...path]/`

**Acceptance Criteria**

```
Given /{locale}/destinos/{slug}/ renders
When the sidebar is inspected
Then real counts are shown: "X alojamientos", "Y eventos" (numbers from the API).

Given the queries for counts
When executed
Then they run in parallel via Promise.all with the destination fetch (no waterfall).

Given the query
When optimized
Then it uses pageSize=0 or count-only mode to avoid fetching full lists for the count.

Given the page is ISR-cached for 24h
When admin updates an accommodation/event in this destination
Then revalidation triggers via the entity path mapper.
```

**Implementation**: `apps/web/src/pages/[lang]/destinos/[...path].astro`. Replace TODO counts with real API calls.

---

### REQ-096-26: ShareButtons in event and post detail

**Acceptance Criteria**

```
Given /{locale}/eventos/[slug]/ renders
When the share section is inspected
Then <ShareButtons url={canonical} title={event.title} /> is present.

Given /{locale}/publicaciones/[slug]/ renders
When the share section is inspected
Then <ShareButtons url={canonical} title={post.title} /> is present.
```

**Implementation**: Replace existing share placeholders.

---

### REQ-096-27: Map placeholder consolidation (interactive map deferred)

**Acceptance Criteria**

```
Given /{locale}/eventos/[slug]/ has a location
When the map area is rendered
Then a placeholder card shows "Ubicación: [direction text]" with a button "Ver en Google Maps" linking to https://maps.google.com/?q={encoded address}.

Given /{locale}/destinos/[...path]/ has a hero image
When the map area is rendered
Then the same placeholder pattern is used.

Given an interactive MapView is implemented in a future spec (v1.1)
When the placeholder is replaced
Then the placeholder code is removed in a single PR.
```

**Implementation**: New shared component `apps/web/src/components/MapPlaceholder.astro`. Used in eventos/[slug].astro and destinos/[...path].astro.

---

### REQ-096-28: Author blog page functional

**Acceptance Criteria**

```
Given /{locale}/publicaciones/autor/{slug}/ is requested
When the SSR resolves the author via GET /api/v1/public/users/by-slug/{slug}
Then the page renders with the author's avatar, displayName, bio, and a paginated list of their posts.

Given the slug does not resolve to a user
When SSR receives 404
Then the page returns 404.

Given a blog post detail page links to its author
When the link is clicked
Then the user lands on /{locale}/publicaciones/autor/{slug}/.
```

**Implementation**: 
- Update `apps/web/src/pages/[lang]/publicaciones/autor/[slug]/index.astro` to consume T-016 endpoint.
- Re-enable author links in blog post cards and post detail.

---

### REQ-096-29: Search results page consuming T-017

**Acceptance Criteria**

```
Given /{locale}/busqueda/?q=colón is requested
When the page renders
Then results are grouped by entity type (Alojamientos, Destinos, Eventos, Publicaciones), each with a count and 5 cards.

Given a group has more results than shown
When inspected
Then a "Ver todos" link to the entity listing with the query pre-filled is visible.

Given /{locale}/busqueda/ with no query
When the page renders
Then a search field is shown with popular tags as quick-search shortcuts.

Given the page head
When inspected
Then a noindex meta tag is present (search results must not be indexed).

Given the user types in the search field
When 2+ characters are entered
Then results update (debounced 300ms).
```

**Implementation**: `apps/web/src/pages/[lang]/busqueda/index.astro` + a small results island for live filtering.

---

### REQ-096-30: ContactForm island and submission

**Acceptance Criteria**

```
Given /{locale}/contacto/ renders
When the form is inspected
Then it has fields: firstName, lastName, email, type (select: general/accommodation), accommodationId (only visible if type=accommodation), message.

Given the user submits with valid data
When POST /api/v1/public/contact responds 200
Then a success message replaces the form.

Given the user submits with invalid data
When the schema validates
Then inline errors appear and submission is blocked.

Given a bot fills the honeypot field
When POST is processed
Then the request is silently discarded (HTTP 200 fake-success, no email sent).

Given more than 5 submissions in 60s from same IP
When POST is rate-limited
Then HTTP 429 is returned with a localized error.
```

**Implementation**:
- `apps/web/src/components/ContactForm.client.tsx`.
- `apps/api/src/routes/contact/public/submit.ts` — verify it exists, create if not.
- Email notification + admin log entry on success.

---

## Phase 6.5: Marketing/Legal Polish (absorbed from SPEC-075 audit)

These pages already exist with real content (`/nosotros/`, `/beneficios/`, `/legal/{privacidad,terminos,cookies}/`, `/suscriptores/{propietarios,turistas,planes}/`, `/feedback/`). The polish below brings them to beta-readiness without rewriting content.

### REQ-096-40: AboutPage JSON-LD on `/nosotros/` and `/beneficios/`

**Acceptance Criteria**

```
Given /{locale}/nosotros/ renders
When inspected
Then a JSON-LD block with @type="AboutPage" is present (name, description, primaryImageOfPage, mainEntity referencing the Organization).

Given /{locale}/beneficios/ renders
When inspected
Then a JSON-LD block with @type="AboutPage" is present with description listing tourist + owner benefit categories.

Given the JSON-LD block
When tested in Google Rich Results Test
Then no errors are reported.
```

**Implementation**: Add JSON-LD generator helper in `apps/web/src/lib/jsonld.ts` (or extend existing). Render in page `<head>` via SEOHead component or inline `<JsonLd>`.

---

### REQ-096-41: PriceSpecification JSON-LD on pricing pages

**Acceptance Criteria**

```
Given /{locale}/suscriptores/turistas/ renders
When inspected
Then each plan card emits a JSON-LD block with @type="Offer" + nested PriceSpecification (priceCurrency=ARS, price=plan.price, url=signup deep link).

Given /{locale}/suscriptores/planes/ renders
When inspected
Then each owner plan card emits the same structure.

Given the JSON-LD block
When tested in Google Rich Results Test
Then no errors are reported.
```

**Implementation**: Read plan data from `@repo/billing.ALL_PLANS` (already used by these pages). Map to `Offer`/`PriceSpecification`. Render once per plan in the page `<head>` block.

---

### REQ-096-42: FAQPage JSON-LD on legal pages

**Acceptance Criteria**

```
Given /{locale}/legal/privacidad/, /{locale}/legal/terminos/, /{locale}/legal/cookies/ render
When inspected
Then each emits a JSON-LD block with @type="FAQPage" derived from the section heading + body content (one question per H2).

Given the JSON-LD block
When tested in Google Rich Results Test
Then no errors are reported (acceptable to use Article schema instead if FAQPage validation is stricter than content fits).
```

**Implementation**: Helper that reads the `sections` array already present in legal page data and maps each section into `mainEntity` Q/A pair. Fallback to `@type="Article"` if FAQPage doesn't fit.

---

### REQ-096-43: EmptyState fallback for pricing pages when plan data unavailable

**Acceptance Criteria**

```
Given /{locale}/suscriptores/turistas/ or /{locale}/suscriptores/planes/ renders
When `ALL_PLANS` import returns an empty array (or fetch fails)
Then the page renders <EmptyState> with title "Planes no disponibles", description, and a CTA to /contacto/.

Given the same pages
When ALL_PLANS contains data
Then the page renders normally with plan cards.
```

**Implementation**: Wrap plan grid in conditional rendering. Use shared `EmptyState` component (REQ-096-09) once available.

---

## Phase 7: Cross-app Coordination

### REQ-096-31: Admin profile page editable

**Problem**: `apps/admin/src/routes/_authed/me/profile.tsx` is currently read-only. Per Bloque 5 decision, both web and admin allow profile editing.

**Acceptance Criteria**

```
Given an admin user lands on /admin/_authed/me/profile
When the page renders
Then editable fields are: displayName, firstName, lastName, bio, avatarUrl, phone (same as web).

Given the form uses the centralized profile schema
When validating input
Then the same Zod schema from @repo/schemas/user/profile is used.

Given the user saves
When PATCH /api/v1/admin/users/{id} succeeds
Then a toast confirms and the form reflects the updated state.
```

**Implementation**: Convert `profile.tsx` from display-only to a Tailwind form using react-hook-form + Zod resolver.

---

### REQ-096-32: Admin settings page adapted to 4 fields

**Acceptance Criteria**

```
Given an admin user lands on /admin/_authed/me/settings
When the page renders
Then it has 2 sections: "Web" (themeWeb, languageWeb) and "Admin" (themeAdmin, languageAdmin), plus shared sections for notifications.

Given the legacy darkMode/language fields existed
When the page reads/writes
Then it uses the new 4-field schema (no legacy field references remain).

Given a setting is changed
When PATCH succeeds
Then auto-save (current behavior) is preserved.
```

**Implementation**: `apps/admin/src/routes/_authed/me/settings.tsx`. Update `useUpdateUserSettings` hook to handle new fields.

---

## Phase 8: Infrastructure

### REQ-096-33: ISR exclude regex fix (T-013)

**Acceptance Criteria**

```
Given the ISR exclude config
When updated
Then the exclude pattern is exactly: `[/^(\/(?:en|pt))?\/(auth|mi-cuenta|busqueda|feedback)(\/.*)?$/]` (one regex covering all 4 paths).

Given /{locale}/alojamientos/tipo/cabin/ is requested twice in 24h
When the second request arrives
Then it is served from ISR cache (no API call).

Given any /{locale}/auth/* path is requested
When inspected
Then it is rendered fresh (SSR, not ISR).

Given any /{locale}/mi-cuenta/* path is requested
When inspected
Then it is rendered fresh (SSR, not ISR).

Given /{locale}/busqueda/ is requested
When inspected
Then it is excluded from ISR.

Given /{locale}/feedback/ is requested
When inspected
Then it is excluded from ISR.
```

**Implementation**: `apps/web/astro.config.mjs`. Test with manual cache check on staging.

---

### REQ-096-34: Dynamic sitemap endpoint

**Acceptance Criteria**

```
Given a request to /sitemap-dynamic.xml
When the endpoint runs
Then it fetches all published accommodations, destinations, events, and posts in parallel and returns valid XML with <url> entries for each entity in all 3 locales.

Given the endpoint
When ISR-cached
Then the cache TTL is 24h.

Given the @astrojs/sitemap configuration
When inspected
Then customPages includes the dynamic sitemap URL.

Given /sitemap-index.xml is requested
When inspected
Then it lists both the static @astrojs/sitemap output and the dynamic sitemap.

Given a published entity is created or updated
When the entity path mapper runs
Then both the entity detail and the sitemap-dynamic.xml are revalidated.
```

**Implementation**: `apps/web/src/pages/sitemap-dynamic.xml.ts`. Fetch logic with proper error handling (partial sitemap if one entity fetch fails).

---

### REQ-096-35: Entity path mapper update

**Acceptance Criteria**

```
Given the entity path mapper
When inspected
Then the accommodation type slug list contains exactly the 10 valid types from AccommodationTypeEnum (apartment, house, country-house, cabin, hotel, hostel, camping, room, motel, resort) — no estancia, no posada.

Given the event category slug list
When inspected
Then it contains exactly the 9 valid categories from EventCategoryEnum (music, culture, sports, gastronomy, festival, nature, theater, workshop, other).

Given an accommodation is updated in admin
When the revalidation runs
Then it clears: detail page, listing, type sub-route, AND amenity sub-routes for all linked amenities, AND feature sub-routes for all linked features.

Given an event is updated
When the revalidation runs
Then it clears: detail, listing, category sub-route, location sub-route, AND destination's events sub-route (if destinationId is set).

Given a post is updated
When the revalidation runs
Then it clears: detail, listing, category sub-route, tag sub-routes (existing), author sub-route (new).

Given a destination is updated
When the revalidation runs
Then it clears: detail, listing, accommodations sub-route, events sub-route, AND attraction sub-routes for all linked attractions.
```

**Implementation**: `packages/service-core/src/revalidation/entity-path-mapper.ts`. Add unit tests covering each entity's revalidation set.

---

## Phase 9: i18n

### REQ-096-36: Full i18n coverage in es/en/pt

**Acceptance Criteria**

```
Given new components/pages introduced by this spec
When inspected
Then every user-facing string uses createTranslations(locale) and a corresponding key in the i18n namespace JSON.

Given the i18n locale files
When CI runs the i18n-check script
Then no key is missing in any of the 3 locales (es, en, pt).

Given a user switches locale
When any new page renders
Then the content is fully translated (no fallback to es leaking).
```

**Implementation**:
- New keys in `packages/i18n/locales/{es,en,pt}/web/*.json`.
- Existing CI script validates parity.

---

## Phase 10: SEO + Performance Audit

### REQ-096-37: JSON-LD pass + Rich Results validation

**Acceptance Criteria**

```
Given an accommodation detail page renders
When inspected
Then a JSON-LD block is present using the appropriate Schema.org subtype (Hotel/Hostel/Motel/Resort/Campground or LodgingBusiness fallback).

Given an event detail page renders
When inspected
Then an Event JSON-LD block is present with eventStatus mapping (cancelled/active/rescheduled).

Given a post detail page renders
When inspected
Then a BlogPosting JSON-LD block is present.

Given a destination detail page renders
When inspected
Then a TouristDestination JSON-LD block is present.

Given any page with a FAQ section renders
When inspected
Then a FAQPage JSON-LD block is present.

Given any page with breadcrumbs renders
When inspected
Then a BreadcrumbList JSON-LD block is present.

Given each of the above JSON-LD blocks
When tested in Google Rich Results Test
Then no errors are reported (warnings about non-required fields acceptable).
```

**Implementation**: Audit existing JSON-LD generators, fill gaps. Run Rich Results Test on 1 representative page per type before close.

---

### REQ-096-38: Lighthouse audit

**Acceptance Criteria**

```
Given Lighthouse runs against /{locale}/, /{locale}/alojamientos/, /{locale}/alojamientos/[slug]/, /{locale}/mi-cuenta/, /{locale}/contacto/
When the audit completes
Then each of the 4 categories (Performance, SEO, Accessibility, BestPractices) scores >= 80.

Given an audit fails to reach 80 in any category
When investigated
Then the gap is documented and either fixed or accepted with rationale before merge.
```

**Implementation**: Manual Lighthouse run (or Lighthouse CI integration) on staging before merging the final PR.

---

## Phase 11: E2E Tests Specification

### REQ-096-39: E2E tests listed for SPEC-092

**Acceptance Criteria**

```
Given this spec is closed
When SPEC-092 (host onboarding + E2E execution) is opened
Then SPEC-092 includes the following E2E tests as a new section "E2E from SPEC-096":

  E2E-1: Anonymous browse → search → results → entity detail → contact form
  E2E-2: Signup → onboarding → publish → mi-cuenta/propiedades visible
  E2E-3: Authenticated favorite toggle on accommodation → /mi-cuenta/favoritos shows it → remove → empty state
  E2E-4: Authenticated review submission → /mi-cuenta/resenas shows it → click entity → detail
  E2E-5: Profile edit on web → save → admin /me/profile reflects changes
  E2E-6: Profile edit on admin → save → web /mi-cuenta/editar reflects changes
  E2E-7: Theme toggle in web → admin themeAdmin unchanged
  E2E-8: Subscription cancel flow → status update → email sent
  E2E-9: 404 on broken link → 0 broken links exist (regression of audit)
  E2E-10: Filter sub-route → ISR cache hit on second visit
```

**Implementation**: SPEC-096 produces this list. Adding to SPEC-092's task tracker happens at SPEC-096 closure.

---

## Out of Scope

Explicitly NOT in this spec (deferred to v1.1 or beyond):

- **Interactive MapView** with Leaflet/MapLibre/Google Maps (T-022 from SPEC-075). Replaced here by `MapPlaceholder` pattern (REQ-096-27).
- **`/eventos/ubicacion/[slug]/` sub-route** (T-039 from SPEC-075). Geographic filtering already covered by `destinationId` filter from REQ-096-02; a dedicated location sub-route adds little for beta and can return in v1.1 if metrics show demand.
- **Lighthouse 90+** in any category. Beta target is 80+. Optimization with real data is a separate effort.
- **Favorites multi-entity** (destinos, eventos, posts). Beta supports accommodation favorites only.
- **Inline review editing/deletion** in `/mi-cuenta/resenas/`. Read-only in beta. Edit/delete via entity detail page.
- **Admin profile fields beyond shared schema** (e.g., professional bio for hosts, moderation flags for editors). Future role-specific UIs.
- **Server-defer islands** for ReviewListIsland. Use `client:visible` due to known Astro bug (#13583).
- **Full-text search** with PostgreSQL tsvector or Algolia/Meilisearch. Beta uses `safeIlike` only.
- **i18n routing reorganization** (e.g., `/en/blog/` vs `/en/publicaciones/`). Beta keeps current Spanish slugs across all locales.

---

## Critical Files Map

### `apps/web/src/`
| Path | Change |
|---|---|
| `layouts/Header.astro` | Rediseño con UserMenu + Publicar prominente |
| `layouts/Footer.astro` | Fix link + 5 columnas + Categorías |
| `components/UserMenu.client.tsx` | NEW — React island |
| `components/Breadcrumbs.astro` | NEW |
| `components/EmptyState.astro` | NEW |
| `components/ShareButtons.client.tsx` | NEW |
| `components/ErrorBanner.astro` | NEW |
| `components/ImageGallery.client.tsx` | EXTRACT from accommodation, generalize |
| `components/TagChips.astro` | NEW |
| `components/CategoryTiles.astro` | NEW |
| `components/MapPlaceholder.astro` | NEW |
| `components/ContactForm.client.tsx` | NEW |
| `components/account/ProfileEditForm.client.tsx` | NEW |
| `components/account/UserFavoritesList.client.tsx` | NEW |
| `components/account/UserReviewsList.client.tsx` | NEW |
| `components/account/PreferenceToggles.client.tsx` | NEW |
| `components/account/SubscriptionDashboard.client.tsx` | NEW |
| `pages/[lang]/index.astro` | Add CategoryTiles section |
| `pages/[lang]/busqueda/index.astro` | Implement results consuming T-017 |
| `pages/[lang]/contacto/index.astro` | ContactForm island |
| `pages/[lang]/publicaciones/autor/[slug]/index.astro` | Consume T-016 |
| `pages/[lang]/eventos/[slug].astro` | ShareButtons real, MapPlaceholder |
| `pages/[lang]/publicaciones/[slug].astro` | ShareButtons real |
| `pages/[lang]/destinos/[...path].astro` | Counts reales, MapPlaceholder |
| `pages/[lang]/mi-cuenta/editar/index.astro` | ProfileEditForm island |
| `pages/[lang]/mi-cuenta/favoritos/index.astro` | UserFavoritesList |
| `pages/[lang]/mi-cuenta/resenas/index.astro` | UserReviewsList |
| `pages/[lang]/mi-cuenta/suscripcion/index.astro` | SubscriptionDashboard |
| `pages/[lang]/mi-cuenta/preferencias/index.astro` | PreferenceToggles |
| `pages/sitemap-dynamic.xml.ts` | NEW |
| `astro.config.mjs` | Fix ISR exclude regex |

### `apps/api/src/routes/`
| Path | Change |
|---|---|
| `search/public/search.ts` | NEW (T-017) |
| `user/public/getBySlug.ts` | NEW (T-016) |
| `contact/public/submit.ts` | Verify or create |
| `event/admin/*.ts` | Add destinationId filter (T-015 follow-through) |

### `apps/admin/src/routes/`
| Path | Change |
|---|---|
| `_authed/me/profile.tsx` | Convert to editable form |
| `_authed/me/settings.tsx` | Adapt to 4-field schema (themeWeb/Admin, languageWeb/Admin) |

### `packages/`
| Path | Change |
|---|---|
| `db/src/models/accommodation/accommodation.model.ts` | Add JOIN for amenity/feature (T-014) |
| `db/src/schemas/event/event.schema.ts` | Add destinationId FK (T-015) |
| `db/src/migrations/manual/{ts}_event_destination_fk.sql` | NEW migration |
| `db/scripts/backfill-event-destinations.ts` | NEW backfill script |
| `schemas/src/user/preferences.ts` | Update to 4-field schema |
| `schemas/src/user/profile.ts` | NEW centralized profile edit schema |
| `schemas/src/contact/submit.ts` | NEW contact schema |
| `schemas/src/search/query.ts` | NEW search schema |
| `service-core/src/revalidation/entity-path-mapper.ts` | Fix slugs + add new paths |
| `i18n/locales/{es,en,pt}/web/*.json` | NEW strings for all new components/pages |

---

## Verification Plan

After implementation:

1. **Code quality**: `pnpm typecheck && pnpm lint && pnpm test` passes (unit + integration).
2. **Audit regression**: Re-run the audit Explore agent. Diff against pre-spec audit. Acceptable result: 0 broken links, 0 orphan pages, ≤ 3 NEEDS POLISH (only deferred items like map).
3. **Lighthouse**: Run on `/`, `/alojamientos/`, `/alojamientos/[slug]/`, `/mi-cuenta/`, `/contacto/`. All ≥ 80 in 4 categories.
4. **JSON-LD**: Google Rich Results Test on 1 page per detail type (alojamiento, evento, destino, post). 0 errors.
5. **i18n**: Run i18n-check CI. Manually navigate site in es/en/pt — no untranslated text.
6. **Mi-cuenta flow**: Manual signup → edit profile → add favorite → cancel favorite → check reviews list → change preferences → view subscription → click "Más opciones" if HOST → admin opens.
7. **Cross-app sync**: Edit profile in admin → web reflects changes after refresh. Edit profile in web → admin reflects changes after refresh.
8. **ISR cache**: Hit `/alojamientos/tipo/cabin/` twice. Second hit served from cache (verify via header or response time).
9. **Sitemap**: Fetch `/sitemap-dynamic.xml`. Inspect: contains entries for ≥ 10 accommodations, ≥ 5 destinations, all event/post slugs, in 3 locales.
10. **Revalidation**: Edit accommodation in admin → confirm related listings + filters revalidate within seconds.
11. **E2E delegation**: SPEC-092 task tracker updated with the 10 new E2E tests listed in REQ-096-39.

---

## Notes for implementation

- **Sequencing**: Phases 1-2 must complete first (backend + schema). Phase 3 (components) blocks Phases 4-6 (UI consumers). Phase 7 (cross-app) can run anytime after Phase 2. Phase 8 (infra) can run in parallel with UI work. Phase 9 i18n cleanup after all components stabilize. Phase 10-11 at end.
- **Anti-regression discipline**: Every shared component refactor (FilterSidebar, ImageGallery especially) MUST start with a screenshot snapshot of all current call sites. Visual diff threshold ≤ 1% before merge.
- **Schema migrations**: User settings 4-field migration MUST run before deploying web/admin code that depends on the new fields. Otherwise legacy reads break.
- **i18n discipline**: Every new component PR includes the corresponding i18n keys in all 3 locales. Don't accumulate translation debt.

---

## Appendix A — SPEC-075 Absorption Map

SPEC-075 (Web App Complete Page Structure) was archived on 2026-04-29 after a code-level audit confirmed a substantial part of its scope already shipped. Remaining work was absorbed into this spec. Below is the per-task mapping for traceability.

### A.1 Already implemented in code (no further work required)

These SPEC-075 tasks are verified complete by code audit; SPEC-096 does NOT recreate them:

| SPEC-075 Task | Verification |
|---|---|
| T-001 to T-008 (8 layouts) | All layout files present in `apps/web/src/layouts/` |
| T-009 (404/500 → ErrorLayout) | `pages/404.astro`, `pages/500.astro` use ErrorLayout |
| T-010 (homepage → DefaultLayout) | `pages/[lang]/index.astro` uses DefaultLayout |
| T-011 (auth pages → AuthLayout) | `pages/[lang]/auth/*.astro` use AuthLayout |
| T-012 (mi-cuenta → AccountLayout) | `pages/[lang]/mi-cuenta/index.astro` uses AccountLayout |
| T-019 (FilterSidebar component) | `components/FilterSidebar.client.tsx` consolidated |
| T-025 (ListingPageHeader) | `components/ListingPageHeader.astro` exists |
| T-026 (alojamientos listing) | `pages/[lang]/alojamientos/index.astro` |
| T-028 (alojamientos/tipo) | `pages/[lang]/alojamientos/tipo/[type]/index.astro` |
| T-029 (alojamientos/comodidades) | Page exists; backend JOIN gap → REQ-096-01 |
| T-030 (alojamientos/caracteristicas) | Page exists |
| T-031 (destinos listing) | `pages/[lang]/destinos/index.astro` |
| T-032 (destino detail catch-all) | Page exists |
| T-033 (destinos/{slug}/alojamientos) | Page exists |
| T-034 (destinos/{slug}/eventos) | Page exists; FK gap → REQ-096-02 |
| T-035 (destinos/atraccion/[slug]) | Page exists |
| T-036 (eventos listing) | Page exists |
| T-037 (event detail) | Page exists; share/map polish → REQ-096-26, 27 |
| T-038 (eventos/categoria) | Page exists |
| T-040 (publicaciones listing) | Page exists |
| T-041 (post detail) | Page exists; share polish → REQ-096-26 |
| T-042 (publicaciones/categoria) | Page exists |
| T-043 (publicaciones/etiqueta) | Page exists |
| T-047 (nosotros) | Page exists; JSON-LD → REQ-096-40 |
| T-048 (legal/privacidad) | Page exists; JSON-LD → REQ-096-42 |
| T-049 (legal/terminos) | Page exists; JSON-LD → REQ-096-42 |
| T-050 (feedback) | Page exists |
| T-056 (propietarios) | Page exists |
| T-057 (beneficios) | Page exists; JSON-LD → REQ-096-40 |
| T-058 (turistas) | Page exists; JSON-LD + EmptyState → REQ-096-41, 43 |
| T-059 (planes) | Page exists; JSON-LD + EmptyState → REQ-096-41, 43 |

### A.2 Mapped 1:1 to SPEC-096 REQs (work pending)

| SPEC-075 Task | SPEC-096 REQ |
|---|---|
| T-013 (ISR regex) | REQ-096-33 |
| T-014 (amenity/feature JOIN) | REQ-096-01 |
| T-015 (events destinationId FK) | REQ-096-02 |
| T-016 (user-by-slug endpoint) | REQ-096-03 |
| T-017 (search endpoint) | REQ-096-04 |
| T-018 (Breadcrumbs) | REQ-096-08 + REQ-096-19 |
| T-020 (EmptyState) | REQ-096-09 |
| T-021 (ImageGallery) | REQ-096-13 |
| T-023 (ReviewListIsland) | REQ-096-22 (UserReviewsList covers it) |
| T-024 (ErrorBanner) | REQ-096-12 |
| T-027 (accommodation detail polish) | REQ-096-10 (ShareButtons), REQ-096-19 (Breadcrumbs) |
| T-044 (publicaciones/autor placeholder) | REQ-096-28 |
| T-045 (búsqueda placeholder) | REQ-096-29 |
| T-046 (contacto) | REQ-096-30 |
| T-051 (mi-cuenta editar) | REQ-096-20 |
| T-052 (mi-cuenta favoritos) | REQ-096-21 |
| T-053 (mi-cuenta resenas) | REQ-096-22 |
| T-054 (mi-cuenta suscripcion) | REQ-096-24 |
| T-055 (mi-cuenta preferencias) | REQ-096-23 |
| T-060 to T-063 (pagination rewrites) | Phase 8 infra |
| T-064 (entity path mapper) | REQ-096-35 |
| T-065 (header/footer) | REQ-096-14 to 19 |
| T-066 (dynamic sitemap) | REQ-096-34 |

### A.3 Out of scope (documented above)

- T-022 (interactive MapView) → replaced by MapPlaceholder (REQ-096-27).
- T-039 (eventos/ubicacion sub-route) → covered by `destinationId` filter from REQ-096-02.
