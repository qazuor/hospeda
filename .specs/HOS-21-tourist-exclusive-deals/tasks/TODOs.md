# HOS-21: Tourist Exclusive Deals & VIP Promotions

## Progress: 0/16 tasks (0%)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-001 -> T-002 -> T-005 -> T-006 -> T-008 -> T-009 -> T-011 -> T-012 -> T-016 (9 steps)
**Parallel Tracks:** 5 identified (entitlement config, i18n, owner-form, docs, testing)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add touristAudience column to owner_promotions
  - Structural Drizzle migration via pnpm db:generate + db:migrate
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 2) - Add touristAudience to owner-promotion Zod schemas
  - Create/update/public schemas gain the new field
  - Blocked by: T-001
  - Blocks: T-005, T-007

- [ ] **T-003** (complexity: 2) - Wire VIP_PROMOTIONS_ACCESS entitlement metadata + plan assignment
  - Activates the currently-orphaned enum member
  - Blocked by: none
  - Blocks: T-009

- [ ] **T-004** (complexity: 1) - Add i18n strings for exclusive deals page (es/en/pt)
  - Title, empty state, upgrade CTA, VIP-only badge
  - Blocked by: none
  - Blocks: T-012

### Core Phase

- [ ] **T-005** (complexity: 3) - Add tourist-audience-aware search to OwnerPromotionService
  - Composes with existing _executeSearch filters
  - Blocked by: T-002
  - Blocks: T-006

- [ ] **T-006** (complexity: 3) - Cross-check accommodation-visibility rules in the exclusive-deals search
  - Reuses the existing VIP_VISIBILITY_ACCESS accommodation-visibility check
  - Blocked by: T-005
  - Blocks: T-008

- [ ] **T-007** (complexity: 2) - Accept touristAudience in owner-promotion create/update routes
  - Self-service, no new role gating
  - Blocked by: T-002
  - Blocks: T-013

### Integration Phase

- [ ] **T-008** (complexity: 3) - Create protected exclusive-deals list route
  - New route, existing public list.ts untouched
  - Blocked by: T-006
  - Blocks: T-009

- [ ] **T-009** (complexity: 3) - Wire gateExclusiveDeals + vip entitlement check into the new route
  - Un-phantoms gateExclusiveDeals; scopes search by VIP_PROMOTIONS_ACCESS
  - Blocked by: T-008, T-003
  - Blocks: T-010, T-011, T-014

- [ ] **T-011** (complexity: 2) - Build the exclusive-deals Astro SSR-shell page
  - Follows the mi-cuenta/alertas precedent
  - Blocked by: T-009
  - Blocks: T-012

- [ ] **T-012** (complexity: 3) - Build ExclusiveDealsList.client.tsx
  - Follows AlertsList.client.tsx precedent; 403 upgrade-prompt UX
  - Blocked by: T-011, T-004
  - Blocks: T-015, T-016

- [ ] **T-013** (complexity: 2) - Add VIP-only toggle to the owner promotion form
  - Self-service form field wired to T-007
  - Blocked by: T-007
  - Blocks: T-016

### Testing Phase

- [ ] **T-014** (complexity: 3) - API integration tests for the gated exclusive-deals route
  - 403 gating, tier-correct results, accommodation-visibility filtering
  - Blocked by: T-009
  - Blocks: T-016

- [ ] **T-015** (complexity: 2) - Component tests for ExclusiveDealsList.client.tsx
  - Loading, empty, upgrade-prompt, populated states
  - Blocked by: T-012
  - Blocks: none

- [ ] **T-016** (complexity: 3) - E2E test for the full exclusive-deals flow
  - Full tier matrix + owner VIP-only toggle + accommodation-visibility filtering
  - Blocked by: T-012, T-013, T-014
  - Blocks: none

### Docs Phase

- [ ] **T-010** (complexity: 1) - Update endpoint-gate-matrix.md for the now-active gate
  - Moves gateExclusiveDeals out of "Reserved — Phantom Gates"
  - Blocked by: T-009
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-004
Level 1: T-002
Level 2: T-005, T-007
Level 3: T-006, T-013
Level 4: T-008
Level 5: T-009
Level 6: T-010, T-011, T-014
Level 7: T-012
Level 8: T-015, T-016

## Suggested Start

Begin with **T-001** (complexity: 2) - it has no dependencies and unblocks the critical path (T-002 next). **T-003** and **T-004** can run in parallel with T-001/T-002 since they have no dependencies either.
