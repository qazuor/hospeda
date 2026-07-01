# SPEC-309: Featured Listing — Addon Source + Hardening

## Progress: 16/30 tasks (53%)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-001 -> T-002 -> T-004 -> T-005 -> T-008 -> T-023 -> T-030 (7 steps)
**Parallel Tracks:** 4 identified — (A) DB/resolver/sync-primitive core spine, (B) 6 billing call-site rewires (run in parallel once T-005 lands), (C) addon checkout/confirm + addon-hook wiring, (D) owner self-service toggle (API + web)

Followup to SPEC-292 (merged PR #1930). Wires the `visibility-boost-7d`/`-30d` addons'
customer-level FEATURED_LISTING grant into the existing plan-only featuring system,
renames `featuredByPlan` -> `featuredByEntitlement`, adds ISR revalidation, hardens
status-handling parity with `loadEntitlements`/the reconcile cron, and adds an
owner self-service toggle (folded in from SPEC-320).

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Migration: rename featuredByPlan column to featuredByEntitlement [DONE]
  - accommodation.dbschema.ts column+indexes, accommodation.model.ts sort expression (OQ-1)
  - Blocked by: none
  - Blocks: T-002, T-005

- [x] **T-002** (complexity: 2) - Migration: new featured_listing_addon_grants link table + generate [DONE]
  - New table analogous to commerce_listing_subscriptions; ONE db:generate covering T-001+T-002
  - Blocked by: T-001
  - Blocks: T-004, T-007

- [x] **T-003** (complexity: 1) - Addon config: add requiresAccommodationTarget flag [DONE]
  - AddonDefinition + both visibility-boost addons
  - Blocked by: none
  - Blocks: T-006

### Core Phase

- [x] **T-004** (complexity: 3) - Build shared featured-entitlement resolver helpers [DONE]
  - resolveOwnerPlanGrantsFeatured / resolveAccommodationHasActiveFeaturedAddon / getOwnerAccommodationIdsWithActiveFeaturedAddon
  - Blocked by: T-002
  - Blocks: T-005, T-014, T-019, T-021

- [x] **T-005** (complexity: 3) - Rename and harden sync primitives with addon-aware exclusion/guard [DONE]
  - syncFeaturedByEntitlementForOwner (addon-protected exclusion) + syncFeaturedByEntitlementForAccommodation (plan-guard)
  - Blocked by: T-001, T-004
  - Blocks: T-008..T-018, T-022, T-026

- [x] **T-006** (complexity: 2) - Checkout: capture and validate accommodationId for target-required addons [DONE]
  - Also fixed a cross-task gap: T-003's flag only reached the static config catalog; extended addon-catalog.mapper.ts + billingAddons.seed.ts so the DB-backed catalog reads/writes it too
  - Blocked by: T-003
  - Blocks: T-007

- [x] **T-007** (complexity: 3) - Thread accommodationId through confirm flow and write the link row [DONE]
  - Blocked by: T-002, T-006
  - Blocks: T-015, T-016, T-025

### Integration Phase

- [x] **T-008** (complexity: 2) - G-1/G-5: wire qzpay-admin-hooks.ts to the union resolver [DONE]
  - Blocked by: T-005 · Blocks: T-023
- [x] **T-009** (complexity: 2) - G-1/G-5: wire subscription-logic.ts to the union resolver [DONE]
  - Blocked by: T-005 · Blocks: T-023
- [x] **T-010** (complexity: 2) - G-1/G-5: wire payment-logic.ts to the union resolver [DONE]
  - Blocked by: T-005 · Blocks: T-023
- [x] **T-011** (complexity: 2) - G-1/G-5: wire finalize-cancelled-subs.ts to the union resolver [DONE]
  - Blocked by: T-005 · Blocks: T-024
- [x] **T-012** (complexity: 2) - G-1/G-5: wire dunning.job.ts to the union resolver [DONE]
  - Blocked by: T-005 · Blocks: T-024
- [x] **T-013** (complexity: 2) - G-1/G-5: wire apply-scheduled-plan-changes.ts to the union resolver [DONE]
  - Blocked by: T-005 · Blocks: T-024
- [x] **T-014** (complexity: 3) - Rename and extend reconcile cron for addon-sourced, per-accommodation drift [DONE]
  - Blocked by: T-004, T-005 · Blocks: T-029
- [x] **T-015** (complexity: 2) - G-2: wire addon grant path to sync accommodation featuring [DONE]
  - Blocked by: T-005, T-007 · Blocks: T-025
- [x] **T-016** (complexity: 3) - G-2: wire addon expiry paths to clear accommodation featuring [DONE]
  - Blocked by: T-005, T-007 · Blocks: T-026
- [ ] **T-017** (complexity: 2) - G-3: wire ISR/CDN revalidation into syncFeaturedByEntitlementForOwner
  - Blocked by: T-005 · Blocks: T-027
- [ ] **T-018** (complexity: 1) - G-3: wire ISR/CDN revalidation into syncFeaturedByEntitlementForAccommodation
  - Blocked by: T-005 · Blocks: T-027
- [ ] **T-019** (complexity: 3) - G-6: owner self-service featured toggle — API route + entitlement gate
  - Blocked by: T-004 · Blocks: T-020
- [ ] **T-020** (complexity: 3) - G-6: owner self-service featured toggle — web UI
  - Blocked by: T-019 · Blocks: T-028

### Testing Phase

- [ ] **T-021** (complexity: 2) - Unit tests — resolver helpers (T-004)
  - Blocked by: T-004 · Blocks: T-030
- [ ] **T-022** (complexity: 3) - Unit tests — sync primitives exclusion/guard (T-005)
  - Blocked by: T-005 · Blocks: T-030
- [ ] **T-023** (complexity: 3) - Unit tests — call-site group A (webhook hooks: qzpay-admin-hooks, subscription-logic, payment-logic)
  - Blocked by: T-008, T-009, T-010 · Blocks: T-030
- [ ] **T-024** (complexity: 3) - Unit tests — call-site group B (cron jobs: finalize-cancelled-subs, dunning, apply-scheduled-plan-changes)
  - Blocked by: T-011, T-012, T-013 · Blocks: T-030
- [ ] **T-025** (complexity: 3) - Integration test — addon purchase to accommodation-scoped featuring, end-to-end
  - Blocked by: T-007, T-015 · Blocks: T-030
- [ ] **T-026** (complexity: 2) - Integration test — addon expiry plan-guard regression
  - Blocked by: T-016, T-005 · Blocks: T-030
- [ ] **T-027** (complexity: 2) - Integration test — revalidation triggered on featuring changes
  - Blocked by: T-017, T-018 · Blocks: T-030
- [ ] **T-028** (complexity: 2) - Tests — owner self-service toggle gate (T-019/T-020)
  - Blocked by: T-020 · Blocks: T-030
- [ ] **T-029** (complexity: 2) - Tests — reconcile cron per-accommodation addon drift (T-014)
  - Blocked by: T-014 · Blocks: T-030

### Docs Phase

- [ ] **T-030** (complexity: 1) - Docs: cross-reference and close-out notes
  - Blocked by: T-021..T-029 (all 9 testing tasks) · Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003
Level 1: T-002, T-006
Level 2: T-004, T-007
Level 3: T-005, T-019, T-021
Level 4: T-008, T-009, T-010, T-011, T-012, T-013, T-014, T-015, T-016, T-017, T-018, T-020, T-022
Level 5: T-023, T-024, T-025, T-026, T-027, T-028, T-029
Level 6: T-030

## Suggested Start

Begin with **T-001** (complexity: 2) - the `featuredByPlan` -> `featuredByEntitlement`
column rename. No dependencies, and it unblocks the two core-phase spines (T-002's
link table + T-005's sync primitives). **T-003** (complexity: 1, addon config flag)
can run in parallel — it has no dependencies either and feeds the separate
checkout-wiring track (T-006/T-007).
