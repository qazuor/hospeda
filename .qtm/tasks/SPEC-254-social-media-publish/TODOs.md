# SPEC-254: Social Automation Backend

## Progress: 32/52 tasks (62%) — SocialPostService schedule/markReady/pause/unpause/archive (T-034) done; INVALID_STATE carried in ServiceError.reason (route T-036 must surface reason as response code)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-001 -> T-002 -> T-004 -> T-005 -> T-006 -> T-007 -> T-008 -> T-009 -> T-010 -> T-011 -> T-013 -> T-014 -> T-016 -> T-017 -> T-018 -> T-019 -> T-027 -> T-028 -> T-029 -> T-032 -> T-033 -> T-034 -> T-035 -> T-036 -> T-037 -> T-044 -> T-045 -> T-046 -> T-047 -> T-048 -> T-049 -> T-050 -> T-051 -> T-052 (34 steps)
**Parallel Tracks:** 4 identified

- Track A (DB+Schema): T-001 -> T-002/T-003 -> T-004 -> T-005 -> ... -> T-013
- Track B (Catalog UI): T-016 -> T-018 -> T-020 -> T-021 -> T-022
- Track C (GPT Ingestion): T-023 -> T-024 -> T-025 -> T-026/T-027 -> T-028 -> T-029
- Track D (Env setup): T-023 and T-043 can start in parallel with Track A after T-001

---

## Phase: setup (DB schemas, enums, permissions, env)

- [x] **T-001** (complexity: 2) - Create 10 social TS enums in packages/schemas/src/enums/
  - 10 enum files + 10 matching .schema.ts files. Test: unit tests asserting enum members and Zod validation.
  - Blocked by: none
  - Blocks: T-002, T-003

- [x] **T-002** (complexity: 1) - Export social enums from packages/schemas/src/enums/index.ts
  - 20 barrel export lines added to enums/index.ts.
  - Blocked by: T-001
  - Blocks: T-004, T-005

- [x] **T-003** (complexity: 2) - Add 25 PermissionEnum + 9 PermissionCategoryEnum values for social domain
  - Edit permission.enum.ts; add JSDoc per value. Test: assert new enum keys exist.
  - Blocked by: none (parallel with T-001)
  - Blocks: T-012, T-016, T-030, T-039

- [x] **T-004** (complexity: 2) - Register 9 social pgEnums in packages/db/src/schemas/enums.dbschema.ts
  - 10 pgEnum registrations using enumToTuple(). Verified by typecheck.
  - Blocked by: T-002
  - Blocks: T-005

- [x] **T-005** (complexity: 3) - Create DB table schemas for simple catalog tables
  - 7 files: social-campaigns, social-content-batches, social-audiences, social-platforms, social-hashtag-sets, social-post-footers, social-assets.
  - Blocked by: T-004
  - Blocks: T-006, T-007, T-008

- [x] **T-006** (complexity: 2) - Create DB table schemas for hashtags, platform-formats, settings
  - 3 files: social-hashtags, social-platform-formats, social-settings.
  - Blocked by: T-005
  - Blocks: T-007, T-008

- [x] **T-007** (complexity: 3) - Create DB table schemas for social_posts, social_post_targets, social_post_media, social_post_hashtags
  - 4 files with FKs and relations() blocks.
  - Blocked by: T-005, T-006
  - Blocks: T-008

- [x] **T-008** (complexity: 2) - Create DB table schemas for append-only tables
  - 3 files: social-ai-requests, social-publish-logs, social-audit-log (no soft-delete columns).
  - Blocked by: T-007
  - Blocks: T-009

- [x] **T-009** (complexity: 1) - Export all 17 social table schemas from packages/db/src/schemas/index.ts
  - Create social/index.ts + import in root index.
  - Blocked by: T-008
  - Blocks: T-010

- [x] **T-010** (complexity: 2) - Generate migration file 0022_cuddly_natasha_romanoff.sql (db:migrate deferred to env setup/CI)
  - Run pnpm db:generate, verify output, run pnpm db:migrate against dev DB.
  - Blocked by: T-009
  - Blocks: T-011

- [x] **T-011** (complexity: 2) - Write extras migration 018-social-indexes (019 trigger dropped: 002-set-updated-at covers all updated_at tables globally)
  - Two idempotent SQL files; run pnpm db:apply-extras twice to verify.
  - Blocked by: T-010
  - Blocks: T-013

- [x] **T-012** (complexity: 1) - Register 24 social permissions in rolePermissions seed for ADMIN and SUPER_ADMIN
  - Edit rolePermissions.seed.ts; test: assert all 25 new permissions exist for both roles.
  - Blocked by: T-003
  - Blocks: T-015

- [x] **T-023** (complexity: 1) - Add env vars HOSPEDA_AI_SOCIAL_KEY and HOSPEDA_OPERATOR_PIN_HASH
  - 5-step env workflow. Test: env schema validation rejects startup when var is missing.
  - Blocked by: none (can start in parallel)
  - Blocks: T-024

- [x] **T-043** (complexity: 1) - Add env vars HOSPEDA_MAKE_API_KEY and HOSPEDA_MAKE_INBOUND_KEY
  - 5-step env workflow for Make.com keys.
  - Blocked by: none (can start in parallel)
  - Blocks: T-044, T-048

---

## Phase: core (DB models, Zod entity schemas, services, seed, GPT routes)

- [x] **T-013** (complexity: 3) - Create DB model files for all 17 social tables
  - One BaseModelImpl-extending model per table; create models/social/index.ts.
  - Blocked by: T-011
  - Blocks: T-014, T-020, T-026, T-027, T-032, T-044

- [x] **T-014** (complexity: 3) - Create Zod entity schema directories for all 17 social entities
  - 17 entity dirs, each with 7 files (.schema, .crud, .query, .http, .access, .admin-search, index).
  - Blocked by: T-002, T-013
  - Blocks: T-015, T-016, T-028

- [x] **T-015** (complexity: 3) - Create seed data files for all catalog entities (model-direct, idempotent; 12 platform-format combos — STORY single-row per UNIQUE constraint)
  - 9 seed files + JSON fixtures; idempotent upserts; register in runRequiredSeeds.
  - Blocked by: T-012, T-014
  - Blocks: T-016

- [x] **T-016** (complexity: 3) - Create catalog CRUD services (hashtag, hashtag-set, footer, campaign, batch, audience)
  - 6 services with normalizers + permissions + unit tests.
  - Blocked by: T-014, T-015
  - Blocks: T-017, T-018, T-030

- [x] **T-017** (complexity: 2) - Create PlatformFormatService and SettingsService
  - Secret masking in listAll; audit log on settings update; warning count on format disable.
  - Blocked by: T-016
  - Blocks: T-018, T-030

- [x] **T-018** (complexity: 3) - Wire catalog admin API routes (hashtags, hashtag-sets, footers, campaigns, batches, audiences) [slug made optional in crud schemas]
  - 6 route files, each with 5 endpoints; register under /api/v1/admin/social.
  - Blocked by: T-016, T-017
  - Blocks: T-019, T-030

- [x] **T-019** (complexity: 2) - Wire platform-formats and settings admin API routes
  - 2 route files: platform-formats (GET + PATCH) and settings (GET + PATCH /:key).
  - Blocked by: T-018
  - Blocks: T-020

- [x] **T-024** (complexity: 2) - Create inbound API-key middleware factory
  - apps/api/src/middlewares/api-key.ts; timingSafeEqual, synthetic actor injection.
  - Blocked by: T-023
  - Blocks: T-025, T-048

- [x] **T-025** (complexity: 2) - Add createApiKeyRoute factory to route-factory-tiered.ts
  - Mirrors createAdminRoute but uses api-key middleware.
  - Blocked by: T-024
  - Blocks: T-026, T-027, T-048, T-049

- [x] **T-026** (complexity: 2) - Implement GET /api/v1/ai/social/catalog route
  - Query 8 active catalog collections; assemble response with defaults.
  - Blocked by: T-025, T-013
  - Blocks: T-027

- [x] **T-027** (complexity: 3) - Create SocialImagePipelineService
  - Download (15s timeout), Cloudinary upload, social_assets + social_post_media writes; graceful failure (draft still created).
  - Blocked by: T-025, T-013
  - Blocks: T-028

- [x] **T-028** (complexity: 3) - Create SocialDraftIngestionService
  - 12-step ingestion: pin check, conflict, slug resolution, target validation, status override, DB writes, hashtag linking, image pipeline.
  - Blocked by: T-027, T-014
  - Blocks: T-029

- [x] **T-029** (complexity: 2) - Implement POST /api/v1/ai/social/drafts route
  - Parse body, call SocialDraftIngestionService, map errors to HTTP codes.
  - Blocked by: T-028
  - Blocks: T-031

- [x] **T-030** (complexity: 2) - Implement GET /api/v1/admin/social/gpt-action-schema route
  - Programmatic OpenAPI 3.1 with exactly 2 paths from Zod schemas.
  - Blocked by: T-018, T-029
  - Blocks: T-040

- [x] **T-031** (complexity: 1) - Extend rate-limit middleware for AI inbound and Make callback routes
  - Add ai-inbound and make-callback endpoint types to getEndpointType().
  - Blocked by: T-029
  - Blocks: T-040

- [x] **T-032** (complexity: 1) - Create SocialAuditLogService
  - Single log() method; SocialAuditEvent const; swallows DB errors.
  - Blocked by: T-013
  - Blocks: T-033

- [x] **T-033** (complexity: 3) - Create SocialPostService — approve, reject, requestChanges
  - State machine enforcement; media check on approve; audit log calls.
  - Blocked by: T-032
  - Blocks: T-034

- [x] **T-034** (complexity: 3) - Extend SocialPostService — schedule, markReady, pause, unpause, archive
  - Future-date validation; weekday validation for WEEKLY; PUBLISHING guard on archive.
  - Blocked by: T-033
  - Blocks: T-035

- [ ] **T-035** (complexity: 3) - Extend SocialPostService — listPosts, getPostDetail, updatePost, promoteHashtag
  - safeIlike() search; nested detail; state-field block on update; hashtag upsert.
  - Blocked by: T-034
  - Blocks: T-036

---

## Phase: integration (API routes wiring, admin UI, dispatch + cron)

- [ ] **T-020** (complexity: 3) - Build admin UI catalog pages (hashtags, footers, campaigns, batches, audiences)
  - 5 TanStack Start route files; DataTable + modals + permission gates.
  - Blocked by: T-019
  - Blocks: T-021

- [ ] **T-021** (complexity: 2) - Build admin UI pages for platform-formats and settings
  - platform-formats DataTable (edit only, no create/delete); settings key-value table (masked secrets).
  - Blocked by: T-020
  - Blocks: T-022

- [ ] **T-022** (complexity: 1) - Add i18n translation keys for catalog UI (Phase 1)
  - Spanish locale keys for all Phase 1 pages.
  - Blocked by: T-020, T-021
  - Blocks: T-040

- [ ] **T-036** (complexity: 3) - Implement state-transition admin API routes (9 routes)
  - approve, reject, request-changes, schedule, mark-ready, pause, unpause, archive, promote-hashtag.
  - Blocked by: T-035
  - Blocks: T-037

- [ ] **T-037** (complexity: 3) - Implement admin post CRUD routes (list, detail, update, dashboard, publish-logs, audit-log)
  - 6 route files; includeDeleted=true requires SOCIAL_POST_HARD_DELETE; dashboard live webhook check.
  - Blocked by: T-036
  - Blocks: T-038, T-039

- [ ] **T-039** (complexity: 3) - Build admin UI post list page (/admin/social/posts)
  - DataTable with filters, status badges (color+text), platform icon row with aria-label, optimistic approve.
  - Blocked by: T-037
  - Blocks: T-040

- [ ] **T-040** (complexity: 3) - Build admin UI post detail page (/admin/social/posts/$id)
  - Tabs (Content/Media/Targets/Logs/Audit); sticky action bar; promote-hashtag modal; ARIA live regions.
  - Blocked by: T-039
  - Blocks: T-041

- [ ] **T-041** (complexity: 3) - Build admin social dashboard page (/admin/social)
  - KPI cards, quick-approval queue with optimistic update, recent failures, system alert for missing webhook.
  - Blocked by: T-040
  - Blocks: T-042

- [ ] **T-042** (complexity: 1) - Add i18n translation keys for Phase 3 admin UI (posts, dashboard)
  - Spanish locale keys; aria-labels with post title interpolation.
  - Blocked by: T-041
  - Blocks: T-043 (not a hard block — can proceed in parallel with Phase 4 if needed)

- [ ] **T-044** (complexity: 3) - Create SocialPublishDispatchService — findEligibleTargets and buildMakePayload
  - Complex query with 5 filter conditions; payload includes callback URLs.
  - Blocked by: T-043, T-013
  - Blocks: T-045

- [ ] **T-045** (complexity: 3) - Implement SocialPublishDispatchService — dispatchTarget with retry logic
  - Optimistic lock; live webhook URL read; 3-retry exhaustion logic.
  - Blocked by: T-044
  - Blocks: T-046

- [ ] **T-046** (complexity: 3) - Implement SocialPublishDispatchService — cascadePostStatus and rearmRecurrence
  - Terminal state detection; ONCE/WEEKLY/BIWEEKLY/MONTHLY next-run computation; clean-slate rearm (all targets reset).
  - Blocked by: T-045
  - Blocks: T-047

- [ ] **T-047** (complexity: 3) - Implement SocialPublishDispatchService — handleMakeCallbackClaim and handleMakeCallbackResult
  - Claim sets PUBLISHING; result SUCCESS/FAILED with retry logic and cascade.
  - Blocked by: T-046
  - Blocks: T-048

- [ ] **T-048** (complexity: 2) - Implement Make callback routes (claim and result)
  - POST /integrations/make/social/jobs/:targetId/claim and /result; x-hospeda-make-key auth.
  - Blocked by: T-047, T-025, T-043
  - Blocks: T-049

- [ ] **T-049** (complexity: 2) - Create social-publish-dispatch cron job
  - Every 5 minutes; live webhook URL check; sequential per-target dispatch; cron_runs logging.
  - Blocked by: T-048, T-025
  - Blocks: T-050

---

## Phase: testing (integration and E2E tests)

- [ ] **T-038** (complexity: 2) - Write integration test: full draft → approve → schedule → mark-ready flow
  - 8-step test with audit log verification at each step. Requires test DB.
  - Blocked by: T-037
  - Blocks: T-040 (soft; UI should not be blocked on this)

- [ ] **T-050** (complexity: 3) - Write integration test: full end-to-end pipeline
  - GPT draft → approve → mark-ready → cron dispatch → Make claim → Make result → PUBLISHED + WEEKLY rearm.
  - Blocked by: T-049
  - Blocks: T-051

- [ ] **T-051** (complexity: 2) - Write unit tests for dispatch cron edge cases
  - Paused post excluded, PUBLISHING lock, retry_count boundary, mixed cascade results.
  - Blocked by: T-050
  - Blocks: T-052

---

## Phase: cleanup

- [ ] **T-052** (complexity: 1) - Add Sentry feature tag and final integration verification
  - Tag all social routes with { feature: 'social-automation' }; full build+typecheck+lint+test run.
  - Blocked by: T-051
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no blockers, start immediately):
  T-001, T-003, T-023, T-043

Level 1 (blocked by level 0):
  T-002 (← T-001)
  T-012 (← T-003)
  T-024 (← T-023)

Level 2:
  T-004 (← T-002)
  T-015 (← T-012, T-014)
  T-025 (← T-024)

Level 3:
  T-005 (← T-004)
  T-026 (← T-025, T-013)
  T-027 (← T-025, T-013)

Level 4:
  T-006 (← T-005)

Level 5:
  T-007 (← T-005, T-006)

Level 6:
  T-008 (← T-007)

Level 7:
  T-009 (← T-008)

Level 8:
  T-010 (← T-009)

Level 9:
  T-011 (← T-010)

Level 10:
  T-013 (← T-011)

Level 11:
  T-014 (← T-002, T-013)
  T-032 (← T-013)

Level 12:
  T-015 (← T-012, T-014)
  T-028 (← T-027, T-014)
  T-033 (← T-032)

Level 13:
  T-016 (← T-014, T-015)
  T-029 (← T-028)
  T-034 (← T-033)

Level 14:
  T-017 (← T-016)
  T-031 (← T-029)
  T-035 (← T-034)

Level 15:
  T-018 (← T-016, T-017)
  T-036 (← T-035)

Level 16:
  T-019 (← T-018)
  T-030 (← T-018, T-029)
  T-037 (← T-036)

Level 17:
  T-020 (← T-019)
  T-038 (← T-037)
  T-039 (← T-037)

Level 18:
  T-021 (← T-020)
  T-040 (← T-039)

Level 19:
  T-022 (← T-020, T-021)
  T-041 (← T-040)

Level 20:
  T-042 (← T-041)
  T-044 (← T-043, T-013)

Level 21:
  T-045 (← T-044)

Level 22:
  T-046 (← T-045)

Level 23:
  T-047 (← T-046)

Level 24:
  T-048 (← T-047, T-025, T-043)

Level 25:
  T-049 (← T-048, T-025)

Level 26:
  T-050 (← T-049)

Level 27:
  T-051 (← T-050)

Level 28:
  T-052 (← T-051)
```

## Parallel Tracks

**Track A — DB Foundation** (T-001 → T-002 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-011 → T-013):
This is the critical-path spine. Everything depends on these DB tables existing.

**Track B — Permissions + Seed** (T-003 → T-012 → [waits for T-014] → T-015):
Can start in parallel with Track A from T-003.

**Track C — Env + Middleware** (T-023 → T-024 → T-025):
Can start in parallel immediately. T-023 and T-043 have no blockers.

**Track D — Make env** (T-043):
Start immediately, no blockers.

## Suggested Start

Begin with **T-001** (complexity: 2) - Create 10 social TS enums.

This is the foundation of the critical path. Run **T-003** and **T-023** and **T-043** in parallel on day 1 (all have no blockers).

Recommended day-1 parallel work:

1. T-001: 10 enum files (developer A)
2. T-003: 25 PermissionEnum values (developer A or B)
3. T-023 + T-043: env vars setup (developer B — fast tasks, ~30 min each)

After T-001+T-002 complete, T-004 unblocks and the DB schema chain can proceed sequentially (T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-010 → T-011).

Once T-013 unblocks (after T-011), T-014 and T-032 can run in parallel — this is where the backend and audit service tracks diverge productively.

The catalog UI (T-020 onward) should be done after the API routes (T-018, T-019) are in place, but can be developed partially using mocked data if needed.

Phase 4 (T-044 through T-052) should only begin after Phase 3 API routes are fully tested (T-038 must pass).
