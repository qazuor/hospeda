# SPEC-030: Web Pages Migration (web-old to web)

## Progress: 124/124 tasks (100%)

> **Note:** All tasks were marked completed in state.json. See audit-report-v3.md for remaining gaps (overlay tokens, test coverage, documentation).

**Average Complexity:** 2.4
**Critical Path:** T-001 -> T-005 -> T-066 -> T-068 -> T-070 -> T-071 -> T-107 -> T-108 (8 levels deep)
**Parallel Tracks:** 6 independent tracks after setup (accommodations, destinations, events, blog, account, marketing/legal)

---

### Setup Phase (5 tasks)

- [ ] **T-001** (complexity: 2) - Verify infrastructure readiness for migration
  - Verify all prerequisite infrastructure exists in apps/web before starting migration. Check: (1) All shared...
  - Blocked by: none
  - Blocks: T-003, T-005, T-007, T-013, T-015 (+22 more)

- [ ] **T-002** (complexity: 2) - Verify and port CSS animation classes
  - Check if apps/web/src/styles/global.css already contains the scroll-reveal animation classes from web-old...
  - Blocked by: none
  - Blocks: T-003, T-005, T-013, T-015, T-017 (+23 more)

- [ ] **T-109** (complexity: 2) - Create useTranslation hook for React islands
  - Create src/hooks/useTranslation.ts as a wrapper hook over createT/createTranslations from src/lib/i18n.ts...
  - Blocked by: T-001
  - Blocks: T-008, T-009, T-010, T-011, T-013 (+16 more)

- [ ] **T-110** (complexity: 2) - Create apps/web/CLAUDE.md
  - Create apps/web/CLAUDE.md adapted for the new web app. Base on web-old/CLAUDE.md but update for new archi...
  - Blocked by: none
  - Blocks: none

- [ ] **T-111** (complexity: 1) - Verify and enable experimental.serverIslands in astro.config
  - Verify that apps/web/astro.config.mjs has experimental.serverIslands: true enabled. This is required for ...
  - Blocked by: none
  - Blocks: T-015, T-019

---

### Core Phase - Infrastructure Components (48 tasks)

- [ ] **T-003** (complexity: 3) - Evaluate and port Pagination.astro
  - Evaluate web-old/src/components/ui/Pagination.astro (181 lines) and port to web/src/components/shared/Pag...
  - Blocked by: T-001, T-002
  - Blocks: T-004, T-058, T-066, T-072, T-078 (+1 more)

- [ ] **T-004** (complexity: 2) - Write Pagination.astro unit tests
  - Write unit tests for Pagination.astro at web/test/components/shared/pagination.test.ts. Test: ellipsis lo...
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-005** (complexity: 2) - Evaluate and port Breadcrumb.astro
  - Evaluate web-old/src/components/ui/Breadcrumb.astro and port to web/src/components/shared/Breadcrumb.astr...
  - Blocked by: T-001, T-002
  - Blocks: T-006, T-058, T-060, T-066, T-068 (+11 more)

- [ ] **T-006** (complexity: 2) - Write Breadcrumb.astro unit tests
  - Write unit tests for Breadcrumb.astro at web/test/components/shared/breadcrumb.test.ts. Test: renders wit...
  - Blocked by: T-005
  - Blocks: none

- [ ] **T-007** (complexity: 2) - Port filter-sidebar.types.ts with destination data fix
  - Port web-old/src/components/accommodation/filter-sidebar.types.ts to web/src/components/accommodation/fil...
  - Blocked by: T-001
  - Blocks: T-008, T-009, T-010, T-011

- [ ] **T-008** (complexity: 3) - Evaluate and port FilterSection.client.tsx
  - Evaluate web-old/src/components/accommodation/FilterSection.client.tsx and port to web/src/components/acco...
  - Blocked by: T-007, T-109
  - Blocks: T-011

- [ ] **T-009** (complexity: 3) - Evaluate and port PriceRangeFilter.client.tsx
  - Evaluate web-old/src/components/accommodation/PriceRangeFilter.client.tsx and port to web/src/components/a...
  - Blocked by: T-007, T-109
  - Blocks: T-011

- [ ] **T-010** (complexity: 2) - Evaluate and port ActiveFilterChips.client.tsx
  - Evaluate web-old/src/components/accommodation/ActiveFilterChips.client.tsx and port. Sub-component of Filt...
  - Blocked by: T-007, T-109
  - Blocks: T-011

- [ ] **T-011** (complexity: 4) - Evaluate and port FilterSidebar.client.tsx
  - Evaluate web-old/src/components/accommodation/FilterSidebar.client.tsx (385 lines, complex) and port. Mai...
  - Blocked by: T-007, T-008, T-009, T-010
  - Blocks: T-012, T-058

- [ ] **T-012** (complexity: 3) - Write FilterSidebar system tests
  - Write tests for FilterSidebar system at web/test/components/accommodation/filter-sidebar.test.tsx. Port an...
  - Blocked by: T-011
  - Blocks: none

- [ ] **T-013** (complexity: 3) - Evaluate and port ImageGallery.client.tsx
  - Evaluate web-old/src/components/ui/ImageGallery.client.tsx (281 lines) and port to web/src/components/shar...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-014, T-060, T-068

- [ ] **T-014** (complexity: 2) - Write ImageGallery tests
  - Write tests at web/test/components/shared/image-gallery.test.tsx. Test: renders main image, thumbnails, th...
  - Blocked by: T-013
  - Blocks: none

- [ ] **T-015** (complexity: 4) - Evaluate and port FavoriteButton system
  - Evaluate and port web-old FavoriteButton.client.tsx (285 lines) + FavoriteButtonIsland.astro to web/src/co...
  - Blocked by: T-001, T-002, T-109, T-111
  - Blocks: T-016, T-060, T-068

- [ ] **T-016** (complexity: 3) - Write FavoriteButton system tests
  - Write tests at web/test/components/shared/favorite-button.test.tsx. Test: renders heart icon, toggle state...
  - Blocked by: T-015
  - Blocks: none

- [ ] **T-017** (complexity: 2) - Evaluate and port ShareButtons.client.tsx
  - Evaluate web-old ShareButtons.client.tsx (219 lines) and port to web/src/components/shared/. Features: Nat...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-018, T-060, T-068, T-074, T-080

- [ ] **T-018** (complexity: 2) - Write ShareButtons tests
  - Write tests at web/test/components/shared/share-buttons.test.tsx. Test: renders share buttons, copy to cli...
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-019** (complexity: 3) - Evaluate and port ReviewList.client.tsx + ReviewListIsland.astro
  - Evaluate web-old ReviewList.client.tsx (314 lines) + ReviewListIsland.astro and port to web/src/components...
  - Blocked by: T-001, T-002, T-109, T-111
  - Blocks: T-020, T-021, T-060

- [ ] **T-020** (complexity: 3) - Evaluate and port ReviewForm.client.tsx
  - Evaluate web-old ReviewForm.client.tsx (323 lines) and port to web/src/components/review/. Decision: React...
  - Blocked by: T-019
  - Blocks: T-021, T-060

- [ ] **T-021** (complexity: 3) - Write Review system tests
  - Write tests for ReviewList and ReviewForm at web/test/components/review/. Test ReviewList: renders cards, p...
  - Blocked by: T-019, T-020
  - Blocks: none

- [ ] **T-022** (complexity: 2) - Evaluate and port SearchBar.client.tsx
  - Evaluate web-old SearchBar.client.tsx (183 lines) and port to web/src/components/search/. Simple: text inp...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-023, T-092

- [ ] **T-023** (complexity: 2) - Write SearchBar tests
  - Write tests at web/test/components/search/search-bar.test.tsx. Test: renders input, debounce (300ms), clea...
  - Blocked by: T-022
  - Blocks: none

- [ ] **T-024** (complexity: 2) - Evaluate and port SortDropdown.astro
  - Evaluate web-old SortDropdown.astro and port to web/src/components/shared/. Server-rendered dropdown for s...
  - Blocked by: T-001, T-002
  - Blocks: T-025, T-058

- [ ] **T-025** (complexity: 2) - Write SortDropdown tests
  - Write tests at web/test/components/shared/sort-dropdown.test.ts. Test: renders sort options, correct values...
  - Blocked by: T-024
  - Blocks: none

- [ ] **T-026** (complexity: 2) - Evaluate and port ImageCarousel.client.tsx
  - Evaluate web-old ImageCarousel.client.tsx (189 lines) and port to web/src/components/shared/. CSS scroll-s...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-027, T-058

- [ ] **T-027** (complexity: 2) - Write ImageCarousel tests
  - Write tests at web/test/components/shared/image-carousel.test.tsx. Test: renders images, scroll-snap conta...
  - Blocked by: T-026
  - Blocks: none

- [ ] **T-028** (complexity: 2) - Evaluate and port AmenitiesList.astro
  - Evaluate web-old AmenitiesList.astro and port to web/src/components/shared/. Update color tokens. Check if...
  - Blocked by: T-001, T-002
  - Blocks: T-029, T-060

- [ ] **T-029** (complexity: 2) - Write AmenitiesList tests
  - Write tests at web/test/components/shared/amenities-list.test.ts. Port existing tests from web-old. Test: ...
  - Blocked by: T-028
  - Blocks: none

- [ ] **T-030** (complexity: 3) - Evaluate and port AccordionFAQ component
  - Evaluate web-old AccordionFAQ.client.tsx. Decide: (1) Copy+adapt React, or (2) Rewrite with native <detai...
  - Blocked by: T-001, T-002
  - Blocks: T-031, T-060, T-101

- [ ] **T-031** (complexity: 2) - Write AccordionFAQ tests
  - Write tests at web/test/components/shared/accordion-faq.test.ts(x). Test: renders question/answer pairs, t...
  - Blocked by: T-030
  - Blocks: none

- [ ] **T-032** (complexity: 2) - Evaluate and port MapView.client.tsx placeholder
  - Evaluate web-old MapView.client.tsx (205 lines) and port to web/src/components/shared/. This is a PLACEHO...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-033, T-060, T-068

- [ ] **T-033** (complexity: 2) - Write MapView tests
  - Write tests at web/test/components/shared/map-view.test.tsx. Port existing tests. Test: renders placeholde...
  - Blocked by: T-032
  - Blocks: none

- [ ] **T-034** (complexity: 3) - Evaluate and port CalendarView.client.tsx
  - Copy and adapt web-old CalendarView.client.tsx (430 lines). Custom monthly calendar marking event dates (N...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-035, T-074

- [ ] **T-035** (complexity: 3) - Write CalendarView tests
  - Write tests at web/test/components/event/calendar-view.test.tsx. Port existing tests. Test: renders curren...
  - Blocked by: T-034
  - Blocks: none

- [ ] **T-036** (complexity: 3) - Evaluate and port DestinationFilters.client.tsx
  - Evaluate web-old DestinationFilters.client.tsx and port to web/src/components/destination/. Update: useTra...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-037, T-066

- [ ] **T-037** (complexity: 2) - Write DestinationFilters tests
  - Write tests at web/test/components/destination/destination-filters.test.tsx. Port existing tests. Test: ren...
  - Blocked by: T-036
  - Blocks: none

- [ ] **T-038** (complexity: 2) - Port LitoralMap.astro
  - Port web-old LitoralMap.astro to web/src/components/destination/. Simple SVG map component. Update: color ...
  - Blocked by: T-001, T-002
  - Blocks: T-039, T-066

- [ ] **T-039** (complexity: 2) - Write LitoralMap tests
  - Write tests at web/test/components/destination/litoral-map.test.ts. Port existing tests. Test: renders SVG...
  - Blocked by: T-038
  - Blocks: none

- [ ] **T-040** (complexity: 3) - Evaluate and port ContactForm.client.tsx
  - Evaluate web-old ContactForm.client.tsx and port to web/src/components/content/. Decision: rewrite with RH...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-041, T-094

- [ ] **T-041** (complexity: 2) - Write ContactForm tests
  - Write tests at web/test/components/content/contact-form.test.tsx. Port existing tests. Test: renders field...
  - Blocked by: T-040
  - Blocks: none

- [ ] **T-042** (complexity: 2) - Evaluate and port PricingCard.astro
  - Evaluate web-old PricingCard.astro and port to web/src/components/shared/. Update: color tokens, use Gradi...
  - Blocked by: T-001, T-002
  - Blocks: T-043, T-096

- [ ] **T-043** (complexity: 2) - Write PricingCard tests
  - Write tests at web/test/components/shared/pricing-card.test.ts. Port existing tests. Test: renders plan na...
  - Blocked by: T-042
  - Blocks: none

- [ ] **T-044** (complexity: 3) - Evaluate and port ProfileEditForm.client.tsx
  - Evaluate web-old ProfileEditForm.client.tsx (~200 lines) and port to web/src/components/account/. Update: ...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-052, T-086

- [ ] **T-045** (complexity: 2) - Evaluate and port PreferenceToggles.client.tsx
  - Evaluate web-old PreferenceToggles.client.tsx (~150 lines) and port to web/src/components/account/. Featur...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-052, T-088

- [ ] **T-046** (complexity: 3) - Evaluate and port UserFavoritesList.client.tsx
  - Evaluate web-old UserFavoritesList.client.tsx (~250 lines) and port. Features: favorites list with tabs, p...
  - Blocked by: T-001, T-002, T-109, T-114
  - Blocks: T-053, T-087

- [ ] **T-047** (complexity: 3) - Evaluate and port UserReviewsList + ReviewEditForm
  - Evaluate web-old UserReviewsList.client.tsx (~250 lines) and ReviewEditForm.client.tsx (~200 lines) and po...
  - Blocked by: T-001, T-002, T-109, T-114
  - Blocks: T-053, T-090

- [ ] **T-048** (complexity: 3) - Evaluate and port SubscriptionDashboard + SubscriptionCard
  - Evaluate web-old SubscriptionDashboard.client.tsx (~300 lines) and SubscriptionCard.client.tsx (~150 lines...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-049, T-054, T-089

- [ ] **T-049** (complexity: 3) - Evaluate and port CancelSubscriptionDialog + ChangePlanDialog
  - Evaluate web-old CancelSubscriptionDialog.client.tsx (~100 lines) and ChangePlanDialog.client.tsx (~150 li...
  - Blocked by: T-048
  - Blocks: T-054, T-089

- [ ] **T-050** (complexity: 3) - Evaluate and port InvoiceHistory + PaymentHistory
  - Evaluate web-old InvoiceHistory.client.tsx (~200 lines) and PaymentHistory.client.tsx (~200 lines) and por...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-054, T-089

- [ ] **T-051** (complexity: 3) - Evaluate and port UsageOverview + ActiveAddons
  - Evaluate web-old UsageOverview.client.tsx (~150 lines) and ActiveAddons.client.tsx (~150 lines) and port. ...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-054, T-089

- [ ] **T-052** (complexity: 3) - Write account component tests (Profile, Preferences)
  - Write tests for ProfileEditForm and PreferenceToggles at web/test/components/account/. Port existing tests...
  - Blocked by: T-044, T-045
  - Blocks: none

- [ ] **T-053** (complexity: 3) - Write account component tests (Favorites, Reviews)
  - Write tests for UserFavoritesList and UserReviewsList at web/test/components/account/. Port existing tests....
  - Blocked by: T-046, T-047
  - Blocks: none

- [ ] **T-054** (complexity: 3) - Write account component tests (Subscription, Billing)
  - Write tests for SubscriptionDashboard, SubscriptionCard, CancelSubscriptionDialog, ChangePlanDialog, Invoi...
  - Blocked by: T-048, T-049, T-050, T-051
  - Blocks: none

- [ ] **T-112** (complexity: 2) - Port FilterChipsBar.client.tsx
  - Port web-old/src/components/accommodation/FilterChipsBar.client.tsx to web/src/components/accommodation/. ...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-058

- [ ] **T-113** (complexity: 1) - Port NavigationProgress.astro
  - Port web-old/src/components/ui/NavigationProgress.astro to web/src/components/shared/NavigationProgress.as...
  - Blocked by: T-001, T-002
  - Blocks: none

- [ ] **T-114** (complexity: 2) - Port Tabs.client.tsx
  - Port web-old/src/components/ui/Tabs.client.tsx to web/src/components/shared/Tabs.client.tsx. Needed for Ac...
  - Blocked by: T-001, T-002, T-109
  - Blocks: T-046, T-047

- [ ] **T-115** (complexity: 2) - Port DestinationCarousel.astro + utils
  - Port web-old/src/components/destination/DestinationCarousel.astro and destination-carousel.utils.ts to web...
  - Blocked by: T-001, T-002
  - Blocks: T-066

- [ ] **T-116** (complexity: 2) - Port DestinationPreview.astro + utils
  - Port web-old/src/components/destination/DestinationPreview.astro and destination-preview.utils.ts to web/s...
  - Blocked by: T-001, T-002
  - Blocks: T-068

- [ ] **T-117** (complexity: 2) - Port CounterAnimation.client.tsx + useCountUp hook
  - Port web-old/src/components/content/CounterAnimation.client.tsx and web-old/src/hooks/useCountUp.ts to web...
  - Blocked by: T-001, T-002
  - Blocks: T-099, T-100

- [ ] **T-118** (complexity: 3) - Create format-utils.ts utility
  - Create src/lib/format-utils.ts with generic formatting functions used across cards and pages: formatPrice(...
  - Blocked by: T-001
  - Blocks: none

---

### Integration Phase - Pages (63 tasks)

- [ ] **T-055** (complexity: 2) - Create 404 error page
  - Create web/src/pages/404.astro. Recreate (not port). SSR (no prerender) with locale detection from URL pat...
  - Blocked by: T-001, T-002
  - Blocks: T-057

- [ ] **T-056** (complexity: 2) - Create 500 error page
  - Create web/src/pages/500.astro. Same structure as 404 but with retry button (window.location.reload()). i1...
  - Blocked by: T-001, T-002
  - Blocks: T-057

- [ ] **T-057** (complexity: 2) - Write error pages tests
  - Write tests for 404 and 500 pages at web/test/pages/error-pages.test.ts. Port existing tests. Test: 404 r...
  - Blocked by: T-055, T-056
  - Blocks: T-107

- [ ] **T-058** (complexity: 4) - Create accommodation list page
  - Create web/src/pages/[lang]/alojamientos/index.astro. Copy+Adapt from web-old (271 lines). SSR (prerender...
  - Blocked by: T-003, T-005, T-011, T-024, T-026 (+1 more)
  - Blocks: T-059, T-062, T-063

- [ ] **T-059** (complexity: 3) - Write accommodation list page tests
  - Write tests at web/test/pages/accommodations/list.test.ts. Test: renders with mock data, filter applicatio...
  - Blocked by: T-058
  - Blocks: none

- [ ] **T-060** (complexity: 4) - Create accommodation detail page
  - Create web/src/pages/[lang]/alojamientos/[slug].astro. Copy+Adapt from web-old (310 lines). SSG with getS...
  - Blocked by: T-005, T-013, T-015, T-017, T-019 (+4 more)
  - Blocks: T-061

- [ ] **T-061** (complexity: 3) - Write accommodation detail page tests
  - Write tests at web/test/pages/accommodations/detail.test.ts. Test: renders with mock data, image gallery, ...
  - Blocked by: T-060
  - Blocks: none

- [ ] **T-062** (complexity: 2) - Create accommodation pagination page
  - Create web/src/pages/[lang]/alojamientos/page/[page].astro. Uses shared `_AccommodationListLayout.astro` p...
  - Blocked by: T-058
  - Blocks: T-064, T-065

- [ ] **T-063** (complexity: 2) - Create accommodation type filter page
  - Create web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro. Uses shared `_AccommodationListLayout.as...
  - Blocked by: T-058
  - Blocks: T-064, T-065

- [ ] **T-064** (complexity: 2) - Create accommodation type filter pagination
  - Create web/src/pages/[lang]/alojamientos/tipo/[type]/page/[page].astro. Uses shared `_AccommodationListLay...
  - Blocked by: T-062, T-063
  - Blocks: T-065

- [ ] **T-065** (complexity: 2) - Write accommodation variant pages tests
  - Write tests at web/test/pages/accommodations/variants.test.ts. Test: pagination extracts page param, type ...
  - Blocked by: T-062, T-063, T-064
  - Blocks: T-107

- [ ] **T-066** (complexity: 3) - Create destination list page
  - Create web/src/pages/[lang]/destinos/index.astro. Copy+Adapt from web-old (217 lines). SSG with getStatic...
  - Blocked by: T-003, T-005, T-036, T-038, T-115
  - Blocks: T-067, T-068, T-070

- [ ] **T-067** (complexity: 3) - Write destination list page tests
  - Write tests at web/test/pages/destinations/list.test.ts. Test: renders with mock data, filter interaction,...
  - Blocked by: T-066
  - Blocks: none

- [ ] **T-068** (complexity: 4) - Create destination detail page
  - Create web/src/pages/[lang]/destinos/[...path].astro. Copy+Adapt from web-old (459 lines, MOST COMPLEX). ...
  - Blocked by: T-005, T-013, T-015, T-017, T-032 (+2 more)
  - Blocks: T-069, T-070

- [ ] **T-069** (complexity: 3) - Write destination detail page tests
  - Write tests at web/test/pages/destinations/detail.test.ts. Test: renders with mock data, dynamic breadcrum...
  - Blocked by: T-068
  - Blocks: none

- [ ] **T-070** (complexity: 2) - Create destination pagination page
  - Create web/src/pages/[lang]/destinos/page/[page].astro. SSG with getStaticLocalePaths. Variant of destinat...
  - Blocked by: T-066, T-068
  - Blocks: T-071

- [ ] **T-071** (complexity: 2) - Write destination sub-pages tests
  - Write tests at web/test/pages/destinations/sub-pages.test.ts. Test: pagination, destination accommodation...
  - Blocked by: T-070, T-119, T-120
  - Blocks: T-107

- [ ] **T-072** (complexity: 3) - Create event list page
  - Create web/src/pages/[lang]/eventos/index.astro. Copy+Adapt from web-old (201 lines). SSR. Features: time...
  - Blocked by: T-003, T-005
  - Blocks: T-073, T-076

- [ ] **T-073** (complexity: 2) - Write event list page tests
  - Write tests at web/test/pages/events/list.test.ts. Test: renders with mock data, timeframe tabs, category...
  - Blocked by: T-072
  - Blocks: none

- [ ] **T-074** (complexity: 4) - Create event detail page
  - Create web/src/pages/[lang]/eventos/[slug].astro. Copy+Adapt from web-old (368 lines). SSG with getStatic...
  - Blocked by: T-005, T-017, T-034
  - Blocks: T-075, T-076

- [ ] **T-075** (complexity: 3) - Write event detail page tests
  - Write tests at web/test/pages/events/detail.test.ts. Test: renders with mock data, past event indicator, a...
  - Blocked by: T-074
  - Blocks: none

- [ ] **T-076** (complexity: 2) - Create event pagination page
  - Create web/src/pages/[lang]/eventos/page/[page].astro. SSR. Variant of event list (T-072) with page from ...
  - Blocked by: T-072, T-074
  - Blocks: T-077

- [ ] **T-077** (complexity: 2) - Write event variant pages tests
  - Write tests at web/test/pages/events/variants.test.ts. Test: pagination, category filter pre-applied, comb...
  - Blocked by: T-076, T-121, T-122
  - Blocks: T-107

- [ ] **T-078** (complexity: 3) - Create blog list page
  - Create web/src/pages/[lang]/publicaciones/index.astro. Copy+Adapt from web-old (268 lines). SSR. Features...
  - Blocked by: T-003, T-005
  - Blocks: T-079, T-082

- [ ] **T-079** (complexity: 2) - Write blog list page tests
  - Write tests at web/test/pages/blog/list.test.ts. Test: renders with mock data, featured post, category fil...
  - Blocked by: T-078
  - Blocks: none

- [ ] **T-080** (complexity: 3) - Create blog detail page
  - Create web/src/pages/[lang]/publicaciones/[slug].astro. Copy+Adapt from web-old (209 lines). SSG with get...
  - Blocked by: T-005, T-017
  - Blocks: T-081, T-082

- [ ] **T-081** (complexity: 3) - Write blog detail page tests
  - Write tests at web/test/pages/blog/detail.test.ts. Test: renders with mock data, TipTap content sanitized...
  - Blocked by: T-080
  - Blocks: none

- [ ] **T-082** (complexity: 2) - Create blog pagination page
  - Create web/src/pages/[lang]/publicaciones/page/[page].astro. SSR. Variant of blog list (T-078) with page ...
  - Blocked by: T-078
  - Blocks: T-083

- [ ] **T-083** (complexity: 2) - Write blog variant pages tests
  - Write tests at web/test/pages/blog/variants.test.ts. Test: pagination, tag filter, combined tag+pagination...
  - Blocked by: T-082, T-123, T-124
  - Blocks: T-107

- [ ] **T-084** (complexity: 3) - Create account dashboard page
  - Create web/src/pages/[lang]/mi-cuenta/index.astro. Copy+Adapt from web-old (315 lines). SSR, auth-guarded...
  - Blocked by: T-001, T-002, T-005
  - Blocks: T-085, T-086, T-087, T-088, T-089 (+1 more)

- [ ] **T-085** (complexity: 2) - Write account dashboard tests
  - Write tests at web/test/pages/account/dashboard.test.ts. Test: renders with user data, avatar initials, si...
  - Blocked by: T-084
  - Blocks: none

- [ ] **T-086** (complexity: 2) - Create edit profile page
  - Create web/src/pages/[lang]/mi-cuenta/editar.astro. Copy+Adapt from web-old (89 lines, thin wrapper). SSR...
  - Blocked by: T-044, T-084
  - Blocks: T-091

- [ ] **T-087** (complexity: 2) - Create favorites page
  - Create web/src/pages/[lang]/mi-cuenta/favoritos.astro. Copy+Adapt from web-old (66 lines). SSR, auth-guar...
  - Blocked by: T-046, T-084
  - Blocks: T-091

- [ ] **T-088** (complexity: 2) - Create preferences page
  - Create web/src/pages/[lang]/mi-cuenta/preferencias.astro. Copy+Adapt from web-old (133 lines). SSR, auth-...
  - Blocked by: T-045, T-084
  - Blocks: T-091

- [ ] **T-089** (complexity: 2) - Create subscription page
  - Create web/src/pages/[lang]/mi-cuenta/suscripcion.astro. Copy+Adapt from web-old (73 lines). SSR, auth-gu...
  - Blocked by: T-048, T-049, T-050, T-051, T-084
  - Blocks: T-091

- [ ] **T-090** (complexity: 2) - Create reviews page
  - Create web/src/pages/[lang]/mi-cuenta/resenas.astro. Copy+Adapt from web-old (66 lines). SSR, auth-guarde...
  - Blocked by: T-047, T-084
  - Blocks: T-091

- [ ] **T-091** (complexity: 3) - Write account sub-pages tests
  - Write tests at web/test/pages/account/sub-pages.test.ts. Test each page: renders with auth, sidebar nav, c...
  - Blocked by: T-086, T-087, T-088, T-089, T-090
  - Blocks: T-107

- [ ] **T-092** (complexity: 4) - Create search results page
  - Create web/src/pages/[lang]/busqueda.astro. Copy+Adapt from web-old (331 lines). SSR. Features: 4 APIs in...
  - Blocked by: T-005, T-022
  - Blocks: T-093

- [ ] **T-093** (complexity: 3) - Write search page tests
  - Write tests at web/test/pages/search.test.ts. Test: renders with results from 4 entities, empty state (no ...
  - Blocked by: T-092
  - Blocks: T-107

- [ ] **T-094** (complexity: 3) - Create contact page
  - Create web/src/pages/[lang]/contacto.astro. Recreate from web-old (167 lines). SSG (prerender=true). Two-c...
  - Blocked by: T-005, T-040
  - Blocks: T-095

- [ ] **T-095** (complexity: 2) - Write contact page tests
  - Write tests at web/test/pages/contact.test.ts. Test: two-column layout, contact form, email, social links,...
  - Blocked by: T-094
  - Blocks: T-107

- [ ] **T-096** (complexity: 3) - Create tourist pricing page
  - Create web/src/pages/[lang]/precios/turistas.astro. Recreate from web-old (156 lines). SSG. Plans via plan...
  - Blocked by: T-005, T-042
  - Blocks: T-097, T-098

- [ ] **T-097** (complexity: 2) - Create owner pricing page
  - Create web/src/pages/[lang]/precios/propietarios.astro. SSG (prerender=true). Same structure as tourist pri...
  - Blocked by: T-096
  - Blocks: T-098

- [ ] **T-098** (complexity: 2) - Write pricing pages tests
  - Write tests at web/test/pages/pricing.test.ts. Test: plan cards render, highlighted styling, FAQ, CTA link...
  - Blocked by: T-096, T-097
  - Blocks: T-107

- [ ] **T-099** (complexity: 3) - Create benefits page with CTA fix
  - Create web/src/pages/[lang]/beneficios.astro. Recreate from web-old (260 lines). SSG. 5 tourist + 5 owner...
  - Blocked by: T-005, T-117
  - Blocks: T-102

- [ ] **T-100** (complexity: 2) - Create about us page
  - Create web/src/pages/[lang]/quienes-somos.astro. Recreate from web-old (173 lines). SSG. Sections: Hero w...
  - Blocked by: T-005, T-117
  - Blocks: T-102

- [ ] **T-101** (complexity: 3) - Create owners landing page
  - Create web/src/pages/[lang]/propietarios/index.astro. Recreate from web-old (223 lines). SSG. Content from...
  - Blocked by: T-005, T-030
  - Blocks: T-102

- [ ] **T-102** (complexity: 3) - Write marketing pages tests
  - Write tests at web/test/pages/marketing/. Benefits: tourist/owner benefits, CTA links correct, icons. Abou...
  - Blocked by: T-099, T-100, T-101
  - Blocks: T-107

- [ ] **T-103** (complexity: 2) - Create privacy policy page
  - Create web/src/pages/[lang]/privacidad.astro. Minimal Adapt from web-old (149 lines). SSG. 7 sections hard...
  - Blocked by: T-001, T-002
  - Blocks: T-106

- [ ] **T-104** (complexity: 2) - Create terms and conditions page
  - Create web/src/pages/[lang]/terminos-condiciones.astro. Minimal Adapt from web-old. SSG (prerender=true). ...
  - Blocked by: T-001, T-002
  - Blocks: T-106

- [ ] **T-105** (complexity: 2) - Create sitemap page with link fixes
  - Create web/src/pages/[lang]/mapa-del-sitio.astro. Minimal Adapt from web-old (155 lines). SSG. 7 sections...
  - Blocked by: T-001, T-002
  - Blocks: T-106

- [ ] **T-106** (complexity: 2) - Write legal pages tests
  - Write tests at web/test/pages/legal/. Privacy: 7 sections, prose, last updated. Terms: same structure. Sit...
  - Blocked by: T-103, T-104, T-105
  - Blocks: T-107

- [ ] **T-119** (complexity: 2) - Create destination accommodations list page
  - Create web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro. SSR (dynamic destination slug parame...
  - Blocked by: T-066, T-068
  - Blocks: T-120, T-071

- [ ] **T-120** (complexity: 2) - Create destination accommodations pagination page
  - Create web/src/pages/[lang]/destinos/[slug]/alojamientos/page/[page].astro. SSR (dynamic destination slug ...
  - Blocked by: T-119
  - Blocks: T-071

- [ ] **T-121** (complexity: 2) - Create event category list page
  - Create web/src/pages/[lang]/eventos/categoria/[category]/index.astro. SSR. Variant of event list (T-072) w...
  - Blocked by: T-072, T-074
  - Blocks: T-122, T-077

- [ ] **T-122** (complexity: 2) - Create event category pagination page
  - Create web/src/pages/[lang]/eventos/categoria/[category]/page/[page].astro. SSR. Combines category filter ...
  - Blocked by: T-121
  - Blocks: T-077

- [ ] **T-123** (complexity: 2) - Create blog tag list page
  - Create web/src/pages/[lang]/publicaciones/etiqueta/[tag]/index.astro. SSR. Variant of blog list (T-078) wi...
  - Blocked by: T-078, T-080
  - Blocks: T-124, T-083

- [ ] **T-124** (complexity: 2) - Create blog tag pagination page
  - Create web/src/pages/[lang]/publicaciones/etiqueta/[tag]/page/[page].astro. SSR. Combines tag filter and p...
  - Blocked by: T-123
  - Blocks: T-083

---

### Testing Phase (2 tasks)

- [ ] **T-107** (complexity: 2) - Run full regression test suite
  - Run complete test suite for apps/web: pnpm typecheck, pnpm lint, pnpm test. Fix any failures. Ensure minim...
  - Blocked by: T-057, T-065, T-071, T-077, T-083 (+6 more)
  - Blocks: T-108

- [ ] **T-108** (complexity: 3) - Cross-viewport and dark mode visual verification
  - Visually verify ALL migrated pages using Playwright screenshots in 3 viewports (375px mobile, 768px tablet...
  - Blocked by: T-107
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no dependencies - 4 tasks):
  T-001, T-002, T-110, T-111

Level 1 (depends only on Level 0 - 20 tasks):
  T-003, T-005, T-007, T-024, T-028, T-030, T-038, T-042,
  T-055, T-056, T-084, T-103, T-104, T-105, T-109, T-113,
  T-115, T-116, T-117, T-118

Level 2 (depends on up to Level 1 - 19 tasks):
  T-004, T-006, T-008, T-009, T-010, T-013, T-015, T-017,
  T-019, T-022, T-025, T-026, T-029, T-032, T-034, T-036,
  T-039, T-040, T-043, T-044, T-045, T-048, T-050, T-051,
  T-057, T-072, T-078, T-106, T-112, T-114

Level 3 (depends on up to Level 2 - 20 tasks):
  T-011, T-014, T-016, T-018, T-020, T-023, T-027, T-031,
  T-033, T-035, T-037, T-041, T-046, T-047, T-049, T-052,
  T-066, T-074, T-080, T-085, T-092, T-094, T-096, T-099,
  T-100, T-101

Level 4 (depends on up to Level 3 - 16 tasks):
  T-012, T-021, T-053, T-054, T-058, T-060, T-067, T-068,
  T-073, T-075, T-076, T-079, T-081, T-082, T-086, T-087,
  T-088, T-090, T-093, T-095, T-097, T-102

Level 5 (depends on up to Level 4 - 10 tasks):
  T-059, T-061, T-062, T-063, T-069, T-070, T-089, T-091,
  T-098, T-119, T-121, T-123

Level 6 (depends on up to Level 5 - 6 tasks):
  T-064, T-120, T-122, T-124

Level 7 (depends on up to Level 6 - 4 tasks):
  T-065, T-071, T-077, T-083

Level 8 (depends on Level 7 - 1 task):
  T-107

Level 9 (depends on Level 8 - 1 task):
  T-108
```

---

## Suggested Start

Begin with the **4 Level-0 tasks** in parallel:

- **T-001** - Verify infrastructure readiness (critical.. blocks 27+ tasks)
- **T-002** - Verify and port CSS animation classes (critical.. blocks 28+ tasks)
- **T-110** - Create apps/web/CLAUDE.md (independent, no blockers or dependents)
- **T-111** - Verify experimental.serverIslands in astro config (quick, complexity 1, unblocks T-015 and T-019)

After those complete, prioritize **T-109** (useTranslation hook) as it unblocks 21 React island tasks.
