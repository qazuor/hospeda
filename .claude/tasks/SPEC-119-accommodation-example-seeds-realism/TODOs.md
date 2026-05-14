# TODOs: Accommodation Example Seeds Realism

Spec: SPEC-119 | Status: pending | Progress: 0/35

## Setup
- [ ] T-001: Map 51 user slugs to JSON file paths (complexity: 2)
- [ ] T-002: Grep Admin/Web for unsafe accommodation.price reads (complexity: 2)
- [ ] T-003: Smoke-test omitted-price JSON against seed JSON Schema (complexity: 1)
- [ ] T-004: Curate 10 Pexels URLs per accommodation type (8 types) (complexity: 4)
- [ ] T-005: Write _image-pool.ts typed const (complexity: 2) [blocked by T-004]
- [ ] T-006: Document the image pool in packages/seed/docs/image-pool.md (complexity: 1) [blocked by T-004]

## Core
- [ ] T-007: Refresh camping image galleries via random per-accommodation assignment (15 files) (complexity: 4) [blocked by T-001, T-005]
- [ ] T-008: Refresh apartment image galleries via random per-accommodation assignment (20 files) (complexity: 4) [blocked by T-001, T-005]
- [ ] T-009: Refresh hostel image galleries via random per-accommodation assignment (10 files) (complexity: 3) [blocked by T-001, T-005]
- [ ] T-010: Refresh hotel image galleries via random per-accommodation assignment (14 files) (complexity: 2) [blocked by T-001, T-005]
- [ ] T-011: Refresh cabin image galleries via random per-accommodation assignment (12 files) (complexity: 2) [blocked by T-001, T-005]
- [ ] T-012: Refresh room image galleries via random per-accommodation assignment (13 files) (complexity: 3) [blocked by T-001, T-005]
- [ ] T-013: Refresh country_house and house image galleries (20 files) (complexity: 2) [blocked by T-001, T-005]
- [ ] T-014: Write plan-pricing-tiers.ts deterministic planner (complexity: 3)
- [ ] T-015: Run planner; produce pricing-tier-plan.md (complexity: 2) [blocked by T-014]
- [ ] T-016: Define realistic ARS value ranges per type (complexity: 2)
- [ ] T-017: Apply Tier 0 (no price) to ~24-28 entries (complexity: 2) [blocked by T-003, T-015, T-016]
- [ ] T-018: Verify Tier 1 (base only) entries — no edit pass (complexity: 1) [blocked by T-015]
- [ ] T-019: Apply Tier 2 (base + partial) to ~29-33 entries (complexity: 4) [blocked by T-015, T-016]
- [ ] T-020: Apply Tier 3 (full stack) to ~19-23 entries (complexity: 4) [blocked by T-015, T-016]

## Integration
- [ ] T-021: Fix unsafe Web price reads if any (complexity: 3) [blocked by T-002]
- [ ] T-022: Fix unsafe Admin price reads if any (complexity: 3) [blocked by T-002]
- [ ] T-023: Smoke pnpm db:fresh-dev end-to-end locally (complexity: 2) [blocked by T-017, T-018, T-019, T-020]

## Testing
- [ ] T-024: Test: image pool membership invariant (complexity: 2) [blocked by T-005, T-013]
- [ ] T-025: Test: camping gallery uniqueness invariant (complexity: 2) [blocked by T-007]
- [ ] T-026: Test: pricing distribution invariant (complexity: 3) [blocked by T-017, T-018, T-019, T-020]
- [ ] T-027: Test: fee coverage and others[] coverage invariants (complexity: 3) [blocked by T-019, T-020]
- [ ] T-028: Write check-image-pool-coverage.ts lint script and wire to package.json (complexity: 3) [blocked by T-005]
- [ ] T-029: Run pnpm test --filter=@repo/seed to green (complexity: 2) [blocked by T-024, T-025, T-026, T-027, T-028]
- [ ] T-030: Workspace pnpm typecheck and lint to green (complexity: 2) [blocked by T-029]
- [ ] T-031: Visual review: 3 random accommodations of each type in local Web (complexity: 2) [blocked by T-021, T-023]
- [ ] T-032: Visual review: Admin detail for one Tier 0 and one Tier 3 entry (complexity: 2) [blocked by T-022, T-023]

## Docs
- [ ] T-033: Write PR description and delete transitory working docs (complexity: 2) [blocked by T-030, T-031, T-032]
- [ ] T-034: Update packages/seed/CLAUDE.md to reference the image pool (complexity: 1) [blocked by T-006]

## Cleanup
- [ ] T-035: Open PR targeting staging with SPEC-119 reference (complexity: 1) [blocked by T-033, T-034]
