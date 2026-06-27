# SPEC-239: Commerce listing core (merchant-with-subscription) + Gastronomía

## Progress: 0/64 tasks (0%)

**Average Complexity:** 2.4/3 (all tasks ≤ 3)
**Critical Path:** T-001 -> T-021 -> T-024 -> T-027 -> T-028 -> T-029 -> T-035 -> T-038 -> T-042 -> T-053 -> T-058 -> T-060 -> T-062 -> T-063 -> T-064 (15 steps)
**Parallel Tracks:** Level 0 starts 9 tasks in parallel; widest level (Level 2) runs 13 in parallel.

**Tagging:** 36 tasks CORE (reusable comercio-con-suscripción), 28 GASTRO (gastronomy consumer). CORE/GASTRO separation is an acceptance gate (US-9).

---

### Setup Phase

- [ ] **T-019** (complexity: 2) [core] - Add commerce schema env-registry entries
  - HOSPEDA_COMMERCE_LEAD_NOTIFY_EMAIL + HOSPEDA_COMMERCE_PLAN_ID. STOP and ask owner to set in Coolify after.
  - Blocked by: T-005
  - Blocks: T-046, T-047, T-049

### Core Phase

#### Phase 1 — CORE schemas, enums, config, roles/perms

- [ ] **T-001** (complexity: 1) [core] - Add PriceRangeEnum and ProductDomainEnum core enums
  - Blocked by: none — Blocks: T-008, T-010, T-021, T-026
- [ ] **T-002** (complexity: 1) [core] - Add CommerceEntityType core enum
  - Blocked by: none — Blocks: T-022, T-024
- [ ] **T-003** (complexity: 1) [gastro] - Add GastronomyTypeEnum gastro enum
  - Blocked by: none — Blocks: T-010, T-021
- [ ] **T-004** (complexity: 3) [core] - Create OpeningHoursSchema core common schema
  - Blocked by: none — Blocks: T-010
- [ ] **T-005** (complexity: 1) [core] - Create CommerceRatingSchema core common schema
  - Blocked by: none — Blocks: T-017, T-019
- [ ] **T-006** (complexity: 2) [core] - Create CommerceIdentityFields core common schema
  - Blocked by: none — Blocks: T-010
- [ ] **T-007** (complexity: 1) [core] - Add COMMERCE_OWNER role to RoleEnum
  - Blocked by: none — Blocks: T-009, T-030
- [ ] **T-008** (complexity: 2) [core] - Add COMMERCE_* permissions + category to PermissionEnum
  - Blocked by: T-001 — Blocks: T-009, T-025, T-026, T-030
- [ ] **T-009** (complexity: 2) [core] - Map COMMERCE_OWNER role to COMMERCE_* permissions in seed
  - Blocked by: T-007, T-008 — Blocks: T-040
- [ ] **T-018** (complexity: 2) [core] - Create CommerceLeadSchema core lead schema
  - Blocked by: none — Blocks: T-023, T-033, T-046, T-047

#### Phase 2 — GASTRO schemas

- [ ] **T-010** (complexity: 3) [gastro] - Create GastronomySchema main entity schema
  - Blocked by: T-001, T-003, T-004, T-006 — Blocks: T-011..T-017
- [ ] **T-011** (complexity: 3) [gastro] - Create gastronomy admin + operational CRUD schemas (operational-only owner update)
  - Blocked by: T-010 — Blocks: T-035, T-043
- [ ] **T-012** (complexity: 3) [gastro] - Create gastronomy HTTP schema with completeness check
  - Blocked by: T-010 — Blocks: T-042
- [ ] **T-013** (complexity: 2) [gastro] - Create gastronomy query + admin-search schemas
  - Blocked by: T-010 — Blocks: T-045, T-047
- [ ] **T-014** (complexity: 3) [gastro] - Create gastronomy three-tier access schemas
  - Blocked by: T-010 — Blocks: T-038, T-042
- [ ] **T-015** (complexity: 2) [gastro] - Create gastronomy options/relations/batch schemas
  - Blocked by: T-010 — Blocks: T-045
- [ ] **T-016** (complexity: 2) [gastro] - Create gastronomy FAQ subtype schema
  - Blocked by: T-010 — Blocks: T-037, T-044
- [ ] **T-017** (complexity: 2) [gastro] - Create gastronomy review subtype schema
  - Blocked by: T-010, T-005 — Blocks: T-039, T-044

#### Phase 3 — DB

- [ ] **T-020** (complexity: 2) [core] - Add users.must_change_password structural migration
  - Blocked by: none — Blocks: T-031, T-040, T-041
- [ ] **T-021** (complexity: 3) [gastro] - Create gastronomies dbschema table
  - Blocked by: T-001, T-003 — Blocks: T-024, T-025, T-028, T-035
- [ ] **T-022** (complexity: 2) [core] - Create commerce_listing_subscriptions link dbschema
  - Blocked by: T-002 — Blocks: T-027, T-032, T-049
- [ ] **T-023** (complexity: 2) [core] - Create commerce_lead dbschema table
  - Blocked by: T-018 — Blocks: T-027, T-033
- [ ] **T-024** (complexity: 3) [gastro] - Create gastronomy review + faq dbschemas
  - Blocked by: T-021 — Blocks: T-027
- [ ] **T-025** (complexity: 2) [gastro] - Create gastronomy amenity/feature junction dbschemas
  - Blocked by: T-021 — Blocks: T-027, T-036
- [ ] **T-026** (complexity: 3) [core] - Add billing_subscriptions.product_domain via extras carril
  - Blocked by: T-001 — Blocks: T-027, T-032, T-034
- [ ] **T-027** (complexity: 2) - Generate + apply gastronomy/commerce migrations
  - Blocked by: T-021, T-022, T-023, T-024, T-025, T-026 — Blocks: T-028
- [ ] **T-028** (complexity: 3) - Create gastronomy + commerce Drizzle models
  - Blocked by: T-027 — Blocks: T-029, T-032, T-033, T-035, T-040

#### Phase 4 — CORE services

- [ ] **T-029** (complexity: 3) [core] - Implement BaseCommerceListingService skeleton + lifecycle hooks
  - Blocked by: T-028 — Blocks: T-031, T-035, T-053
- [ ] **T-030** (complexity: 2) [core] - Implement generic commerce permissions module
  - Blocked by: T-007, T-008 — Blocks: T-035, T-038
- [ ] **T-031** (complexity: 2) [core] - Implement generic commerce junction-sync helper
  - Blocked by: T-029 — Blocks: T-036
- [ ] **T-032** (complexity: 3) [core] - Implement commerce-visibility reconciler
  - Blocked by: T-022, T-026, T-028 — Blocks: T-049, T-050
- [ ] **T-033** (complexity: 2) [core] - Implement commerce-lead service
  - Blocked by: T-018, T-023, T-028 — Blocks: T-046, T-047
- [ ] **T-034** (complexity: 3) [core] - Add product_domain filter to accommodation entitlement reads (HIGH-RISK isolation seam)
  - Blocked by: T-026 — Blocks: T-051
- [ ] **T-040** (complexity: 3) [core] - Implement commerce-owner-provisioning service (temp pw + must_change_password)
  - Blocked by: T-009, T-020, T-028 — Blocks: T-048

#### Phase 5 — GASTRO service

- [ ] **T-035** (complexity: 3) [gastro] - Implement GastronomyService extends BaseCommerceListingService
  - Blocked by: T-011, T-013, T-021, T-028, T-029, T-030 — Blocks: T-036, T-038, T-042, T-045
- [ ] **T-036** (complexity: 3) [gastro] - Wire gastronomy junction sync + operational-only enforcement
  - Blocked by: T-025, T-031, T-035 — Blocks: T-043
- [ ] **T-037** (complexity: 2) [gastro] - Implement gastronomy FAQ service helpers
  - Blocked by: T-016, T-035 — Blocks: T-044
- [ ] **T-038** (complexity: 2) [gastro] - Implement gastronomy projections + permissions module
  - Blocked by: T-014, T-030, T-035 — Blocks: T-042
- [ ] **T-039** (complexity: 3) [gastro] - Implement gastronomy review service + denormalized rating recompute
  - Blocked by: T-017, T-035 — Blocks: T-044, T-046

### Integration Phase

#### Phase 6 — Auth: force-password-change

- [ ] **T-041** (complexity: 3) [core] - Implement must_change_password gate + change-password endpoint (HIGH-RISK gate)
  - Blocked by: T-020 — Blocks: T-052, T-055

#### Phase 7 — API routes

- [ ] **T-042** (complexity: 3) [gastro] - Implement gastronomy public API routes
  - Blocked by: T-011, T-012, T-014, T-035, T-038 — Blocks: T-053, T-054
- [ ] **T-043** (complexity: 3) [gastro] - Implement gastronomy protected owner API routes
  - Blocked by: T-011, T-013, T-036 — Blocks: T-054
- [ ] **T-044** (complexity: 3) [gastro] - Implement gastronomy protected FAQ + review API routes
  - Blocked by: T-016, T-017, T-037, T-039 — Blocks: T-054
- [ ] **T-045** (complexity: 3) [gastro] - Implement gastronomy admin CRUD API routes
  - Blocked by: T-013, T-015, T-035 — Blocks: T-046, T-054, T-059
- [ ] **T-046** (complexity: 3) [gastro] - Implement gastronomy admin review + assign-owner routes
  - Blocked by: T-039, T-045 — Blocks: T-054, T-059
- [ ] **T-047** (complexity: 3) [core] - Implement commerce lead public + admin API routes
  - Blocked by: T-018, T-019, T-033 — Blocks: T-054, T-056, T-058

#### Phase 8 — Billing wiring

- [ ] **T-048** (complexity: 3) [core] - Implement admin commerce start-subscription route
  - Blocked by: T-040, T-049 — Blocks: T-050, T-056
- [ ] **T-049** (complexity: 2) [core] - Seed commerce plan + link-row creation on subscription start
  - Blocked by: T-019, T-022, T-032 — Blocks: T-048, T-050
- [ ] **T-050** (complexity: 3) [core] - Wire webhook/cron to commerce-visibility reconciler
  - Blocked by: T-032, T-048, T-049 — Blocks: T-057

#### Phase 9 — Web

- [ ] **T-052** (complexity: 2) - Add commerce i18n locale files (es/en/pt)
  - Blocked by: T-041 — Blocks: T-053, T-055, T-056
- [ ] **T-053** (complexity: 3) [gastro] - Build /gastronomia listing page (web)
  - Blocked by: T-042, T-052 — Blocks: T-058
- [ ] **T-054** (complexity: 3) [gastro] - Build /gastronomia detail page + blocks (web)
  - Blocked by: T-042, T-043, T-044, T-045, T-046, T-047, T-052 — Blocks: T-058
- [ ] **T-055** (complexity: 2) [core] - Build change-password-required screen (web)
  - Blocked by: T-041, T-052 — Blocks: T-058
- [ ] **T-056** (complexity: 2) [core] - Build public lead form page (web)
  - Blocked by: T-047, T-052 — Blocks: T-058

#### Phase 10 — Admin

- [ ] **T-057** (complexity: 3) [core] - Build generic commerce admin Entity shell config layer
  - Blocked by: T-050 — Blocks: T-058, T-059
- [ ] **T-058** (complexity: 3) [core] - Build admin lead inbox + owner-provisioning UX
  - Blocked by: T-047, T-053, T-054, T-055, T-056 — Blocks: T-060
- [ ] **T-059** (complexity: 3) [gastro] - Build gastronomy admin routes (fields/filters)
  - Blocked by: T-045, T-046, T-057 — Blocks: T-060

### Testing Phase

- [ ] **T-051** (complexity: 3) [core] - Add entitlement-isolation regression test (host + commerce) — HIGH-RISK gate (AC-4.4)
  - Blocked by: T-034 — Blocks: T-061
- [ ] **T-060** (complexity: 3) - Write cross-layer E2E test for gastronomy flow
  - Blocked by: T-057, T-058, T-059 — Blocks: T-061, T-062
- [ ] **T-061** (complexity: 2) [core] - Execute staging MP smoke for commerce subscription (SPEC-143 binding gate)
  - Blocked by: T-051, T-060 — Blocks: T-064

### Docs Phase

#### Phase 11 — Docs & ADR

- [ ] **T-062** (complexity: 2) [core] - Write core/gastro separation ADR + SPEC-240 reuse checklist (AC-9.2)
  - Blocked by: T-060 — Blocks: T-063
- [ ] **T-063** (complexity: 1) [core] - Add route-architecture + CLAUDE.md doc rows
  - Blocked by: T-062 — Blocks: T-064

### Cleanup Phase

- [ ] **T-064** (complexity: 1) [core] - Add endpoint-gate-matrix rows for commerce/gastronomy
  - Blocked by: T-061, T-062, T-063 — Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-018, T-020
- Level 1: T-008, T-010, T-019, T-021, T-022, T-023, T-026, T-041
- Level 2: T-009, T-011, T-012, T-013, T-014, T-015, T-016, T-017, T-024, T-025, T-030, T-034, T-052
- Level 3: T-027, T-051, T-055
- Level 4: T-028
- Level 5: T-029, T-032, T-033, T-040
- Level 6: T-031, T-035, T-047, T-049
- Level 7: T-036, T-037, T-038, T-039, T-045, T-048, T-056
- Level 8: T-042, T-043, T-044, T-046, T-050
- Level 9: T-053, T-054, T-057
- Level 10: T-058, T-059
- Level 11: T-060
- Level 12: T-061, T-062
- Level 13: T-063
- Level 14: T-064

## Suggested Start

Begin with **T-001** (complexity: 1) — Add PriceRangeEnum and ProductDomainEnum. No dependencies; it unblocks the GASTRO entity schema (T-010), the gastronomies table (T-021), the permission set (T-008), and the product_domain isolation column (T-026) — the foundational seam of the whole spec. T-002..T-007 and T-018/T-020 can run in parallel on the same level.

## High-Risk Tasks (extra care + explicit regression coverage)

- **T-034 + T-051** — `product_domain` entitlement isolation. A commerce subscription must NEVER enter `loadEntitlements()`. T-051 asserts a host+commerce customer resolves accommodation entitlements identically to an accommodation-only customer.
- **T-041** — `must_change_password` force-password-change gate. No native Better Auth mechanism exists today; the gate must block every protected route except change-password while flagged (regression test AC-3.4).
- **T-061** — Staging MercadoPago smoke (SPEC-143). Binding gate for the billing surface; cannot merge without the filed sign-off.
