# SPEC-034: On-Demand ISR Revalidation System

## Progress: 0/86 tasks (0%)

**Average Complexity:** 2.3/4 (max)
**Critical Path:** T-006 -> T-008 -> T-009 -> T-011 -> T-047 -> T-052 -> T-066 -> T-073 -> T-074 -> T-075 (10 steps)
**Parallel Tracks:** 6 tracks identified

---

### Setup Phase (T-001 – T-026)

- [ ] **T-001** (complexity: 2) - Update astro.config.mjs with ISR configuration
  - Add trailingSlash, bypassToken, expiration=86400, 8 exclude patterns to adapter config
  - Blocked by: none
  - Blocks: T-027..T-036

- [ ] **T-002** (complexity: 1) - Add HOSPEDA_REVALIDATION_SECRET to .env.example files
  - Add env var with openssl generate instructions to api and web .env.example
  - Blocked by: none
  - Blocks: none

- [ ] **T-003** (complexity: 2) - Add revalidation env vars to ApiEnvSchema
  - Add HOSPEDA_REVALIDATION_SECRET and HOSPEDA_REVALIDATION_CRON_SCHEDULE to apps/api/src/utils/env.ts
  - Blocked by: none
  - Blocks: T-021, T-082

- [ ] **T-004** (complexity: 2) - Add HOSPEDA_REVALIDATION_SECRET env validation to web app
  - Add to serverEnvSchema and add getRevalidationSecret() in apps/web/src/lib/env.ts
  - Blocked by: none
  - Blocks: none

- [ ] **T-005** (complexity: 1) - Add REVALIDATION permissions to PermissionEnum
  - Add REVALIDATION category + 4 permission values to packages/schemas/src/enums/permission.enum.ts
  - Blocked by: none
  - Blocks: T-026, T-066..T-071, T-074

- [ ] **T-006** (complexity: 2) - Create revalidation_config DB schema
  - Create packages/db/src/schemas/revalidation/revalidation-config.dbschema.ts
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-007** (complexity: 2) - Create revalidation_log DB schema
  - Create packages/db/src/schemas/revalidation/revalidation-log.dbschema.ts with 4 indexes
  - Blocked by: none
  - Blocks: T-008

- [ ] **T-008** (complexity: 1) - Create DB schemas barrel and update packages/db/src/schemas/index.ts
  - Blocked by: T-006, T-007
  - Blocks: T-009, T-010, T-025

- [ ] **T-009** (complexity: 2) - Create RevalidationConfigModel
  - Extend BaseModel, add findByEntityType() and findAllEnabled()
  - Blocked by: T-008
  - Blocks: T-011, T-016

- [ ] **T-010** (complexity: 3) - Create RevalidationLogModel
  - Extend BaseModel, add deleteOlderThan() and findLastCronEntry()
  - Blocked by: T-008
  - Blocks: T-011

- [ ] **T-011** (complexity: 1) - Create DB models barrel and update packages/db/src/models/index.ts
  - Blocked by: T-009, T-010
  - Blocks: T-047, T-052, T-067, T-069, T-070, T-071

- [ ] **T-012** (complexity: 2) - Create Zod schemas: revalidation-config
  - RevalidationEntityTypeEnum (8 values), RevalidationConfigSchema, UpdateRevalidationConfigInputSchema
  - Blocked by: none
  - Blocks: T-015

- [ ] **T-013** (complexity: 2) - Create Zod schemas: revalidation-log
  - RevalidationTriggerEnum, RevalidationStatusEnum, RevalidationLogSchema, RevalidationLogFilterSchema
  - Blocked by: none
  - Blocks: T-015

- [ ] **T-014** (complexity: 2) - Create Zod schemas: revalidation HTTP request/response
  - ManualRevalidateRequestSchema, RevalidateEntityRequestSchema, RevalidationResponseSchema, RevalidationStatsSchema
  - Blocked by: none
  - Blocks: T-015

- [ ] **T-015** (complexity: 1) - Create schemas barrel and update packages/schemas/src/entities/index.ts
  - Blocked by: T-012, T-013, T-014
  - Blocks: T-024, T-066..T-071, T-074

- [ ] **T-016** (complexity: 2) - Create revalidation_config seed data and seed function
  - defaults.json with 8 entity configs, seedRevalidationConfig function
  - Blocked by: T-009
  - Blocks: T-017

- [ ] **T-017** (complexity: 1) - Register seedRevalidationConfig in required seed manifest
  - Blocked by: T-016
  - Blocks: none

- [ ] **T-018** (complexity: 2) - Implement RevalidationAdapter interface and VercelRevalidationAdapter
  - packages/service-core/src/revalidation/adapters/revalidation.adapter.ts
  - Blocked by: none
  - Blocks: T-019

- [ ] **T-019** (complexity: 2) - Implement NoOpRevalidationAdapter and adapter factory
  - NoOpRevalidationAdapter + createRevalidationAdapter(env) factory function
  - Blocked by: T-018
  - Blocks: T-020, T-038

- [ ] **T-020** (complexity: 2) - Write unit tests for RevalidationAdapter implementations
  - Test both Vercel and NoOp adapters; mock fetch for VercelRevalidationAdapter
  - Blocked by: T-019
  - Blocks: none

- [ ] **T-021** (complexity: 3) - Implement EntityPathMapper
  - packages/service-core/src/revalidation/entity-path-mapper.ts: getAffectedPaths() for 8 entity types
  - Blocked by: T-003
  - Blocks: T-022

- [ ] **T-022** (complexity: 3) - Write unit tests for EntityPathMapper
  - Test each entity type's path generation with all locales; edge cases for slugs
  - Blocked by: T-021
  - Blocks: none

- [ ] **T-023** (complexity: 3) - Implement RevalidationService
  - packages/service-core/src/revalidation/revalidation.service.ts with debouncing, path resolvers, fire-and-forget
  - Blocked by: T-019, T-021
  - Blocks: T-024, T-046

- [ ] **T-024** (complexity: 3) - Implement initializeRevalidationService and getRevalidationService
  - Singleton pattern in packages/service-core/src/revalidation/revalidation-init.ts
  - Blocked by: T-015, T-023
  - Blocks: T-025, T-047

- [ ] **T-025** (complexity: 1) - Export revalidation module from service-core index
  - Add exports to packages/service-core/src/index.ts
  - Blocked by: T-008, T-024
  - Blocks: T-054, T-080

- [ ] **T-026** (complexity: 2) - Add revalidation permissions to seed admin role
  - Add 4 REVALIDATION_* permissions to admin role in packages/seed
  - Blocked by: T-005
  - Blocks: none

### Core Phase (T-027 – T-054)

- [ ] **T-027** (complexity: 2) - Migrate /alojamientos page to SSR
  - Remove `export const prerender = true`, ensure no getStaticPaths
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-028** (complexity: 2) - Migrate /alojamientos/[slug] page to SSR
  - Remove prerender, replace getStaticPaths with dynamic params
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-029** (complexity: 2) - Migrate /destinos/[slug] page to SSR
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-030** (complexity: 2) - Migrate /eventos page to SSR
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-031** (complexity: 2) - Migrate /eventos/[slug] page to SSR
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-032** (complexity: 2) - Migrate /posts/[slug] page to SSR
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-033** (complexity: 2) - Verify /alojamientos/tipo/[tipo] is already SSR
  - Confirm no prerender, validate dynamic routing still works
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-034** (complexity: 2) - Verify /eventos/categoria/[cat] is already SSR
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-035** (complexity: 2) - Verify /search page is already SSR
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-036** (complexity: 2) - Verify index page server islands pattern
  - Confirm homepage uses server:defer correctly and doesn't need ISR
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-037** (complexity: 1) - Document ISR pattern in apps/web/CLAUDE.md
  - Add ISR section explaining SSR pages vs excluded routes, bypass token usage
  - Blocked by: T-001
  - Blocks: none

- [ ] **T-038** (complexity: 3) - Write integration tests for adapter factory
  - Test createRevalidationAdapter returns correct adapter per NODE_ENV
  - Blocked by: T-019
  - Blocks: none

- [ ] **T-039** (complexity: 3) - Add _afterCreate hook to AccommodationService
  - Call revalidationService?.scheduleRevalidation() fire-and-forget in hook
  - Blocked by: T-024
  - Blocks: T-046

- [ ] **T-040** (complexity: 3) - Add _afterUpdate hook to AccommodationService
  - Blocked by: T-024
  - Blocks: T-046

- [ ] **T-041** (complexity: 3) - Add _afterDelete hook to AccommodationService
  - Blocked by: T-024
  - Blocks: T-046

- [ ] **T-042** (complexity: 3) - Add service hooks to DestinationService
  - _afterCreate, _afterUpdate, _afterDelete
  - Blocked by: T-024
  - Blocks: T-046

- [ ] **T-043** (complexity: 3) - Add service hooks to EventService
  - _afterCreate, _afterUpdate, _afterDelete
  - Blocked by: T-024
  - Blocks: T-046

- [ ] **T-044** (complexity: 3) - Add service hooks to PostService
  - _afterCreate, _afterUpdate, _afterDelete
  - Blocked by: T-024
  - Blocks: T-046

- [ ] **T-045** (complexity: 3) - Add service hooks to review/tag/amenity services
  - AccommodationReviewService, DestinationReviewService, TagService, AmenityService
  - Blocked by: T-024
  - Blocks: T-046

- [ ] **T-046** (complexity: 3) - Write unit tests for service hooks
  - Verify fire-and-forget pattern; mock revalidationService; test each service hook
  - Blocked by: T-039..T-045, T-023
  - Blocks: none

- [ ] **T-047** (complexity: 3) - Implement revalidation API module bootstrap
  - Call initializeRevalidationService in apps/api/src/index.ts startup
  - Blocked by: T-024, T-011
  - Blocks: T-048

- [ ] **T-048** (complexity: 3) - Create revalidation router skeleton
  - apps/api/src/routes/revalidation/index.ts with Hono router
  - Blocked by: T-047
  - Blocks: T-066..T-071

- [ ] **T-049** (complexity: 2) - Mount revalidation router in API app
  - Register /api/v1/admin/revalidation/* in apps/api/src/index.ts
  - Blocked by: T-048
  - Blocks: none

- [ ] **T-050** (complexity: 3) - Write unit tests for EntityPathMapper edge cases
  - Slug normalization, missing locales, unknown entity types, null values
  - Blocked by: T-022
  - Blocks: none

- [ ] **T-051** (complexity: 3) - Write unit tests for RevalidationService
  - Mock adapter; test debounce, scheduleRevalidation, revalidateByEntityType; error isolation
  - Blocked by: T-023
  - Blocks: none

- [ ] **T-052** (complexity: 3) - Implement revalidation stats endpoint helper
  - RevalidationStatsService reading from RevalidationLogModel
  - Blocked by: T-011
  - Blocks: T-070

- [ ] **T-053** (complexity: 3) - Write integration tests for revalidation API endpoints
  - Test auth/permission guards on all 7 endpoints
  - Blocked by: T-066..T-071, T-074
  - Blocks: none

- [ ] **T-054** (complexity: 2) - Export RevalidationService types from service-core
  - Ensure all public types are exported from packages/service-core/src/index.ts
  - Blocked by: T-025
  - Blocks: none

### Integration Phase (T-055 – T-086)

- [ ] **T-055** (complexity: 2) - Add revalidation i18n keys (es/en/pt)
  - Add keys for all revalidation UI labels in all 3 locales
  - Blocked by: none
  - Blocks: T-073

- [ ] **T-066** (complexity: 3) - Implement POST /revalidate/manual endpoint
  - createAdminRoute factory, REVALIDATION_TRIGGER permission, ManualRevalidateRequestSchema
  - Blocked by: T-005, T-015, T-048
  - Blocks: T-053

- [ ] **T-067** (complexity: 3) - Implement POST /revalidate/entity endpoint
  - Blocked by: T-005, T-011, T-015, T-048
  - Blocks: T-053

- [ ] **T-068** (complexity: 3) - Implement POST /revalidate/type endpoint
  - Blocked by: T-005, T-015, T-048
  - Blocks: T-053

- [ ] **T-069** (complexity: 3) - Implement GET /revalidation/config and PATCH /revalidation/config/:id
  - Read and update revalidation configs from DB
  - Blocked by: T-005, T-011, T-015, T-048
  - Blocks: T-053

- [ ] **T-070** (complexity: 3) - Implement GET /revalidation/logs endpoint
  - Paginated log listing with filters
  - Blocked by: T-052, T-005, T-011, T-015, T-048
  - Blocks: T-053

- [ ] **T-071** (complexity: 3) - Implement GET /revalidation/stats endpoint
  - Blocked by: T-005, T-011, T-015, T-048
  - Blocks: T-053

- [ ] **T-072** (complexity: 3) - Implement GET /revalidation/health endpoint
  - Check adapter connectivity, return service status
  - Blocked by: T-048
  - Blocks: none

- [ ] **T-073** (complexity: 3) - Create RevalidateEntityButton admin component
  - apps/admin/src/components/RevalidateEntityButton.tsx with TanStack Query mutation
  - Blocked by: T-055
  - Blocks: T-074

- [ ] **T-074** (complexity: 4) - Create admin revalidation management page
  - apps/admin/src/routes/_authed/revalidation/index.tsx: tabs for config, logs, manual trigger
  - Blocked by: T-005, T-015, T-073
  - Blocks: T-075

- [ ] **T-075** (complexity: 3) - Create TanStack Query hooks for revalidation API
  - useRevalidationConfig, useRevalidationLogs, useManualRevalidate, useRevalidateEntity
  - Blocked by: T-074
  - Blocks: none

- [ ] **T-076** (complexity: 2) - Add revalidation route to admin navigation
  - Add menu item to admin sidebar/nav
  - Blocked by: T-074
  - Blocks: none

- [ ] **T-077** (complexity: 2) - Add billing HTTP adapter updates for revalidation
  - Update apps/admin/src/lib/billing-http-adapter/ if needed for new endpoints
  - Blocked by: T-066
  - Blocks: none

- [ ] **T-078** (complexity: 2) - Create admin revalidation config edit form
  - Form for editing debounceSeconds, cronIntervalMinutes, autoRevalidateOnChange per entity
  - Blocked by: T-074
  - Blocks: none

- [ ] **T-079** (complexity: 2) - Create revalidation logs table component
  - Paginated table showing revalidation history with filters
  - Blocked by: T-074
  - Blocks: none

- [ ] **T-080** (complexity: 2) - Create revalidation HTTP adapter in admin
  - apps/admin/src/lib/revalidation-http-adapter/ with typed fetch functions
  - Blocked by: T-025
  - Blocks: T-075

- [ ] **T-081** (complexity: 2) - Write E2E smoke test for manual revalidation flow
  - Playwright test: trigger manual revalidation, verify log entry created
  - Blocked by: T-066, T-074
  - Blocks: none

- [ ] **T-082** (complexity: 3) - Create page-revalidation.job.ts cron job
  - Interval-based revalidation per entity type based on cronIntervalMinutes from config
  - Blocked by: T-052, T-003
  - Blocks: T-083, T-084

- [ ] **T-083** (complexity: 3) - Implement stale detection in page-revalidation.job.ts
  - Query entities updated in last 48h; trigger revalidation for stale ones
  - Blocked by: T-082
  - Blocks: T-084

- [ ] **T-084** (complexity: 1) - Register pageRevalidationJob in cron registry
  - Blocked by: T-083
  - Blocks: T-085, T-086

### Testing Phase

- [ ] **T-085** (complexity: 3) - Write unit tests for page revalidation cron job
  - Test interval check, stale detection, log cleanup, dryRun mode
  - Blocked by: T-084
  - Blocks: none

- [ ] **T-086** (complexity: 2) - Verify cron integration with existing cron infrastructure
  - Manual integration verification: job appears in list, log entries created
  - Blocked by: T-084
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no deps, start here):
  T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-012, T-013, T-014,
  T-018, T-055

Level 1:
  T-008 (T-006+T-007), T-015 (T-012+T-013+T-014), T-019 (T-018)

Level 2:
  T-009 (T-008), T-010 (T-008), T-020 (T-019), T-021 (T-003)
  T-027..T-036 (T-001), T-037 (T-001)

Level 3:
  T-011 (T-009+T-010), T-016 (T-009), T-022 (T-021)

Level 4:
  T-017 (T-016), T-023 (T-019+T-021), T-024 (T-015+T-023)

Level 5:
  T-025 (T-008+T-024), T-026 (T-005), T-047 (T-024+T-011)
  T-039..T-045 (T-024)

Level 6:
  T-048 (T-047), T-052 (T-011), T-054 (T-025)
  T-046 (T-039..T-045+T-023)

Level 7:
  T-049 (T-048), T-066..T-071 (T-048+T-005+T-015), T-073 (T-055)
  T-082 (T-052+T-003)

Level 8:
  T-053 (T-066..T-071), T-072 (T-048), T-074 (T-073+T-005+T-015)
  T-083 (T-082)

Level 9:
  T-075 (T-074), T-076 (T-074), T-078 (T-074), T-079 (T-074)
  T-084 (T-083)

Level 10:
  T-085 (T-084), T-086 (T-084), T-081 (T-066+T-074)
```

---

## Suggested Start

Begin in parallel with these tasks — all have zero dependencies:

1. **T-001** (complexity: 2) - Update astro.config.mjs — unblocks 10 page migration tasks
2. **T-006** (complexity: 2) - Create revalidation_config DB schema — critical path to models
3. **T-007** (complexity: 2) - Create revalidation_log DB schema — critical path to models
4. **T-012** (complexity: 2) - Create Zod schemas: revalidation-config
5. **T-013** (complexity: 2) - Create Zod schemas: revalidation-log
6. **T-014** (complexity: 2) - Create Zod schemas: HTTP request/response
7. **T-018** (complexity: 2) - RevalidationAdapter interface — critical path to service
8. **T-005** (complexity: 1) - Add REVALIDATION permissions — unblocks all API routes
9. **T-003** (complexity: 2) - Add env vars to ApiEnvSchema — unblocks EntityPathMapper
10. **T-055** (complexity: 2) - Add i18n keys — unblocks admin UI
