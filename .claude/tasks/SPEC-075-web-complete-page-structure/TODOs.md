# SPEC-075: Web App Complete Page Structure

## Progress: 8/66 tasks (12%)

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
- [ ] **T-009** (complexity: 2) - Migrate error pages to ErrorLayout
- [ ] **T-010** (complexity: 2) - Migrate homepage to DefaultLayout
- [ ] **T-011** (complexity: 2) - Migrate auth pages to AuthLayout
- [ ] **T-012** (complexity: 2) - Migrate mi-cuenta to AccountLayout

### Prerequisites Phase (5 tasks)

- [ ] **T-013** (complexity: 2) - Fix ISR exclude regex
- [ ] **T-014** (complexity: 4) - Add amenity/feature JOIN filtering
- [ ] **T-015** (complexity: 4) - Add destinationId FK to events
- [ ] **T-016** (complexity: 3) - Create user-by-slug endpoint
- [ ] **T-017** (complexity: 4) - Create global search endpoint

### Shared Components Phase (8 tasks)

- [ ] **T-018** (complexity: 2) - Create Breadcrumbs component
- [ ] **T-019** (complexity: 4) - Create FilterSidebar component
- [ ] **T-020** (complexity: 2) - Create EmptyState component
- [ ] **T-021** (complexity: 4) - Create ImageGallery component
- [ ] **T-022** (complexity: 3) - Create MapView island
- [ ] **T-023** (complexity: 3) - Create ReviewListIsland
- [ ] **T-024** (complexity: 2) - Create ErrorBanner component
- [ ] **T-025** (complexity: 2) - Create listing page header component

### Core Accommodations (5 tasks)

- [ ] **T-026** (complexity: 4) - Accommodations listing page
- [ ] **T-027** (complexity: 4) - Accommodation detail page
- [ ] **T-028** (complexity: 3) - Accommodations by type
- [ ] **T-029** (complexity: 3) - Accommodations by amenity (blocked by T-014)
- [ ] **T-030** (complexity: 3) - Accommodations by feature

### Core Destinations (5 tasks)

- [ ] **T-031** (complexity: 3) - Destinations listing page
- [ ] **T-032** (complexity: 4) - Destination detail page
- [ ] **T-033** (complexity: 3) - Accommodations within destination
- [ ] **T-034** (complexity: 3) - Events within destination (blocked by T-015)
- [ ] **T-035** (complexity: 3) - Destinations by attraction

### Core Events (4 tasks)

- [ ] **T-036** (complexity: 4) - Events listing page
- [ ] **T-037** (complexity: 4) - Event detail page
- [ ] **T-038** (complexity: 3) - Events by category
- [ ] **T-039** (complexity: 3) - Events by location

### Core Posts (5 tasks)

- [ ] **T-040** (complexity: 4) - Posts listing page
- [ ] **T-041** (complexity: 4) - Post detail page
- [ ] **T-042** (complexity: 3) - Posts by category
- [ ] **T-043** (complexity: 3) - Posts by tag
- [ ] **T-044** (complexity: 3) - Posts by author (blocked by T-016)

### Content Phase (6 tasks)

- [ ] **T-045** (complexity: 4) - Global search page (blocked by T-017)
- [ ] **T-046** (complexity: 3) - Contact page
- [ ] **T-047** (complexity: 2) - About us page
- [ ] **T-048** (complexity: 2) - Privacy policy page
- [ ] **T-049** (complexity: 2) - Terms and conditions page
- [ ] **T-050** (complexity: 4) - Feedback page

### Account Phase (5 tasks)

- [ ] **T-051** (complexity: 3) - Edit profile page
- [ ] **T-052** (complexity: 3) - Favorites page
- [ ] **T-053** (complexity: 3) - Reviews page
- [ ] **T-054** (complexity: 3) - Subscription page
- [ ] **T-055** (complexity: 3) - Preferences page

### Marketing Phase (4 tasks)

- [ ] **T-056** (complexity: 3) - Property owners landing
- [ ] **T-057** (complexity: 2) - Benefits page
- [ ] **T-058** (complexity: 3) - Tourist pricing page
- [ ] **T-059** (complexity: 3) - Owner pricing page

### Infrastructure Phase (7 tasks)

- [ ] **T-060** (complexity: 2) - Pagination rewrite files - accommodations
- [ ] **T-061** (complexity: 2) - Pagination rewrite files - destinations
- [ ] **T-062** (complexity: 2) - Pagination rewrite files - events
- [ ] **T-063** (complexity: 2) - Pagination rewrite files - posts
- [ ] **T-064** (complexity: 3) - Update entity path mapper
- [ ] **T-065** (complexity: 3) - Update header/footer navigation
- [ ] **T-066** (complexity: 3) - Dynamic sitemap endpoint

---

## Suggested Next

After completing setup migrations (T-009 to T-012), start:
- **Shared components** (T-018 to T-025) — unblock all page tasks
- **Prerequisites** (T-013 to T-017) — unblock blocked pages
- **Infrastructure** (T-060 to T-066) — can run in parallel
