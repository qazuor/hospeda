# SPEC-228: Web loading-states consistency & coverage

## Progress: 0/22 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-001 -> T-003 -> T-010 -> T-013 -> T-022 (5 steps)
**Parallel Tracks:** foundation (T-001/T-002 independent), Astro skeleton-swaps (T-007/T-008 unblocked), CSS-only polish (T-015/T-016 unblocked)

---

### Core Phase (Phase 1 — Foundation toolkit)

- [ ] **T-001** (complexity: 2) - Create canonical Spinner component
  - Spinner.tsx + .module.css, size/label props, role=status, aria-label, unit tests
  - Blocked by: none
  - Blocks: T-004, T-006, T-009, T-010, T-011, T-012, T-014, T-017, T-019, T-021

- [ ] **T-002** (complexity: 2) - Create SkeletonCard + SkeletonCardList components
  - Configurable shimmer block for React islands + list wrapper, unit tests
  - Blocked by: none
  - Blocks: T-007, T-008, T-013, T-020

- [ ] **T-003** (complexity: 3) - Create LoadingButton (or extend GradientButtonReact) + record decision
  - loading/loadingLabel + aria-busy + disabled + inline Spinner; pick ONE approach, document it
  - Blocked by: T-001
  - Blocks: T-004, T-010, T-011, T-012, T-019

### Docs Phase (Phase 1)

- [ ] **T-004** (complexity: 2) - Write loading-states convention doc
  - apps/web/docs/loading-states.md: decision table, a11y rules, forbidden patterns, recorded decision
  - Blocked by: T-001, T-002, T-003
  - Blocks: T-005

### Setup Phase (Phase 1)

- [ ] **T-005** (complexity: 2) - Add CI grep guard for forbidden loading patterns
  - Fail CI on '...' loading labels / ⏳ emoji in islands, with allowlist; self-test
  - Blocked by: T-004
  - Blocks: T-022

### Integration Phase (Phase 2 — HIGH + Phase 3 — MEDIUM)

- [ ] **T-006** (complexity: 3) - A1 Map sidebar loading indicator (isFetching)
  - Wire useViewportSearch isFetching -> MapCardsSidebar overlay/skeleton
  - Blocked by: T-001 / Blocks: —

- [ ] **T-007** (complexity: 2) - A2 Eventos filter skeleton-swap
  - Port html[data-filters-loading] pattern from alojamientos
  - Blocked by: T-002 / Blocks: —

- [ ] **T-008** (complexity: 2) - A3 Publicaciones filter skeleton-swap
  - PostGridSkeleton in filter-loading path
  - Blocked by: T-002 / Blocks: —

- [ ] **T-009** (complexity: 3) - A4 AiChatWidget thinking indicator + ⏳ replacement
  - showThinking dots + Spinner on send
  - Blocked by: T-001 / Blocks: —

- [ ] **T-010** (complexity: 3) - A5 ReviewsModal + DestinationReviewsModal spinner
  - Spinner + cargar-más aria-busy (no disappear), both modals
  - Blocked by: T-001, T-003 / Blocks: T-013

- [ ] **T-011** (complexity: 2) - A6 ContactHost double-submit guard
  - disabled + aria-busy on Solicitar acceso + handleSubmit
  - Blocked by: T-001, T-003 / Blocks: —

- [ ] **T-012** (complexity: 2) - A7 ConversationReply send button
  - Replace '...' with Spinner/i18n sending label + aria-busy
  - Blocked by: T-001 / Blocks: —

- [ ] **T-013** (complexity: 2) - Review modals initial-load skeleton
  - SkeletonCard stack on first fetch, distinct from cargar-más
  - Blocked by: T-002, T-010 / Blocks: —

- [ ] **T-014** (complexity: 2) - CommentThreadIsland visual spinner
  - Inline Spinner when isSubmitting
  - Blocked by: T-001 / Blocks: —

- [ ] **T-015** (complexity: 2) - ImageGallery lightbox fade
  - CSS fade/shimmer between image changes
  - Blocked by: none / Blocks: —

- [ ] **T-016** (complexity: 2) - MapPlaceholder hydration fallback
  - Render MapPlaceholder.astro until island hydrates
  - Blocked by: none / Blocks: —

### Cleanup Phase (Phase 4 — LOW + final sweep)

- [ ] **T-017** (complexity: 1) - LocationPicker ⏳ replacement
  - Blocked by: T-001 / Blocks: —

- [ ] **T-018** (complexity: 2) - FavoriteButton hydration spinner (measure first)
  - Blocked by: T-001 / Blocks: —

- [ ] **T-019** (complexity: 2) - NewsletterPreferences + CollectionDetailActions polish
  - Blocked by: T-001, T-003 / Blocks: —

- [ ] **T-020** (complexity: 2) - UserFavoritesList + UserReviewsList SkeletonCard
  - Blocked by: T-002 / Blocks: —

- [ ] **T-021** (complexity: 1) - SearchChatPanel ⏳ replacement
  - Blocked by: T-001 / Blocks: —

- [ ] **T-022** (complexity: 2) - Final consistency sweep + grep audit
  - Migrate stragglers, confirm CI guard + success criteria 3/4
  - Blocked by: T-005..T-021 / Blocks: —

---

## Dependency Graph

Level 0: T-001, T-002, T-007*, T-008*, T-015, T-016  (*skeleton-swaps need only T-002)
Level 1: T-003, T-006, T-009, T-012, T-014, T-017, T-018, T-020, T-021
Level 2: T-004, T-010, T-011, T-019
Level 3: T-005, T-013
Level 4: T-022

## Suggested Start

Begin with **T-001** (complexity: 2) - Spinner. No dependencies, unblocks 10 tasks (the most leverage in the graph). Then T-002 (Skeleton) and T-003 (LoadingButton) to complete the foundation before any migration.
