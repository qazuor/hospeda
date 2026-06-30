# SPEC-288: Accommodation Comparison

## Progress: 0/14 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-006 -> T-007 -> T-008 -> T-009 (4 steps)
**Parallel Tracks:** 4 identified (T-001, T-002, T-006, T-012 start in parallel)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Define compare endpoint request/response Zod schemas in @repo/schemas
  - CompareAccommodationsRequestSchema ({ ids }) + response schema; types + unit tests
  - Blocked by: none
  - Blocks: T-003

- [ ] **T-012** (complexity: 2) - Add i18n keys for compare feature (es/en/pt)
  - Button, upsell/limit, floating bar, matrix labels; reuse billing.comparison ns
  - Blocked by: none
  - Blocks: T-008

### Core Phase

- [ ] **T-002** (complexity: 2) - Update MAX_COMPARE_ITEMS per-plan limits in billing config
  - Plus 4->2, TOURIST_VIP_LIMITS -1->4 (cascades to owner/complex); config tests
  - Blocked by: none
  - Blocks: T-005

- [ ] **T-003** (complexity: 3) - Build POST /protected/accommodations/compare route + handler
  - Mount entitlementMiddleware + gateComparator; set count; fetch by ids
  - Blocked by: T-001
  - Blocks: T-004, T-005, T-011

- [ ] **T-004** (complexity: 1) - Remove PHANTOM-GATE note from gateComparator()
  - Clean comment + update endpoint-gate-matrix.md
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-006** (complexity: 3) - Build compare-store (singleton pub/sub + localStorage)
  - toast-store pattern; add/remove/clear; useSyncExternalStore; unit tests
  - Blocked by: none
  - Blocks: T-007, T-008, T-010, T-011

- [ ] **T-007** (complexity: 2) - Client-side limit enforcement via useMyEntitlements
  - canCompare + maxItems guard with reason ('upsell'|'limit'); unit tests per plan
  - Blocked by: T-006
  - Blocks: T-008, T-010

### Integration Phase

- [ ] **T-008** (complexity: 3) - Build CompareButton island with upsell
  - FavoriteButton pattern; toggle + upsell (free) + limit message; component tests
  - Blocked by: T-006, T-007, T-012
  - Blocks: T-009

- [ ] **T-009** (complexity: 2) - Integrate CompareButton into card render points
  - AccommodationCard.astro + MapCardsSidebar.client.tsx
  - Blocked by: T-008
  - Blocks: none

- [ ] **T-010** (complexity: 3) - Build floating comparison bar/drawer
  - Selected items + remove/clear + 'Comparar ahora' CTA; component tests
  - Blocked by: T-006, T-007
  - Blocks: T-014

- [ ] **T-011** (complexity: 3) - Build comparison page with side-by-side matrix
  - /[lang]/alojamientos/comparar; hydrate via endpoint; matrix + empty/error states
  - Blocked by: T-003, T-006
  - Blocks: T-013, T-014

### Testing Phase

- [ ] **T-005** (complexity: 3) - Integration tests for the compare endpoint
  - ENTITLEMENT_REQUIRED / LIMIT_REACHED / happy Plus(2) VIP(4)
  - Blocked by: T-003, T-002
  - Blocks: none

- [ ] **T-014** (complexity: 3) - End-to-end compare flow test
  - Select -> bar -> compare page -> matrix -> per-plan limit + upsell
  - Blocked by: T-011, T-010
  - Blocks: none

### Cleanup Phase

- [ ] **T-013** (complexity: 1) - Activate compare row in PlanComparisonTable
  - upcoming -> available (line ~95); removes 'Próximamente' badge
  - Blocked by: T-011
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-006, T-012
Level 1: T-003, T-007
Level 2: T-004, T-005, T-008, T-010, T-011
Level 3: T-009, T-013, T-014

## Suggested Start

Begin with **T-006** (complexity: 3) - it sits on the critical path and unblocks 4
tasks (the whole web track). In parallel you can start **T-001** (schema, unblocks
the API), **T-002** (billing limits) and **T-012** (i18n) since none have dependencies.
