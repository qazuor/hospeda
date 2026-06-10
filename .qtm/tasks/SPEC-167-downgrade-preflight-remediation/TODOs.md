# SPEC-167: Downgrade Over-Limit Remediation (grandfather + restrict)

## Progress: 0/25 tasks (0%)

**Average Complexity:** 2.5/10
**Critical Path:** T-005 → T-006 → T-011 → T-013 → T-019 → T-020 → T-022 → T-023 → T-025 (9 steps)
**Parallel Tracks:** setup columns (T-001→T-002, T-003), primitives (T-007/T-008/T-009/T-010), wiring (T-013/T-014/T-016/T-017/T-018)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add planRestricted column to accommodations and owner_promotions (DB)
  - Blocked by: none | Blocks: T-002, T-004, T-007, T-008
- [ ] **T-002** (complexity: 2) - Add planRestricted to accommodation + promotion Zod schemas and types
  - Blocked by: T-001 | Blocks: T-004, T-007, T-008
- [ ] **T-003** (complexity: 2) - Add archivedGallery to media Zod schema
  - Blocked by: none | Blocks: T-009

### Core Phase

- [ ] **T-004** (complexity: 3) - Exclude planRestricted accommodations from public read paths
  - Blocked by: T-001, T-002 | Blocks: T-019
- [ ] **T-005** (complexity: 2) - Red-first unit tests for computeDowngradeExcess
  - Blocked by: none | Blocks: T-006
- [ ] **T-006** (complexity: 3) - Implement computeDowngradeExcess (read-only diff helper)
  - Blocked by: T-005 | Blocks: T-011, T-016
- [ ] **T-007** (complexity: 2) - Accommodation restrict/restore primitives
  - Blocked by: T-001, T-002 | Blocks: T-011, T-012
- [ ] **T-008** (complexity: 2) - Promotion restrict/restore primitives
  - Blocked by: T-001, T-002 | Blocks: T-011, T-012
- [ ] **T-009** (complexity: 3) - Photo archive/restore primitive (JSONB gallery move)
  - Blocked by: T-003 | Blocks: T-011, T-012
- [ ] **T-010** (complexity: 2) - Add targeted batch revalidation helper
  - Blocked by: none | Blocks: T-011, T-018
- [ ] **T-011** (complexity: 3) - Shared restriction service applyDowngradeRestrictions (red-first)
  - Blocked by: T-006, T-007, T-008, T-009, T-010 | Blocks: T-013, T-014, T-017
- [ ] **T-012** (complexity: 3) - Restore-on-upgrade service + wiring into upgrade paths
  - Blocked by: T-007, T-008, T-009 | Blocks: T-014, T-020
- [ ] **T-015** (complexity: 3) - keepIds selection field: schema + persistence with scheduled change
  - Blocked by: none | Blocks: T-013, T-016

### Integration Phase

- [ ] **T-013** (complexity: 3) - Wire restriction into apply-scheduled-plan-changes cron
  - Blocked by: T-011, T-015 | Blocks: T-017, T-019
- [ ] **T-014** (complexity: 3) - Wire restriction + restoration into admin change-plan hook
  - Blocked by: T-011, T-012 | Blocks: T-019
- [ ] **T-016** (complexity: 3) - Request-time restriction preview in plan-change downgrade response
  - Blocked by: T-006, T-015 | Blocks: T-019
- [ ] **T-017** (complexity: 3) - Wire downgrade notifications (warning at schedule, confirmation at apply)
  - Blocked by: T-011, T-013 | Blocks: none
- [ ] **T-018** (complexity: 2) - Fix pause/resume revalidation gap (spec §6)
  - Blocked by: T-010 | Blocks: none

### Testing Phase

- [ ] **T-019** (complexity: 3) - e2e: downgrade restriction happy path
  - Blocked by: T-004, T-013, T-014, T-016 | Blocks: T-022
- [ ] **T-020** (complexity: 3) - e2e: keepIds honored + restore-on-upgrade + idempotent re-apply
  - Blocked by: T-012, T-019 | Blocks: T-022
- [ ] **T-021** (complexity: 2) - INV-5 pinning + non-downgrade regression tests
  - Blocked by: T-011, T-012 | Blocks: T-022
- [ ] **T-022** (complexity: 2) - Verification sweep (typecheck, biome, touched + consumer tests, e2e)
  - Blocked by: T-019, T-020, T-021, T-017, T-018 | Blocks: T-023
- [ ] **T-023** (complexity: 3) - Adversarial fresh-context review + apply confirmed fixes
  - Blocked by: T-022 | Blocks: T-024, T-025

### Docs Phase

- [ ] **T-024** (complexity: 1) - Register staging smoke entry #6 (SPEC-193 batch)
  - Blocked by: T-023 | Blocks: T-025
- [ ] **T-025** (complexity: 2) - PR to staging + CI + merge + closeout
  - Blocked by: T-023, T-024 | Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-005, T-010, T-015
Level 1: T-002, T-006, T-009, T-018
Level 2: T-004, T-007, T-008
Level 3: T-011, T-012
Level 4: T-013, T-014, T-016, T-021
Level 5: T-017, T-019
Level 6: T-020
Level 7: T-022
Level 8: T-023
Level 9: T-024, T-025

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks the whole planRestricted track.
