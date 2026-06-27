# SPEC-240: Experiencias y Servicios (tourism services & experiences)

## Progress: 0/40 tasks (0%)

**Average Complexity:** 1.9/3 (max)
**Status:** in-progress
**Depends on:** SPEC-239 (commerce-listing core — merged to staging; only T-061 MP smoke pending as a prod gate)

All tasks have complexity ≤ 3. The spec is a thin consumer of the SPEC-239 commerce core.

---

### Phase 1 — Enums + Schemas (setup/core)

- [ ] **T-001** (c1) - Add ExperienceTypePgEnum + ExperiencePriceUnitPgEnum to DB enums — blocks T-002, T-008
- [ ] **T-002** (c1) - Create Zod enum schemas — blocked by T-001 — blocks T-003
- [ ] **T-003** (c2) - experience.schema.ts (main entity) — blocked by T-002 — blocks T-004..T-007, T-018
- [ ] **T-004** (c2) - experience.crud.schema.ts — blocked by T-003 — blocks T-017, T-020, T-021
- [ ] **T-005** (c3) - experience.http.schema.ts (public-tier leak guard) — blocked by T-003 — blocks T-019, T-020, T-021
- [ ] **T-006** (c2) - experience.query + admin-search schema — blocked by T-003 — blocks T-019, T-021
- [ ] **T-007** (c2) - experience.relations.schema.ts — blocked by T-003 — blocks T-019

### Phase 2 — DB (core)

- [ ] **T-008** (c2) - experiences.dbschema.ts (main table + indexes) — blocked by T-001 — blocks T-009..T-013
- [ ] **T-009** (c1) - experience_reviews.dbschema.ts — blocked by T-008
- [ ] **T-010** (c1) - experience_faqs.dbschema.ts — blocked by T-008
- [ ] **T-011** (c1) - experience_hours.dbschema.ts — blocked by T-008
- [ ] **T-012** (c1) - r_experience_amenity + r_experience_feature — blocked by T-008
- [ ] **T-013** (c3) - Generate/review/apply migration + drift guard — blocked by T-008..T-012 — blocks T-014, T-017
- [ ] **T-014** (c2) - Seed data (3-5 entries) — blocked by T-013

### Phase 3 — Service (core)

- [ ] **T-015** (c2) - experience.permissions.ts — blocks T-017
- [ ] **T-016** (c2) - helpers + normalizers (TDD) — blocks T-017
- [ ] **T-018** (c1) - experience.types.ts — blocked by T-003 — blocks T-017
- [ ] **T-017** (c3) - experience.service.ts (extends BaseCommerceListingService) — blocked by T-004, T-013, T-015, T-016, T-018 — blocks T-019..T-021

### Phase 4 — API (integration/testing)

- [ ] **T-019** (c3) - Public routes (list/getById/getBySlug/reviews) — blocked by T-017, T-005, T-006, T-007
- [ ] **T-020** (c3) - Protected routes (updateOwn, review create/delete) — blocked by T-017, T-004, T-005
- [ ] **T-021** (c3) - Admin routes (CRUD + toggle-sub + FAQs + hours + reviews) — blocked by T-017, T-004, T-005, T-006
- [ ] **T-022** (c2) - Integration tests + endpoint-gate-matrix — blocked by T-019, T-020, T-021

### Phase 5 — Web UI (integration/testing)

- [ ] **T-023** (c2) - i18n experience.json es/en/pt — blocks T-024, T-026, T-027, T-029
- [ ] **T-024** (c2) - ExperienceCard + ExperiencePriceTag — blocked by T-023
- [ ] **T-025** (c2) - ExperienceGrid + ExperienceFilters island — blocked by T-024
- [ ] **T-026** (c3) - /experiencias index.astro (SSR) — blocked by T-019, T-025, T-023
- [ ] **T-027** (c2) - Hero + Info + ContactCTA (WhatsApp) — blocked by T-023
- [ ] **T-028** (c2) - FAQs + Reviews island — blocked by T-023
- [ ] **T-029** (c3) - /experiencias/[slug].astro (SSR, 404 guard) — blocked by T-019, T-027, T-028
- [ ] **T-030** (c2) - Web component tests — blocked by T-026, T-029

### Phase 6 — Admin UI (integration)

- [ ] **T-031** (c2) - Admin list page — blocked by T-021
- [ ] **T-032** (c3) - Admin create/edit form + subscription toggle — blocked by T-021
- [ ] **T-033** (c1) - Admin detail/view page — blocked by T-021
- [ ] **T-034** (c2) - Admin FAQ management (reuse FaqManager) — blocked by T-021
- [ ] **T-035** (c1) - Admin review moderation — blocked by T-021
- [ ] **T-036** (c3) - Owner-scoped operational edit form — blocked by T-021, T-032

### Phase 7 — Docs + Closeout (docs/cleanup)

- [ ] **T-037** (c1) - Update route-architecture.md — blocked by T-021
- [ ] **T-038** (c1) - Update endpoint-gate-matrix — blocked by T-021
- [ ] **T-039** (c2) - Smoke test (create→toggle→visible→review→approve) — blocked by T-014, T-022, T-030, T-031..T-036
- [ ] **T-040** (c1) - Closeout indexes + CSV — blocked by T-037, T-038, T-039

---

## Critical Path

T-001 → T-002 → T-003 → T-004 → T-017 → T-021 → T-032 → T-036 → T-039 → T-040

## Parallel Tracks (after T-003)

- **Schemas track:** T-005, T-006, T-007 in parallel
- **DB track:** T-008 → T-009/T-010/T-011/T-012 (parallel) → T-013
- **Service prep:** T-015, T-016, T-018 in parallel (all feed T-017)
- **Web track:** T-023 → components (T-024/T-027/T-028 parallel) once public API (T-019) lands
- **Admin track:** T-031/T-033/T-034/T-035 parallel once admin API (T-021) lands

## Suggested Start

Begin with **T-001** (complexity 1) — no dependencies, unblocks the entire enum/schema/DB chain.
