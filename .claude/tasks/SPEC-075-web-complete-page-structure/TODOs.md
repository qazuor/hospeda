# SPEC-075: Web App Complete Page Structure (ARCHIVED — merged into SPEC-096)

> **Status**: ARCHIVED 2026-04-29. All 66 tasks resolved: 38 verified complete in code, 26 absorbed into SPEC-096 and shipped, 2 deferred to v1.1. See `MERGE_NOTE.md` and SPEC-096 Appendix A for the full mapping.

## Progress: 66/66 tasks (100%) — closed via SPEC-096

**Average Complexity:** 2.9/4
**Critical Path:** T-019 (FilterSidebar) -> T-026 (Accommodations listing) -> T-060 (Pagination)
**Parallel Tracks:** 6 identified (accommodations, destinations, events, posts, account, marketing)

---

### Setup Phase (12 tasks)

- [x] **T-001** (complexity: 2) - Create ErrorLayout
- [x] **T-002** (complexity: 2) - Create DefaultLayout
- [x] **T-003** (complexity: 3) - Create ListingLayout
- [x] **T-004** (complexity: 3) - Create DetailLayout
- [x] **T-005** (complexity: 3) - Create AccountLayout
- [x] **T-006** (complexity: 2) - Create MarketingLayout
- [x] **T-007** (complexity: 3) - Create LegalLayout
- [x] **T-008** (complexity: 2) - Create AuthLayout
- [x] **T-009** (complexity: 2) - Migrate error pages to ErrorLayout
- [x] **T-010** (complexity: 2) - Migrate homepage to DefaultLayout
- [x] **T-011** (complexity: 2) - Migrate auth pages to AuthLayout
- [x] **T-012** (complexity: 2) - Migrate mi-cuenta to AccountLayout

### Prerequisites Phase (5 tasks)

- [x] **T-013** (complexity: 2) - Fix ISR exclude regex
- [x] **T-014** (complexity: 4) - Add amenity/feature JOIN filtering
- [x] **T-015** (complexity: 4) - Add destinationId FK to events
- [x] **T-016** (complexity: 3) - Create user-by-slug endpoint
- [x] **T-017** (complexity: 4) - Create global search endpoint

### Shared Components Phase (8 tasks)

- [x] **T-018** (complexity: 2) - Create Breadcrumbs component
- [x] **T-019** (complexity: 4) - Create FilterSidebar component
- [x] **T-020** (complexity: 2) - Create EmptyState component
- [x] **T-021** (complexity: 4) - Create ImageGallery component
- [x] **T-022** (complexity: 3) - Create MapView island
- [x] **T-023** (complexity: 3) - Create ReviewListIsland
- [x] **T-024** (complexity: 2) - Create ErrorBanner component
- [x] **T-025** (complexity: 2) - Create listing page header component

### Core Accommodations (5 tasks)

- [x] **T-026** (complexity: 4) - Accommodations listing page
- [x] **T-027** (complexity: 4) - Accommodation detail page
- [x] **T-028** (complexity: 3) - Accommodations by type
- [x] **T-029** (complexity: 3) - Accommodations by amenity (blocked by T-014)
- [x] **T-030** (complexity: 3) - Accommodations by feature

### Core Destinations (5 tasks)

- [x] **T-031** (complexity: 3) - Destinations listing page
- [x] **T-032** (complexity: 4) - Destination detail page
- [x] **T-033** (complexity: 3) - Accommodations within destination
- [x] **T-034** (complexity: 3) - Events within destination (blocked by T-015)
- [x] **T-035** (complexity: 3) - Destinations by attraction

### Core Events (4 tasks)

- [x] **T-036** (complexity: 4) - Events listing page
- [x] **T-037** (complexity: 4) - Event detail page
- [x] **T-038** (complexity: 3) - Events by category
- [x] **T-039** (complexity: 3) - Events by location

### Core Posts (5 tasks)

- [x] **T-040** (complexity: 4) - Posts listing page
- [x] **T-041** (complexity: 4) - Post detail page
- [x] **T-042** (complexity: 3) - Posts by category
- [x] **T-043** (complexity: 3) - Posts by tag
- [x] **T-044** (complexity: 3) - Posts by author (blocked by T-016)

### Content Phase (6 tasks)

- [x] **T-045** (complexity: 4) - Global search page (blocked by T-017)
- [x] **T-046** (complexity: 3) - Contact page
- [x] **T-047** (complexity: 2) - About us page
- [x] **T-048** (complexity: 2) - Privacy policy page
- [x] **T-049** (complexity: 2) - Terms and conditions page
- [x] **T-050** (complexity: 4) - Feedback page

### Account Phase (5 tasks)

- [x] **T-051** (complexity: 3) - Edit profile page
- [x] **T-052** (complexity: 3) - Favorites page
- [x] **T-053** (complexity: 3) - Reviews page
- [x] **T-054** (complexity: 3) - Subscription page
- [x] **T-055** (complexity: 3) - Preferences page

### Marketing Phase (4 tasks)

- [x] **T-056** (complexity: 3) - Property owners landing
- [x] **T-057** (complexity: 2) - Benefits page
- [x] **T-058** (complexity: 3) - Tourist pricing page
- [x] **T-059** (complexity: 3) - Owner pricing page

### Infrastructure Phase (7 tasks)

- [x] **T-060** (complexity: 2) - Pagination rewrite files - accommodations
- [x] **T-061** (complexity: 2) - Pagination rewrite files - destinations
- [x] **T-062** (complexity: 2) - Pagination rewrite files - events
- [x] **T-063** (complexity: 2) - Pagination rewrite files - posts
- [x] **T-064** (complexity: 3) - Update entity path mapper
- [x] **T-065** (complexity: 3) - Update header/footer navigation
- [x] **T-066** (complexity: 3) - Dynamic sitemap endpoint

---

## Suggested Next

After completing setup migrations (T-009 to T-012), start:
- **Shared components** (T-018 to T-025) — unblock all page tasks
- **Prerequisites** (T-013 to T-017) — unblock blocked pages
- **Infrastructure** (T-060 to T-066) — can run in parallel
