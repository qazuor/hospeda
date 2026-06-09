# SPEC-210: Public Response Tier Enforcement

## Progress: 0/13 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-004 → T-005 → T-009 → T-012 (4 steps)
**Parallel Tracks:** audit/schemas track (T-001→T-002/T-003) and factory track (T-004→T-005, T-006) run in parallel

---

### Setup Phase

- [ ] **T-001** (complexity: 2) — Audit every public route and classify its response schema
  - Inventory all `routes/**/public/*.ts`, classify OK/LEAK/PASSTHROUGH/MISSING, write audit doc
  - Blocked by: none
  - Blocks: T-002, T-003, T-007, T-008, T-009, T-010

### Core Phase

- [ ] **T-002** (complexity: 2) — Create SponsorshipLevelPublicSchema
  - `.pick()` public fields only, no audit fields; unit test drops audit fields
  - Blocked by: T-001 · Blocks: T-009
- [ ] **T-003** (complexity: 2) — Create any other missing public-tier schemas flagged by the audit
  - Blocked by: T-001 · Blocks: T-010
- [ ] **T-004** (complexity: 3) — Add assertConcretePublicSchema startup guard helper
  - Rejects z.record/z.any/z.unknown/passthrough, names offending route
  - Blocked by: none · Blocks: T-005
- [ ] **T-005** (complexity: 3) — Make responseSchema required on public factory + wire startup guard
  - TS-required + startup throw; protected/admin unchanged
  - Blocked by: T-004 · Blocks: T-007, T-008, T-009, T-010, T-011, T-013
- [ ] **T-006** (complexity: 2) — Make stripWithSchema fail-closed when no schema is provided
  - Throw instead of return raw; audit non-public no-schema callers
  - Blocked by: none · Blocks: T-007, T-008, T-009, T-010

### Integration Phase

- [ ] **T-007** (complexity: 2) — Re-wire similar.ts to z.array(AccommodationPublicSchema)
  - Blocked by: T-005, T-006 · Blocks: T-012
- [ ] **T-008** (complexity: 2) — Re-wire exchange-rates/public/list.ts to ExchangeRatePublicSchema
  - Grep web/admin consumers first; regression test
  - Blocked by: T-005, T-006 · Blocks: T-012
- [ ] **T-009** (complexity: 2) — Re-wire sponsorship-level public getById + list to new tier
  - Blocked by: T-002, T-005, T-006 · Blocks: T-012
- [ ] **T-010** (complexity: 3) — Fix every remaining route flagged by the audit
  - Grep consumers + wire tier per route; resolve audit doc
  - Blocked by: T-003, T-005, T-006 · Blocks: T-012

### Testing Phase

- [ ] **T-011** (complexity: 2) — Add boot-the-public-router fail-closed test
  - Positive: router registers clean; negative: passthrough throws at boot
  - Blocked by: T-005 · Blocks: T-012
- [ ] **T-012** (complexity: 2) — Full regression sweep across api, web, admin
  - Blocked by: T-007, T-008, T-009, T-010, T-011 · Blocks: none

### Docs Phase

- [ ] **T-013** (complexity: 1) — Document the public-response contract rule
  - Blocked by: T-005 · Blocks: none

---

## Dependency Graph

- Level 0: T-001, T-004, T-006
- Level 1: T-002, T-003, T-005
- Level 2: T-007, T-008, T-009, T-010, T-011, T-013
- Level 3: T-012

## Suggested Start

Two independent tracks can start immediately:
- **T-001** (audit) — no deps, unblocks the schema + re-wire work.
- **T-004** (assertConcretePublicSchema) — no deps, unblocks the factory hardening.
