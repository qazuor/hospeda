# HOS-25: Versioned Seed Data Migrations

## Progress: 0/23 tasks (0%)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-003 → T-006 → T-007 → T-005 → T-009 → T-017 → T-020 → T-023 (8 steps)
**Parallel Tracks:** 3 identified (ledger/runner track, safeDelete track, example-determinism track)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Define seed_migrations ledger table + generate structural migration
  - Drizzle table (name PK, group, checksum, applied_at, duration_ms, result) + db:generate.
  - Blocked by: none
  - Blocks: T-002, T-004, T-008

- [ ] **T-002** (complexity: 1) - Add seed_migrations to dbReset preserve-list (correct name)
  - Prevents --reset from wiping migration-tracking state; documents drizzle_migrations naming caveat.
  - Blocked by: T-001
  - Blocks: none

### Core Phase

- [ ] **T-003** (complexity: 1) - Define data-migration module contract types
  - SeedMigrationMeta / Ctx / Result / up() RO-RO contract.
  - Blocked by: none
  - Blocks: T-004, T-005, T-006, T-011, T-013

- [ ] **T-004** (complexity: 3) - Implement ledger read/write layer + checksum
  - getAppliedMigrations / recordApplied / computeChecksum (sha256).
  - Blocked by: T-001, T-003
  - Blocks: T-008, T-009, T-010, T-012

- [ ] **T-006** (complexity: 3) - safeDelete step 1: inbound-FK introspection + active-ref count
  - Dynamic pg-catalog FK discovery (never a hand-maintained list, R-3).
  - Blocked by: T-003
  - Blocks: T-007

- [ ] **T-007** (complexity: 3) - safeDelete step 2: operator-edit detection + skip/warn
  - Model C reuse; delete only when 0 refs AND not operator-edited, else skip+warn.
  - Blocked by: T-006
  - Blocks: T-005, T-020

- [ ] **T-005** (complexity: 3) - Build data-migration context factory
  - db/models/services + actor bootstrap + inject helpers.safeDelete.
  - Blocked by: T-003, T-007
  - Blocks: T-009

- [ ] **T-008** (complexity: 2) - Migration discovery + ledger diff + ordering
  - Scan NNNN-*.ts, load meta, sort by prefix, diff vs ledger, group filter.
  - Blocked by: T-004
  - Blocks: T-009, T-010

- [ ] **T-011** (complexity: 2) - Prod destructive gate + destructive meta flag
  - evaluateProdDataMigrationGate pure fn (HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION).
  - Blocked by: T-003
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Runner core (transaction-per-migration, record, abort)
  - Resolve pending → gate → tx per migration → up() → record/commit or rollback+abort.
  - Blocked by: T-004, T-005, T-008, T-011
  - Blocks: T-012, T-017, T-021

- [ ] **T-010** (complexity: 2) - Baseline-stamp mode
  - Mark all present migrations applied without running them.
  - Blocked by: T-004, T-008
  - Blocks: T-019

- [ ] **T-012** (complexity: 1) - Status reporter (applied vs pending)
  - Blocked by: T-009
  - Blocks: T-017

- [ ] **T-013** (complexity: 2) - db:seed:make scaffold generator
  - Next NNNN prefix + templated module with meta + empty up().
  - Blocked by: T-003
  - Blocks: T-017

- [ ] **T-014** (complexity: 2) - Deterministic UUIDv5 scheme for example fixtures (OQ-1)
  - Blocked by: none
  - Blocks: T-015, T-016

- [ ] **T-015** (complexity: 3) - Explicit-id passthrough in the seed create path
  - Stop unconditionally stripping id; forward explicit PK (opt-in, required unchanged).
  - Blocked by: T-014
  - Blocks: T-016

- [ ] **T-016** (complexity: 3) - Apply deterministic UUIDv5 ids across example normalizers
  - Blocked by: T-014, T-015
  - Blocks: T-022

### Integration Phase

- [ ] **T-017** (complexity: 3) - Wire CLI: db:seed:migrate / :status / :make
  - Blocked by: T-009, T-012, T-013
  - Blocks: T-018, T-019, T-020

- [ ] **T-018** (complexity: 1) - package.json scripts + interactive CLI menu entries
  - Blocked by: T-017
  - Blocks: none

- [ ] **T-019** (complexity: 2) - Integrate baseline-stamp into db:fresh
  - Blocked by: T-010, T-017
  - Blocks: T-021

- [ ] **T-020** (complexity: 3) - Port billing extras/023-025 .plan.sql into numbered TS data-migrations
  - Blocked by: T-007, T-017
  - Blocks: T-023

### Testing Phase

- [ ] **T-021** (complexity: 3) - Integration test: full migrate lifecycle against a seeded DB
  - Blocked by: T-009, T-019
  - Blocks: none

- [ ] **T-022** (complexity: 2) - Integration test: example deterministic ids stable across reseed
  - Blocked by: T-016
  - Blocks: none

### Docs Phase

- [ ] **T-023** (complexity: 2) - Author guide: data-migrations, dual-write, run order, extras boundary
  - Also fixes the stale Faker claim in packages/seed/CLAUDE.md.
  - Blocked by: T-017, T-020
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-014
Level 1: T-002, T-004, T-006, T-011, T-013, T-015
Level 2: T-007, T-008, T-016, T-022
Level 3: T-005, T-010
Level 4: T-009
Level 5: T-012, T-017
Level 6: T-018, T-019, T-020
Level 7: T-021, T-023

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks the ledger/runner track (T-002, T-004, T-008). In parallel, **T-003** (types) and **T-014** (deterministic UUID util) are also dependency-free and open the safeDelete and example-determinism tracks.
