# SPEC-222: Accommodation import from URL

## Progress: 0/28 tasks (0%)

**Average Complexity:** 2.5/3 (max)
**Critical Path:** T-009 → T-014 → T-019 → T-020 → T-023 → T-025 (6 steps)
**Parallel Tracks:** schemas/AI/billing/env (setup) ‖ security util ‖ adapters

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Add ImportSource + FieldSource enums and ImportedField<T> helper to @repo/schemas
  - Blocked by: none
  - Blocks: T-002, T-003
- [ ] **T-002** (complexity: 3) - Define AccommodationImportDraftSchema (per-field ImportedField, type=13 enum values)
  - Blocked by: T-001
  - Blocks: T-003, T-011, T-019
- [ ] **T-003** (complexity: 2) - Define AccommodationImportRequest/Response schemas (legalConfirmed literal(true))
  - Blocked by: T-002
  - Blocks: T-019, T-020, T-023, T-026
- [ ] **T-004** (complexity: 2) - Register 'accommodation_import' AI feature + default prompt (es, 13 types)
  - Blocked by: none
  - Blocks: T-019
- [ ] **T-005** (complexity: 3) - Add AI entitlement + limit keys (+ LIMIT_METADATA + RESOURCE_NAMES + seed)
  - Blocked by: none
  - Blocks: T-019, T-020
- [ ] **T-006** (complexity: 2) - Register import env vars (registry + api env.ts + .env.example) → notify Coolify
  - Blocked by: none
  - Blocks: T-007, T-016, T-017, T-018

### Core Phase

- [ ] **T-007** (complexity: 3) - Implement safeExternalFetch SSRF-guarded fetch util
  - Blocked by: T-006
  - Blocks: T-008, T-014, T-015
- [ ] **T-008** (complexity: 2) - Unit tests for safeExternalFetch (SSRF matrix)
  - Blocked by: T-007
  - Blocks: none
- [ ] **T-009** (complexity: 2) - ImportSourceAdapter interface + RawExtraction + detectSource
  - Blocked by: none
  - Blocks: T-010..T-019
- [ ] **T-010** (complexity: 3) - JSON-LD / OpenGraph / meta extraction helpers (no DOM dep, strip ratings)
  - Blocked by: T-009
  - Blocks: T-014, T-015
- [ ] **T-011** (complexity: 3) - Confidence scoring constant + per-field Zod map/validate
  - Blocked by: T-002, T-009
  - Blocks: T-019
- [ ] **T-012** (complexity: 2) - Amenity resolution (catalog name/slug search)
  - Blocked by: T-009
  - Blocks: T-019
- [ ] **T-013** (complexity: 2) - destinationHint resolution (never auto-set FK)
  - Blocked by: T-009
  - Blocks: T-019
- [ ] **T-014** (complexity: 3) - GenericAdapter (fetch + JSON-LD → AI Strategy B)
  - Blocked by: T-007, T-010, T-004
  - Blocks: T-019
- [ ] **T-015** (complexity: 3) - BookingAdapter (fetch + JSON-LD Hotel → Apify fallback)
  - Blocked by: T-007, T-010
  - Blocks: T-019
- [ ] **T-016** (complexity: 3) - AirbnbAdapter (Apify actor REST) + credential degradation (US-11)
  - Blocked by: T-006, T-009
  - Blocks: T-019
- [ ] **T-017** (complexity: 3) - MercadoLibreAdapter (OAuth /items/{id}) + credential degradation (US-11)
  - Blocked by: T-006, T-009
  - Blocks: T-019
- [ ] **T-018** (complexity: 2) - GooglePlacesAdapter (Place Details New) + credential degradation (US-11)
  - Blocked by: T-006, T-009
  - Blocks: T-019
- [ ] **T-019** (complexity: 3) - accommodation-import.service.ts orchestration (stateless, never throws)
  - Blocked by: T-003, T-004, T-005, T-011, T-012, T-013, T-014, T-015, T-016, T-017, T-018
  - Blocks: T-020, T-027

### Integration Phase

- [ ] **T-020** (complexity: 3) - POST /protected/accommodations/import-from-url (perms, legal recheck, rate-limit, AI quota)
  - Blocked by: T-003, T-005, T-019
  - Blocks: T-021, T-022, T-023, T-026
- [ ] **T-021** (complexity: 3) - Integration test for import endpoint
  - Blocked by: T-020
  - Blocks: none
- [ ] **T-023** (complexity: 3) - Web: ImportFromUrl.client.tsx island + module.css (legal-checkbox gate)
  - Blocked by: T-003, T-020
  - Blocks: T-024, T-025
- [ ] **T-024** (complexity: 2) - Web: per-platform URL-help panel (US-7) + i18n es/en/pt
  - Blocked by: T-023
  - Blocks: none
- [ ] **T-025** (complexity: 3) - Web: wire into CreatePropertyMiniForm + confidence badges + prefill
  - Blocked by: T-023
  - Blocks: none
- [ ] **T-026** (complexity: 3) - Admin: import-from-url section in consolidated edit form
  - Blocked by: T-020
  - Blocks: none

### Docs Phase

- [ ] **T-022** (complexity: 1) - Docs: route-architecture + endpoint-gate-matrix
  - Blocked by: T-020
  - Blocks: none
- [ ] **T-027** (complexity: 2) - ADR: tiered import strategy + provider abstraction + SSRF + legal
  - Blocked by: T-019
  - Blocks: none

### Cleanup Phase

- [ ] **T-028** (complexity: 2) - Polish: PostHog events + legal copy + smoke test
  - Blocked by: T-020
  - Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001, T-004, T-005, T-006, T-009
- Level 1: T-002, T-007, T-010, T-012, T-013, T-016, T-017, T-018
- Level 2: T-003, T-008, T-011, T-014, T-015
- Level 3: T-019
- Level 4: T-020, T-027
- Level 5: T-021, T-022, T-023, T-026, T-028
- Level 6: T-024, T-025

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks the whole schema chain (T-002, T-003) that the service and both UIs need. T-004, T-005, T-006, T-009 are also dependency-free and can run in parallel.

## External blockers (owner action — not code)

- MercadoLibre OAuth app + token (ML `/items` no longer anonymous) → T-017
- Google Places API key (needs GCP billing enabled) → T-018
- Apify API token → T-016 (+ Booking fallback T-015)

Adapters degrade cleanly to `source: 'none'` (US-11) while credentials are pending.
