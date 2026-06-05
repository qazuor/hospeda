# SPEC-159: Cross-Entity View Tracking

## Progress: 1/15 tasks (7%)

**Average Complexity:** 2.4/10
**Critical Path:** T-002 -> T-004 -> T-006 -> T-008 -> T-012 -> T-013 -> T-014 -> T-015 (8 steps)
**Parallel Tracks:** 3 identified (schemas T-001 / db T-002+ / hash util T-005 can all start in parallel)

> Architecture: Option 1 approved 2026-06-04 — own lean `entity_views` table (no BaseModel),
> cookieless server-side visitorHash, insert-always + dedup-at-aggregation, query-time aggregation
> for V1, 95-day retention purge cron. See `../../specs/SPEC-159-cross-entity-view-tracking/tech-analysis.md`.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Create entityView Zod schemas in @repo/schemas
  - Capture/window/query/stats schemas + tests (test-first)
  - Blocked by: none
  - Blocks: T-006, T-007, T-008

### Core Phase

- [x] **T-002** (complexity: 2) - Create entity_views lean dbschema + migration
  - LEAN append-only table (approved deviation, no BaseModel columns) + db:generate migration
  - Blocked by: none
  - Blocks: T-003, T-004, T-011

- [ ] **T-003** (complexity: 1) - Add entity_views indexes to migrations/extras
  - Two-carriles rule: idempotent SQL mirroring model indexes
  - Blocked by: T-002
  - Blocks: none

- [ ] **T-004** (complexity: 3) - Create EntityViewModel with insert + windowed aggregation
  - insertView, getStatsForEntities (7d/30d unique+total, 30-min dedup window), purgeOlderThan
  - Blocked by: T-002
  - Blocks: T-006, T-007, T-011

- [ ] **T-005** (complexity: 3) - Implement server-side visitorHash util + env var
  - sha256(dailySalt + truncatedIp + UA), no raw IP; HOSPEDA_VIEWS_HASH_SECRET full env workflow
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-006** (complexity: 3) - Create EntityViewService capture path
  - capture() with EntityViewCaptureSchema validation, Result<T>
  - Blocked by: T-001, T-004
  - Blocks: T-008

- [ ] **T-007** (complexity: 3) - Add EntityViewService scoped aggregation methods
  - HOST own-scoped (anti-peeking) + EDITOR permission-gated (POST_VIEW_ALL / EVENT_VIEW_ALL)
  - Blocked by: T-001, T-004
  - Blocks: T-009, T-010

### Integration Phase

- [ ] **T-008** (complexity: 3) - Create POST /api/v1/public/views capture route
  - skipAuth + rate limit + bot denylist fake-202 + server-side hash, fire-and-forget 202
  - Blocked by: T-001, T-005, T-006
  - Blocks: T-012

- [ ] **T-009** (complexity: 2) - Create GET /protected/views/accommodations/me route
  - ACCOMMODATION_VIEW_OWN, cacheTTL 60, per-accommodation breakdown
  - Blocked by: T-007
  - Blocks: T-014

- [ ] **T-010** (complexity: 3) - Create GET /protected/views/posts and /protected/views/events routes
  - POST_VIEW_ALL / EVENT_VIEW_ALL, entityIds + window validation
  - Blocked by: T-007
  - Blocks: T-014

- [ ] **T-011** (complexity: 2) - Create entity_views retention purge cron
  - Nightly purge >95 days, recordCronRun (mirrors search-index-refresh.job.ts)
  - Blocked by: T-004
  - Blocks: T-014

- [ ] **T-012** (complexity: 3) - Add web view-capture beacon + extend accommodation tracker
  - sendBeacon util + AccommodationViewTracker, astro:page-load VT rebind (SPEC-191 gotcha)
  - Blocked by: T-008
  - Blocks: T-013

- [ ] **T-013** (complexity: 3) - Add post and event view trackers on detail pages
  - POST/EVENT trackers client:idle on detail pages
  - Blocked by: T-012
  - Blocks: T-014

### Testing Phase

- [ ] **T-014** (complexity: 2) - End-to-end verification + full quality pass
  - E2E fixtures across window boundaries, manual smoke, full green + coverage
  - Blocked by: T-009, T-010, T-011, T-013
  - Blocks: T-015

### Docs Phase

- [ ] **T-015** (complexity: 1) - Document view tracking + close out spec
  - route-architecture.md, privacy note, deviation note, spec close-out
  - Blocked by: T-014
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-005
Level 1: T-003, T-004
Level 2: T-006, T-007, T-011
Level 3: T-008, T-009, T-010
Level 4: T-012
Level 5: T-013
Level 6: T-014
Level 7: T-015

## Suggested Start

Begin with **T-001** (complexity: 2) or **T-002** (complexity: 2) — both have no dependencies; T-002 sits on the critical path and unblocks 3 tasks.
