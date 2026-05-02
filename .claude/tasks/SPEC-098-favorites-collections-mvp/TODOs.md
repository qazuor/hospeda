# TODOs: Favorites & Collections MVP

Spec: SPEC-098 | Status: in_progress | Progress: 4/104

---

## Phase 0 — Setup (4 tasks) [ALL COMPLETED]

- [x] T-001: Audit AuthRequiredPopover.client.tsx props interface (complexity: 2)
- [x] T-002: Audit DestinationsIsland.client.tsx integration point (complexity: 1)
- [x] T-003: Verify enforceFavoritesLimit middleware and bookmark limit value (complexity: 1)
- [x] T-004: Verify existence of GET /public/user-bookmarks/count endpoint (complexity: 1)

---

## Phase 1 — Core: DB foundation (10 tasks)

- [ ] T-005: Create user_bookmark_collections Drizzle schema (complexity: 3)
- [ ] T-006: Add collectionId nullable FK column to user_bookmarks schema (complexity: 2) [blocked by T-005]
- [ ] T-007: Add Drizzle relations for collections and bookmarks (complexity: 2) [blocked by T-005, T-006]
- [ ] T-008: Write manual SQL for collection indexes and partial unique constraint (complexity: 2) [blocked by T-005, T-007]
- [ ] T-009: Write manual SQL for user_bookmarks entity performance index (complexity: 1) [blocked by T-006, T-008]
- [ ] T-010: Update apply-postgres-extras.sh to include new manual SQL files (complexity: 2) [blocked by T-008, T-009]
- [ ] T-011a: Create UserBookmarkCollectionModel class skeleton (complexity: 2) [blocked by T-010]
- [ ] T-011b: Implement CRUD methods on UserBookmarkCollectionModel (complexity: 3) [blocked by T-011a]
- [ ] T-011c: Implement listByUser method with optional bookmark count on UserBookmarkCollectionModel (complexity: 3) [blocked by T-011b]
- [ ] T-012: Add checkBookmarksBulk query method to UserBookmarkModel (complexity: 3) [blocked by T-010]

---

## Phase 2 — Core: Schemas + Permissions (6 tasks)

- [ ] T-013: Create UserBookmarkCollection base and entity Zod schemas (complexity: 3) [blocked by T-011c]
- [ ] T-014: Create UserBookmarkCollection CRUD Zod schemas (create, update) (complexity: 2) [blocked by T-013]
- [ ] T-015: Create UserBookmarkCollection query, http, access, and params schemas (complexity: 3) [blocked by T-013, T-014]
- [ ] T-016: Add BulkCheckInputSchema and BulkCheckResultSchema to userBookmark http schemas (complexity: 2) [blocked by T-012, T-015]
- [ ] T-017: Add 5 USER_BOOKMARK_COLLECTION permissions to permission enum (complexity: 1) [blocked by T-016]
- [ ] T-018: Add role-permission assignments for collection permissions (complexity: 2) [blocked by T-017]

---

## Phase 3 — Core: Config + Services (10 tasks)

- [ ] T-025: Register HOSPEDA_MAX_COLLECTIONS_PER_USER env var in packages/config (complexity: 2) [no deps — repurposed from old enforceCollectionsLimit middleware task]
- [ ] T-019: Create UserBookmarkCollectionService skeleton extending BaseCrudService (complexity: 3) [blocked by T-014, T-015, T-017, T-018]
- [ ] T-020a: Implement countActiveCollections service method (complexity: 2) [blocked by T-019]
- [ ] T-020b: Implement createCollection service method (complexity: 3) [blocked by T-020a]
- [ ] T-CL2: Implement _canCreate limit guard in UserBookmarkCollectionService (complexity: 3) [blocked by T-025, T-020a]
- [ ] T-021: Implement listCollectionsByUser service method (complexity: 3) [blocked by T-019]
- [ ] T-022a: Implement getCollectionById service method (complexity: 3) [blocked by T-019]
- [ ] T-022b: Implement updateCollection service method (complexity: 3) [blocked by T-022a]
- [ ] T-023: Implement deleteCollection service method (complexity: 3) [blocked by T-019]
- [ ] T-024: Implement addBookmarkToCollection and removeBookmarkFromCollection methods (complexity: 3) [blocked by T-019]
- [ ] T-034: Add checkBookmarksBulk and updateBookmark methods to UserBookmarkService (complexity: 3) [blocked by T-016]

---

## Phase 4 — Core: Routes (9 tasks)

- [ ] T-026: Implement POST /protected/user-bookmark-collections route (complexity: 3) [blocked by T-016]
- [ ] T-027: Implement GET /protected/user-bookmark-collections (list) route (complexity: 2) [blocked by T-016]
- [ ] T-CL3: Extend GET /user-bookmark-collections list response with usage block (complexity: 3) [blocked by T-027, T-CL2]
- [ ] T-028: Create GET /public/user-bookmarks/count endpoint from scratch (complexity: 3) [blocked by T-004]
- [ ] T-029: Implement GET /protected/user-bookmark-collections/:id route (complexity: 3) [blocked by T-026, T-027]
- [ ] T-030: Implement PATCH and DELETE /protected/user-bookmark-collections/:id routes (complexity: 3) [blocked by T-029]
- [ ] T-031: Implement POST and DELETE /user-bookmark-collections/:id/bookmarks/:bookmarkId routes (complexity: 3) [blocked by T-030]
- [ ] T-032: Implement PATCH /protected/user-bookmarks/:id (notes update) route (complexity: 2) [blocked by T-016]
- [ ] T-033: Implement POST /protected/user-bookmarks/check-bulk route (complexity: 3) [blocked by T-001, T-016]

---

## Phase 5 — Core: i18n (3 tasks)

- [ ] T-035: Add i18n keys to account.json for favorites (es, en, pt) (complexity: 3)
- [ ] T-036: Add sort.mostSaved i18n key to accommodations.json (es, en, pt) (complexity: 1) [blocked by T-035]
- [ ] T-i18n-CL: Add collection limit i18n keys to account.json (es, en, pt) (complexity: 1) [blocked by T-035]

---

## Phase 6 — Core: Seed data (6 tasks)

- [ ] T-S01: Audit bookmark seed data structure for collectionId field addition (complexity: 1)
- [ ] T-S02: Create example seed JSON files for user_bookmark_collections (complexity: 2) [blocked by T-S01]
- [ ] T-S03: Create userBookmarkCollections.seed.ts using createSeedFactory pattern (complexity: 3) [blocked by T-S02]
- [ ] T-S04: Update bookmark JSON files and seed to add collectionId field on subset (complexity: 3) [blocked by T-S01, T-S03]
- [ ] T-S05: Register userBookmarkCollections seed in index.ts and manifest-example.json (complexity: 2) [blocked by T-S03, T-S04]

---

## Phase 7 — Integration: FavoriteButton foundation (5 tasks)

- [ ] T-038a: Create FavoriteButton.client.tsx skeleton with props interface (complexity: 2) [blocked by T-002]
- [ ] T-038b: Wire auth detection and AuthRequiredPopover into FavoriteButton (complexity: 2) [blocked by T-038a]
- [ ] T-038c: Style FavoriteButton with CSS module and count pill (complexity: 2) [blocked by T-038b]
- [ ] T-039a: Wire FavoriteButton toggle API calls (POST/DELETE bookmark) (complexity: 3) [blocked by T-035, T-038c]
- [ ] T-039b: Wire FavoriteButton single-check fallback on mount (complexity: 2) [blocked by T-039a]

---

## Phase 8 — Integration: DestinationCard extraction (4 tasks) [NEW]

- [ ] T-DC1: Create DestinationCard.astro mirroring AccommodationCard layout (complexity: 3) [blocked by T-038c]
- [ ] T-DC2: Refactor destinos/index.astro to use DestinationCard.astro (complexity: 2) [blocked by T-DC1]
- [ ] T-DC3: Refactor DestinationsIsland.client.tsx card JSX to match DestinationCard structure (complexity: 3) [blocked by T-DC1]
- [ ] T-DC4: Visual smoke test destination card carousel and listing parity (complexity: 1) [blocked by T-DC2, T-DC3]

---

## Phase 9 — Integration: Card coverage + map + detail headers (8 tasks)

- [ ] T-040: Integrate FavoriteButton into AccommodationCard.astro (complexity: 3) [blocked by T-039b]
- [ ] T-041: Implement bulk-check fetch on /alojamientos listing page (complexity: 3) [blocked by T-039b]
- [ ] T-042: Integrate FavoriteButton into EventCard, ArticleCard components (complexity: 3) [blocked by T-036, T-040]
- [ ] T-043: Integrate FavoriteButton into DestinationsIsland.client.tsx (complexity: 2) [blocked by T-DC1, T-040]
- [ ] T-044: Integrate FavoriteButton into LocationMap.client.tsx popup (complexity: 3) [blocked by T-DC1, T-026, T-027, T-028, T-031, T-032, T-033, T-034, T-040, T-041, T-042, T-043]
- [ ] T-045: Integrate FavoriteButton and counter into accommodation DetailHeader.astro (complexity: 3) [blocked by T-044]
- [ ] T-046: Integrate FavoriteButton and counter into destination, event, post detail headers (complexity: 3) [blocked by T-045]
- [ ] T-052: Add Most Saved sort option to alojamientos, eventos, and publicaciones listings (complexity: 3) [blocked by T-036]

---

## Phase 10 — Integration: Modals (5 tasks)

- [ ] T-047a: Create CreateEditCollectionModal.client.tsx skeleton and form fields (complexity: 2) [blocked by T-046]
- [ ] T-047b: Add color picker and icon picker to CreateEditCollectionModal (complexity: 2) [blocked by T-047a]
- [ ] T-047c: Wire CreateEditCollectionModal API calls and error handling (complexity: 3) [blocked by T-047b]
- [ ] T-048a: Create MoveToCollectionModal.client.tsx skeleton with collection list (complexity: 2) [blocked by T-047c]
- [ ] T-048b: Wire MoveToCollectionModal API calls and inline create form (complexity: 3) [blocked by T-048a]

---

## Phase 11 — Integration: Favorites page, collection detail, collection limit UI (11 tasks)

- [ ] T-049a: Refactor UserFavoritesList.client.tsx: entity type tabs (complexity: 3) [blocked by T-047c, T-048b]
- [ ] T-049b: Add 'Sin coleccion' uncollected bookmarks section to UserFavoritesList (complexity: 3) [blocked by T-049a]
- [ ] T-049c: Add 'Mis colecciones' grid section to UserFavoritesList (complexity: 3) [blocked by T-049b]
- [ ] T-049d: Wire MoveToCollectionModal trigger from bookmark cards in UserFavoritesList (complexity: 2) [blocked by T-049c]
- [ ] T-050a: Add inline notes editor textarea to bookmark cards (complexity: 2) [blocked by T-049d]
- [ ] T-050b: Wire notes save API call and keyboard shortcut (complexity: 2) [blocked by T-050a]
- [ ] T-051a: Create /favoritos/colecciones/[id].astro page skeleton with auth guard (complexity: 2) [blocked by T-049d, T-050b]
- [ ] T-051b: Add collection header and entity type filter chips to collection detail page (complexity: 2) [blocked by T-051a]
- [ ] T-051c: Add paginated bookmark grid with MoveToCollectionModal and notes editor to collection detail page (complexity: 3) [blocked by T-051b]
- [ ] T-UI-CL1: Display collection usage counter in /favoritos page header (complexity: 2) [blocked by T-CL3, T-i18n-CL]
- [ ] T-UI-CL2: Disable create CTA in CreateEditCollectionModal when at limit (complexity: 2) [blocked by T-047c, T-CL3, T-i18n-CL]

---

## Phase 12 — Testing: Schemas + Services (9 tasks)

- [ ] T-037: Write unit tests for UserBookmarkCollection schemas (complexity: 3) [blocked by T-015]
- [ ] T-053a: Write unit tests for UserBookmarkCollectionService: createCollection and countActiveCollections (complexity: 3) [blocked by T-051c]
- [ ] T-053b: Write unit tests for UserBookmarkCollectionService: listCollectionsByUser (complexity: 2) [blocked by T-053a]
- [ ] T-054a: Write unit tests for UserBookmarkCollectionService: getCollectionById and updateCollection (complexity: 3) [blocked by T-053b]
- [ ] T-054b: Write unit tests for UserBookmarkCollectionService: deleteCollection, addBookmark, removeBookmark (complexity: 3) [blocked by T-054a]
- [ ] T-055: Write unit tests for UserBookmarkService additions (checkBookmarksBulk, updateBookmark) (complexity: 3) [blocked by T-054b]
- [ ] T-CL4: Write unit tests for the collection limit guard (complexity: 2) [blocked by T-CL2]
- [ ] T-S06: Write unit/integration test for userBookmarkCollections seed (complexity: 2) [blocked by T-S05]

---

## Phase 13 — Testing: API integration + Frontend + E2E (11 tasks)

- [ ] T-056a: Write integration tests for collection routes: create, list, getById (complexity: 3) [blocked by T-055]
- [ ] T-056b: Write integration tests for collection routes: update, delete (complexity: 3) [blocked by T-056a]
- [ ] T-CL5: Write integration test for GET /user-bookmark-collections usage block (complexity: 2) [blocked by T-CL3]
- [ ] T-057a: Write integration tests for bookmark sub-resource and bulk-check routes (complexity: 3) [blocked by T-056b]
- [ ] T-057b: Write integration tests for notes route and public count route (complexity: 3) [blocked by T-057a]
- [ ] T-058: Write component tests for FavoriteButton.client.tsx (complexity: 3) [blocked by T-057b]
- [ ] T-059a: Write E2E tests: favorite toggle (card and detail page) (complexity: 3) [blocked by T-058]
- [ ] T-059b: Write E2E tests: collections CRUD and move bookmark (complexity: 3) [blocked by T-059a]
- [ ] T-060a: Write E2E tests: inline notes and public counter (complexity: 3) [blocked by T-059b]
- [ ] T-060b: Write E2E tests: collections limit and entity smoke tests (complexity: 3) [blocked by T-060a]

---

## Phase 14 — Docs (4 tasks)

- [ ] T-061: Update CLAUDE.md files for service-core, db, and schemas packages (complexity: 2) [blocked by T-060b]
- [ ] T-062: Add FavoriteButton reuse pattern note to apps/web CLAUDE.md (complexity: 1) [blocked by T-061]
- [ ] T-063: Add backend naming split comment to userBookmark.dbschema.ts and route files (complexity: 1) [blocked by T-062]
- [ ] T-ADR-098: Create ADR-026 documenting collections limit strategy (complexity: 1) [blocked by T-063]

---

## Phase 15 — Cleanup (1 task)

- [ ] T-064: Final cleanup: remove dead code, sweep TODO(SPEC-098) markers, validate coverage (complexity: 2) [blocked by T-063, T-ADR-098]

---

## Summary

| Phase | Tasks | Notes |
|-------|-------|-------|
| setup | 4 | Audits only — ALL COMPLETED |
| core (DB) | 10 | Drizzle schema, relations, manual SQL, models |
| core (schemas + permissions) | 6 | Zod schemas, permission enum, role assignments |
| core (config + services) | 11 | T-025 env var + UserBookmarkCollectionService methods + T-CL2 limit guard |
| core (routes) | 9 | 9 route handlers + T-CL3 usage block extension |
| core (i18n) | 3 | account.json + accommodations.json + T-i18n-CL limit keys |
| core (seed) | 5 | Collection JSON fixtures + seed.ts + bookmarks update + registration |
| integration (FavoriteButton) | 5 | skeleton -> auth -> styles -> API toggle -> mount check |
| integration (DestinationCard) | 4 | NEW: T-DC1..T-DC4 extraction before destination FavoriteButton |
| integration (cards + map + headers) | 8 | AccommodationCard, listing, EventCard, ArticleCard, Destinations, LocationMap, 2x DetailHeaders + sort |
| integration (modals) | 5 | CreateEditCollectionModal (3 sub-tasks) + MoveToCollectionModal (2 sub-tasks) |
| integration (favorites page + detail + limit UI) | 11 | UserFavoritesList refactor (4) + notes (2) + collection detail (3) + T-UI-CL1 + T-UI-CL2 |
| testing (schemas + services) | 8 | Schema tests + service tests + T-CL4 limit guard tests + seed test |
| testing (API + frontend + E2E) | 10 | Collection route tests (4) + T-CL5 usage block test + FavoriteButton tests + 4 E2E pairs |
| docs | 4 | CLAUDE.md updates + T-ADR-098 |
| cleanup | 1 | Final sweep |
| **TOTAL** | **104** | +12 from Phase 0 audit findings |

**Critical path (longest chain):**
T-001 -> T-033 -> T-DC1 -> T-043 -> T-044 -> T-045 -> T-046 -> T-047a -> T-047b -> T-047c -> T-048a -> T-048b -> T-049a -> T-049b -> T-049c -> T-049d -> T-050a -> T-050b -> T-051a -> T-051b -> T-051c -> T-053a -> T-053b -> T-054a -> T-054b -> T-055 -> T-056a -> T-056b -> T-057a -> T-057b -> T-058 -> T-059a -> T-059b -> T-060a -> T-060b -> T-061 -> T-062 -> T-063 -> T-ADR-098 -> T-064

Critical path length: 40 tasks deep.

**Parallel tracks (can start immediately, no dependencies):**
- Track A: T-001 (setup, done) -> T-033 (check-bulk route)
- Track B: T-005 (DB schema) -> full backend core track
- Track C: T-035 (i18n) -> T-038a (FavoriteButton skeleton) -> T-038c -> T-DC1 (DestinationCard)
- Track D: T-CL1 (env var config) -> T-CL2 (limit guard) -> T-CL4 (guard tests)
- Track E: T-S01 (seed audit) -> seed data track
- Track F: T-027 (list route) -> T-CL3 (usage block) -> T-CL5 (usage test)

**Key architectural decisions (Phase 0 audit outcomes):**
- Collections limit: `HOSPEDA_MAX_COLLECTIONS_PER_USER` env var (default 10), guard in service `_canCreate` with `{ currentCount, maxAllowed }` error payload. No middleware.
- DestinationCard: extracted to `DestinationCard.astro` (T-DC1..T-DC4), now IN SCOPE before FavoriteButton integration in destination contexts.
- Public count endpoint: build from scratch (`apps/api/src/routes/user-bookmark/public/count.ts`). Folder does not exist.
- Path fix: `apps/api/src/middlewares/` (plural) throughout all task descriptions.

**Policy notes:**
- No numbered migration files. Schema changes via `pnpm db:fresh-dev` (drizzle-kit push). Manual SQL in `packages/db/src/migrations/manual/` applied via `apply-postgres-extras.sh`.
- Seed tasks (T-S01..T-S06) must run AFTER T-005/T-006 (schema) and T-019 (UserBookmarkCollectionService exists for createSeedFactory to use).
