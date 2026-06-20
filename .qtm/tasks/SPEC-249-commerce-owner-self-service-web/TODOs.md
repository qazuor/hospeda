# SPEC-249: Commerce owner self-service web area

## Progress: 0/26 tasks (0%)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-003 → T-006 → T-009 → T-011 → T-012 → T-016 → T-025 (7 steps)
**Parallel Tracks:** 3 (web owner surface · admin approve&provision · early regression)

> Scope note: Parts B (force-password) and C (credential email) were ALREADY BUILT by
> SPEC-239 — they are VERIFY-ONLY here (T-023, T-024). The build work is the web owner
> surface (Part A) + the single approve&provision admin action (Part D / AC-6).

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Add isCommerceOwnerRole helper + commerce nav gating to account-roles
  - apps/web/src/lib/account-roles.ts; mirror isHostRole. Unit test for the helper.
  - Blocked by: none · Blocks: T-009, T-010, T-011

- [ ] **T-002** (complexity: 2) - Add i18n keys (es/en/pt) for the commerce owner area
  - packages/i18n nav + list + editor labels + states. Catalog completeness test.
  - Blocked by: none · Blocks: T-009, T-011

- [ ] **T-003** (complexity: 2) - Add OwnerListingSummary view type + list-response schema in @repo/schemas
  - Reuse existing updateOwn schemas; only a thin summary + list schema. Unit test.
  - Blocked by: none · Blocks: T-006, T-007, T-009

### Core Phase

- [ ] **T-004** (complexity: 3) - Add owner-scoped listOwn on GastronomyService
  - service-core; ownerId scoping, soft-delete excluded. Ownership unit tests.
  - Blocked by: none · Blocks: T-005, T-006

- [ ] **T-005** (complexity: 2) - Add owner-scoped listOwn on ExperienceService
  - Mirror T-004; factor shared logic into base if clean. Unit tests.
  - Blocked by: T-004 · Blocks: T-007

- [ ] **T-006** (complexity: 3) - Add protected GET /gastronomy/protected/mine
  - Owner-scoped list endpoint via T-004. Integration test (owner/tourist/unauth).
  - Blocked by: T-003, T-004 · Blocks: T-008, T-009

- [ ] **T-007** (complexity: 2) - Add protected GET /experience/protected/mine
  - Mirror T-006 via T-005. Integration test.
  - Blocked by: T-003, T-005 · Blocks: T-008, T-009

- [ ] **T-008** (complexity: 1) - Add endpoint-gate-matrix rows for the new /mine endpoints (SPEC-145 guard)
  - docs/billing/endpoint-gate-matrix.md + route-architecture note. CI matrix guard must pass.
  - Blocked by: T-006, T-007 · Blocks: T-026

- [ ] **T-009** (complexity: 3) - Create mi-cuenta/comercio listing page (SSR, owned listings)
  - apps/web .../mi-cuenta/comercio/index.astro; role gate, fetch+merge both /mine, AccountLayout. Gating/render test.
  - Blocked by: T-001, T-002, T-003, T-006, T-007 · Blocks: T-010, T-011, T-020, T-025

- [ ] **T-010** (complexity: 1) - Add 'Mi comercio' nav entry to the mi-cuenta shell
  - Gated by isCommerceOwnerRole. Visibility test.
  - Blocked by: T-001, T-009 · Blocks: none

- [ ] **T-011** (complexity: 3) - Create per-listing editor route (SSR getById-own + read-only identity)
  - .../comercio/[vertical]/[id]/editar.astro; 404 for non-owner; read-only identity; mount island. Ownership smoke.
  - Blocked by: T-001, T-002, T-009 · Blocks: T-012

- [ ] **T-012** (complexity: 3) - Build editor island scaffolding (native form, submit hook to protected patch)
  - CommerceListingEditor.client.tsx; per-vertical patch; dirty-state; CSS module. Submit-hook unit test.
  - Blocked by: T-011 · Blocks: T-013, T-014, T-015, T-016

- [ ] **T-013** (complexity: 3) - Editor: simple field groups (menuUrl, priceRange, richDescription, contactInfo)
  - Wire to patch. Component tests.
  - Blocked by: T-012 · Blocks: T-021, T-025

- [ ] **T-014** (complexity: 3) - Editor: structured field groups (openingHours, socialNetworks)
  - Structured JSON round-trip. Component tests.
  - Blocked by: T-012 · Blocks: T-021, T-025

- [ ] **T-015** (complexity: 3) - Editor: media gallery group
  - Reuse web media handling. Component test.
  - Blocked by: T-012 · Blocks: T-025

- [ ] **T-016** (complexity: 3) - Editor: amenities/features multi-select groups
  - Fetch catalog, persist id arrays. Component test.
  - Blocked by: T-012 · Blocks: T-025, T-026

- [ ] **T-017** (complexity: 3) - Service: approve-lead-and-provision orchestration
  - Compose lead approve + provisionCommerceOwner; idempotent. Unit tests (approve/reject/double).
  - Blocked by: none · Blocks: T-018, T-024

- [ ] **T-018** (complexity: 3) - API: single approve-and-provision admin action
  - Extend mark-handled.ts or new route via T-017; matrix row if new. Integration test.
  - Blocked by: T-017 · Blocks: T-019, T-023, T-026

- [ ] **T-019** (complexity: 3) - Admin UI: surface 'Approve & provision' in the leads inbox
  - apps/admin TanStack/Tailwind; confirm dialog + mutation + toast. Component test.
  - Blocked by: T-018 · Blocks: none

### Integration Phase

- [ ] **T-020** (complexity: 2) - Integration: mustChangePassword interplay with mi-cuenta/comercio
  - Provisioned owner forced to cambiar-contrasena before comercio. Reuses SPEC-239 gate. Integration test.
  - Blocked by: T-009 · Blocks: none

- [ ] **T-021** (complexity: 2) - Integration: owner edits reflected on the public ficha
  - Edits surface on /gastronomia/[slug] + /experiencias/[slug] incl. revalidation. Integration test.
  - Blocked by: T-013, T-014 · Blocks: none

### Testing Phase

- [ ] **T-022** (complexity: 2) - Regression: updateOwn rejects/strips identity fields (both verticals) [AC-3]
  - Forged name/slug/type/destinationId unchanged after submit, gastronomy + experience.
  - Blocked by: none · Blocks: none

- [ ] **T-023** (complexity: 2) - Smoke: force-password on first login [AC-4, verify-only]
  - Provisioned owner forced through cambiar-contrasena; flag clears. Assert existing mechanism.
  - Blocked by: T-018 · Blocks: none

- [ ] **T-024** (complexity: 2) - Smoke: credential email on provisioning [AC-5, verify-only]
  - Notifications stub: COMMERCE_OWNER_CREDENTIALS sent with changePasswordUrl.
  - Blocked by: T-017 · Blocks: none

- [ ] **T-025** (complexity: 3) - E2E: owner edits gastronomy + experience operational fields [AC-1, AC-2]
  - Playwright with gastro-owner-*@local.test; own-only listing, edit both verticals, non-owner blocked.
  - Blocked by: T-009, T-013, T-014, T-015, T-016 · Blocks: none

### Docs Phase

- [ ] **T-026** (complexity: 1) - Docs: commerce owner self-service guide + references
  - Owner guide + apps/web CLAUDE.md + route-architecture (paired with T-008).
  - Blocked by: T-008, T-016, T-018 · Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001, T-002, T-003, T-004, T-017, T-022
- Level 1: T-005, T-006, T-018, T-024
- Level 2: T-007, T-019, T-023
- Level 3: T-008, T-009
- Level 4: T-010, T-011, T-020
- Level 5: T-012
- Level 6: T-013, T-014, T-015, T-016
- Level 7: T-021, T-025, T-026

## Suggested Start

Begin with **T-003** (schema) and **T-004** (gastronomy listOwn) — they sit on the critical
path. In parallel, **T-017** can start the admin approve&provision track and **T-022** the
identity-strip regression, both with no dependencies.
