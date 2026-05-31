# SPEC-169: Role Permission Audit + Owner-Scoped Data Access

## Progress: 32/32 tasks (100%) — code+tests+docs+live e2e smoke all done; ready for PR to staging

> This checklist below is NOT maintained per-task — the live source of truth is
> `state.json` (full per-task status + notes) and `.qtm/tasks/index.json`
> (progress mirror). See those for current state.

**Average Complexity:** 2.3/4 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-004 → T-005 → T-006 → T-009 → T-010 → T-016 → T-026 → T-032 (11 steps)
**Owner-decision gate:** T-003 blocks ALL implementation. §12 checkpoints embedded in T-004, T-005, T-006, T-008, T-009, T-010, T-017, T-018, T-020, T-021, T-022, T-030.

> ⛔ **DECISION PROTOCOL (spec §12):** Any ambiguity or >1 viable option → STOP and consult the owner. T-003 is a HARD GATE: no schema/service/seed/front task starts until the owner approves the audit verdicts.

---

### Setup Phase

- [ ] **T-001** (complexity: 2... read as 3) - Audit script: role × permission matrix scan
  - Scan ROLE_PERMISSIONS for _VIEW_ALL/_READ_ALL/_VIEW_PRIVATE → read baseline
  - Blocked by: none · Blocks: T-002, T-003

- [ ] **T-002** (complexity: 3) - Audit script: endpoint enumeration + write-enforcement matrix
  - Admin list/getById endpoints with optional owner filter + write-op isOwner classification (incl UI-less routes)
  - Blocked by: T-001 · Blocks: T-003, T-015

### Core Phase

- [ ] **T-003** (complexity: 1) - ⛔ OWNER-REVIEW GATE (§12): present audits, approve ALL verdicts
  - Blocked by: T-001, T-002 · Blocks: T-004, T-005, T-006, T-007, T-010, T-017, T-018, T-020, T-021, T-022

- [ ] **T-004** (complexity: 2) - Add ACCOMMODATION_VIEW_OWN to PermissionEnum
  - Blocked by: T-003 · Blocks: T-005, T-006, T-007, T-008, T-031

- [ ] **T-005** (complexity: 3) - Per-entity ownership resolver (ownerColumn + isOwner)
  - Blocked by: T-003, T-004 · Blocks: T-006, T-007

- [ ] **T-006** (complexity: 3) - _canAdminView on AccommodationService (VIEW_ALL OR VIEW_OWN+isOwner)
  - Blocked by: T-003, T-004, T-005 · Blocks: T-008, T-009, T-013

- [ ] **T-007** (complexity: 4) - Forced owner-scoping in adminList (VIEW_OWN forces ownerId=actor.id)
  - Blocked by: T-003, T-004, T-005 · Blocks: T-008, T-009, T-012, T-016

- [ ] **T-008** (complexity: 2) - adminList route gate: accept VIEW_ALL OR VIEW_OWN
  - Blocked by: T-004, T-006, T-007 · Blocks: T-009

- [ ] **T-009** (complexity: 3) - getById route + service use _canAdminView
  - Blocked by: T-006, T-008 · Blocks: T-010, T-016

- [ ] **T-010** (complexity: 2) - Seed: remove HOST VIEW_ALL, add VIEW_OWN; EDITOR rationale; CLIENT_MANAGER untouched
  - Blocked by: T-003, T-004, T-009 · Blocks: T-011, T-014, T-015, T-016, T-022, T-027, T-028, T-029

- [ ] **T-011** (complexity: 2) - AC-6 test: no unauthorized broad grants in non-staff roles
  - Blocked by: T-010 · Blocks: T-026

- [ ] **T-012** (complexity: 2) - AC-1/AC-2 unit tests: forced owner scope in adminList
  - Blocked by: T-007 · Blocks: T-026

- [ ] **T-013** (complexity: 2) - AC-8/AC-9 unit tests: _canAdminView own vs other
  - Blocked by: T-006 · Blocks: T-026

- [ ] **T-014** (complexity: 3) - AC-10 integration: HOST write ops blocked on other's accommodation
  - Blocked by: T-010 · Blocks: T-026

- [ ] **T-015** (complexity: 2) - AC-11 write-enforcement matrix test
  - Blocked by: T-002, T-010 · Blocks: T-026

- [ ] **T-016** (complexity: 2) - AC-4/AC-5 regression: staff unscoped + /me/accommodations works
  - Blocked by: T-007, T-009, T-010 · Blocks: T-026

- [ ] **T-017** (complexity: 3) - GET /admin/accommodations/options lookup endpoint
  - Blocked by: T-003 · Blocks: T-018, T-020, T-021

- [ ] **T-018** (complexity: 3) - /options for destination (+ approved entities)
  - Blocked by: T-003, T-017 · Blocks: T-021

### Integration Phase

- [ ] **T-019** (complexity: 2) - Verify AdminSearchSchema keeps ownerId optional
  - Blocked by: T-007, T-010 · Blocks: T-023

- [ ] **T-020** (complexity: 3) - Migrate OwnerSelect to /options
  - Blocked by: T-003, T-017 · Blocks: T-023, T-025

- [ ] **T-021** (complexity: 3) - Migrate DestinationSelect + entity-select fields + entity-search to /options
  - Blocked by: T-003, T-017, T-018 · Blocks: T-023, T-025

- [ ] **T-022** (complexity: 2) - beforeLoad owner-scope guard on /accommodations route(s)
  - Blocked by: T-003, T-010 · Blocks: T-023, T-024

- [ ] **T-023** (complexity: 2) - E2E verify /me/accommodations works after all changes
  - Blocked by: T-019, T-020, T-021, T-022 · Blocks: T-024, T-025

### Testing Phase

- [ ] **T-024** (complexity: 2) - AC-3 route-guard test: redirect HOST from /accommodations
  - Blocked by: T-022, T-023 · Blocks: T-026

- [ ] **T-025** (complexity: 2) - AC-7 integration: selectors work for EDITOR (ACCESS_PANEL_ADMIN only)
  - Blocked by: T-020, T-021, T-023 · Blocks: T-026

- [ ] **T-026** (complexity: 4) - Run full suite + fix regressions from seed/permission changes
  - Blocked by: T-011, T-012, T-013, T-014, T-015, T-016, T-024, T-025 · Blocks: T-027, T-031, T-032

- [ ] **T-027** (complexity: 2) - Update SPEC-143 test-user matrix fixtures for HOST change
  - Blocked by: T-010, T-026 · Blocks: T-032

### Docs Phase

- [ ] **T-028** (complexity: 2) - Document permission model + allow-list rationale (ADR)
  - Blocked by: T-010, T-026 · Blocks: T-032

- [ ] **T-029** (complexity: 1) - CLIENT_MANAGER known-debt comment + tracking note
  - Blocked by: T-010 · Blocks: T-032

### Cleanup Phase

- [ ] **T-030** (complexity: 1) - Remove (or keep, per owner) one-off audit scripts
  - Blocked by: T-003, T-026 · Blocks: T-032

- [ ] **T-031** (complexity: 1) - Verify enum-consistency tests for new PermissionEnum values
  - Blocked by: T-004, T-026 · Blocks: T-032

- [ ] **T-032** (complexity: 1) - Final typecheck + lint pass
  - Blocked by: T-026, T-027, T-028, T-029, T-030, T-031 · Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001
- Level 1: T-002
- Level 2: T-003 (⛔ owner gate)
- Level 3: T-004, T-017
- Level 4: T-005, T-018
- Level 5: T-006, T-007
- Level 6: T-008, T-020, T-021, T-022
- Level 7: T-009, T-019, T-023
- Level 8: T-010, T-024, T-025
- Level 9: T-011, T-012, T-013, T-014, T-015, T-016
- Level 10: T-026
- Level 11: T-027, T-028, T-029, T-030, T-031
- Level 12: T-032

## Suggested Start

Begin with **T-001** (audit read pass). It has no dependencies and feeds the T-003 owner gate that unlocks everything else.

## AC → Task Mapping

| AC | Tasks |
|----|-------|
| AC-1 | T-007, T-012 |
| AC-2 | T-007, T-012 |
| AC-3 | T-022, T-024 |
| AC-4 | T-007, T-008, T-009, T-016 |
| AC-5 | T-010, T-016, T-023 |
| AC-6 | T-010, T-011 |
| AC-7 | T-017, T-018, T-020, T-021, T-025 |
| AC-8 | T-006, T-009, T-013 |
| AC-9 | T-006, T-009, T-013 |
| AC-10 | T-014 |
| AC-11 | T-002, T-015 |
