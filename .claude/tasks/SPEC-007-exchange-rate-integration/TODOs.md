# SPEC-007: Exchange Rate Integration

## Progress: 15/38 tasks (39%)

**Average Complexity:** 2.7/4 (max)
**Critical Path:** T-001 -> T-006 -> T-007 -> T-016 -> T-020 -> T-027 -> T-029 -> T-033 -> T-034 -> T-038 (10 steps)
**Parallel Tracks:** 5 tracks identified

---

### Setup Phase (5 tasks, avg complexity: 1.8)

- [x] **T-001** (complexity: 1) - Add BRL to PriceCurrencyEnum
  - Add BRL to existing currency enum in schemas and verify DB enum derives correctly
  - Blocked by: none
  - Blocks: T-006, T-010

- [x] **T-002** (complexity: 2) - Create ExchangeRateType and ExchangeRateSource enums
  - Create enums for rate types (oficial, blue, mep, ccl, tarjeta, standard) and sources (dolarapi, exchangerate-api, manual)
  - Blocked by: none
  - Blocks: T-006, T-008, T-010, T-011

- [x] **T-003** (complexity: 2) - Add exchange rate permissions to PermissionEnum
  - Add 6 new permissions: VIEW, CREATE, UPDATE, DELETE, CONFIG_UPDATE, FETCH
  - Blocked by: none
  - Blocks: T-015

- [x] **T-004** (complexity: 2) - Add exchange rate environment variables
  - Add HOSPEDA_EXCHANGE_RATE_API_KEY and API base URLs to config package
  - Blocked by: none
  - Blocks: T-018, T-019

- [x] **T-005** (complexity: 2) - Add i18n translation strings for exchange rates
  - Add Spanish translation strings for exchange rate labels, types, errors, admin UI
  - Blocked by: none
  - Blocks: none

### Core Phase - Schemas (4 tasks, avg complexity: 2.5)

- [x] **T-006** (complexity: 3) - Create ExchangeRate Zod schema
  - Main schema with currency pair, rate, inverseRate, rateType, source, timestamps
  - Blocked by: T-001, T-002
  - Blocks: T-007, T-010, T-021

- [x] **T-007** (complexity: 3) - Create ExchangeRate CRUD schemas
  - Create/Update/Delete/Restore/Search/Convert input/output schemas
  - Blocked by: T-006
  - Blocks: T-016

- [x] **T-008** (complexity: 2) - Create ExchangeRateConfig Zod schema
  - Singleton config schema with fetch intervals, defaults, disclaimer settings
  - Blocked by: T-002
  - Blocks: T-009, T-011

- [x] **T-009** (complexity: 2) - Create ExchangeRateConfig CRUD schemas
  - Update and Get schemas for singleton config management
  - Blocked by: T-008
  - Blocks: T-017

### Core Phase - Database (5 tasks, avg complexity: 2.4)

- [x] **T-010** (complexity: 3) - Create exchange_rates DB table schema
  - Drizzle table with currency pair, rate, indexes for lookups
  - Blocked by: T-001, T-002
  - Blocks: T-012, T-014

- [x] **T-011** (complexity: 2) - Create exchange_rate_config DB table schema
  - Drizzle singleton config table with fetch intervals and defaults
  - Blocked by: T-002
  - Blocks: T-013, T-014

- [x] **T-012** (complexity: 3) - Create ExchangeRateModel
  - Model with findLatestRate, findLatestRates, findRateHistory, findManualOverrides
  - Blocked by: T-010
  - Blocks: T-016

- [x] **T-013** (complexity: 2) - Create ExchangeRateConfigModel
  - Model with getConfig (with default creation) and updateConfig
  - Blocked by: T-011
  - Blocks: T-017

- [ ] **T-014** (complexity: 2) - Generate and verify database migration
  - Generate Drizzle migration for both tables and apply
  - Blocked by: T-010, T-011
  - Blocks: T-031

### Core Phase - Service (7 tasks, avg complexity: 3.0)

- [x] **T-015** (complexity: 2) - Create exchange rate permission checks
  - 6 permission check functions following tag.permissions.ts pattern
  - Blocked by: T-003
  - Blocks: T-016, T-017

- [ ] **T-016** (complexity: 4) - Create ExchangeRateService basic CRUD
  - Service with CRUD + getLatestRate, createManualOverride, removeManualOverride
  - Blocked by: T-007, T-012, T-015
  - Blocks: T-020, T-022, T-023, T-024, T-025, T-028

- [ ] **T-017** (complexity: 3) - Create ExchangeRateConfigService
  - Singleton config service with getConfig and updateConfig
  - Blocked by: T-009, T-013, T-015
  - Blocks: T-026, T-030

- [ ] **T-018** (complexity: 3) - Create DolarAPI client
  - HTTP client for dolarapi.com with response normalization
  - Blocked by: T-004
  - Blocks: T-020

- [ ] **T-019** (complexity: 3) - Create ExchangeRate-API client
  - HTTP client for exchangerate-api.com with API key auth
  - Blocked by: T-004
  - Blocks: T-020

- [ ] **T-020** (complexity: 4) - Create exchange rate fetcher with fallback chain
  - Priority chain: manual override -> DolarAPI -> ExchangeRate-API -> DB fallback
  - Blocked by: T-016, T-018, T-019
  - Blocks: T-027, T-030

- [x] **T-021** (complexity: 2) - Create rate conversion helper functions
  - convertAmount, calculateInverseRate, formatConvertedAmount, isRateStale
  - Blocked by: T-006
  - Blocks: T-023

### Integration Phase - API Routes (8 tasks, avg complexity: 2.8)

- [ ] **T-022** (complexity: 3) - Create public list exchange rates route
  - GET /api/v1/public/exchange-rates with optional filters
  - Blocked by: T-016
  - Blocks: T-029

- [ ] **T-023** (complexity: 3) - Create public convert amount route
  - GET /api/v1/public/exchange-rates/convert with from/to/amount params
  - Blocked by: T-016, T-021
  - Blocks: T-029

- [ ] **T-024** (complexity: 3) - Create admin set manual rate override route
  - POST /api/v1/protected/exchange-rates (EXCHANGE_RATE_CREATE permission)
  - Blocked by: T-016
  - Blocks: T-029

- [ ] **T-025** (complexity: 2) - Create admin delete rate override route
  - DELETE /api/v1/protected/exchange-rates/:id (manual overrides only)
  - Blocked by: T-016
  - Blocks: T-029

- [ ] **T-026** (complexity: 3) - Create admin update config route
  - PUT /api/v1/protected/exchange-rates/config
  - Blocked by: T-017
  - Blocks: T-029

- [ ] **T-027** (complexity: 3) - Create admin fetch-now trigger route
  - POST /api/v1/protected/exchange-rates/fetch-now
  - Blocked by: T-020
  - Blocks: T-029

- [ ] **T-028** (complexity: 3) - Create admin rate history route
  - GET /api/v1/protected/exchange-rates/history with pagination and filters
  - Blocked by: T-016
  - Blocks: T-029

- [ ] **T-029** (complexity: 2) - Register all exchange rate routes in API app
  - Create index.ts and register in main router
  - Blocked by: T-022, T-023, T-024, T-025, T-026, T-027, T-028
  - Blocks: T-033

### Integration Phase - Cron & Seeds (3 tasks, avg complexity: 3.0)

- [ ] **T-030** (complexity: 4) - Implement exchange rate cron scheduler
  - Interval-based auto-fetching with configurable intervals
  - Blocked by: T-020, T-017
  - Blocks: none

- [ ] **T-031** (complexity: 2) - Create exchange rate seed data files
  - JSON seed files for default config and initial rates
  - Blocked by: T-014
  - Blocks: T-032

- [ ] **T-032** (complexity: 3) - Create exchange rate seed factory and register in manifest
  - Seed factory following createSeedFactory pattern
  - Blocked by: T-031, T-016
  - Blocks: none

### Admin UI Phase (6 tasks, avg complexity: 3.5)

- [ ] **T-033** (complexity: 4) - Create exchange rates admin feature configuration
  - Feature config, TanStack Query hooks, admin-specific types
  - Blocked by: T-029
  - Blocks: T-034, T-035, T-036, T-037

- [ ] **T-034** (complexity: 4) - Create exchange rates admin table component
  - TanStack Table with sorting, filtering, source badges, staleness indicator
  - Blocked by: T-033
  - Blocks: T-038

- [ ] **T-035** (complexity: 3) - Create manual rate override dialog form
  - Dialog form with currency selects, rate input, optional expiry date picker
  - Blocked by: T-033
  - Blocks: T-038

- [ ] **T-036** (complexity: 3) - Create fetch configuration form
  - Form with interval settings, toggles, disclaimer text
  - Blocked by: T-033
  - Blocks: T-038

- [ ] **T-037** (complexity: 4) - Create rate history view component
  - History table with filters, pagination, and simple trend visualization
  - Blocked by: T-033
  - Blocks: T-038

- [ ] **T-038** (complexity: 3) - Create exchange rates admin route page
  - Assemble all components into complete admin page with navigation link
  - Blocked by: T-034, T-035, T-036, T-037
  - Blocks: none

---

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

1. **Schemas Track:** T-001/T-002 -> T-006/T-008 -> T-007/T-009
2. **Database Track:** T-001/T-002 -> T-010/T-011 -> T-012/T-013 -> T-014
3. **Permissions Track:** T-003 -> T-015
4. **External API Track:** T-004 -> T-018/T-019
5. **Admin UI Track:** T-033 -> T-034/T-035/T-036/T-037 -> T-038

## Suggested Start

Begin with **T-001** (complexity: 1) - Add BRL to PriceCurrencyEnum. It has no dependencies and unblocks T-006 and T-010. Run in parallel with T-002, T-003, T-004, and T-005 since they are all independent setup tasks.
