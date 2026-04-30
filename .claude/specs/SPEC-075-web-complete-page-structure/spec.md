# SPEC-075: Web App Complete Page Structure

> **Status**: ARCHIVED — Merged into SPEC-096 on 2026-04-29
> **Priority**: P0 (critical)
> **Complexity**: XXL
> **Origin**: Web app completion — migrate all pages from web-old architecture to new web app
> **Affected packages**: apps/web, packages/service-core (entity-path-mapper)
> **Created**: 2026-04-09
> **Archived**: 2026-04-29
> **Estimated effort**: ~70 tasks across 5 phases (closed at 8 verified-completed + ~22 verified-in-code; remaining work absorbed by SPEC-096)
>
> **NOTICE**: This spec has been ARCHIVED. After a code-level audit on 2026-04-29, the work was split as follows:
> - 8 layouts (T-001 to T-008): VERIFIED COMPLETE in code.
> - 4 page migrations (T-009 to T-012): VERIFIED COMPLETE in code (audit confirmed 404/500/homepage/auth/mi-cuenta use the correct layouts).
> - ~22 sub-routes and marketing/legal pages: VERIFIED PRESENT in code (some need only polish or backend follow-through, tracked in SPEC-096).
> - Backend prerequisites, account islands, infrastructure (sitemap/ISR/path-mapper), and cross-app coordination: ABSORBED into SPEC-096 with 1:1 REQ mapping.
> - 2 items deferred to v1.1: T-022 (interactive MapView, replaced by MapPlaceholder), T-039 (`/eventos/ubicacion/[slug]/`, covered by `destinationId` filter).
>
> See `MERGE_NOTE.md` in this directory and **SPEC-096 Appendix A** for the full mapping. Do not start new work from this spec — use SPEC-096.

---

## Overview

The Hospeda web app (`apps/web`) currently has 10 page files: a root redirect (`index.astro`), the locale-prefixed homepage (`[lang]/index.astro`), 5 auth pages, the mi-cuenta dashboard, and the 404/500 error pages. The only full-page layout is `BaseLayout.astro`; `Header.astro` and `Footer.astro` exist as shared layout components in `src/layouts/`. The legacy app (`apps/web-old`) contained 48 page files covering 37 unique page types for accommodations, destinations, events, blog posts, search, legal, marketing, and user account sub-sections. All required API endpoints already exist in `apps/api` (one prerequisite fix needed: amenity/feature filtering at the model level — see REQ-075-13). Most i18n namespaces are defined in `packages/i18n`, though marketing pricing and feedback namespaces must be created during implementation. This spec defines every page that must be created, its URL, layout, rendering strategy, and the shared infrastructure changes needed to complete the public-facing web app.

This is a launch-blocking gap. Until all content pages exist, the platform has no functional public surface. The work is organized into 5 phases: a layout system foundation followed by core content, search/info, account sub-pages, and marketing/pricing.

---

## Goals

- Complete all public-facing pages needed for launch across the 4 main content domains (alojamientos, destinos, eventos, publicaciones).
- Establish a reusable layout system (8 specialized sub-layouts) for visual consistency and long-term maintainability.
- Optimize the rendering strategy for each page (ISR/SSG/SSR) leveraging the existing on-demand revalidation system.
- Deliver SEO-ready pages with JSON-LD structured data on all content pages.
- Support full i18n across es, en, and pt on every page using `createTranslations(locale)` from `apps/web/src/lib/i18n.ts` (which wraps `@repo/i18n` internally).
- Fix the ISR exclude-regex bug that currently prevents filter sub-routes from being ISR-cached.
- Extend the entity path mapper in `packages/service-core` to cover all new URL patterns.

### Success Metrics

- All 41+ pages render correctly in all 3 locales (es, en, pt) without errors.
- Lighthouse Performance score >= 90 on listing and detail pages.
- Lighthouse SEO score >= 95 on all public pages.
- ISR working with on-demand revalidation for all content pages.
- `pnpm typecheck && pnpm lint` pass with no new errors.
- View Transitions work correctly on all pagination navigation.
- JSON-LD structured data validates without errors in Google's Rich Results Test for accommodation, event, post, and destination detail pages.

---

## Phase 0: Layout System

All new pages depend on the layout system. This phase must be completed before any Phase 1-4 work begins.

The layout hierarchy is: `BaseLayout` (already exists at `src/layouts/BaseLayout.astro`, provides HTML shell, fonts, View Transitions scripts) wraps all sub-layouts. `Header.astro` and `Footer.astro` also exist in `src/layouts/` as shared components used by layouts. Sub-layouts import `BaseLayout` and compose the page shell, typically including Header and Footer.

### REQ-075-01: Create ErrorLayout

**Problem**: The 404 and 500 pages currently use `BaseLayout` directly with ad-hoc structure. A dedicated error layout ensures crash-resistant rendering with no heavy scripts or complex component trees.

**User Stories**

> As a visitor who lands on an error page,
> I want a minimal, functional page that does not itself throw errors,
> so that I always see a comprehensible message regardless of what went wrong.

**Acceptance Criteria**

```
Given I visit a URL that resolves to a 404 or 500 page,
When the page renders,
Then I see a simplified header (logo + home link, no nav dropdowns), centered error content, and a minimal footer.

Given the error page is rendered,
When I inspect the page source,
Then no heavy client-side JS bundles (search islands, map components, etc.) are loaded.

Given the 404 and 500 pages both import ErrorLayout,
When I view either page in any of the 3 supported locales,
Then the layout renders correctly with locale-aware text.
```

**Implementation notes**: `src/layouts/ErrorLayout.astro`. No props required beyond BaseLayout's standard SEO props. The 404 and 500 pages already exist and must be migrated to use this layout.

---

### REQ-075-02: Create DefaultLayout

**Problem**: Pages like the homepage and destinations listing do not need a filter sidebar or breadcrumbs but do need header and footer with a clean slot for full-width section content.

**User Stories**

> As a developer adding a new informational page,
> I want a DefaultLayout that handles header and footer automatically,
> so that I only need to provide the page body content.

**Acceptance Criteria**

```
Given a page uses DefaultLayout,
When it renders,
Then the page contains a consistent header, a direct content slot, and a footer with no additional structural elements.

Given DefaultLayout is used on the homepage and destinations listing,
When I compare the header and footer across pages,
Then they are visually identical.
```

**Implementation notes**: `src/layouts/DefaultLayout.astro`. Accepts standard SEO props forwarded to BaseLayout. Used by: homepage, destinos listing, search, contact, about, catch-all pages.

---

### REQ-075-03: Create ListingLayout

**Problem**: Accommodation, event, and post listing pages share a common structure: a header, an optional collapsible filter sidebar, a content grid, a pagination slot, and a footer.

**User Stories**

> As a visitor browsing accommodations,
> I want to see a filter panel alongside the listings,
> so that I can narrow results without leaving the page.

> As a visitor on a mobile device,
> I want the filter panel to be collapsible,
> so that it does not obscure the listing grid.

**Acceptance Criteria**

```
Given a listing page uses ListingLayout with showFilters=true,
When the page renders on a desktop viewport,
Then a filter panel is visible to the left of or above the content grid, based on filterPosition prop.

Given the same page is viewed on a mobile viewport,
When the user has not expanded the filter panel,
Then the filter panel is collapsed and a toggle button is visible.

Given a listing page uses ListingLayout with showFilters=false,
When the page renders,
Then no filter panel or filter toggle button is present.

Given a listing page includes pagination,
When I inspect the layout,
Then a pagination slot is rendered below the content grid.
```

**Implementation notes**: `src/layouts/ListingLayout.astro`. Props: `showFilters?: boolean` (default false), `filterPosition?: 'left' | 'top'` (default 'left'). The filter panel slot is named `filters`. The pagination slot is named `pagination`.

---

### REQ-075-04: Create DetailLayout

**Problem**: Accommodation, destination, event, and post detail pages share a two-column structure: main content area on the left and a contextual sidebar (pricing, related items, stats) on the right, with an optional breadcrumb trail above.

**User Stories**

> As a visitor viewing an accommodation detail page,
> I want a consistent page structure with breadcrumbs showing my navigation path,
> so that I know where I am and can navigate back easily.

> As a visitor on a mobile device viewing a detail page,
> I want the sidebar to stack below the main content,
> so that the primary content is not hidden.

**Acceptance Criteria**

```
Given a detail page uses DetailLayout with showBreadcrumbs=true,
When the page renders,
Then a breadcrumb trail is rendered above the main content area.

Given a detail page uses DetailLayout with showSidebar=true,
When viewed on a desktop viewport,
Then the main content and sidebar are displayed in a two-column layout.

Given the same page is viewed on a mobile viewport,
When the page renders,
Then the sidebar stacks below the main content in a single column.

Given a detail page uses DetailLayout with showSidebar=false,
When the page renders,
Then the main content occupies the full page width and no sidebar is present.
```

**Implementation notes**: `src/layouts/DetailLayout.astro`. Props: `showBreadcrumbs?: boolean` (default true), `showSidebar?: boolean` (default true). Slots: `breadcrumbs`, `default` (main content), `sidebar`.

---

### REQ-075-05: Create AccountLayout

**Problem**: The mi-cuenta dashboard and all account sub-pages share a two-panel layout: a persistent sidebar navigation on the left and a content area on the right. Access is gated by the auth middleware.

**User Stories**

> As a logged-in user visiting my account section,
> I want a persistent sidebar showing all account pages,
> so that I can switch between profile, favorites, reviews, subscription, and preferences without losing context.

> As a non-authenticated visitor trying to access an account URL,
> I want to be redirected to the login page,
> so that private data is protected.

**Acceptance Criteria**

```
Given I am authenticated and visit any /mi-cuenta/* page,
When the page renders,
Then I see an account sidebar with links to: Mi cuenta, Editar perfil, Favoritos, Mis reseñas, Suscripción, Preferencias.

Given I am on the /mi-cuenta/favoritos/ page,
When I look at the sidebar,
Then the "Favoritos" link is visually marked as active.

Given I am not authenticated and navigate to any /mi-cuenta/* URL,
When the middleware processes the request,
Then I am redirected to the login page with a returnUrl query parameter set (e.g., /es/auth/signin?returnUrl=%2Fes%2Fmi-cuenta%2Ffavoritos%2F).

Given I am authenticated,
When I use AccountLayout on a mobile viewport,
Then the sidebar collapses and is accessible via a menu toggle.
```

**Implementation notes**: `src/layouts/AccountLayout.astro`. Props: `activeSection?: string`. The layout itself does not perform auth; the existing middleware handles that. Sidebar links are i18n-aware.

---

### REQ-075-06: Create MarketingLayout

**Problem**: Marketing pages (propietarios, beneficios, precios) require full-width sections without the max-width constraint applied to content pages. They share header and footer but need an unconstrained content area.

**User Stories**

> As a potential property owner visiting the propietarios page,
> I want full-width visual sections that showcase the platform's value,
> so that the page feels like a purposeful landing page, not a content article.

**Acceptance Criteria**

```
Given a page uses MarketingLayout,
When the page renders,
Then the content slot has no max-width constraint and spans the full viewport width.

Given MarketingLayout renders,
When I inspect the header and footer,
Then they are the same as on DefaultLayout pages.
```

**Implementation notes**: `src/layouts/MarketingLayout.astro`. No additional props beyond BaseLayout SEO props.

---

### REQ-075-07: Create LegalLayout

**Problem**: Privacy policy and terms pages need a narrow prose container optimized for reading, a table of contents sidebar, and a "last updated" date display.

**User Stories**

> As a visitor reading the privacy policy,
> I want a readable prose layout with a table of contents,
> so that I can navigate to the section I care about without scrolling the entire document.

**Acceptance Criteria**

```
Given a page uses LegalLayout with showToc=true,
When the page renders on a desktop viewport,
Then a table of contents sidebar is visible alongside the prose content.

Given lastUpdated is provided to LegalLayout,
When the page renders,
Then a "Last updated: {date}" string is displayed at the top of the content area.

Given the page is viewed on a mobile viewport,
When it renders,
Then the table of contents moves to above the prose content, not alongside it.
```

**Implementation notes**: `src/layouts/LegalLayout.astro`. Props: `lastUpdated?: string`, `showToc?: boolean` (default true). Narrow prose max-width (~65ch).

---

### REQ-075-08: Create AuthLayout

**Problem**: The 5 existing auth pages use ad-hoc structure. A dedicated AuthLayout provides a centered card with a minimal header and no footer, consistent with auth UI best practices.

**User Stories**

> As a visitor on the login page,
> I want a focused, uncluttered layout with the form centered on the page,
> so that there are no distractions from completing the authentication action.

**Acceptance Criteria**

```
Given a page uses AuthLayout,
When the page renders,
Then the page shows a minimal header (logo only, no full nav) and a centered card containing the page content.

Given AuthLayout renders,
When I scroll to the bottom of the page,
Then there is no site footer.
```

**Implementation notes**: `src/layouts/AuthLayout.astro`. Existing auth pages (login, register, forgot-password, reset-password, verify-email) must be migrated to this layout from whatever they currently use.

---

### REQ-075-09: Migrate existing pages to new layouts

**Problem**: Existing pages were built before the layout system existed and use inconsistent structures. They must be updated to use the appropriate new layout.

**Acceptance Criteria**

```
Given the 404 page exists,
When it is migrated to ErrorLayout,
Then its visual output is identical to the pre-migration output.

Given the 500 page exists,
When it is migrated to ErrorLayout,
Then its visual output is identical to the pre-migration output.

Given the homepage exists,
When it is migrated to DefaultLayout,
Then its visual output is identical to the pre-migration output.

Given all 5 auth pages exist,
When each is migrated to AuthLayout,
Then their visual output is identical to the pre-migration output.

Given the mi-cuenta dashboard exists,
When it is migrated to AccountLayout,
Then its visual output is identical to the pre-migration output.
```

**Pages to migrate**:
- `src/pages/404.astro` → ErrorLayout
- `src/pages/500.astro` → ErrorLayout
- `src/pages/[lang]/index.astro` → DefaultLayout
- `src/pages/[lang]/auth/signin.astro` → AuthLayout
- `src/pages/[lang]/auth/signup.astro` → AuthLayout
- `src/pages/[lang]/auth/forgot-password.astro` → AuthLayout
- `src/pages/[lang]/auth/reset-password.astro` → AuthLayout
- `src/pages/[lang]/auth/verify-email.astro` → AuthLayout
- `src/pages/[lang]/mi-cuenta/index.astro` → AccountLayout

---

## Phase 1: Core Content Pages

### 1.1 Alojamientos (Accommodations)

#### REQ-075-10: Accommodations listing page

**User Stories**

> As a visitor to the platform,
> I want to browse all available accommodations in a paginated list,
> so that I can find a place to stay.

> As a visitor with specific requirements,
> I want to filter accommodations by type, price, guests, amenities, and other attributes,
> so that I only see options relevant to my trip.

**Acceptance Criteria**

```
Given I navigate to /{lang}/alojamientos/,
When the page renders,
Then I see a paginated grid of accommodation cards fetched from GET /api/v1/public/accommodations.

Given I apply a filter (e.g., type=cabin),
When the filter is submitted,
Then the URL updates with the filter as a query param and the grid shows only matching accommodations.

Given the listing page has more than one page of results,
When I click to page 2,
Then I navigate to /{lang}/alojamientos/page/2/ and see the next set of results.

Given I navigate to /{lang}/alojamientos/page/1/,
When the page loads,
Then I am redirected to /{lang}/alojamientos/ (canonical, no page param for first page).

Given there are no accommodations matching the current filters,
When the grid renders,
Then I see an empty state with a message and a "clear filters" link.

Given the page is indexed by a search engine,
When it reads the page,
Then the page includes an ItemList JSON-LD block with ListItem elements wrapping each accommodation card (LodgingBusiness is for single entities, not listings).
```

**Details**:
- URL: `/{lang}/alojamientos/`
- Layout: ListingLayout (showFilters=true, filterPosition='left')
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/accommodations`
- Pagination file: `src/pages/[lang]/alojamientos/page/[page].astro` (rewrites to parent with ?page=N)
- Supported filter query params: `q`, `type`, `types` (array, multiple types), `destinationId`, `minPrice`, `maxPrice`, `currency`, `minGuests`, `maxGuests`, `minBedrooms`, `maxBedrooms`, `minBathrooms`, `maxBathrooms`, `minRating`, `maxRating`, `isFeatured`, `isAvailable`, `hasPool`, `hasWifi`, `allowsPets`, `hasParking`, `amenities` (array of UUIDs), `features` (array of UUIDs), `sortBy`, `sortOrder`
- **IMPORTANT**: While `hasPool`, `hasWifi`, `allowsPets`, `hasParking`, `amenities`, and `features` all exist in `AccommodationSearchHttpSchema`, **`amenities` and `features` are NOT actually implemented** at the handler/model level. The model explicitly ignores them (comment in code: "Filtering by amenities would require a join and is more complex"). Boolean filters (`hasPool` etc.) work as direct column matches. See REQ-075-13 prerequisite for amenity/feature filtering implementation.
- Additional schema-supported params (not exposed in UI filters but available in the public endpoint): `checkIn`, `checkOut`, `availableFrom`, `availableTo`. Note: `name`, `description`, `address`, `country`, `city`, `latitude`, `longitude`, `radius`, `ownerId` exist in `AccommodationSearchHttpSchema` but are NOT exposed by the public API endpoint and are not relevant for the web app (text search uses `q`, location filtering uses `destinationId`, owner filtering is admin-only).
- Valid type values (UPPERCASE in enum, case handling at API level): `APARTMENT`, `HOUSE`, `COUNTRY_HOUSE`, `CABIN`, `HOTEL`, `HOSTEL`, `CAMPING`, `ROOM`, `MOTEL`, `RESORT` (from AccommodationTypeEnum). URL slugs use lowercase equivalents: `apartment`, `house`, `country-house`, `cabin`, `hotel`, `hostel`, `camping`, `room`, `motel`, `resort`.

---

#### REQ-075-11: Accommodation detail page

**User Stories**

> As a visitor who has selected an accommodation,
> I want a full detail page with photos, description, amenities, pricing, map, and reviews,
> so that I can decide whether to book it.

> As a visitor on the detail page,
> I want to see related accommodations at the bottom,
> so that I have alternatives if this one does not fit.

**Acceptance Criteria**

```
Given I navigate to /{lang}/alojamientos/{slug}/,
When the page renders,
Then I see all detail sections: image gallery, type badge, rating, location, description, amenities, features, pricing sidebar, map, reviews, FAQ, share/favourite buttons, and 3 related cards.

Given the slug does not match any accommodation in the database,
When the server processes the request,
Then the middleware rewrites to /404 and I see the 404 error page.

Given the page is rendered,
When I inspect the page source,
Then a JSON-LD block using the most specific Schema.org subtype is present, mapped as follows: HOTEL→Hotel, HOSTEL→Hostel, MOTEL→Motel, RESORT→Resort, CAMPING→Campground, all others (APARTMENT, HOUSE, COUNTRY_HOUSE, CABIN, ROOM)→LodgingBusiness (generic). Schema.org also defines BedAndBreakfast and VacationRental subtypes but these have no AccommodationTypeEnum equivalent. Required fields: name, address. Recommended fields: image, priceRange, aggregateRating, geo (lat/lng), telephone, url, checkinTime, checkoutTime.

Given the reviews section is below the fold,
When the page first loads,
Then the ReviewListIsland is loaded via server:defer (deferred server island). Note: server:defer only works on Astro components (.astro), so ReviewListIsland must be an Astro wrapper that internally renders a React island. The wrapper pattern is: ReviewListIsland.astro uses server:defer and contains <ReviewList client:load /> inside. Additional server:defer constraints: (1) props must be serializable (no functions, no circular refs), (2) if encrypted props exceed ~2048 bytes in URL, Astro falls back to POST which breaks browser caching.. keep props minimal, (3) inside a server island `Astro.url` returns `/_server-islands/ComponentName` not the page URL.. use Referer header instead, (4) for rolling deployments, set `ASTRO_KEY` env var for stable encryption, (5) **KNOWN BUG** (GitHub withastro/astro#13583): server:defer islands can get stuck showing skeleton/fallback on revisit when View Transitions are active. If this bug is not fixed by implementation time, use `client:visible` instead of `server:defer` for ReviewListIsland as a fallback strategy.

Given the user has previously favourited this accommodation,
When the detail page loads,
Then the favourite button shows the active/filled state.
```

**Details**:
- URL: `/{lang}/alojamientos/[slug]/`
- Layout: DetailLayout (showBreadcrumbs=true, showSidebar=true)
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/accommodations/slug/:slug`
- Sidebar content: pricing, availability CTA, host info
- Main content sections: image gallery with lightbox, type badge, star rating, location, TipTap rich-text description, amenities grid, features list, interactive MapView, ReviewListIsland (server:defer), FAQ accordion, share and favourite buttons, 3 related accommodation cards

---

#### REQ-075-12: Accommodations by type sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/alojamientos/tipo/{type}/,
When the page renders,
Then I see only accommodations of that type, fetched via GET /api/v1/public/accommodations?type={type}.

Given the type value in the URL is not in the valid type list,
When the page processes the request,
Then I am shown the 404 page.

Given the by-type page has multiple pages of results,
When I navigate to page 2,
Then I go to /{lang}/alojamientos/tipo/{type}/page/2/.
```

**Details**:
- URL: `/{lang}/alojamientos/tipo/[type]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/alojamientos/tipo/[type]/page/[page].astro`

---

#### REQ-075-13: Accommodations by amenity sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/alojamientos/comodidades/{slug}/,
When the page renders,
Then I see accommodations that include the amenity identified by that slug, fetched via GET /api/v1/public/accommodations?amenities={id}.

Given the amenity slug does not resolve to a known amenity,
When the page processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/alojamientos/comodidades/[slug]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/alojamientos/comodidades/[slug]/page/[page].astro`
- **PREREQUISITE (BLOCKING)**: The accommodations list handler accepts `amenities` and `features` array params in the HTTP schema, but **the model layer silently ignores them**. The model (`packages/db/src/models/accommodation/accommodation.model.ts`) has an explicit comment: "Filtering by amenities would require a join and is more complex." Implementation requires: (1) JOIN on `r_accommodation_amenity` table, (2) WHERE clause filtering by amenity IDs, (3) same for features via `r_accommodation_feature`. This affects both REQ-075-13 (by amenity) and REQ-075-14 (by feature). The schema, HTTP-to-domain conversion, and service layers all pass the params through correctly.. only the model `search()` and `searchWithRelations()` methods need the JOIN logic added.
- **Amenity slug resolution**: No `GET /api/v1/public/amenities/by-slug/{slug}` endpoint exists. The available endpoints are `GET /api/v1/public/amenities/` (list all) and `GET /api/v1/public/amenities/{id}` (by UUID). Resolution approach: fetch the full amenity list (finite set, typically <100 items — cacheable), find the entry matching the URL slug, extract its `id`, then pass that `id` to the accommodations query. If no amenity matches the slug, render 404.

---

#### REQ-075-14: Accommodations by feature sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/alojamientos/caracteristicas/{slug}/,
When the page renders,
Then I see accommodations linked to the feature identified by that slug, fetched via GET /api/v1/public/features/{featureId}/accommodations.

Given the feature slug does not resolve to a known feature,
When the page processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/alojamientos/caracteristicas/[slug]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/alojamientos/caracteristicas/[slug]/page/[page].astro`
- **NOT BLOCKED**: Unlike REQ-075-13, this page uses the dedicated endpoint `GET /api/v1/public/features/{featureId}/accommodations` (file: `apps/api/src/routes/feature/public/getAccommodationsByFeature.ts`) which performs its own JOIN and does not depend on the generic `features` param in `AccommodationSearchHttpSchema`. The prerequisite in REQ-075-13 does NOT apply here.
- **Feature slug resolution**: No `GET /api/v1/public/features/by-slug/{slug}` endpoint exists. The available endpoints are `GET /api/v1/public/features/` (list all), `GET /api/v1/public/features/{id}` (by UUID), and `GET /api/v1/public/features/search` (advanced search). Resolution approach: fetch the full feature list (finite set, cacheable), find the entry matching the URL slug, extract its `id`, then use that `id` in the dedicated accommodations-by-feature endpoint. If no feature matches the slug, render 404.

---

### 1.2 Destinos (Destinations)

#### REQ-075-15: Destinations listing page

**User Stories**

> As a visitor exploring the region,
> I want to see all available destinations organized by their geographic hierarchy,
> so that I can discover places at different levels (country, province, city, area).

**Acceptance Criteria**

```
Given I navigate to /{lang}/destinos/,
When the page renders,
Then I see a grid of destination cards, using DefaultLayout (not ListingLayout) because destination hierarchy serves as the primary filter mechanism.

Given the listing page renders,
When I inspect the page source,
Then no filter sidebar is present.

Given there are more than one page of destinations,
When I navigate to page 2,
Then I go to /{lang}/destinos/page/2/.
```

**Details**:
- URL: `/{lang}/destinos/`
- Layout: DefaultLayout (destinations use their hierarchy as the filter — no sidebar)
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/destinations`
- Pagination file: `src/pages/[lang]/destinos/page/[page].astro`

---

#### REQ-075-16: Destination detail page (hierarchical catch-all)

**User Stories**

> As a visitor who clicked on a destination,
> I want a rich detail page showing climate, attractions, accommodations, events, and a map,
> so that I can learn about the place before deciding to visit.

**Acceptance Criteria**

```
Given I navigate to /{lang}/destinos/entre-rios/,
When the page renders,
Then I see the destination detail for "Entre Ríos" fetched via GET /api/v1/public/destinations/by-path?path=/entre-rios (note: path requires leading slash, regex: `/^\/[a-z0-9-/]+$/`, max 500 chars).

Given I navigate to /{lang}/destinos/entre-rios/colon/,
When the page renders,
Then I see the destination detail for the city "Colón" within "Entre Ríos", fetched via GET /api/v1/public/destinations/by-path?path=/entre-rios/colon.

Given the path does not resolve to any destination,
When the server processes the request,
Then I am shown the 404 page.

Given the destination detail page renders,
When I inspect the page source,
Then a TouristDestination JSON-LD block is present (more specific than Place, adds touristType and includesAttraction properties). Note: neither Place nor TouristDestination triggers Google Rich Results, but improves Knowledge Graph understanding and AI visibility.

Given the destination has linked accommodations,
When the page renders,
Then a preview of 3 accommodations is visible with a "View all" link to /{lang}/destinos/{slug}/alojamientos/.
```

**Details**:
- URL: `/{lang}/destinos/[...path]/` (catch-all, handles hierarchical segments)
- Layout: DetailLayout (showBreadcrumbs=true, showSidebar=true)
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/destinations/by-path?path=/{path}` (path requires leading slash)
- Sidebar: counts (accommodations, events, attractions)
- Main content: hero image, TipTap description, image gallery, climate grid, "how to get there", attractions list, interactive MapView, favourite/share buttons, accommodation preview (3), event preview (3)

---

#### REQ-075-17: Accommodations within a destination

**Acceptance Criteria**

```
Given I navigate to /{lang}/destinos/{slug}/alojamientos/,
When the page renders,
Then I see all accommodations in that destination, fetched via GET /api/v1/public/accommodations/destination/:destinationId (note: path param is `destinationId`, not `destId`; response is hardcoded to page=1, pageSize=20 — pagination must be handled client-side or the endpoint extended).

Given there are multiple pages,
When I navigate to page 2,
Then I go to /{lang}/destinos/{slug}/alojamientos/page/2/.
```

**Details**:
- URL: `/{lang}/destinos/[slug]/alojamientos/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/destinos/[slug]/alojamientos/page/[page].astro`

---

#### REQ-075-18: Events within a destination

**Acceptance Criteria**

```
Given I navigate to /{lang}/destinos/{slug}/eventos/,
When the page renders,
Then I see all events associated with that destination, fetched via GET /api/v1/public/events?destinationId={id} (destination slug resolved to ID server-side).

Given there are multiple pages,
When I navigate to page 2,
Then I go to /{lang}/destinos/{slug}/eventos/page/2/.
```

**Details**:
- URL: `/{lang}/destinos/[slug]/eventos/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/destinos/[slug]/eventos/page/[page].astro`
- **PREREQUISITE (BLOCKING)**: Events currently do NOT have a relationship with the destinations table. `EventLocation` is a separate entity with its own `city` text field and `slug`. To support this page, a `destinationId` FK must be added to the events table:
  1. **DB migration**: Add `destinationId` (UUID, nullable, FK → destinations) column to events table
  2. **Backfill**: Populate by matching `eventLocation.city` → `destination.name` for existing events
  3. **Schema update**: Add `destinationId` to `EventSearchHttpSchema` and `EventSearchSchema`
  4. **Handler update**: Process `destinationId` filter in the events list handler
  5. **Model update**: Add WHERE clause for `destinationId` in event model's search methods
  This prerequisite is shared with the entity path mapper update (REQ-075-45) which needs to revalidate destination event sub-routes.

---

#### REQ-075-19: Destinations by attraction

**Acceptance Criteria**

```
Given I navigate to /{lang}/destinos/atraccion/{slug}/,
When the page renders,
Then I see the attraction detail fetched via GET /api/v1/public/attractions/slug/:slug, plus the parent destination data.

Given the attraction slug does not resolve to a known attraction,
When the server processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/destinos/atraccion/[slug]/`
- Layout: DetailLayout (showBreadcrumbs=true, showSidebar=true)
- Rendering: SSR + ISR 24h

---

### 1.3 Eventos (Events)

#### REQ-075-20: Events listing page

**User Stories**

> As a visitor planning a trip,
> I want to browse upcoming events with filters for category, price, and date,
> so that I can find activities that match my interests and travel window.

**Acceptance Criteria**

```
Given I navigate to /{lang}/eventos/,
When the page renders,
Then I see a paginated grid of events, defaulting to upcoming events sorted by start date.

Given I select the "Gastronomía" category filter,
When the filter is applied,
Then the grid shows only events with category=gastronomy.

Given I toggle to the "Past events" tab,
When the view updates,
Then the grid shows events with a start date before today, sorted by most recent.

Given there are no events matching the current filters,
When the grid renders,
Then I see an empty state message with a "View all events" link.
```

**Details**:
- URL: `/{lang}/eventos/`
- Layout: ListingLayout (showFilters=true, filterPosition='top')
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/events`
- Pagination file: `src/pages/[lang]/eventos/page/[page].astro`
- Filters: timeframe tabs (upcoming/past/all), `category`, `isFree`, `minPrice`, `maxPrice`, `city`, `locationId`, `organizerId`, `startDateAfter`, `startDateBefore`, `q`, `sortBy`, `sortOrder`
- Valid categories (UPPERCASE in `EventCategoryEnum`, case handling at API level): `MUSIC`, `CULTURE`, `SPORTS`, `GASTRONOMY`, `FESTIVAL`, `NATURE`, `THEATER`, `WORKSHOP`, `OTHER`. URL slugs use lowercase equivalents: `music`, `culture`, `sports`, `gastronomy`, `festival`, `nature`, `theater`, `workshop`, `other`.

---

#### REQ-075-21: Event detail page

**User Stories**

> As a visitor who clicked on an event,
> I want to see date, time, location, description, agenda, tickets, and organizer info,
> so that I can decide whether to attend.

**Acceptance Criteria**

```
Given I navigate to /{lang}/eventos/{slug}/,
When the page renders,
Then I see: category badge, past-event indicator (if applicable), date/time/location metadata, hero image, description, agenda timeline, pricing/tickets sidebar, organizer info, location with map, share buttons, and 3 related upcoming events.

Given the event's start date is in the past,
When the page renders,
Then a "Past event" badge is prominently displayed.

Given the page renders,
When I inspect the page source,
Then an Event JSON-LD block is present with required fields: name, startDate, location (with nested address); and recommended fields: endDate, organizer (with name and url), offers (with price, priceCurrency, availability, validFrom, url), image (multiple aspect ratios: 1x1, 4x3, 16x9), description, eventStatus (EventScheduled/EventCancelled/EventPostponed/EventRescheduled), performer, previousStartDate (for rescheduled events).

Given the slug does not resolve to a known event,
When the server processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/eventos/[slug]/`
- Layout: DetailLayout (showBreadcrumbs=true, showSidebar=true)
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/events/slug/:slug`
- Sidebar: pricing/tickets, organizer info
- Structured data: EventJsonLd
- **EventStatus mapping**: No `EventStatus` enum exists in the codebase. Schema.org defines 4 valid values: `EventScheduled`, `EventCancelled`, `EventPostponed`, `EventRescheduled`. The `eventStatus` must be derived from existing boolean flags and lifecycle state: `isCancelled` → `EventCancelled`, `isActive && !isCancelled` → `EventScheduled`. `EventRescheduled` can be inferred when the event has a `previousStartDate` (from `EventRescheduleInputSchema` which has cancel/reschedule operations with `notifyAttendees` flag). `EventPostponed` has no direct codebase equivalent — map it to `EventCancelled` or omit unless a `postponed` flag is added. Implementation must build this mapping in the JSON-LD generator. The event CRUD schema also supports `EventCancelInputSchema` (with `cancellationReason`) and `EventRescheduleInputSchema` (with new dates).

---

#### REQ-075-22: Events by category sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/eventos/categoria/{category}/,
When the page renders,
Then I see events filtered by that category via GET /api/v1/public/events?category={CATEGORY}.

Given the category value is not in the valid category list,
When the page processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/eventos/categoria/[category]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/eventos/categoria/[category]/page/[page].astro`

---

#### REQ-075-23: Events by location sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/eventos/en/{slug}/,
When the page renders,
Then I see events at the venue or location identified by that slug, fetched via GET /api/v1/public/events/location/:locationId.

Given the location slug does not resolve to a known location,
When the page processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/eventos/en/[slug]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/eventos/en/[slug]/page/[page].astro`
- API: `GET /api/v1/public/events/location/:locationId` (locationId is UUID, not slug)
- **Slug resolution**: The URL uses the EventLocation slug, but the events-by-location endpoint expects a UUID `locationId`. The page must first resolve the slug to a locationId using `GET /api/v1/public/event-locations/slug/:slug` (this endpoint already exists at `apps/api/src/routes/event-location/public/getBySlug.ts`). The flow is: (1) resolve slug → EventLocation object with `id`, (2) fetch events via `GET /api/v1/public/events/location/:locationId` using the resolved ID.

---

### 1.4 Publicaciones (Blog Posts)

#### REQ-075-24: Posts listing page

**User Stories**

> As a visitor interested in the region,
> I want to browse blog posts and articles about travel, culture, and gastronomy,
> so that I can discover content relevant to my interests.

**Acceptance Criteria**

```
Given I navigate to /{lang}/publicaciones/,
When the page renders,
Then I see a paginated grid of published posts fetched from GET /api/v1/public/posts.

Given I filter by the "Cultura" category,
When the filter is applied,
Then only posts with category=culture are shown.

Given there are multiple pages,
When I navigate to page 2,
Then I go to /{lang}/publicaciones/page/2/.
```

**Details**:
- URL: `/{lang}/publicaciones/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/posts`
- Pagination file: `src/pages/[lang]/publicaciones/page/[page].astro`
- Filters: `category`, `q`, `isFeatured`, `tags`, `sortBy`, `sortOrder`
- Valid categories (UPPERCASE in `PostCategoryEnum`, case handling at API level): `EVENTS`, `CULTURE`, `GASTRONOMY`, `NATURE`, `TOURISM`, `GENERAL`, `SPORT`, `CARNIVAL`, `NIGHTLIFE`, `HISTORY`, `TRADITIONS`, `WELLNESS`, `FAMILY`, `TIPS`, `ART`, `BEACH`, `RURAL`, `FESTIVALS`. URL slugs use lowercase equivalents: `events`, `culture`, `gastronomy`, `nature`, `tourism`, `general`, `sport`, `carnival`, `nightlife`, `history`, `traditions`, `wellness`, `family`, `tips`, `art`, `beach`, `rural`, `festivals`.

---

#### REQ-075-25: Post detail page

**User Stories**

> As a visitor reading a blog post,
> I want the full article with author info, tags, reading time, and related posts,
> so that I can enjoy the content and discover more.

**Acceptance Criteria**

```
Given I navigate to /{lang}/publicaciones/{slug}/,
When the page renders,
Then I see: cover image, category badge, title, author avatar and name, publish date, reading time, TipTap content, tags, share buttons, and 3 related posts.

Given the page renders,
When I inspect the page source,
Then a BlogPosting JSON-LD block is present (more specific than Article for blog content) with recommended fields: headline, author (with name and url), datePublished (ISO 8601), dateModified, and image (multiple high-res images with 16x9, 4x3, 1x1 aspect ratios).

Given the slug does not resolve to a known published post,
When the server processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/publicaciones/[slug]/`
- Layout: DetailLayout (showBreadcrumbs=true, showSidebar=false)
- Rendering: SSR + ISR 24h
- API: `GET /api/v1/public/posts/slug/:slug`
- Structured data: BlogPosting JSON-LD

---

#### REQ-075-26: Posts by category sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/publicaciones/categoria/{category}/,
When the page renders,
Then I see posts in that category, fetched via GET /api/v1/public/posts/category/:category.

Given the category value is not in the valid category list,
When the page processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/publicaciones/categoria/[category]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/publicaciones/categoria/[category]/page/[page].astro`

---

#### REQ-075-27: Posts by tag sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/publicaciones/etiqueta/{tag}/,
When the page renders,
Then the server resolves the tag slug to an ID via GET /api/v1/public/tags/by-slug/{slug} and fetches posts via GET /api/v1/public/posts?tags={tagId}.

Given the tag slug does not resolve to a known tag,
When the page processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/publicaciones/etiqueta/[tag]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/publicaciones/etiqueta/[tag]/page/[page].astro`
- **Tag slug resolution**: Use `GET /api/v1/public/tags/by-slug/{slug}` (file: `apps/api/src/routes/tag/public/getBySlug.ts`) to resolve the URL slug to a tag object with `id`. Then pass the `id` to `GET /api/v1/public/posts?tags={tagId}`. If the tag endpoint returns 404, render the 404 page.

---

#### REQ-075-28: Posts by author sub-route

**Acceptance Criteria**

```
Given I navigate to /{lang}/publicaciones/autor/{slug}/,
When the page renders,
Then the server resolves the author slug to a user ID via GET /api/v1/public/users/by-slug/{slug} and fetches posts via GET /api/v1/public/posts?authorId={id}.

Given the author slug does not resolve to a known user,
When the page processes the request,
Then I am shown the 404 page.
```

**Details**:
- URL: `/{lang}/publicaciones/autor/[slug]/`
- Layout: ListingLayout (showFilters=true)
- Rendering: SSR + ISR 24h
- Pagination file: `src/pages/[lang]/publicaciones/autor/[slug]/page/[page].astro`
- **PREREQUISITE (BLOCKING)**: No public user-by-slug endpoint exists. Currently only `GET /api/v1/public/users/{id}` (by UUID) and `POST /api/v1/public/users/batch` are available. Users have auto-generated slugs (`user-{8char-uuid}`, column in `users` table, unique). A new endpoint `GET /api/v1/public/users/by-slug/{slug}` must be created following the same pattern as `GET /api/v1/public/tags/by-slug/{slug}`. The endpoint should return the user's public profile (id, displayName, slug, avatar) without sensitive fields. The page also displays the author's name and avatar in a header section above the post grid.

---

## Phase 2: Search, Contact, and Informational Pages

### REQ-075-29: Global search page

**User Stories**

> As a visitor looking for something specific,
> I want a single search page that shows results across accommodations, destinations, events, and posts,
> so that I do not have to search each section separately.

**Acceptance Criteria**

```
Given I navigate to /{lang}/busqueda/ with no query,
When the page renders,
Then I see popular suggestions or trending content, not an empty page.

Given I navigate to /{lang}/busqueda/?q=colón,
When the page renders,
Then I see results grouped by entity type (accommodations, destinations, events, posts) with a count per group.

Given there are no results for the query,
When the page renders,
Then I see a "No results found" message with a suggestion to try a different search.

Given the search page is rendered,
When I inspect the page head,
Then the page has a noindex meta tag (search results must not be indexed).
```

**Details**:
- URL: `/{lang}/busqueda/`
- Layout: DefaultLayout
- Rendering: SSR (no ISR — personalized/dynamic)
- noindex: yes
- **PREREQUISITE (BLOCKING)**: No unified search endpoint exists. Individual entity search endpoints exist (`/accommodations?q=`, `/destinations?q=`, `/events?q=`, `/posts?q=`) but no cross-entity search. A new endpoint `GET /api/v1/public/search?q={query}` must be created that:
  1. Accepts `q` (required, string, min 2 chars) and optional `limit` (per entity type, default 5, max 20)
  2. Queries all 4 entity types in parallel (accommodations, destinations, events, posts)
  3. Returns results grouped by entity type with a count per group: `{ accommodations: { items: [], total: N }, destinations: { items: [], total: N }, events: { items: [], total: N }, posts: { items: [], total: N } }`
  4. Each item includes minimal fields for rendering a card: `id`, `slug`, `name`/`title`, `coverImage`, `type`/`category` (where applicable)
  5. Uses `safeIlike()` for all text matching (per project LIKE search policy)
  6. Rate limit: 30 requests per minute per IP (search can be expensive)

---

### REQ-075-30: Contact page

**User Stories**

> As a visitor with a question or problem,
> I want a contact form to send a message to the Hospeda team,
> so that I can get help without needing to find an email address.

**Acceptance Criteria**

```
Given I navigate to /{lang}/contacto/,
When the page renders,
Then I see a contact form with fields for first name, last name, email, message, and type (general/accommodation).

Given I submit the form with all required fields (firstName, lastName, email, message),
When the server processes the submission,
Then my message is sent via POST /api/v1/public/contact and I see a success confirmation.

Given I submit the form with a missing required field,
When the client validates the form,
Then I see an inline validation error next to the empty field and the form is not submitted.

Given the API call fails,
When the error is returned,
Then I see an error message telling me the message could not be sent and to try again.
```

**Details**:
- URL: `/{lang}/contacto/`
- Layout: DefaultLayout
- Rendering: SSG (prerender)
- ContactForm is a React island loaded with `client:visible`
- API request body: { firstName: string(1-100), lastName: string(1-100), email: string(email), message: string(10-2000), type?: 'general'|'accommodation', accommodationId?: string }
- Rate limit: 5 requests per 60 seconds
- API: `POST /api/v1/public/contact`

---

### REQ-075-31: About us page

**User Stories**

> As a visitor curious about Hospeda,
> I want an about page describing the platform's mission and team,
> so that I can understand who is behind the service.

**Acceptance Criteria**

```
Given I navigate to /{lang}/nosotros/,
When the page renders,
Then I see a hero section, mission statement, values cards, a regional section about Concepción del Uruguay, and a CTA.

Given the page renders in English,
When I read the content,
Then all text is in English.
```

**Details**:
- URL: `/{lang}/nosotros/`
- Layout: DefaultLayout
- Rendering: SSG (prerender)

---

### REQ-075-32: Privacy policy page

**User Stories**

> As a visitor concerned about data privacy,
> I want to read the privacy policy in my preferred language,
> so that I understand how my data is handled.

**Acceptance Criteria**

```
Given I navigate to /{lang}/legal/privacidad/,
When the page renders,
Then I see the privacy policy content in 7 sections, rendered in LegalLayout with a table of contents.

Given the page includes a lastUpdated date,
When it renders,
Then the date is visible at the top of the content.
```

**Details**:
- URL: `/{lang}/legal/privacidad/`
- Layout: LegalLayout (showToc=true)
- Rendering: SSG (prerender)

---

### REQ-075-33: Terms and conditions page

**Acceptance Criteria**

```
Given I navigate to /{lang}/legal/terminos/,
When the page renders,
Then I see the terms of service in 7 sections, rendered in LegalLayout with a table of contents.
```

**Details**:
- URL: `/{lang}/legal/terminos/`
- Layout: LegalLayout (showToc=true)
- Rendering: SSG (prerender)

---

### REQ-075-34: Feedback page

**User Stories**

> As a beta user experiencing a bug or issue,
> I want a structured feedback form to report problems with screenshots and reproduction steps,
> so that the development team can efficiently diagnose and fix issues.

**Acceptance Criteria**

```
Given I navigate to /{lang}/feedback/,
When the page renders,
Then I see a multi-step feedback form with Step 1 (type, title, description) and Step 2 (severity, reproduction details, attachments).

Given I fill out the required fields (type, title, description, name, email) and submit,
When the server processes the submission via POST /api/v1/public/feedback (multipart/form-data),
Then my feedback is submitted and I see a confirmation with a Linear issue link (if Linear integration succeeds).

Given I attach files to the feedback form,
When I select files,
Then up to 5 image files (PNG/JPEG/WebP/GIF, max 10MB each) are accepted.

Given I submit without required fields,
When the client validates the form,
Then inline validation errors appear next to the empty required fields.

Given the Linear API call fails,
When the fallback runs,
Then my feedback is sent via email notification instead.
```

**Details**:
- URL: `/{lang}/feedback/`
- Layout: DefaultLayout (beta feature, will be removed for production)
- Rendering: SSR (no ISR)
- API: `POST /api/v1/public/feedback` (multipart/form-data)
- Feedback schemas and config live in `packages/feedback/` (re-exported via `packages/schemas/src/feedback.ts`)
- **Multipart structure**: The form sends 3 multipart fields:
  1. `data` (required): JSON string containing the entire form object (see structure below)
  2. `website` (optional): Honeypot field for bot protection. If non-empty, request is silently discarded with a fake success response
  3. `attachments` (optional): Up to 5 image files (PNG/JPEG/WebP/GIF, max 10MB each). Each file appended under the same `attachments` key. Server validates magic bytes (not just MIME type). Total `data` field size limit: 32KB
- **`data` JSON structure**:
  - Step 1 (required): `type` (enum: `bug-js`, `bug-ui-ux`, `bug-content`, `feature-request`, `improvement`, `other`), `title` (string, 5-200 chars), `description` (string, 10-5000 chars)
  - Step 2 (optional): `severity` (enum: `critical`, `high`, `medium`, `low`), `stepsToReproduce` (string, max 3000), `expectedResult` (string, max 1000), `actualResult` (string, max 1000)
  - User info (required): `reporterEmail` (valid email), `reporterName` (string, 2-100 chars)
  - Environment (required wrapper, auto-collected by client): `{ currentUrl?: string (URL), browser?: string (max 200), os?: string (max 200), viewport?: string (max 100), timestamp: string (REQUIRED, ISO datetime), appSource: 'web' | 'admin' | 'standalone' (REQUIRED), deployVersion?: string (max 100), userId?: string, consoleErrors?: string[] (max 20, each max 500), errorInfo?: { message: string (max 1000), stack?: string (max 5000) } }`
- Rate limit: 30 requests per IP per hour (window: 3,600,000ms). HTTP 429 when exceeded
- **Response**: `{ linearIssueId: string | null, linearIssueUrl?: string | null, message: string }`
- **Integration flow**: (1) parse multipart, (2) check honeypot (silent discard if filled), (3) validate JSON `data`, (4) sanitize all fields against XSS, (5) validate attachment magic bytes, (6) attempt Linear issue creation (3 retries, exponential backoff 1s/2s/4s), (7) on Linear failure, send email fallback, (8) return success regardless of integration outcome
- Can be disabled via `HOSPEDA_FEEDBACK_ENABLED` env var

---

## Phase 3: Account Sub-pages

All pages in this phase use AccountLayout, SSR (no ISR), and are protected by the existing auth middleware. The middleware redirects unauthenticated requests to the login page.

### REQ-075-35: Edit profile page

**User Stories**

> As a logged-in user,
> I want to edit my display name, avatar, bio, and contact details,
> so that my profile reflects current information.

**Acceptance Criteria**

```
Given I am authenticated and navigate to /{lang}/mi-cuenta/editar/,
When the page renders,
Then I see a ProfileEditForm pre-populated with my current profile data.

Given I change my display name and save,
When the form is submitted,
Then the change is persisted and I see a success notification.

Given I am not authenticated and navigate to this URL,
When the middleware processes the request,
Then I am redirected to the login page.
```

**Details**:
- URL: `/{lang}/mi-cuenta/editar/`
- Layout: AccountLayout (activeSection='editar')
- Rendering: SSR
- Island: ProfileEditForm (client:load)
- API read: `GET /api/v1/protected/users/{id}` (user data pre-populated in form)
- API write: `PATCH /api/v1/protected/users/{id}` (partial update) or `PUT /api/v1/protected/users/{id}` (full update)
- The authenticated user's ID is available from the session parsed by middleware

---

### REQ-075-36: Favorites page

**User Stories**

> As a logged-in user,
> I want to see all the accommodations and destinations I have favourited,
> so that I can revisit them quickly.

**Acceptance Criteria**

```
Given I am authenticated and navigate to /{lang}/mi-cuenta/favoritos/,
When the page renders,
Then I see a list of all entities I have marked as favourite, with remove buttons.

Given I click the remove button on a favourite,
When the action completes,
Then the item is removed from the list without a full page reload.

Given I have no favourites,
When the page renders,
Then I see an empty state with a link to the accommodations and destinations listings.
```

**Details**:
- URL: `/{lang}/mi-cuenta/favoritos/`
- Layout: AccountLayout (activeSection='favoritos')
- Rendering: SSR
- Island: UserFavoritesList (client:load)
- API list: `GET /api/v1/protected/user-bookmarks/` (paginated list of user's bookmarks)
- API check: `GET /api/v1/protected/user-bookmarks/check` (check if entity is bookmarked)
- API toggle: `POST /api/v1/protected/user-bookmarks/` (toggle bookmark on/off)
- API remove: `DELETE /api/v1/protected/user-bookmarks/{id}` (remove specific bookmark)
- API count: `GET /api/v1/protected/user-bookmarks/count` (total bookmark count)
- Note: The API uses "bookmarks" terminology, not "favorites". The UI label "Favoritos" is an i18n string.

---

### REQ-075-37: Reviews page

**User Stories**

> As a logged-in user,
> I want to see all the reviews I have written,
> so that I can track my contributions and edit or delete them.

**Acceptance Criteria**

```
Given I am authenticated and navigate to /{lang}/mi-cuenta/resenas/,
When the page renders,
Then I see all reviews I have submitted, grouped by entity type.

Given I have no reviews,
When the page renders,
Then I see an empty state with an encouragement to visit accommodations or destinations.
```

**Details**:
- URL: `/{lang}/mi-cuenta/resenas/`
- Layout: AccountLayout (activeSection='resenas')
- Rendering: SSR
- Island: UserReviewsList (client:load)
- API: `GET /api/v1/protected/users/me/reviews` (returns paginated accommodation and destination reviews written by the authenticated user, grouped by entity type)

---

### REQ-075-38: Subscription page

**User Stories**

> As a logged-in user,
> I want to see my current subscription plan, next billing date, and available upgrades,
> so that I can manage my Hospeda subscription.

**Acceptance Criteria**

```
Given I am authenticated and navigate to /{lang}/mi-cuenta/suscripcion/,
When the page renders,
Then I see my current plan name, status, next billing date, and a list of plan features.

Given I am on a free plan,
When the page renders,
Then I see upgrade options with pricing for paid plans.
```

**Details**:
- URL: `/{lang}/mi-cuenta/suscripcion/`
- Layout: AccountLayout (activeSection='suscripcion')
- Rendering: SSR
- Island: SubscriptionDashboard (client:load)
- API: `GET /api/v1/protected/users/me/subscription` (returns current billing subscription: plan slug, name, status [active/trial/cancelled/expired/past_due/pending], billing period, payment method, grace period info)
- Plan comparison data: `GET /api/v1/public/plans` (for upgrade options — uses same endpoint as marketing pricing pages, filtered by user's plan category)

---

### REQ-075-39: Preferences page

**User Stories**

> As a logged-in user,
> I want to set my notification preferences, language preference, and display settings,
> so that the platform behaves according to my preferences.

**Acceptance Criteria**

```
Given I am authenticated and navigate to /{lang}/mi-cuenta/preferencias/,
When the page renders,
Then I see toggles for email notifications, language selection, and display preferences.

Given I change a preference toggle,
When the toggle is clicked,
Then the preference is saved immediately (optimistic update) without requiring a form submit.
```

**Details**:
- URL: `/{lang}/mi-cuenta/preferencias/`
- Layout: AccountLayout (activeSection='preferencias')
- Rendering: SSR
- Island: PreferenceToggles (client:load)
- API read: `GET /api/v1/protected/users/{id}` (user profile includes settings/preferences)
- API write: `PATCH /api/v1/protected/users/{id}` (update preference fields)
- API newsletter: `POST /api/v1/protected/users/me/newsletter/toggle` (toggle newsletter subscription)
- API stats: `GET /api/v1/protected/users/me/stats` (user activity statistics, for display in preferences dashboard)

---

## Phase 4: Marketing and Pricing Pages

### REQ-075-40: Property owners landing page

**User Stories**

> As a property owner considering listing on Hospeda,
> I want a landing page explaining the benefits, process, and FAQs,
> so that I can decide whether to create an account.

**Acceptance Criteria**

```
Given I navigate to /{lang}/suscriptores/propietarios/,
When the page renders,
Then I see: a hero section, 6 key benefits, a "how it works" step-by-step, an FAQ accordion, and a CTA to register.

Given I expand an FAQ item,
When the accordion opens,
Then the answer is revealed with a smooth animation and the item is marked as open.

Given the page renders,
When I inspect the page source,
Then a FAQPage JSON-LD block is present covering all FAQ items. Note: since August 2023, Google restricted FAQPage rich results to authoritative government/health sites. This markup will NOT generate visible rich results for a commercial tourism site, but is still valuable for AI visibility (ChatGPT, Perplexity, Google AI Overviews) and semantic correctness.
```

**Details**:
- URL: `/{lang}/suscriptores/propietarios/`
- Layout: MarketingLayout
- Rendering: SSG (prerender)
- Structured data: FAQPage JSON-LD

---

### REQ-075-41: Benefits page

**Acceptance Criteria**

```
Given I navigate to /{lang}/beneficios/,
When the page renders,
Then I see 5 tourist benefits and 5 property owner benefits, each with an icon, title, and description, plus CTAs for each audience.
```

**Details**:
- URL: `/{lang}/beneficios/`
- Layout: MarketingLayout
- Rendering: SSG (prerender)

---

### REQ-075-42: Tourist pricing page

**User Stories**

> As a visitor considering a paid plan,
> I want to see plan options, features, and pricing in a comparison table,
> so that I can make an informed decision.

**Acceptance Criteria**

```
Given I navigate to /{lang}/suscriptores/turistas/,
When the page renders,
Then I see plan cards fetched from GET /api/v1/public/plans, filtered to tourist-facing plans.

Given the API call fails or returns empty,
When the page renders,
Then I see hardcoded fallback plan cards so the page never shows as blank.

Given the page renders,
When I inspect the pricing data,
Then all monetary values are displayed in ARS.
```

**Details**:
- URL: `/{lang}/suscriptores/turistas/`
- Layout: MarketingLayout
- Rendering: SSG + ISR 24h (plans change infrequently but must stay current)
- API: `GET /api/v1/public/plans`

---

### REQ-075-43: Owner pricing page

**Acceptance Criteria**

```
Given I navigate to /{lang}/suscriptores/planes/,
When the page renders,
Then I see plan cards for property owner plans, fetched from GET /api/v1/public/plans filtered to owner plans.

Given the API call fails or returns empty,
When the page renders,
Then hardcoded fallback plan cards are displayed.
```

**Details**:
- URL: `/{lang}/suscriptores/planes/`
- Layout: MarketingLayout
- Rendering: SSG + ISR 24h
- API: `GET /api/v1/public/plans`
- **Note**: The plans API returns 3 categories defined by `PlanCategory` type union in `packages/billing/src/types/plan.types.ts`: `'owner' | 'complex' | 'tourist'`. Plans are hardcoded config objects in `packages/billing/src/config/plans.config.ts` (9 plans total: 3 owner, 3 complex, 3 tourist), NOT stored in the database. This page displays both `owner` and `complex` plans together (complexes/hotels are a variant of property owner plans). The tourist pricing page (REQ-075-42) displays only `tourist` category plans. Use `PLANS_BY_CATEGORY` from the billing config for client-side grouping.

---

## Phase 5: Infrastructure Changes

### REQ-075-44: Fix ISR exclude regex

**Problem**: The current ISR exclude regex in `apps/web/astro.config.mjs` excludes ALL sub-routes under content sections (e.g., /alojamientos/[^/]+(/.*)?$), which unintentionally prevents filter sub-routes (e.g., /alojamientos/tipo/cabin/) AND detail pages from being ISR-cached. The new configuration enables ISR 24h for all content pages (listings, detail pages, filter sub-routes) while keeping auth, account, search, and feedback pages as pure SSR. Detail pages will use ISR 24h combined with on-demand revalidation triggered by the entity path mapper when content changes in the admin panel.

**Acceptance Criteria**

```
Given the ISR exclude regex is updated,
When a filter sub-route like /{lang}/alojamientos/tipo/cabin/ is requested for the second time,
Then the response is served from ISR cache (not re-rendered on every request).

Given the ISR exclude regex is updated,
When any /{lang}/mi-cuenta/* page is requested,
Then it is excluded from ISR and rendered fresh on every request (SSR).

Given the ISR exclude regex is updated,
When any /{lang}/auth/* page is requested,
Then it is excluded from ISR and rendered fresh on every request (SSR).

Given the ISR exclude regex is updated,
When /{lang}/busqueda/ is requested,
Then it is excluded from ISR (dynamic, personalized content).

Given the ISR exclude regex is updated,
When /{lang}/feedback/ is requested,
Then it is excluded from ISR.
```

**Target exclude pattern**:

```javascript
exclude: [
  /^(\/(?:en|pt))?\/mi-cuenta(\/.*)?$/,
  /^(\/(?:en|pt))?\/auth(\/.*)?$/,
  /^(\/(?:en|pt))?\/busqueda(\/.*)?$/,
  /^(\/(?:en|pt))?\/feedback(\/.*)?$/,
]
```

---

### REQ-075-45: Update entity path mapper for new URL patterns

**Problem**: `packages/service-core/src/revalidation/entity-path-mapper.ts` does not know about the new URL patterns introduced in this spec. On-demand ISR revalidation will not clear the correct cached paths when entities are updated.

**Acceptance Criteria**

```
Given an accommodation is updated in the admin panel,
When the revalidation system runs,
Then it clears cached paths for: the accommodation detail, the main listing, the by-type sub-route, and now also the by-amenity and by-feature sub-routes for all amenities and features associated with that accommodation.

Given an event is updated,
When the revalidation system runs,
Then it clears the event detail, listing, by-category, by-location sub-route, and the destination's events sub-route (/{lang}/destinos/{slug}/eventos/).

Given a post is updated,
When the revalidation system runs,
Then it clears the post detail, listing, by-category, by-tag, and by-author sub-routes.

Given a destination is updated,
When the revalidation system runs,
Then it clears the destination detail, listing, its accommodations sub-route, its events sub-route, and all by-attraction sub-routes for attractions belonging to that destination.
```

**New paths to add per entity**:
- `accommodation`: `alojamientos/comodidades/{amenitySlug}/`, `alojamientos/caracteristicas/{featureSlug}/`
- `event`: `eventos/en/{locationSlug}/`, `destinos/{destSlug}/eventos/`
- `post`: `publicaciones/categoria/{category}/`, `publicaciones/autor/{authorSlug}/` (note: `publicaciones/etiqueta/{tagSlug}/` already exists in the mapper and does NOT need to be added)
- `destination`: `destinos/{slug}/alojamientos/`, `destinos/{slug}/eventos/`, `destinos/atraccion/{attractionSlug}/`

**PREREQUISITE FIX**: The current entity path mapper contains stale data that must be corrected:
- Accommodation type slugs include `estancia` and `posada` which do NOT exist in `AccommodationTypeEnum`. Remove them and ensure the slug list matches the 10 valid types: `apartment`, `house`, `country-house`, `cabin`, `hotel`, `hostel`, `camping`, `room`, `motel`, `resort`.
- Event category slugs are `festival, fair, sport, cultural, gastronomy` which do NOT match `EventCategoryEnum` values: `music`, `culture`, `sports`, `gastronomy`, `festival`, `nature`, `theater`, `workshop`, `other`. Update to match the full enum.

---

### REQ-075-46: Pagination infrastructure (14 rewrite files)

**Problem**: Astro requires explicit `page/[page].astro` files that use `Astro.rewrite()` to serve paginated versions of listing pages. Without these, pagination URLs return 404.

**Acceptance Criteria**

```
Given I navigate to /{lang}/{listing}/page/2/,
When the page renders,
Then I see page 2 of the listing results (identical layout to page 1 but offset by pageSize items).

Given I navigate to /{lang}/{listing}/page/1/,
When the page processes the request,
Then I am redirected (301) to /{lang}/{listing}/ (canonical — no page param for first page).

Given I navigate to /{lang}/{listing}/page/0/ or a non-numeric page,
When the page processes the request,
Then I am shown the 404 page.
```

**14 pagination rewrite files required**:

| File | Rewrites to |
|------|-------------|
| `[lang]/alojamientos/page/[page].astro` | `[lang]/alojamientos/` |
| `[lang]/alojamientos/tipo/[type]/page/[page].astro` | `[lang]/alojamientos/tipo/[type]/` |
| `[lang]/alojamientos/comodidades/[slug]/page/[page].astro` | `[lang]/alojamientos/comodidades/[slug]/` |
| `[lang]/alojamientos/caracteristicas/[slug]/page/[page].astro` | `[lang]/alojamientos/caracteristicas/[slug]/` |
| `[lang]/destinos/page/[page].astro` | `[lang]/destinos/` |
| `[lang]/destinos/[slug]/alojamientos/page/[page].astro` | `[lang]/destinos/[slug]/alojamientos/` |
| `[lang]/destinos/[slug]/eventos/page/[page].astro` | `[lang]/destinos/[slug]/eventos/` |
| `[lang]/eventos/page/[page].astro` | `[lang]/eventos/` |
| `[lang]/eventos/categoria/[category]/page/[page].astro` | `[lang]/eventos/categoria/[category]/` |
| `[lang]/eventos/en/[slug]/page/[page].astro` | `[lang]/eventos/en/[slug]/` |
| `[lang]/publicaciones/page/[page].astro` | `[lang]/publicaciones/` |
| `[lang]/publicaciones/categoria/[category]/page/[page].astro` | `[lang]/publicaciones/categoria/[category]/` |
| `[lang]/publicaciones/etiqueta/[tag]/page/[page].astro` | `[lang]/publicaciones/etiqueta/[tag]/` |
| `[lang]/publicaciones/autor/[slug]/page/[page].astro` | `[lang]/publicaciones/autor/[slug]/` |

Each file must: validate that `page` is a positive integer greater than 1, redirect page 1 to the canonical URL (301), and call `Astro.rewrite()` to the parent path with `?page=N` appended. **Important constraint** (Astro `ForbiddenRewrite` error): `Astro.rewrite()` CANNOT rewrite from an on-demand rendered route to a prerendered route when using `output: 'server'`. This is a hard error, not a warning. Both the pagination file and the target listing page must share the same rendering mode. Since listing pages are SSR + ISR, pagination files are also SSR by default, so this constraint is naturally satisfied. Also note: `Astro.rewrite()` was introduced in Astro 4.13.0, and was removed from Actions context in Astro 6.0 (use custom endpoints instead if needed inside actions). If the request body has been read before calling `rewrite()`, clone the request first.

---

### REQ-075-47: Update header and footer navigation

**Problem**: `Header.astro` already links to Alojamientos, Destinos, Eventos, Publicaciones, Contacto, and a CTA to /suscriptores/. `Footer.astro` already has 4 groups: Explorar (alojamientos, destinos, eventos, publicaciones, propietarios), Destinos (concepcion-del-uruguay, colon, gualeguaychu, san-jose), Propietarios (suscriptores/propietarios, suscriptores/planes, suscriptores/turistas, beneficios), and Hospeda (nosotros, contacto, legal/terminos, legal/privacidad). However, some new pages from this spec are not yet linked: `/busqueda/` (search) is missing from the header, and `/feedback/` is not linked anywhere. Additionally, the header needs a search icon/link and the account section indicator.

**Acceptance Criteria**

```
Given I am on any page of the site,
When I look at the header navigation,
Then I see the existing links (Alojamientos, Destinos, Eventos, Publicaciones, Contacto) plus a search icon/link to /{lang}/busqueda/.

Given I scroll to the footer,
When I look at the footer link grid,
Then the existing 4 link groups are present and consistent with the current Footer.astro structure. The feedback page link is NOT added to the footer (it is a beta feature accessible only via direct URL or in-app prompts).

Given the site is in English (en locale),
When I read the navigation labels,
Then all labels are translated to English equivalents.

Given I am on the /mi-cuenta/* section,
When I look at the header,
Then a user menu indicator is visible with a link to the account section.
```

---

### REQ-075-48: Update sitemap to include all new pages

**Problem**: The `@astrojs/sitemap` integration must be configured to include all new public pages and exclude account, auth, search, and feedback pages.

**Acceptance Criteria**

```
Given the sitemap is generated at /sitemap-index.xml,
When I request it,
Then it links to sitemaps that include all public content pages across all 3 locales.

Given the sitemap is generated,
When I check the entries,
Then /mi-cuenta/*, /auth/*, /busqueda/, and /feedback/ are NOT included. The current sitemap filter only excludes `/auth/` and `/mi-cuenta/` patterns and must be updated to also exclude `/busqueda/` and `/feedback/`. Legal pages (/legal/*) SHOULD be included in the sitemap.

Given a dynamic content page (accommodation, event, etc.) is SSR + ISR,
When the sitemap is generated at build time,
Then the page URL is included via a custom dynamic sitemap endpoint.
```

**IMPORTANT**: `@astrojs/sitemap` only generates entries for statically-generated routes (those using `getStaticPaths()`). It does NOT automatically include SSR/ISR pages. Since all content pages in this spec use SSR + ISR (not prerendering), a custom dynamic sitemap endpoint must be created:

- **Endpoint**: `src/pages/sitemap-dynamic.xml.ts` (Astro API route)
- **Behavior**: At request time, fetches all published entity slugs from the API (accommodations, destinations, events, posts) and generates a valid XML sitemap with `<url>` entries for each entity detail page and listing page across all 3 locales.
- **Caching**: The endpoint itself should be ISR-cached with a 24h expiration (content changes trigger revalidation).
- **Integration**: Add the dynamic sitemap URL to the `@astrojs/sitemap` `customPages` config or reference it from `sitemap-index.xml` as an additional sitemap source.
- **Static pages**: Pages using SSG (prerender) like `/nosotros/`, `/legal/*`, `/beneficios/`, `/contacto/`, marketing pages are automatically included by `@astrojs/sitemap` and do NOT need to be in the dynamic sitemap.

---

## UX Considerations

### Empty States

Every listing page must have an empty state component that is shown when:
- No results match the current filters (message + "clear filters" link)
- The entity collection is genuinely empty (message + link to related content)

### Loading States

- Detail pages with deferred islands (`server:defer`) must show a skeleton placeholder while the island loads.
- Listing pages must show a skeleton grid while the initial API call resolves in SSR (not applicable for ISR-cached responses).

### Error States

- If an API call fails during SSR, the page must render a user-visible error banner rather than throwing an uncaught exception that produces a 500.
- The error banner must include a "Try again" button that reloads the page.

### Accessibility

- All interactive filter controls must be keyboard-navigable and have appropriate ARIA labels.
- Image galleries must trap focus when open and support Escape to close.
- The account sidebar must use `<nav>` with `aria-label="Account navigation"`.
- All map components (MapView) must have a text alternative or be hidden from screen readers with a descriptive caption.
- Pagination must use `<nav aria-label="Pagination">` with meaningful link text (not just "1", "2").

### Existing Reusable Components

The following components already exist in `apps/web/src/components/` and must be reused (not recreated):
- `SearchBar.astro` + `SearchBar.client.tsx` (React island) — global search bar
- `shared/Pagination.astro` — pagination navigation
- `seo/BreadcrumbJsonLd.astro` — breadcrumb structured data (visual Breadcrumbs component must be created separately)

The following components do NOT exist and must be created:
- MapView (interactive map island)
- ReviewListIsland (server:defer Astro wrapper + React island)
- Breadcrumbs (visual breadcrumb trail component)
- FilterSidebar (collapsible filter panel)
- ImageGallery (lightbox gallery)

### View Transitions

- Pagination navigation (clicking page 2, 3, etc.) must use Astro View Transitions for a smooth page-to-page animation.
- The active filter state must persist across View Transition navigations.
- **Known issues**: (1) Scroll position may not restore correctly on back/forward navigation through paginated lists (GitHub withastro/astro#7847, #8083). (2) Island component state (e.g. filter form values in React islands) resets on navigation unless `transition:persist` is used. (3) `server:defer` islands can get stuck showing skeleton on revisit with View Transitions (GitHub #13583).

### i18n

- All user-facing strings on every new page must use `createTranslations(locale)` from `apps/web/src/lib/i18n.ts`.
- No hardcoded Spanish text is permitted in any component or page file.
- The i18n config (packages/i18n/src/config.ts) currently defines these web-relevant namespaces (24 total): common, nav, footer, accommodations, auth-ui, billing, blog (NOT "posts"), destinations, events, home, newsletter, owners, contact, about, benefits, error, privacy, search, terms, ui, fields, exchange-rate, account, review. New pages that need i18n keys not covered by existing namespaces must have their namespace added to the config and translation files created as part of implementation. Specifically, namespaces for marketing pricing pages and the feedback page do not yet exist and must be created.
- URL segments themselves remain in Spanish (alojamientos, destinos, eventos, publicaciones) regardless of locale — this is a deliberate SEO decision for the Argentina market.

---

## Out of Scope

The following are explicitly excluded from this spec:

- **HTML sitemap page**: Decided against. The XML sitemap (`/sitemap-index.xml`) is sufficient. A human-readable sitemap page is not needed for launch.
- **Booking/reservation flow**: Accommodation detail pages link to external booking or show contact info, but no in-platform booking system is built here.
- **User-generated review submission**: ReviewListIsland reads reviews. The review submission form is a separate feature.
- **Admin pages**: All admin-panel pages are out of scope. This spec covers only `apps/web`.
- **CMS-driven content**: Marketing page copy (propietarios, beneficios) is hardcoded in the Astro page with i18n strings. No CMS integration.
- **A/B testing or feature flags on pages**: All pages ship as defined with no experimental variants.
- **Infinite scroll**: Pagination uses URL segments (`/page/N/`), not infinite scroll. Infinite scroll is a future consideration.
- **Map tile provider selection**: MapView uses whatever tile provider is already configured. No provider changes in this spec.

---

## Summary

| Artifact | Count |
|----------|-------|
| New layout files | 8 |
| Migrated existing pages to new layouts | 9 |
| New page files (Phase 1-4) | 32 |
| Pagination rewrite files | 14 |
| Infrastructure files modified | 4 (astro.config.mjs, entity-path-mapper.ts, Header.astro, sitemap-dynamic.xml.ts) |
| **Total new/modified files** | **~67** |

Phase execution order: Phase 0 (layouts) must complete before any other phase. Phases 1-4 can be parallelized once the layout system is in place. Phase 5 (infrastructure) can be worked in parallel with Phases 1-4 but the ISR regex fix and entity path-mapper updates should be merged before any content pages go to production.

---

## Revision Log

### Revision 1 (2026-04-09) — Exhaustive cross-referencing with codebase and external documentation

**Corrections applied:**

1. **createTranslations() source**: Fixed reference from `@repo/i18n` to `apps/web/src/lib/i18n.ts` (local wrapper over @repo/i18n)
2. **Auth redirect parameter**: Changed "redirect-back" to "returnUrl" matching actual middleware implementation
3. **Contact form fields**: Updated from generic (name, email, subject, message) to match actual API schema (firstName, lastName, email, message, type, accommodationId). Added rate limit info.
4. **Accommodation types enum**: Removed non-existent types (estancia, posada), added missing type (country_house). Now matches AccommodationTypeEnum exactly.
5. **Boolean accommodation filters removed**: hasPool, hasWifi, allowsPets, hasParking do not exist in AccommodationSearchHttpSchema. Added note about using amenities array for boolean-like filtering.
6. **Features filter param removed**: No `features` query param exists in accommodation search schema. Feature filtering uses dedicated endpoint (REQ-075-14).
7. **server:defer constraint**: Clarified that server:defer only works on .astro components. ReviewListIsland must be an Astro wrapper around a React island.
8. **JSON-LD listing pages**: Changed from "LodgingBusiness or ItemList" to "ItemList with ListItem elements" (LodgingBusiness describes a single entity).
9. **JSON-LD accommodation detail**: Added specific subtypes (Hotel, Resort, etc.) and missing recommended fields (geo, telephone, url, checkinTime, checkoutTime).
10. **JSON-LD destinations**: Changed from "PlaceJsonLd" to "TouristDestination" with note about no Google Rich Results support.
11. **JSON-LD events**: Expanded required/recommended field list (added image, description, eventStatus, performer).
12. **JSON-LD blog posts**: Changed from "ArticleJsonLd" to "BlogPosting" and added dateModified.
13. **FAQPage limitation**: Added note that Google restricted rich results to govt/health sites since Aug 2023; kept for AI visibility value.
14. **Amenity filtering prerequisite**: Added blocking dependency note — list handler does not implement actual amenity ID filtering despite schema support.
15. **Astro.rewrite() constraint**: Added note about on-demand/prerendered rendering mode matching requirement.
16. **URL corrections** (aligned with existing Footer.astro links):
    - About: `/quienes-somos/` → `/nosotros/`
    - Privacy: `/privacidad/` → `/legal/privacidad/`
    - Terms: `/terminos-condiciones/` → `/legal/terminos/`
    - Propietarios: `/propietarios/` → `/suscriptores/propietarios/`
    - Tourist pricing: `/precios/turistas/` → `/suscriptores/turistas/`
    - Owner pricing: `/precios/propietarios/` → `/suscriptores/planes/`
17. **ISR exclude regex**: Expanded problem description to explicitly state that detail pages are being moved from SSR-only to ISR 24h + on-demand revalidation.
18. **i18n namespaces**: Added note listing existing namespaces and identifying missing ones (marketing pricing, feedback) that must be created during implementation. Clarified "blog" namespace exists, not "posts".
19. **Footer/header navigation**: Updated marketing/legal link references to match actual footer structure.
20. **LodgingBusiness subtypes**: Added recommendation to use most specific subtype per accommodation type.

**Decisions made (with user):**
- D1: Marketing page URLs use existing footer structure (`/suscriptores/*`, `/beneficios/`)
- D2: About page URL uses `/nosotros/` (matching footer)
- D3: Legal page URLs use `/legal/terminos/` and `/legal/privacidad/` (matching footer)
- D4: Detail pages use ISR 24h + on-demand revalidation (confirmed intentional)
- D5: Amenity filtering handler fix added as blocking prerequisite within this spec
- D6: Missing i18n namespaces created as part of each page's implementation task

---

### Revision 2 (2026-04-09) — Deep verification against codebase, API handlers, schemas, and external documentation

**Agents used for verification:** 8 specialized agents covering API endpoints, web app state, schemas/enums, Astro server:defer docs, JSON-LD Schema.org types, amenity filtering handler, EventStatus search, events city/destination filter.

**Corrections applied:**

1. **Revision 1 items 5-6 REVERSED**: `hasPool`, `hasWifi`, `allowsPets`, `hasParking` DO exist in `AccommodationSearchHttpSchema`. `features` array param also exists. Revision 1 incorrectly stated they didn't exist. Updated REQ-075-10 filter params accordingly.
2. **Amenity/feature filtering confirmed SCHEMA-ONLY**: Both `amenities` and `features` params are accepted by the schema and passed through service layer, but the model (`accommodation.model.ts`) explicitly ignores them with a comment: "Filtering by amenities would require a join and is more complex." Updated REQ-075-13 and added prerequisite to REQ-075-14.
3. **Accommodation type enum values are UPPERCASE**: Added note that enum uses `HOTEL`, `HOSTEL` etc. URL slugs use lowercase equivalents.
4. **Destination by-path requires leading slash**: API regex is `/^\/[a-z0-9-/]+$/`. Fixed examples in REQ-075-16.
5. **Event JSON-LD — added previousStartDate**: Recommended field for rescheduled events per Google Search Central.
6. **EventStatus mapping note added**: No `EventStatus` enum exists in the codebase. Status must be derived from boolean flags (`isCancelled`, `isActive`) and lifecycle/CRUD schemas (`EventCancelInputSchema`, `EventRescheduleInputSchema`). Added implementation note to REQ-075-21.
7. **REQ-075-34 (Feedback page) — COMPLETE REWRITE**: Actual API uses `multipart/form-data` with structured fields (`title`, `description`, `reporterName`, `reporterEmail`, type enum with 6 values, `severity`, `attachments` up to 5 images, auto-collected environment data). Linear issue creation with email fallback. Rate limit 30/hour. Changed layout from ErrorLayout to DefaultLayout (beta feature).
8. **Plans API has 3 categories**: Added `complex` category note to REQ-075-43 (complex plans displayed alongside owner plans).
9. **Entity path mapper stale data**: Current mapper has `estancia`/`posada` (not in AccommodationTypeEnum) and wrong event category slugs. Added prerequisite fix note to REQ-075-45.
10. **Sitemap exclusions**: Current filter only excludes `/auth/` and `/mi-cuenta/`. Must add `/busqueda/` and `/feedback/`. Clarified legal pages should be included.
11. **server:defer constraints added**: Serializable props requirement, URL length limit (~2048 bytes, POST fallback breaks cache), `Astro.url` behavior inside islands, `ASTRO_KEY` for rolling deployments. Added to REQ-075-11.
12. **REQ-075-23 slug resolution**: Added note that API uses `locationId` UUID but page URL uses slug. Lookup step required.
13. **Additional accommodation search params documented**: `types` (array), `name`, `description`, `address`, `availableFrom`, `availableTo`.
14. **REQ-075-18 (Events within destination) — MAJOR UPDATE**: Events do NOT reference the destinations table. Added blocking prerequisite: `destinationId` FK must be added to events table with migration, backfill, schema/handler/model updates.

**Decisions made (with user):**

- D7: Feedback page uses DefaultLayout (beta feature, removed for production)
- D8: Complex plans included in owner pricing page (REQ-075-43), no separate page
- D9: Events to get `destinationId` FK to destinations table (migration + backfill)
- D10: Amenity/feature filtering confirmed as blocking prerequisite (schema-only, model needs JOIN implementation)
- D11: Events city filter to be reformed to use slug-based filtering

---

### Revision 3 (2026-04-09) — Exhaustive verification with 8 specialized agents

**Agents used for verification:** 8 agents covering: (1) API endpoint existence and params, (2) web app current state (pages, layouts, config), (3) entity path mapper analysis, (4) schemas and enums verification, (5) Astro features documentation (server:defer, rewrite, ISR, sitemap, View Transitions), (6) JSON-LD Schema.org types, (7) DB model verification (events-destinations, amenity filtering), (8) feedback package structure.

**Corrections applied:**

1. **Overview page count fixed**: Changed "9 pages" to "10 page files" (root redirect `index.astro` + locale-prefixed homepage were counted as one).
2. **Layout existence clarified**: Changed "only BaseLayout exists" to "BaseLayout is the only full-page layout; Header.astro and Footer.astro exist as shared layout components in src/layouts/."
3. **REQ-075-47 Header/Footer claim CORRECTED**: The spec falsely claimed Header/Footer "link only to the homepage and auth pages." In reality, Header already has links to Alojamientos, Destinos, Eventos, Publicaciones, Contacto, and /suscriptores/ CTA. Footer has 4 complete link groups. Rewrote REQ-075-47 to focus on adding missing links (/busqueda/ search icon, account indicator) rather than building navigation from scratch.
4. **REQ-075-10 accommodation search params corrected**: Removed `name`, `description`, `address`, `country`, `city`, `latitude`, `longitude`, `radius`, `ownerId` from "available" params list. These exist in the schema but are NOT exposed by the public API endpoint. Added clarifying note.
5. **REQ-075-11 LodgingBusiness subtypes expanded**: Added complete Schema.org mapping for all 10 AccommodationTypeEnum values. 5 have specific subtypes (Hotel, Hostel, Motel, Resort, Campground), 5 fall back to generic LodgingBusiness (APARTMENT, HOUSE, COUNTRY_HOUSE, CABIN, ROOM). Noted BedAndBreakfast and VacationRental subtypes exist in Schema.org but have no enum equivalent.
6. **REQ-075-11 server:defer bug warning added**: Added known bug note (GitHub withastro/astro#13583) where server islands get stuck showing skeleton on revisit with View Transitions. Added fallback strategy: use `client:visible` if bug persists at implementation time.
7. **REQ-075-17 destination accommodations endpoint path fixed**: Changed `destination/:destId` to `destination/:destinationId` (correct param name). Added note about hardcoded pagination (page=1, pageSize=20).
8. **REQ-075-21 EventStatus mapping expanded**: Added `EventPostponed` as 4th valid Schema.org value. Noted no codebase equivalent exists; recommend mapping to EventCancelled or omitting.
9. **REQ-075-23 event-location slug endpoint**: Corrected from "needs creating" to "already exists" at `apps/api/src/routes/event-location/public/getBySlug.ts`. Documented the two-step flow (resolve slug → fetch events by locationId).
10. **REQ-075-34 Feedback page COMPLETE REWRITE**: Rewrote Details section to match actual API structure. Key corrections: (a) multipart sends 3 fields (`data` JSON string, `website` honeypot, `attachments` files), not individual form fields; (b) added `environment` wrapper object with required `timestamp` and `appSource` fields; (c) added `errorInfo` sub-object; (d) added `appSource` enum values ('web' | 'admin' | 'standalone'); (e) added 32KB `data` field size limit; (f) added magic bytes validation for attachments; (g) documented full integration flow (XSS sanitization, 3 retries with exponential backoff, email fallback).
11. **REQ-075-43 PlanCategory source corrected**: Clarified that plan categories are a TypeScript type union in `packages/billing/src/types/plan.types.ts` (not an enum in schemas). Plans are hardcoded config objects in `packages/billing/src/config/plans.config.ts` (9 plans: 3 per category), not stored in the database. Added reference to `PLANS_BY_CATEGORY` helper.
12. **REQ-075-46 Astro.rewrite() constraints expanded**: Added ForbiddenRewrite error reference (hard error, not warning). Added notes about Astro version requirements (introduced in 4.13.0, removed from Actions in 6.0) and request body cloning requirement.
13. **REQ-075-48 Sitemap dynamic pages solution added**: `@astrojs/sitemap` does NOT generate entries for SSR/ISR pages. Added new requirement: create `src/pages/sitemap-dynamic.xml.ts` endpoint that fetches entity slugs from API at request time, generates XML sitemap, and is ISR-cached 24h. Static pages (SSG) remain covered by @astrojs/sitemap automatically.
14. **i18n namespace list completed**: Updated from 20 to full 24 web-relevant namespaces (added: auth-ui, billing, newsletter, exchange-rate that were missing from the list).
15. **Existing reusable components documented**: Added new UX section listing components that already exist (SearchBar, Pagination, BreadcrumbJsonLd) and those that must be created (MapView, ReviewListIsland, Breadcrumbs, FilterSidebar, ImageGallery).
16. **View Transitions known issues documented**: Added 3 known bugs: scroll position on back/forward, island state reset, server:defer skeleton stuck.
17. **Summary table updated**: Infrastructure files count updated from 3 to 4 (added sitemap-dynamic.xml.ts). Total file count updated to ~67.

**Decisions made (with user):**

- D12: Page count corrected to "10 page files" for accuracy
- D13: REQ-075-47 rewritten to focus on adding missing links, not building from scratch
- D14: Layout clarification: "BaseLayout is the only full-page layout; Header/Footer are shared layout components"
- D15: Dynamic sitemap via custom `sitemap-dynamic.xml.ts` endpoint (option 2)
- D16: server:defer bug documented with fallback to `client:visible` if unfixed at implementation time
- D17: Non-existent public endpoint params removed from spec, kept as informational note
- D18: Event-location slug endpoint confirmed as already existing, not a prerequisite
- D19: LodgingBusiness subtypes: 5 specific mappings + LodgingBusiness generic fallback for 5 others
- D20: Feedback form rewritten to match actual multipart structure (JSON `data` field + attachments)
- D21: PlanCategory is a type union in @repo/billing, not an enum. Plans are hardcoded config, not DB-stored

---

### Revision 4 (2026-04-09) — API endpoint verification, slug resolution audit, account pages completeness

**Agents used for verification:** 5 agents covering: (1) all 16 public API endpoints existence and params, (2) web app current state (pages, layouts, middleware, components, astro config), (3) schemas and enums exact values, (4) entity path mapper full analysis, (5) missing endpoints and slug resolution (user slugs, amenity/feature/tag slug endpoints, protected account endpoints, global search, feedback re-export, Astro version).

**Corrections applied:**

1. **REQ-075-14 BLOCKING prerequisite REMOVED**: The dedicated endpoint `GET /api/v1/public/features/{featureId}/accommodations` (file: `apps/api/src/routes/feature/public/getAccommodationsByFeature.ts`) already exists and performs its own JOIN. This page is NOT blocked by the generic `features` param implementation gap in REQ-075-13. Updated Details to document the dedicated endpoint and clarify non-blocking status.
2. **REQ-075-22 event category enum case note ADDED**: EventCategoryEnum uses UPPERCASE values (MUSIC, CULTURE, SPORTS...). Added note matching the accommodation types pattern in REQ-075-10.
3. **REQ-075-24 post category enum case note ADDED**: PostCategoryEnum uses UPPERCASE values (EVENTS, CULTURE, GASTRONOMY...). Added note matching the same pattern.
4. **REQ-075-27 tag slug resolution endpoint DOCUMENTED**: Added exact endpoint `GET /api/v1/public/tags/by-slug/{slug}` (file: `apps/api/src/routes/tag/public/getBySlug.ts`) with two-step resolution flow.
5. **REQ-075-28 user-by-slug PREREQUISITE ADDED**: No public user-by-slug endpoint exists. Users have auto-generated slugs (`user-{8char-uuid}`) but only ID-based lookup is available. Added blocking prerequisite: create `GET /api/v1/public/users/by-slug/{slug}` endpoint returning public profile fields.
6. **REQ-075-29 unified search endpoint PREREQUISITE ADDED**: No cross-entity search endpoint exists. Added blocking prerequisite: create `GET /api/v1/public/search?q={query}` that queries all 4 entity types in parallel, returns grouped results with counts, uses `safeIlike()`, and includes rate limiting (30 req/min/IP).
7. **REQ-075-13 amenity slug resolution CLARIFIED**: No `GET /api/v1/public/amenities/by-slug/{slug}` endpoint exists. Documented resolution approach: fetch full amenity list via `GET /api/v1/public/amenities/` (finite set, cacheable), find by slug, extract ID.
8. **REQ-075-14 feature slug resolution CLARIFIED**: No feature by-slug endpoint exists either. Documented same approach: fetch full feature list, find by slug, extract ID.
9. **REQ-075-35 (Edit profile) API endpoints ADDED**: `GET /api/v1/protected/users/{id}` (read) + `PATCH /api/v1/protected/users/{id}` (write).
10. **REQ-075-36 (Favorites) API endpoints ADDED**: Full bookmark API documented — list, check, toggle, delete, count under `/api/v1/protected/user-bookmarks/*`. Added note: API uses "bookmarks" terminology, not "favorites".
11. **REQ-075-37 (Reviews) API endpoint ADDED**: `GET /api/v1/protected/users/me/reviews` (accommodation + destination reviews, grouped by entity type).
12. **REQ-075-38 (Subscription) API endpoints ADDED**: `GET /api/v1/protected/users/me/subscription` (current plan, status, billing period) + `GET /api/v1/public/plans` (for upgrade comparison).
13. **REQ-075-39 (Preferences) API endpoints ADDED**: Read/write via users endpoint, newsletter toggle via `POST /api/v1/protected/users/me/newsletter/toggle`, stats via `GET /api/v1/protected/users/me/stats`.
14. **REQ-075-45 entity path mapper tag path CORRECTED**: Removed `publicaciones/etiqueta/{tagSlug}/` from "New paths to add" list — it already exists in the current entity path mapper (lines 281-287). Only `publicaciones/categoria/{category}/` and `publicaciones/autor/{authorSlug}/` are genuinely new.

**Verification confirmations (no changes needed):**

- All 16 public API endpoints in the spec confirmed to exist with correct paths and params
- Astro version confirmed as ^5.9.0 (spec's note about Astro 6.0 `rewrite()` change is forward-looking, correct as informational)
- Feedback schema re-export from `@repo/feedback/schemas` confirmed in `packages/schemas/src/feedback.ts`
- Auth middleware `returnUrl` parameter confirmed (not "redirect-back")
- Header navigation confirmed: 5 nav links + owner CTA + AuthSection server island
- Footer navigation confirmed: 4 groups (Explorar, Destinos, Propietarios, Hospeda) + newsletter + social
- 5 missing components confirmed: MapView, ReviewListIsland, Breadcrumbs, FilterSidebar, ImageGallery
- SearchBar located at `apps/web/src/components/sections/SearchBar.astro` (+ .client.tsx + .module.css)
- Pagination located at `apps/web/src/components/shared/Pagination.astro`
- BreadcrumbJsonLd located at `apps/web/src/components/seo/BreadcrumbJsonLd.astro`
- PostSearchHttpSchema confirmed: `authorId` (line 28) and `tags` (line 54, array of UUIDs) both exist
- ISR exclude patterns in astro.config.mjs match spec's description of the problem

**Decisions made (with user):**

- D22: Author by-slug: Create new `GET /api/v1/public/users/by-slug/{slug}` endpoint as prerequisite (option 1)
- D23: Global search: Create unified `GET /api/v1/public/search?q=X` endpoint (option 2, not 4 parallel calls)
- D24: REQ-075-14 is NOT blocked by amenity/feature model prerequisite (dedicated feature endpoint exists)
- D25: Amenity/feature slug resolution via list+filter approach (no new endpoints needed)
- D26: API uses "bookmarks" not "favorites" — documented in spec, UI label is i18n string
