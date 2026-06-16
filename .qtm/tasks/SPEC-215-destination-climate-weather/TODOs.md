# SPEC-215: Destination climate & live weather

## Progress: 0/28 tasks (0%)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-004 -> T-008 -> T-009 -> T-010 -> T-011 -> T-028 (6 steps)
**Parallel Tracks:** seasonal (Part A) and live-weather (Part B) run largely independent until web.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add climate and weather_current jsonb columns to destination dbschema
  - Two nullable jsonb columns following the JSONB subtype pattern.
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 2) - Generate and apply structural migration for the new columns
  - db:generate + db:migrate + db:apply-extras; drift guard clean.
  - Blocked by: T-001
  - Blocks: T-006, T-007

### Core Phase

- [ ] **T-003** (complexity: 2) - Create ClimateSeasonEnum and DestinationClimateSchema subtype
  - Blocked by: none
  - Blocks: T-005, T-018, T-026

- [ ] **T-004** (complexity: 3) - Create weather Zod schemas (WMO enum, current, daily, cache)
  - Cache = { current, daily[16], fetchedAt }.
  - Blocked by: none
  - Blocks: T-005, T-007, T-008, T-020, T-026

- [ ] **T-005** (complexity: 2) - Wire climate + weatherCurrent into DestinationSchema, remove dead HTTP stubs
  - Blocked by: T-003, T-004
  - Blocks: T-006, T-015

- [ ] **T-006** (complexity: 3) - Include climate in destination service CRUD, remove silent-drop logic
  - Blocked by: T-005, T-002
  - Blocks: T-016, T-019, T-021

- [ ] **T-007** (complexity: 2) - Add weather cache read/write to the service
  - Blocked by: T-004, T-002
  - Blocks: T-010, T-013

- [ ] **T-008** (complexity: 2) - Create WMO weather_code -> internal condition + icon mapping
  - Blocked by: T-004
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Implement Open-Meteo client (current + 16-day daily forecast)
  - Blocked by: T-008
  - Blocks: T-010

### Integration Phase

- [ ] **T-010** (complexity: 3) - Implement destination-weather-fetch cron job
  - Advisory lock, withTransaction, dryRun, per-destination failure tolerance.
  - Blocked by: T-007, T-009
  - Blocks: T-011, T-012

- [ ] **T-011** (complexity: 2) - Register weather cron in manifest + registry (12h)
  - Blocked by: T-010
  - Blocks: T-028

- [ ] **T-012** (complexity: 2) - Cron dry-run test
  - Blocked by: T-010
  - Blocks: none

- [ ] **T-013** (complexity: 2) - Add public GET /destinations/:id/weather endpoint
  - Blocked by: T-007
  - Blocks: T-014, T-022, T-027

- [ ] **T-014** (complexity: 2) - Integration test for the public weather endpoint
  - Blocked by: T-013
  - Blocks: none

- [ ] **T-015** (complexity: 3) - Create admin Climate section config (TanStack Form)
  - Blocked by: T-005
  - Blocks: T-016

- [ ] **T-016** (complexity: 2) - Wire Climate section into the destination edit form
  - Blocked by: T-015, T-006
  - Blocks: T-017, T-028

- [ ] **T-017** (complexity: 2) - Admin Climate section component test
  - Blocked by: T-016
  - Blocks: none

- [ ] **T-018** (complexity: 3) - Offline helper deriving seasonal averages from Open-Meteo Climate API
  - Blocked by: T-003
  - Blocks: T-019

- [ ] **T-019** (complexity: 2) - Populate climate in seed JSON for featured destinations
  - Blocked by: T-018, T-006
  - Blocks: none

- [ ] **T-020** (complexity: 2) - Web WMO -> icon (@repo/icons) + i18n label mapping
  - Blocked by: T-004
  - Blocks: T-022

- [ ] **T-021** (complexity: 3) - Build DestinationClimateCard.astro (seasonal SSR)
  - Blocked by: T-006, T-024
  - Blocks: T-023

- [ ] **T-022** (complexity: 3) - Build DestinationWeatherLive.client.tsx island (current + 16-day forecast)
  - Blocked by: T-013, T-020, T-025
  - Blocks: T-023, T-027

- [ ] **T-023** (complexity: 2) - Wire card into sidebar, remove placeholder
  - Blocked by: T-021, T-022
  - Blocks: T-028

- [ ] **T-024** (complexity: 2) - Complete i18n climate/season keys (es/en/pt)
  - Blocked by: none
  - Blocks: T-021

- [ ] **T-025** (complexity: 2) - Add i18n WMO weather condition labels (es/en/pt)
  - Blocked by: none
  - Blocks: T-022

### Testing Phase

- [ ] **T-026** (complexity: 2) - Schema unit tests for climate and weather schemas
  - Blocked by: T-003, T-004
  - Blocks: none

- [ ] **T-027** (complexity: 3) - Graceful-degradation tests (US-3)
  - Blocked by: T-013, T-022
  - Blocks: none

### Docs Phase

- [ ] **T-028** (complexity: 2) - Document weather cron and climate admin field
  - Blocked by: T-011, T-016, T-023
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-004, T-024, T-025
Level 1: T-002, T-005, T-008, T-018, T-020, T-026
Level 2: T-006, T-007, T-009, T-015
Level 3: T-010, T-013, T-016, T-019, T-021
Level 4: T-011, T-012, T-014, T-017, T-022
Level 5: T-023, T-027
Level 6: T-028

## Suggested Start

Begin with **T-004** (complexity: 3) - it has no dependencies, sits on the critical path, and
unblocks 5 tasks. In parallel you can start **T-001** (DB columns) and **T-003** (climate schema).
