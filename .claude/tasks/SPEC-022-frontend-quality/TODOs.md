# SPEC-022: Frontend Quality (Theming, i18n, Performance)

## Summary

- **Total tasks**: 62
- **Phases**: 9
- **Average complexity**: 2.7 / 4
- **Status**: Pending

---

## Phase 1: CSS Variables & Dark Mode Foundation (8 tasks)

- [ ] **T-001** [C:2] Add dark mode overrides for --color-primary-50 to --color-primary-950 in global.css
- [ ] **T-002** [C:2] Add dark mode overrides for status colors (success, error, warning, info) in global.css
- [ ] **T-003** [C:2] Add dark mode overrides for shadow variables in global.css
- [ ] **T-004** [C:3] Add dark mode overrides for semantic colors (green, terracotta, secondary, accent) in global.css
- [ ] **T-005** [C:3] Create semantic Tailwind utility classes mapping (bg-surface, text-on-surface, etc.) .. blocked by T-001, T-002, T-003, T-004
- [ ] **T-006** [C:3] Decide z-index strategy: CSS var tokens OR Tailwind z-scale
- [ ] **T-007** [C:2] Evaluate and document @repo/tailwind-config strategy
- [ ] **T-008** [C:3] Remove !important overrides in NewsletterSection.astro and card components

## Phase 2: Dark Mode - Web Core Components (10 tasks)

- [ ] **T-009** [C:2] Fix dark mode in UserNav.client.tsx .. blocked by T-005
- [ ] **T-010** [C:2] Fix dark mode in TypePopover.client.tsx .. blocked by T-005
- [ ] **T-011** [C:2] Fix dark mode in DestinationPopover.client.tsx .. blocked by T-005
- [ ] **T-012** [C:3] Fix dark mode in DateRangePopover and GuestsPopover .. blocked by T-005
- [ ] **T-013** [C:2] Fix dark mode in Toast.client.tsx .. blocked by T-005
- [ ] **T-014** [C:2] Fix dark mode in ImageCarousel.client.tsx .. blocked by T-005
- [ ] **T-015** [C:2] Fix dark mode in ImageGallery.client.tsx .. blocked by T-005
- [ ] **T-016** [C:3] Fix dark mode in ReviewForm.client.tsx and ReviewList.client.tsx .. blocked by T-005
- [ ] **T-017** [C:3] Fix dark mode in FilterSidebar.client.tsx and DestinationFilterPanel.client.tsx .. blocked by T-005
- [ ] **T-018** [C:2] Fix dark mode in ContactForm.client.tsx and ReviewEditForm.client.tsx .. blocked by T-005

## Phase 3: Dark Mode - Web Secondary Components (8 tasks)

- [ ] **T-019** [C:3] Fix dark mode in HeroImageCarousel.client.tsx (replace inline #ffffff and rgba) .. blocked by T-005
- [ ] **T-020** [C:3] Fix dark mode in accommodation card components .. blocked by T-005
- [ ] **T-021** [C:2] Fix dark mode in DestinationCard.astro (replace #fff, hardcoded colors) .. blocked by T-005
- [ ] **T-022** [C:2] Fix dark mode in EventCard.astro (replace bg-blue-500, bg-green-500) .. blocked by T-005
- [ ] **T-023** [C:2] Fix dark mode in CategoryIconsSection.astro .. blocked by T-005
- [ ] **T-024** [C:3] Fix dark mode in StickyNav.astro (replace rgba values) .. blocked by T-005
- [ ] **T-025** [C:2] Fix dark mode in Header.astro (replace rgba values) .. blocked by T-005
- [ ] **T-026** [C:2] Fix dark mode in Footer.astro (replace to-[#0F1A2E] gradient) .. blocked by T-005

## Phase 4: Dark Mode - Remaining + Admin (6 tasks)

- [ ] **T-027** [C:4] Fix dark mode in remaining web components (Badge, Button, search popovers, misc) .. blocked by T-005
- [ ] **T-028** [C:2] Fix hardcoded rgba in textures.css and animations.css .. blocked by T-001
- [ ] **T-029** [C:3] Fix dark mode in admin PageSkeleton.tsx (62 hardcoded classes)
- [ ] **T-030** [C:2] Fix dark mode in admin CacheMonitor.tsx (27 hardcoded classes)
- [ ] **T-031** [C:2] Fix dark mode in admin signin.tsx and signup.tsx (24+19 classes)
- [ ] **T-032** [C:4] Fix dark mode in remaining admin components (entity-form views, selects, misc)

## Phase 5: i18n - Utilities & Foundation (4 tasks)

- [ ] **T-033** [C:3] Create formatDate utility in @repo/i18n (locale-aware)
- [ ] **T-034** [C:3] Create formatNumber and formatCurrency utilities in @repo/i18n
- [ ] **T-035** [C:3] Replace all hardcoded 'es-AR' Intl calls with centralized utilities (~12 files) .. blocked by T-033, T-034
- [ ] **T-036** [C:3] Make 404.astro and 500.astro locale-aware (use translations)

## Phase 6: i18n - Admin Routes (8 tasks)

- [ ] **T-037** [C:3] Add i18n to admin auth pages (signin.tsx, signup.tsx)
- [ ] **T-038** [C:3] Add i18n to admin profile page (me/profile.tsx - 40+ labels)
- [ ] **T-039** [C:2] Add i18n to admin settings page (me/settings.tsx - 15+ labels)
- [ ] **T-040** [C:3] Add i18n to admin sponsor pages (index, invoices, sponsorships)
- [ ] **T-041** [C:3] Add i18n to admin analytics pages (business, usage, debug)
- [ ] **T-042** [C:3] Add i18n to admin access pages (permissions, roles, user activity/permissions)
- [ ] **T-043** [C:3] Add i18n to admin billing pages (exchange-rates, invoices, webhook-events, settings)
- [ ] **T-044** [C:2] Add i18n to admin notifications page

## Phase 7: i18n - Admin Features & Components (6 tasks)

- [ ] **T-045** [C:3] Add i18n to billing-plans feature (columns, PlanDialog)
- [ ] **T-046** [C:2] Add i18n to billing-addons feature (columns, AddonDialog)
- [ ] **T-047** [C:3] Add i18n to promo-codes feature (columns, dialogs)
- [ ] **T-048** [C:3] Add i18n to exchange-rates feature (FetchConfigForm, ManualOverrideDialog, RateHistoryView)
- [ ] **T-049** [C:4] Add i18n to admin generic components (entity-form views, selects, table cells)
- [ ] **T-050** [C:3] Add i18n to cron-jobs and billing-metrics features

## Phase 8: Performance (8 tasks)

- [ ] **T-051** [C:4] Fix N+1 queries in user.service.ts (use SQL subqueries for counts)
- [ ] **T-052** [C:3] Fix N+1 queries in amenity.service.ts (use SQL subqueries)
- [ ] **T-053** [C:3] Fix N+1 queries in feature.service.ts (use SQL subqueries)
- [ ] **T-054** [C:4] Replace Web Standards Cache API with lru-cache in cache middleware
- [ ] **T-055** [C:2] Add missing indexes to users table (role, lifecycleState, visibility, deletedAt, createdAt)
- [ ] **T-056** [C:3] Implement automatic refresh for search_index materialized view
- [ ] **T-057** [C:2] Create separate health check handler bypassing middleware chain
- [ ] **T-058** [C:2] Change client:load to client:idle in HeroSection search components

## Phase 9: Verification (4 tasks)

- [ ] **T-059** [C:3] Visual verification of dark mode across all web pages .. blocked by T-009..T-028
- [ ] **T-060** [C:3] Visual verification of dark mode across admin pages .. blocked by T-029..T-032
- [ ] **T-061** [C:3] Verify all i18n changes work with locale switching (es/en/pt) .. blocked by T-035..T-050
- [ ] **T-062** [C:3] Run performance benchmarks and verify N+1 fixes .. blocked by T-051..T-058

---

## Dependency Graph (Critical Path)

```
Phase 1 Foundation:
  T-001, T-002, T-003, T-004 (parallel) --> T-005 --> Phase 2 + Phase 3 components
  T-006, T-007, T-008 (independent, parallel)

Phase 2-4 Dark Mode:
  T-005 --> T-009..T-027 (web components, parallelizable)
  T-001 --> T-028 (textures/animations)
  T-029..T-032 (admin, independent of web dark mode)
  All web dark mode --> T-059 (verification)
  All admin dark mode --> T-060 (verification)

Phase 5-7 i18n:
  T-033, T-034 (parallel) --> T-035
  T-036..T-050 (parallelizable, no dependencies between them)
  All i18n --> T-061 (verification)

Phase 8 Performance:
  T-051..T-058 (all parallelizable)
  All performance --> T-062 (verification)
```

## Key File References

| Area | Key Files |
|------|-----------|
| CSS Variables | `apps/web/src/styles/global.css` (lines 148-188) |
| Tailwind Config | `apps/web/tailwind.config.mjs`, `packages/tailwind-config/` |
| i18n Config | `packages/i18n/src/config.ts`, `packages/i18n/src/locales/` |
| User Service | `packages/service-core/src/services/user/user.service.ts` (lines 444-460) |
| Cache Middleware | `apps/api/src/middlewares/cache.ts` |
| DB Schema | `packages/db/src/schemas/user/user.dbschema.ts` |
| Error Pages | `apps/web/src/pages/404.astro`, `apps/web/src/pages/500.astro` |
