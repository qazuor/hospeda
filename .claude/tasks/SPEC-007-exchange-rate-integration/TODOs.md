# SPEC-007: Exchange Rate Integration

## Progress: 38/38 tasks completed (100%) - COMPLETED

**Average Complexity:** 2.7/4 (max)
**Critical Path:** T-001 -> T-006 -> T-007 -> T-016 -> T-020 -> T-027 -> T-029 -> T-033 -> T-034 -> T-038 (10 steps)
**Parallel Tracks:** 5 tracks identified

> **Last update:** 2026-02-15 - All tasks completed. Admin UI phase finished (T-033..T-038). Route page created at /billing/exchange-rates with 3-tab interface, sidebar navigation, and routeTree registration.

---

### Setup Phase (5/5 tasks completed, avg complexity: 1.8)

- [x] **T-001** (complexity: 1) - Add BRL to PriceCurrencyEnum
  - Add BRL to existing currency enum in schemas and verify DB enum derives correctly
  - Blocked by: none | Blocks: T-006, T-010
  - ~~Note: Unit test missing~~ RESOLVED

- [x] **T-002** (complexity: 2) - Create ExchangeRateType and ExchangeRateSource enums
  - Create enums for rate types (oficial, blue, mep, ccl, tarjeta, standard) and sources (dolarapi, exchangerate-api, manual)
  - Blocked by: none | Blocks: T-006, T-008, T-010, T-011
  - ~~Note: Unit tests missing~~ RESOLVED

- [x] **T-003** (complexity: 2) - Add exchange rate permissions to PermissionEnum
  - Add 6 new permissions: VIEW, CREATE, UPDATE, DELETE, CONFIG_UPDATE, FETCH
  - Blocked by: none | Blocks: T-015
  - ~~Note: Unit test missing~~ RESOLVED

- [x] **T-004** (complexity: 2) - Add exchange rate environment variables
  - Add HOSPEDA_EXCHANGE_RATE_API_KEY and API base URLs to config package
  - Blocked by: none | Blocks: T-018, T-019
  - ~~Issue: env var inconsistency~~ RESOLVED

- [x] **T-005** (complexity: 2) - Add i18n translation strings for exchange rates
  - Add Spanish/English translation strings for exchange rate labels, types, errors, admin UI
  - Blocked by: none | Blocks: none

### Core Phase - Schemas (4/4 tasks completed, avg complexity: 2.5)

- [x] **T-006** (complexity: 3) - Create ExchangeRate Zod schema
  - Main schema with currency pair, rate, inverseRate, rateType, source, timestamps
  - Blocked by: T-001, T-002 | Blocks: T-007, T-010, T-021

- [x] **T-007** (complexity: 3) - Create ExchangeRate CRUD schemas
  - Create/Update/Delete/Restore/Search/Convert input/output schemas
  - Blocked by: T-006 | Blocks: T-016

- [x] **T-008** (complexity: 2) - Create ExchangeRateConfig Zod schema
  - Singleton config schema with fetch intervals, defaults, disclaimer settings
  - Blocked by: T-002 | Blocks: T-009, T-011

- [x] **T-009** (complexity: 2) - Create ExchangeRateConfig CRUD schemas
  - Update and Get schemas for singleton config management
  - Blocked by: T-008 | Blocks: T-017

### Core Phase - Database (5/5 tasks completed, avg complexity: 2.4)

- [x] **T-010** (complexity: 3) - Create exchange_rates DB table schema
  - Drizzle table with currency pair, rate, indexes for lookups
  - Blocked by: T-001, T-002 | Blocks: T-012, T-014

- [x] **T-011** (complexity: 2) - Create exchange_rate_config DB table schema
  - Drizzle singleton config table with fetch intervals and defaults
  - Blocked by: T-002 | Blocks: T-013, T-014

- [x] **T-012** (complexity: 3) - Create ExchangeRateModel
  - Model with findLatestRate, findLatestRates, findRateHistory, findManualOverrides
  - Blocked by: T-010 | Blocks: T-016
  - 13 unit tests passing. Services refactored to delegate to model methods.

- [x] **T-013** (complexity: 2) - Create ExchangeRateConfigModel
  - Model with getConfig (with default creation) and updateConfig
  - Blocked by: T-011 | Blocks: T-017
  - 10 unit tests passing. Service refactored to delegate to model methods.

- [x] **T-014** (complexity: 2) - Generate and verify database migration
  - Generate Drizzle migration for both tables and apply
  - Blocked by: T-010, T-011 | Blocks: T-031

### Core Phase - Service (7/7 tasks completed, avg complexity: 3.0)

- [x] **T-015** (complexity: 2) - Create exchange rate permission checks
  - 6 permission check functions following tag.permissions.ts pattern
  - Blocked by: T-003 | Blocks: T-016, T-017

- [x] **T-016** (complexity: 4) - Create ExchangeRateService basic CRUD
  - Service with CRUD + getLatestRate, createManualOverride, removeManualOverride
  - Blocked by: T-007, T-012, T-015 | Blocks: T-020, T-022, T-023, T-024, T-025, T-028
  - *Note: Contains some query logic that spec says should be in T-012 model*

- [x] **T-017** (complexity: 3) - Create ExchangeRateConfigService
  - Singleton config service with getConfig and updateConfig
  - Blocked by: T-009, T-013, T-015 | Blocks: T-026, T-030
  - *Note: Contains singleton logic that spec says should be in T-013 model*

- [x] **T-018** (complexity: 3) - Create DolarAPI client
  - HTTP client for dolarapi.com with response normalization
  - Blocked by: T-004 | Blocks: T-020

- [x] **T-019** (complexity: 3) - Create ExchangeRate-API client
  - HTTP client for exchangerate-api.com with API key auth
  - Blocked by: T-004 | Blocks: T-020

- [x] **T-020** (complexity: 4) - Create exchange rate fetcher with fallback chain
  - Priority chain: manual override -> DolarAPI -> ExchangeRate-API -> DB fallback
  - Blocked by: T-016, T-018, T-019 | Blocks: T-027, T-030

- [x] **T-021** (complexity: 2) - Create rate conversion helper functions
  - convertAmount, calculateInverseRate, formatConvertedAmount, isRateStale
  - Blocked by: T-006 | Blocks: T-023

### Integration Phase - API Routes (8/8 tasks completed, avg complexity: 2.8)

- [x] **T-022** (complexity: 3) - Create public list exchange rates route
  - GET /api/v1/public/exchange-rates with optional filters
  - Blocked by: T-016 | Blocks: T-029

- [x] **T-023** (complexity: 3) - Create public convert amount route
  - GET /api/v1/public/exchange-rates/convert with from/to/amount params
  - Blocked by: T-016, T-021 | Blocks: T-029

- [x] **T-024** (complexity: 3) - Create admin set manual rate override route
  - POST /api/v1/protected/exchange-rates (EXCHANGE_RATE_CREATE permission)
  - Blocked by: T-016 | Blocks: T-029

- [x] **T-025** (complexity: 2) - Create admin delete rate override route
  - DELETE /api/v1/protected/exchange-rates/:id (manual overrides only)
  - Blocked by: T-016 | Blocks: T-029

- [x] **T-026** (complexity: 3) - Create admin update config route
  - PUT /api/v1/protected/exchange-rates/config
  - Blocked by: T-017 | Blocks: T-029

- [x] **T-027** (complexity: 3) - Create admin fetch-now trigger route
  - POST /api/v1/protected/exchange-rates/fetch-now
  - Blocked by: T-020 | Blocks: T-029

- [x] **T-028** (complexity: 3) - Create admin rate history route
  - GET /api/v1/protected/exchange-rates/history with pagination and filters
  - Blocked by: T-016 | Blocks: T-029
  - ~~Note: Date range filters not used~~ RESOLVED

- [x] **T-029** (complexity: 2) - Register all exchange rate routes in API app
  - Create index.ts and register in main router
  - Blocked by: T-022, T-023, T-024, T-025, T-026, T-027, T-028 | Blocks: T-033

### Integration Phase - Cron & Seeds (3/3 tasks completed, avg complexity: 3.0)

- [x] **T-030** (complexity: 4) - Implement exchange rate cron scheduler
  - Interval-based auto-fetching with configurable intervals
  - Blocked by: T-020, T-017 | Blocks: none

- [x] **T-031** (complexity: 2) - Create exchange rate seed data files
  - JSON seed files for default config and initial rates
  - Blocked by: T-014 | Blocks: T-032

- [x] **T-032** (complexity: 3) - Create exchange rate seed factory and register in manifest
  - Seed factory following createSeedFactory pattern
  - Blocked by: T-031, T-016 | Blocks: none

### Admin UI Phase (6/6 tasks completed, avg complexity: 3.5)

- [x] **T-033** (complexity: 4) - Create exchange rates admin feature configuration
  - Feature config, TanStack Query hooks, admin-specific types
  - Implemented in apps/admin/src/features/exchange-rates/ (types.ts, hooks.ts, index.ts)

- [x] **T-034** (complexity: 4) - Create exchange rates admin table component
  - getExchangeRateColumns() in columns.tsx with badges, staleness, delete action

- [x] **T-035** (complexity: 3) - Create manual rate override dialog form
  - ManualOverrideDialog.tsx with TanStack Form and Zod validation

- [x] **T-036** (complexity: 3) - Create fetch configuration form
  - FetchConfigForm.tsx with interval settings, toggles, disclaimer text

- [x] **T-037** (complexity: 4) - Create rate history view component
  - RateHistoryView.tsx with filters, pagination, and source attribution

- [x] **T-038** (complexity: 3) - Create exchange rates admin route page
  - Route at /billing/exchange-rates with 3-tab interface and sidebar navigation

---

## Known Issues (from 2026-02-14 audit)

1. ~~**T-004 env var inconsistency**~~: RESOLVED (2026-02-15). Renamed to `HOSPEDA_EXCHANGE_RATE_API_KEY` in env.ts, convert.ts, fetch-now.ts, and test/setup.ts.
2. ~~**T-012/T-013 model methods**~~: RESOLVED (2026-02-15). Methods implemented in models, services refactored to delegate.
3. ~~**T-028 date filters**~~: RESOLVED (2026-02-15). Added fromDate/toDate to ExchangeRateSearchInputSchema, added findAllWithDateRange to model, updated _executeSearch and history route.
4. ~~**T-001/T-002/T-003 missing unit tests**~~: RESOLVED (2026-02-15). Created exchange-rate-enums.test.ts with 17 tests covering all 3 enums, schemas, and permissions.

## Dependency Graph

```
Level 0: T-001, T-002, T-003, T-004, T-005
Level 1: T-006, T-008, T-010, T-011, T-015, T-018, T-019
Level 2: T-007, T-009, T-012, T-013, T-014, T-021
Level 3: T-016, T-017
Level 4: T-020, T-022, T-023, T-024, T-025, T-026, T-028, T-031
Level 5: T-027, T-029, T-030, T-032
Level 6: T-033
Level 7: T-034, T-035, T-036, T-037
Level 8: T-038

```

## Parallel Tracks

1. **Schemas Track:** T-001/T-002 -> T-006/T-008 -> T-007/T-009 (DONE)
2. **Database Track:** T-001/T-002 -> T-010/T-011 -> T-012/T-013 -> T-014 (DONE)
3. **Permissions Track:** T-003 -> T-015 (DONE)
4. **External API Track:** T-004 -> T-018/T-019 (DONE)
5. **Admin UI Track:** T-033 -> T-034/T-035/T-036/T-037 -> T-038 (DONE)

## Status: COMPLETED

All 38 tasks have been implemented and verified. The exchange rate integration feature is complete across all layers: schemas, database, services, API routes, cron jobs, seed data, and admin UI.
