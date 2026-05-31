# SPEC-158: Destinations Rich Content + Structured FAQs

## Progress: 0/42 tasks (0%)

**Average Complexity:** 2.6/4 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-005 → T-007 → T-009 → T-010 → T-017 → (content T-019..T-040) → T-041 → T-042
**Parallel Tracks:** schema-tests, db, service, api, web, and the 22 content tasks (all parallel once T-017 lands)

---

### Setup Phase (schemas)

- [ ] **T-001** (complexity: 1) — Add DestinationFaqIdSchema to common/id.schema.ts
  - Blocked by: none · Blocks: T-002
- [ ] **T-002** (complexity: 3) — Create destination.faq.schema.ts subtype
  - Blocked by: T-001 · Blocks: T-003
- [ ] **T-003** (complexity: 2) — Raise description max to 8000 + add faqs array + re-exports
  - Blocked by: T-002 · Blocks: T-004, T-005, T-014
- [ ] **T-004** (complexity: 3) — Schema unit tests + historic compat fixture
  - Blocked by: T-003 · Blocks: none

### Core Phase (db)

- [ ] **T-005** (complexity: 3) — Create destination_faq.dbschema.ts table + child relation
  - Blocked by: T-003 · Blocks: T-006, T-007
- [ ] **T-006** (complexity: 2) — Add faqs: many() to destination relations + schemas index export
  - Blocked by: T-005 · Blocks: T-008
- [ ] **T-007** (complexity: 2) — Create destinationFaq.model.ts
  - Blocked by: T-005 · Blocks: T-008, T-009
- [ ] **T-008** (complexity: 2) — Push schema locally + verify set_updated_at trigger covers destination_faqs
  - Blocked by: T-006, T-007 · Blocks: T-017

### Core Phase (service)

- [ ] **T-009** (complexity: 3) — Implement DestinationService.addFaq
  - Blocked by: T-007 · Blocks: T-010, T-011, T-012, T-017
- [ ] **T-010** (complexity: 2) — Implement DestinationService.getFaqs
  - Blocked by: T-009 · Blocks: T-011, T-012, T-017
- [ ] **T-011** (complexity: 3) — Unit tests for addFaq/getFaqs
  - Blocked by: T-009, T-010 · Blocks: none

### Integration Phase (api)

- [ ] **T-012** (complexity: 3) — Include faqs in public destination detail routes (getByPath + getBySlug)
  - Blocked by: T-009, T-010 · Blocks: T-013, T-015
- [ ] **T-013** (complexity: 3) — API integration tests (success, no-faqs empty, 404)
  - Blocked by: T-012 · Blocks: none

### Integration Phase (web)

- [ ] **T-014** (complexity: 2) — Create DestinationFaqAccordion.astro
  - Blocked by: T-003 · Blocks: T-016
- [ ] **T-015** (complexity: 2) — Map faqs in web transforms
  - Blocked by: T-012 · Blocks: T-016
- [ ] **T-016** (complexity: 3) — Wire accordion + FAQPageJsonLd + replace placeholder
  - Blocked by: T-014, T-015 · Blocks: none

### Core Phase (seed plumbing)

- [ ] **T-017** (complexity: 3) — Add faqs loop (with category) to destination seed factory
  - Blocked by: T-008, T-009, T-010 · Blocks: T-018 + all content tasks (T-019..T-040)

### Testing Phase (harness)

- [ ] **T-018** (complexity: 3) — Create seed-content validation test harness for 22 destinations
  - Blocked by: T-003, T-017 · Blocks: T-041

### Content Phase (22 tasks — one per city, blocked by T-017)

- [ ] **T-019** (complexity: 3) — Content: Chajarí (001)
- [ ] **T-020** (complexity: 4) — Content: Colón (002)
- [ ] **T-021** (complexity: 4) — Content: Concordia (003)
- [ ] **T-022** (complexity: 4) — Content: Federación (004)
- [ ] **T-023** (complexity: 4) — Content: Gualeguaychú (005)
- [ ] **T-024** (complexity: 2) — Content: Ibicuy (006) [small]
- [ ] **T-025** (complexity: 2) — Content: Liebig (007) [small]
- [ ] **T-026** (complexity: 2) — Content: Paranacito (008) [small]
- [ ] **T-027** (complexity: 3) — Content: San José (009)
- [ ] **T-028** (complexity: 2) — Content: Ubajay (010) [small]
- [ ] **T-029** (complexity: 4) — Content: Concepción del Uruguay (011)
- [ ] **T-030** (complexity: 2) — Content: Santa Ana (012) [small]
- [ ] **T-031** (complexity: 2) — Content: San Salvador (013)
- [ ] **T-032** (complexity: 3) — Content: Villaguay (014)
- [ ] **T-033** (complexity: 3) — Content: Villa Elisa (015)
- [ ] **T-034** (complexity: 2) — Content: Rosario del Tala (016) [small]
- [ ] **T-035** (complexity: 2) — Content: San Justo (017) [small]
- [ ] **T-036** (complexity: 2) — Content: Caseros (018) [small]
- [ ] **T-037** (complexity: 2) — Content: Urdinarrain (019) [small]
- [ ] **T-038** (complexity: 2) — Content: Larroque (020) [small, do not touch media]
- [ ] **T-039** (complexity: 3) — Content: Gualeguay (021)
- [ ] **T-040** (complexity: 2) — Content: Ceibas (022) [small, do not touch media]
  - All content tasks: Blocked by T-017 · Block T-041

### Testing Phase (final)

- [ ] **T-041** (complexity: 2) — Full seed run + 22-destination validation + coverage
  - Blocked by: T-018 + T-019..T-040 · Blocks: T-042

### Docs Phase

- [ ] **T-042** (complexity: 2) — Docs update + cleanup
  - Blocked by: T-041 · Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001
- Level 1: T-002
- Level 2: T-003
- Level 3: T-004, T-005, T-014
- Level 4: T-006, T-007
- Level 5: T-008, T-009
- Level 6: T-010
- Level 7: T-011, T-012, T-017
- Level 8: T-013, T-015, T-018, T-019..T-040 (content)
- Level 9: T-016, T-041
- Level 10: T-042

## Suggested Start

Begin with **T-001** (complexity: 1) — no dependencies, unblocks the whole schema chain.

## Notes

- **Phase 1 only.** Admin/protected FAQ CRUD + editing UI deferred to Phase 2.
- **Target = seed JSON + local DB.** Never push to staging/prod DB (T-008 is local-only).
- **Content = real web research, no invention.** Content tasks delegated to sub-agents in geographic batches (with WebSearch); orchestrator reviews each before commit.
- **T-038 (Larroque) and T-040 (Ceibas)** have REJECTED gallery image fixtures (moderation tests) — touch only description + faqs, never media.
