# TODOs: Destination Relationship Cleanup

Spec: SPEC-095 | Status: in_progress | Progress: 6/35

---

## Critical Path

T-001 -> T-004 -> T-007 -> T-008 -> T-010 -> T-011 -> T-013 -> T-015 -> T-016/T-017/T-018/T-019/T-022 -> T-033 -> T-034

Length: 12 hops (longest sequential chain). All web component work (T-016 through T-022) is blocked only on T-015 and can proceed in parallel once transforms are stable.

---

## Parallel Tracks

- **Track A (Schema Foundation)**: T-001, T-002, T-003, T-006 — all independent, run simultaneously
- **Track B (Entity Migration)**: T-004 (after T-001 + T-006), T-005 (after T-002 + T-006)
- **Track C (DB + Service)**: T-007, T-008, T-009 (after T-004 + T-005), then T-010, T-011, T-012
- **Track D (Response Schemas)**: T-013 (after T-003 + T-010 + T-011), T-014 (after T-003 + T-012)
- **Track E (API Extension)**: T-020 — independent, can run anytime
- **Track F (Web)**: T-015 (after T-013 + T-014), then T-016..T-022 in parallel
- **Track G (Audit + Seed)**: T-023 (independent), T-024 (after T-023 + T-008 + T-009)
- **Track H (Tests)**: T-025..T-032 fan out after their respective impl tasks
- **Track I (Docs)**: T-035 after T-006, T-034 after T-033

---

## Phase 0 - Schema Foundation (6 tasks)

- [ ] T-001: Create AccommodationLocationSchema (postal address only) (complexity: 1)
- [ ] T-002: Create EventLocationAddressSchema (postal address only) (complexity: 1)
- [ ] T-003: Create CityDestinationRefSchema (relation projection) (complexity: 1)
- [ ] T-004: Replace BaseLocationFields with AccommodationLocationFields in AccommodationSchema (complexity: 2) [blocked by T-001, T-006]
- [ ] T-005: Restructure EventLocationSchema to use new address fields (complexity: 2) [blocked by T-002, T-006]
- [ ] T-006: Revert BBT-11 hotfix (city field on BaseLocationSchema) (complexity: 1)

---

## Phase 1 - Entity Schema Migration (already folded into Phase 0 tasks above)

T-004 and T-005 cover Phase 1 entity schema migration (mapped to `core` phase). No separate phase grouping needed; they are sequenced correctly in the dependency graph.

---

## Phase 2 - DB and Service (8 tasks)

- [ ] T-007: Update DB column types for accommodation and event_location JSONB (complexity: 2) [blocked by T-004, T-005]
- [ ] T-008: Add CITY destinationType validation to AccommodationService (create + update) (complexity: 2) [blocked by T-007]
- [ ] T-009: Add CITY destinationType validation to EventService (create + update) (complexity: 2) [blocked by T-007]
- [ ] T-010: Eager-load cityDestination in AccommodationService list and search (complexity: 2) [blocked by T-003, T-008]
- [ ] T-011: Eager-load cityDestination in AccommodationService getById, getBySlug, adminList (complexity: 2) [blocked by T-010]
- [ ] T-012: Eager-load cityDestination in EventService response methods (complexity: 2) [blocked by T-003, T-009]
- [ ] T-013: Update accommodation API response schemas to include cityDestination (complexity: 2) [blocked by T-003, T-004, T-010, T-011]
- [ ] T-014: Update event API response schemas to include cityDestination (complexity: 2) [blocked by T-003, T-005, T-012]

---

## Phase 3 - Web App (8 tasks)

- [ ] T-015: Update transforms.ts to derive cityName, cityPath, cityDestinationSlug from cityDestination (complexity: 2) [blocked by T-013, T-014]
- [ ] T-016: Update AccommodationCard and PropertyCard to read cityName from props (complexity: 1) [blocked by T-015]
- [ ] T-017: Update EventCard, EventCardHorizontal, EventCardFeatured to read cityName from props (complexity: 1) [blocked by T-015]
- [ ] T-018: Update LodgingBusinessJsonLd to build address from cityDestination data (complexity: 2) [blocked by T-015]
- [ ] T-019: Update EventJsonLd to build location address from cityDestination data (complexity: 2) [blocked by T-015]
- [ ] T-020: Add type=CITY filter support to /destinations GET endpoint (complexity: 2) [no blocking deps]
- [ ] T-021: Create CityDestinationPicker island component (complexity: 3) [blocked by T-020]
- [ ] T-022: Replace city free-text input with CityDestinationPicker in PropertyFormBasicSections (complexity: 2) [blocked by T-021]

---

## Phase 4 - Data and Tests (11 tasks)

- [ ] T-023: Audit accommodation seed files for non-CITY destinationId references (complexity: 1) [no blocking deps]
- [ ] T-024: Re-seed accommodations and event locations with valid CITY destinationIds (complexity: 2) [blocked by T-023, T-008, T-009]
- [ ] T-025: Update accommodation schema-validation tests and fixtures (complexity: 2) [blocked by T-013, T-024]
- [ ] T-026: Update event schema-validation tests and fixtures (complexity: 2) [blocked by T-014, T-024]
- [ ] T-027: Write AccommodationService CITY validation unit tests (complexity: 1) [blocked by T-008]
- [ ] T-028: Write EventService CITY validation unit tests (complexity: 1) [blocked by T-009]
- [ ] T-029: Write web transform unit tests for cityDestination derivation (complexity: 1) [blocked by T-015]
- [ ] T-030: Write web card component tests asserting no location.city reads (complexity: 2) [blocked by T-016, T-017]
- [ ] T-031: Write CityDestinationPicker unit tests (complexity: 2) [blocked by T-021]
- [ ] T-032: Audit and remove any remaining ?city= query parameter usages in public listing routes (complexity: 1) [blocked by T-007]
- [ ] T-033: Run full verification: grep zero location.city, typecheck, lint, test (complexity: 1) [blocked by T-016..T-032]

---

## Docs and Cleanup (2 tasks)

- [ ] T-034: Register GAP-095-01 in gaps-postergados.md and add wire-format release note (complexity: 1) [blocked by T-033]
- [ ] T-035: Mark BBT-11 as superseded in BEFORE_BETA_TESTING.md (complexity: 1) [blocked by T-006]

---

## Complexity Distribution

| Complexity | Count | Tasks |
|------------|-------|-------|
| 1 (trivial) | 14 | T-001, T-002, T-003, T-006, T-016, T-017, T-023, T-027, T-028, T-029, T-032, T-033, T-034, T-035 |
| 2 (small focused) | 20 | T-004, T-005, T-007, T-008, T-009, T-010, T-011, T-012, T-013, T-014, T-015, T-018, T-019, T-020, T-022, T-024, T-025, T-026, T-030, T-031 |
| 3 (multi-file) | 1 | T-021 |

---

## Notes

- **T-021 is the only complexity-3 task** (CityDestinationPicker island). It involves a new React component, debounced fetch, keyboard navigation, and onSelect callback wiring. Splitting further would produce tasks too small to be meaningful (e.g. "add keyboard handler") so it stays at 3.
- **T-020 may be a verification task only** if the `/destinations` endpoint already supports `?type=` filtering. The implementer should check first and reduce effort accordingly.
- **T-023 is pure read-only audit** — no code changes, output is notes for T-024.
- **T-027 and T-028** may collapse into T-008 and T-009 respectively if the implementer writes the full test suite co-located. They exist as explicit tasks to ensure tests are not skipped.
- **T-035 (BBT-11 doc)** can run in parallel with T-006 or immediately after — it is a one-line status update.
