# SPEC-096: Web App Beta-Readiness

## Progress: 0/70 tasks (0%)

**Average Complexity:** 2.33/3 (max)
**Critical Path:** T-003 -> T-004 -> T-005 | T-007 -> T-008 -> T-009 -> T-010 -> T-046 -> T-047 -> T-048 -> T-064 -> T-065 -> T-066 -> T-067 -> T-068 -> T-069 -> T-070 (15 steps)
**Parallel Tracks:** 6 tracks identified

---

### Prerequisites Phase

- [ ] **T-001** (complexity: 3) - Add amenity/feature JOIN to accommodation model search
  - REQ-096-01. JOINs on r_accommodation_amenity + r_accommodation_feature with intersection semantics
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 2) - Update AccommodationSearchSchema to expose amenities/features params
  - REQ-096-01. Add amenities/features as optional uuid[] fields with coercion
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-003** (complexity: 3) - Add destinationId FK column to events table (migration + schema)
  - REQ-096-02. Manual migration + Drizzle schema update + apply-postgres-extras.sh chain
  - Blocked by: none
  - Blocks: T-004, T-005

- [ ] **T-004** (complexity: 3) - Add destinationId filter to event search and backfill script
  - REQ-096-02. EventSearchSchema update + model filter + backfill script using safeIlike
  - Blocked by: T-003
  - Blocks: T-005

- [ ] **T-005** (complexity: 2) - Add event destinationId to public API event handler
  - REQ-096-02. Pass destinationId from query params through public event list route
  - Blocked by: T-003, T-004
  - Blocks: none

- [ ] **T-006** (complexity: 2) - Create public user-by-slug API endpoint
  - REQ-096-03. GET /api/v1/public/users/by-slug/{slug} with safe public fields only
  - Blocked by: none
  - Blocks: T-044

- [ ] **T-007** (complexity: 2) - Create unified search Zod schemas (query + response)
  - REQ-096-04. SearchQuerySchema + SearchResponseSchema with 4 entity groups
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-008** (complexity: 2) - Create search route skeleton and register in public router [split 1/3]
  - REQ-096-04. Route scaffold, schema validation, router mount — no query logic yet
  - Blocked by: T-007
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Implement parallel Promise.all queries with safeIlike [split 2/3]
  - REQ-096-04. 4-entity Promise.all + safeIlike + rate-limit 30 req/min
  - Blocked by: T-008
  - Blocks: T-010

- [ ] **T-010** (complexity: 2) - Write integration tests + apply rate-limit to search endpoint [split 3/3]
  - REQ-096-04. Full test suite: happy path, 400, 429, injection safety
  - Blocked by: T-009
  - Blocks: T-046

- [ ] **T-033** (complexity: 3) - Verify or create contact form public API endpoint
  - REQ-096-30. POST /api/v1/public/contact with honeypot, rate limit, email notification
  - Blocked by: T-014
  - Blocks: T-049

---

### Schemas Phase

- [ ] **T-011** (complexity: 2) - Update user settings Zod schema to 4-field theme/language separation
  - REQ-096-05. themeWeb/Admin, languageWeb/Admin replacing legacy darkMode/language
  - Blocked by: none
  - Blocks: T-012, T-032, T-040, T-056

- [ ] **T-012** (complexity: 2) - Create DB migration to backfill user settings legacy fields
  - REQ-096-05. Map darkMode→themeWeb+themeAdmin, language→languageWeb+languageAdmin
  - Blocked by: T-011
  - Blocks: T-040, T-056

- [ ] **T-013** (complexity: 2) - Create centralized ProfileEditSchema in @repo/schemas
  - REQ-096-06. packages/schemas/src/user/profile.ts with strict() validation
  - Blocked by: none
  - Blocks: T-035, T-055

- [ ] **T-014** (complexity: 2) - Create ContactSubmitSchema in @repo/schemas
  - REQ-096-07. Conditional accommodationId + superRefine validation
  - Blocked by: none
  - Blocks: T-033, T-049

- [ ] **T-032** (complexity: 3) - Update API PATCH /protected/users to enforce field-level permission by scope
  - REQ-096-05. Web scope: only *Web fields. Admin scope: all 4 fields
  - Blocked by: T-011
  - Blocks: T-040

---

### Shared Components Phase

- [ ] **T-015** (complexity: 3) - Create Breadcrumbs component with BreadcrumbList JSON-LD
  - REQ-096-08. nav[role=navigation] + ordered list + JSON-LD + mobile truncation
  - Blocked by: none
  - Blocks: T-026, T-029, T-030, T-031, T-064

- [ ] **T-016** (complexity: 2) - Create EmptyState component
  - REQ-096-09. Icon + title + description + optional CTA slot; max-width 500px
  - Blocked by: none
  - Blocks: T-035, T-038, T-039, T-040, T-049, T-054, T-058, T-064

- [ ] **T-017** (complexity: 3) - Create ShareButtons React island
  - REQ-096-10. Web Share API on mobile; popover with WhatsApp/Facebook/X/Telegram/Copy on desktop
  - Blocked by: none
  - Blocks: T-050, T-064

- [ ] **T-018** (complexity: 1) - Audit and screenshot all existing FilterSidebar call sites (baseline) [split 1/3]
  - REQ-096-11. Visual baseline before any refactor begins
  - Blocked by: none
  - Blocks: T-019

- [ ] **T-019** (complexity: 3) - Refactor FilterSidebar to single component with position prop + update call sites [split 2/3]
  - REQ-096-11. position='left'|'top' + mobile drawer; all call sites updated
  - Blocked by: T-018
  - Blocks: T-020

- [ ] **T-020** (complexity: 2) - Write visual regression snapshot tests for FilterSidebar [split 3/3]
  - REQ-096-11. Snapshot vs baseline (<=1% diff), mobile drawer, both positions
  - Blocked by: T-019
  - Blocks: T-064

- [ ] **T-021** (complexity: 2) - Create ErrorBanner component
  - REQ-096-12. 3 variants: error/warning/info with palette + icon + optional retry
  - Blocked by: none
  - Blocks: T-064

- [ ] **T-022** (complexity: 3) - Extract and generalize ImageGallery component
  - REQ-096-13. Extract from accommodation; add cover-plus-grid variant; visual regression test
  - Blocked by: none
  - Blocks: none

- [ ] **T-023** (complexity: 2) - Create MapPlaceholder component (interactive map deferred)
  - REQ-096-27. 'Ver en Google Maps' link; replace map areas in eventos + destinos pages
  - Blocked by: none
  - Blocks: T-064

---

### Navigation Phase

- [ ] **T-024** (complexity: 1) - Fix Footer broken link (propietarios path)
  - REQ-096-14. Change /propietarios/ to suscriptores/propietarios in Footer.astro:35
  - Blocked by: none
  - Blocks: T-025, T-062

- [ ] **T-025** (complexity: 3) - Redesign Footer to 5-column layout with Categorias and search link
  - REQ-096-15. 5 columns + static Categorias + mobile accordion
  - Blocked by: T-024
  - Blocks: T-062

- [ ] **T-026** (complexity: 3) - Create UserMenu React island for Header
  - REQ-096-16. client:load; unauth=Iniciar sesion; auth=avatar+dropdown with 6 items
  - Blocked by: T-015
  - Blocks: T-027, T-062

- [ ] **T-027** (complexity: 3) - Redesign Header with Publicar CTA and integrate UserMenu
  - REQ-096-16. Publicar visible all widths; hamburger on mobile; Mi cuenta in open hamburger
  - Blocked by: T-026
  - Blocks: T-062

- [ ] **T-028** (complexity: 2) - Create TagChips component for listing pages
  - REQ-096-17. Horizontal chip links; add to alojamientos/eventos/publicaciones listing
  - Blocked by: none
  - Blocks: T-062

- [ ] **T-029** (complexity: 2) - Add Breadcrumbs to accommodation pages (detail + type + amenity + feature sub-routes) [split 1/3]
  - REQ-096-19. 4 accommodation page types; each emits BreadcrumbList JSON-LD
  - Blocked by: T-015
  - Blocks: T-064, T-067

- [ ] **T-030** (complexity: 3) - Add Breadcrumbs to destination and attraction pages [split 2/3]
  - REQ-096-19. destinos/[...path] + 2 sub-routes; each emits BreadcrumbList JSON-LD
  - Blocked by: T-015
  - Blocks: T-064, T-067

- [ ] **T-031** (complexity: 2) - Add Breadcrumbs to event, post and author pages + JSON-LD integration tests [split 3/3]
  - REQ-096-19. 6 eventos + publicaciones page types; each emits BreadcrumbList JSON-LD
  - Blocked by: T-015
  - Blocks: T-064, T-067

- [ ] **T-034** (complexity: 2) - Create CategoryTiles section on homepage
  - REQ-096-18. Visual tiles; insert into index.astro
  - Blocked by: none
  - Blocks: T-062

---

### Account Phase

- [ ] **T-035** (complexity: 2) - Create ProfileEditForm component with Zod validation and pre-population [split 1/3]
  - REQ-096-20. Form component, ProfileEditSchema, PATCH submit, success toast
  - Blocked by: T-013, T-016
  - Blocks: T-036

- [ ] **T-036** (complexity: 3) - Implement avatar preview + upload on submit in ProfileEditForm [split 2/3]
  - REQ-096-20. File input, createObjectURL preview, Cloudinary upload on submit
  - Blocked by: T-035
  - Blocks: T-037

- [ ] **T-037** (complexity: 2) - Wire ProfileEditForm to /mi-cuenta/editar/ page + write tests [split 3/3]
  - REQ-096-20. Page wiring, auth guard, full test suite
  - Blocked by: T-036
  - Blocks: T-063

- [ ] **T-038** (complexity: 3) - Create UserFavoritesList React island for /mi-cuenta/favoritos/
  - REQ-096-21. 12/page; optimistic Quitar; EmptyState with CTA
  - Blocked by: T-016
  - Blocks: T-063

- [ ] **T-039** (complexity: 3) - Create UserReviewsList React island for /mi-cuenta/resenas/
  - REQ-096-22. 10/page; entity links; EmptyState; client:visible
  - Blocked by: T-016
  - Blocks: T-063

- [ ] **T-040** (complexity: 3) - Create PreferenceToggles React island for /mi-cuenta/preferencias/
  - REQ-096-23. Web-only fields; auto-save; CSS variable swap on theme change
  - Blocked by: T-011, T-012, T-032
  - Blocks: T-063

- [ ] **T-041** (complexity: 2) - Create SubscriptionDashboard layout with plan data display [split 1/3]
  - REQ-096-24. Parallel fetch subscription + plans, plan info + Actualizar plan link
  - Blocked by: none
  - Blocks: T-042

- [ ] **T-042** (complexity: 3) - Implement cancel modal + Descargar factura button in SubscriptionDashboard [split 2/3]
  - REQ-096-24. Confirmation modal + DELETE call + error handling
  - Blocked by: T-041
  - Blocks: T-043

- [ ] **T-043** (complexity: 2) - Add role-conditional Mas opciones + write SubscriptionDashboard tests [split 3/3]
  - REQ-096-24. HOST shows admin link; USER does not; full test suite
  - Blocked by: T-042
  - Blocks: T-063

---

### Polish Phase

- [ ] **T-044** (complexity: 2) - Make /publicaciones/autor/[slug]/ page functional using user-by-slug endpoint
  - REQ-096-28. SSR calls user-by-slug; 404 on miss; re-enable author links in post cards
  - Blocked by: T-006
  - Blocks: none

- [ ] **T-045** (complexity: 2) - Add real counts to /destinos/[...path]/ sidebar
  - REQ-096-25. Parallel Promise.all for counts; pageSize=0 mode
  - Blocked by: none
  - Blocks: none

- [ ] **T-046** (complexity: 2) - Create /busqueda/ SSR shell with grouped result rendering [split 1/3]
  - REQ-096-29. Static SSR grouped results, noindex, popular tags fallback
  - Blocked by: T-010
  - Blocks: T-047

- [ ] **T-047** (complexity: 3) - Create SearchResults island with debounced live filtering [split 2/3]
  - REQ-096-29. 300ms debounce, live API calls, in-place grouped result updates
  - Blocked by: T-046
  - Blocks: T-048

- [ ] **T-048** (complexity: 2) - Write full /busqueda/ page integration tests [split 3/3]
  - REQ-096-29. noindex, Ver todos links, debounce, empty state, zero results
  - Blocked by: T-047
  - Blocks: T-064

- [ ] **T-049** (complexity: 3) - Create ContactForm React island and wire to /contacto/ page
  - REQ-096-30. Conditional accommodationId field; honeypot; success state; rate limit error
  - Blocked by: T-014, T-016, T-033
  - Blocks: T-064

- [ ] **T-050** (complexity: 2) - Add ShareButtons to event and post detail pages
  - REQ-096-26. Replace share placeholders in eventos/[slug] and publicaciones/[slug]
  - Blocked by: T-017
  - Blocks: none

---

### Marketing/Legal Polish Phase

- [ ] **T-051** (complexity: 2) - Add AboutPage JSON-LD to /nosotros/ and /beneficios/
  - REQ-096-40. @type='AboutPage' with Organization mainEntity
  - Blocked by: none
  - Blocks: T-064, T-067

- [ ] **T-052** (complexity: 2) - Add PriceSpecification JSON-LD to pricing pages
  - REQ-096-41. Offer + PriceSpecification per plan from ALL_PLANS
  - Blocked by: none
  - Blocks: T-064, T-067

- [ ] **T-053** (complexity: 2) - Add FAQPage JSON-LD to legal pages
  - REQ-096-42. sections array -> Q/A pairs; fallback to Article
  - Blocked by: none
  - Blocks: T-064, T-067

- [ ] **T-054** (complexity: 2) - Add EmptyState fallback to pricing pages when plan data unavailable
  - REQ-096-43. Conditional rendering; CTA to /contacto/
  - Blocked by: T-016
  - Blocks: none

---

### Cross-App Phase

- [ ] **T-055** (complexity: 3) - Convert admin profile page to editable form
  - REQ-096-31. react-hook-form + ProfileEditSchema; PATCH to admin route
  - Blocked by: T-013
  - Blocks: none

- [ ] **T-056** (complexity: 2) - Adapt admin settings page to 4-field theme/language schema
  - REQ-096-32. Web/Admin sections; remove legacy fields; update useUpdateUserSettings hook
  - Blocked by: T-011, T-012
  - Blocks: none

---

### Infrastructure Phase

- [ ] **T-057** (complexity: 2) - Fix ISR exclude regex in astro.config.mjs
  - REQ-096-33. Single consolidated regex for auth/mi-cuenta/busqueda/feedback x 3 locales
  - Blocked by: none
  - Blocks: none

- [ ] **T-058** (complexity: 3) - Create dynamic sitemap endpoint (sitemap-dynamic.xml)
  - REQ-096-34. Parallel fetch all 4 entity types; 3 locale URLs per entity; 24h ISR cache
  - Blocked by: none
  - Blocks: T-059

- [ ] **T-059** (complexity: 1) - Integrate dynamic sitemap into astro.config.mjs sitemap plugin
  - REQ-096-34. Add customPages entry; verify sitemap-index.xml lists both sitemaps
  - Blocked by: T-058
  - Blocks: none

- [ ] **T-060** (complexity: 2) - Fix entity path mapper enum slugs (accommodation types + event categories)
  - REQ-096-35. Exactly 10 accommodation types, exactly 9 event categories per enums
  - Blocked by: none
  - Blocks: T-061

- [ ] **T-061** (complexity: 3) - Extend entity path mapper with amenity, feature, author, attraction revalidation paths
  - REQ-096-35. New revalidation paths for 4 entity types
  - Blocked by: T-060
  - Blocks: none

---

### i18n Phase

- [ ] **T-062** (complexity: 2) - Add i18n keys for navigation components (Header, Footer, TagChips, CategoryTiles, UserMenu)
  - REQ-096-36. All navigation component strings in es/en/pt
  - Blocked by: T-024, T-025, T-026, T-027, T-028, T-034
  - Blocks: T-065

- [ ] **T-063** (complexity: 2) - Add i18n keys for account islands
  - REQ-096-36. Profile, Favorites, Reviews, Preferences, Subscription strings in es/en/pt
  - Blocked by: T-037, T-038, T-039, T-040, T-043
  - Blocks: T-065

- [ ] **T-064** (complexity: 2) - Add i18n keys for shared components and polish/marketing pages
  - REQ-096-36. Breadcrumbs, EmptyState, ErrorBanner, ShareButtons, MapPlaceholder, ContactForm, SearchResults keys
  - Blocked by: T-015, T-016, T-017, T-020, T-021, T-023, T-029, T-030, T-031, T-048, T-049, T-051, T-052, T-053
  - Blocks: T-065

- [ ] **T-065** (complexity: 2) - Extend i18n-check CI to enforce all new web namespaces
  - REQ-096-36. Verify exit non-zero on missing key
  - Blocked by: T-062, T-063, T-064
  - Blocks: T-066, T-067, T-068

---

### SEO + Performance Phase

- [ ] **T-066** (complexity: 2) - Run Rich Results Test on 1 representative page per entity type [split 1/3]
  - REQ-096-37. Audit and document all JSON-LD gaps per entity type
  - Blocked by: T-065
  - Blocks: T-067

- [ ] **T-067** (complexity: 3) - Fix accommodation, event, post and destination JSON-LD gaps [split 2/3]
  - REQ-096-37. Hotel/Hostel/Motel etc type mapping; Event eventStatus; BlogPosting; TouristDestination
  - Blocked by: T-066, T-029, T-030, T-031, T-051, T-052, T-053
  - Blocks: T-068

- [ ] **T-068** (complexity: 2) - Audit BreadcrumbList and FAQPage JSON-LD integration across detail pages [split 3/3]
  - REQ-096-37. Verify BreadcrumbList on all 13 page types; FAQPage on legal pages
  - Blocked by: T-067
  - Blocks: T-069

- [ ] **T-069** (complexity: 3) - Run Lighthouse audit on 5 representative pages and document results
  - REQ-096-38. All 4 categories >= 80 on: homepage, listing, detail, mi-cuenta, contacto
  - Blocked by: T-068
  - Blocks: T-070

---

### E2E Delegation Phase

- [ ] **T-070** (complexity: 2) - Add E2E test definitions to SPEC-092 task tracker
  - REQ-096-39. 10 E2E test specs added to SPEC-092 state as pending tasks
  - Blocked by: T-069
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no blockers):
  T-001, T-003, T-006, T-007, T-011, T-013, T-014, T-015, T-016, T-017,
  T-018, T-021, T-022, T-023, T-024, T-028, T-034, T-041, T-045, T-051,
  T-052, T-053, T-057, T-058, T-060

Level 1:
  T-002 (<- T-001)
  T-004 (<- T-003)
  T-008 (<- T-007)
  T-012 (<- T-011)
  T-019 (<- T-018)
  T-025 (<- T-024)
  T-026 (<- T-015)
  T-029, T-030, T-031 (<- T-015)
  T-032 (<- T-011)
  T-033 (<- T-014)
  T-035 (<- T-013, T-016)
  T-038, T-039 (<- T-016)
  T-042 (<- T-041)
  T-054 (<- T-016)
  T-055 (<- T-013)
  T-056 (<- T-011, T-012)
  T-059 (<- T-058)
  T-061 (<- T-060)

Level 2:
  T-005 (<- T-003, T-004)
  T-009 (<- T-008)
  T-020 (<- T-019)
  T-027 (<- T-026)
  T-036 (<- T-035)
  T-040 (<- T-011, T-012, T-032)
  T-043 (<- T-042)
  T-044 (<- T-006)
  T-049 (<- T-014, T-016, T-033)

Level 3:
  T-010 (<- T-009)
  T-037 (<- T-036)
  T-062 (<- T-024..T-028, T-034)

Level 4:
  T-046 (<- T-010)
  T-063 (<- T-037, T-038, T-039, T-040, T-043)
  T-064 (<- T-015..T-017, T-020..T-023, T-029..T-031, T-048..T-049, T-051..T-053)

Level 5:
  T-047 (<- T-046)

Level 6:
  T-048 (<- T-047)

Level 7:
  T-065 (<- T-062, T-063, T-064)

Level 8:
  T-066 (<- T-065)
  T-067 (<- T-066, T-029..T-031, T-051..T-053)

Level 9:
  T-068 (<- T-067)

Level 10:
  T-069 (<- T-068)

Level 11:
  T-070 (<- T-069)
```

## Parallel Tracks

```
Track A — Backend Prereqs:
  T-001 -> T-002
  T-003 -> T-004 -> T-005
  T-006 -> T-044
  T-007 -> T-008 -> T-009 -> T-010 -> T-046 -> T-047 -> T-048

Track B — Schemas:
  T-011 -> T-012 -> T-040
  T-011 -> T-032 -> T-040
  T-013 -> T-035 -> T-036 -> T-037
  T-014 -> T-033 -> T-049

Track C — Shared Components (all start day 1):
  T-015 -> T-026 -> T-027
  T-015 -> T-029, T-030, T-031
  T-016 -> T-038, T-039
  T-017 -> T-050
  T-018 -> T-019 -> T-020
  T-021, T-022, T-023 (all independent)

Track D — Navigation (parallel to Track C):
  T-024 -> T-025
  T-028, T-034 (independent)
  T-041 -> T-042 -> T-043

Track E — Infrastructure (independent of UI):
  T-057 (independent)
  T-058 -> T-059
  T-060 -> T-061

Track F — Marketing/Legal JSON-LD (independent):
  T-051, T-052, T-053 (all independent)
  T-054 (needs T-016)

Merge point -> i18n: T-062 + T-063 + T-064 -> T-065 -> T-066 -> T-067 -> T-068 -> T-069 -> T-070
```

## Critical Path

T-007 -> T-008 -> T-009 -> T-010 -> T-046 -> T-047 -> T-048 -> T-064 -> T-065 -> T-066 -> T-067 -> T-068 -> T-069 -> T-070

**Longest sequential chain: 14 steps** (was 9 before split — the /busqueda/ + JSON-LD audit chains extend it)

Note: T-064 is also blocked by T-015, T-029, T-030, T-031, T-049, T-051, T-052, T-053 — so in practice the critical path runs through whichever of those finishes last.

## Suggested Start

Begin with these tasks in parallel (all have no dependencies):

- **T-003** (complexity: 3) - destinationId FK migration — critical path enabler
- **T-007** (complexity: 2) - Search schemas — unblocks T-008..T-010 chain
- **T-011** (complexity: 2) - User settings schema — unblocks T-012, T-032, T-040, T-056
- **T-013** (complexity: 2) - ProfileEditSchema — unblocks T-035 and T-055
- **T-014** (complexity: 2) - ContactSubmitSchema — unblocks T-033, T-049
- **T-015** (complexity: 3) - Breadcrumbs — unblocks T-026, T-029, T-030, T-031
- **T-016** (complexity: 2) - EmptyState — unblocks 8 tasks
- **T-018** (complexity: 1) - FilterSidebar baseline — fastest win
- **T-024** (complexity: 1) - Fix Footer link — fastest win, complexity 1
- **T-041** (complexity: 2) - SubscriptionDashboard layout — no blocker, starts account track

Recommend starting with **T-024** and **T-018** (both complexity 1) for immediate quick wins, and **T-003** + **T-007** for critical path.
