# SPEC-199 — AI Natural-Language Search: Task Progress

**Progress**: 0 / 21 tasks completed  
**Average Complexity**: 2.38 / 3  
**Status**: Not started  
**Created**: 2026-06-10

---

## Critical Path

The longest dependency chain that determines minimum calendar time:

```
T-001 → T-003 → T-004 → T-005 → T-010 → T-011 → T-012
                                    ↑
        T-006 → T-007 → T-009 ────→┘
                T-008 ─────────────→┘
        T-002 ─────────────────────→┘

Frontend:
T-014 → T-016 → T-017 → T-020 → T-021
                    ↑               ↑
         T-013 ────→┘   T-019 ─────→┘
         T-015 ────→┘
                T-018 → T-019
```

**Minimum depth**: 6 sequential steps on API path. Frontend path can run in parallel once T-013/T-014 are done.

---

## Parallel Tracks

These groups can start simultaneously (no inter-group blocking):

| Track | Tasks | Notes |
|-------|-------|-------|
| A — Schemas | T-001, T-002 (seq) | Foundation for everything API |
| B — Allowlists | T-006, T-007 (seq) | No deps; can start day 1 |
| C — Prompt | T-008 | No deps; can start day 1 |
| D — Analytics | T-013 | No deps; can start day 1 |
| E — i18n | T-014 | No deps; can start day 1 |

After T-001: Tracks B, C, D, E can all proceed in parallel with T-003.  
After T-006+T-007: T-009 unblocks.  
After T-001+T-005+T-008+T-009: T-010 unblocks.  
After T-014: T-015, T-016 unblock in parallel.  
After T-013+T-014+T-015+T-016: T-017 unblocks.

---

## Tasks by Phase

### Phase: SETUP

- [ ] **T-001** — Create AiSearchIntentRequestSchema and SearchIntentEntitiesSchema with barrel export `cx:3` `deps:none`
- [ ] **T-002** — Create SearchIntentOutputSchema and AiSearchIntentResponseDataSchema `cx:2` `deps:T-001`

### Phase: CORE

- [ ] **T-003** — Create mapper base with location priority and core field mapping `cx:3` `deps:T-001`
- [ ] **T-004** — Extend mapper with bedrooms, bathrooms, maxRating conflict/clamp logic `cx:2` `deps:T-003`
- [ ] **T-005** — Add amenity/feature slug passthrough and whitelist enforcement to mapper `cx:3` `deps:T-003,T-004`
- [ ] **T-006** — Create AMENITY_ALLOWLIST and matchAmenityTerms function `cx:2` `deps:none`
- [ ] **T-007** — Create FEATURE_ALLOWLIST and matchFeatureTerms with anti-overlap enforcement `cx:3` `deps:T-006`
- [ ] **T-008** — Update DEFAULT_PROMPTS['search'] with full slot-extraction contract `cx:2` `deps:none`
- [ ] **T-009** — Create buildSearchIntentPrompt helper with locale-aware allowlist embedding `cx:2` `deps:T-006,T-007`

### Phase: INTEGRATION (API)

- [ ] **T-010** — Create search-intent route handler with middleware chain and generateObject call `cx:3` `deps:T-002,T-005,T-008,T-009`
- [ ] **T-011** — Wire amenity and feature slug-to-UUID DB resolution in route handler `cx:3` `deps:T-010`
- [ ] **T-012** — Write API integration tests for search-intent route (11 test cases) `cx:3` `deps:T-010,T-011`

### Phase: FRONTEND

- [ ] **T-013** — Add 4 PostHog WebEvents constants to analytics events catalog `cx:1` `deps:none`
- [ ] **T-014** — Create aiSearch i18n namespace: 3 JSON files and 4-step config.ts registration `cx:3` `deps:none`
- [ ] **T-015** — Create NlSearchInput.tsx component with character counter and submit `cx:2` `deps:T-014`
- [ ] **T-016** — Create IntentChips.tsx with sessionStorage read, chip render, and removal navigation `cx:3` `deps:T-014`
- [ ] **T-017** — Create AiSearchPanel.client.tsx with full state machine (anon + auth flows) `cx:3` `deps:T-013,T-014,T-015,T-016`
- [ ] **T-018** — Create AiSearchTrigger.astro floating CTA component `cx:1` `deps:T-017`
- [ ] **T-019** — Wire AiSearchTrigger into alojamientos/index.astro listing page `cx:1` `deps:T-018`

### Phase: TESTING

- [ ] **T-020** — Write AiSearchPanel and IntentChips component tests (full coverage per §8.3) `cx:3` `deps:T-016,T-017`
- [ ] **T-021** — Smoke verification: anon gate, chips render/remove, fallback notice, locale `cx:2` `deps:T-019,T-020`

---

## Dependency Graph (Topological Levels)

Tasks at the same level have no blocking dependencies between them and can execute in parallel.

| Level | Tasks | Unblocked by |
|-------|-------|-------------|
| L0 (start immediately) | T-001, T-006, T-008, T-013, T-014 | — |
| L1 | T-002, T-003, T-007, T-015, T-016 | T-001; T-006; T-014 |
| L2 | T-004, T-009 | T-003; T-006+T-007 |
| L3 | T-005 | T-003+T-004 |
| L4 | T-010 | T-002+T-005+T-008+T-009 |
| L5 | T-011, T-017 | T-010; T-013+T-014+T-015+T-016 |
| L6 | T-012, T-018, T-020 | T-010+T-011; T-017; T-016+T-017 |
| L7 | T-019 | T-018 |
| L8 (final) | T-021 | T-019+T-020 |

---

## Suggested First Task

**Start with T-001** (no dependencies, complexity 3, unblocks T-002 and T-003 which are on the critical path).

File to create: `packages/schemas/src/entities/ai/ai-search-intent.schema.ts`

Key things to implement in T-001:

1. `AiSearchIntentRequestSchema` — `query: z.string().min(1).max(500)`, `locale` optional, `.strict()`
2. `SearchIntentEntitiesSchema` — all slots optional, including the expanded set: `minBedrooms`, `maxBedrooms`, `minBathrooms`, `maxBathrooms`, `maxRating`, `featureSlugs: z.array(z.string()).optional()`
3. Export their TS types via `z.infer<>`
4. Barrel export from `packages/schemas/src/entities/ai/index.ts`
5. Test file at `packages/schemas/src/entities/ai/ai-search-intent.schema.test.ts`

While T-001 is in progress, T-006, T-008, T-013, and T-014 can be parallelized to a second agent/session.

---

## Complexity Distribution

| Complexity | Count | Tasks |
|------------|-------|-------|
| 1 | 3 | T-013, T-018, T-019 |
| 2 | 7 | T-002, T-004, T-006, T-008, T-009, T-015, T-021 |
| 3 | 11 | T-001, T-003, T-005, T-007, T-010, T-011, T-012, T-014, T-016, T-017, T-020 |

All tasks ≤ 3 (constraint satisfied).

---

## Key Implementation Notes

- **Mapper (T-003..T-005)**: Pure function, zero DB calls, 100% test coverage required. All boolean values serialized as string 'true'/'false' (matches `createBooleanQueryParam` in AccommodationSearchHttpSchema).
- **Anti-overlap (T-007)**: Physical services (pets/wifi/parking/pool/breakfast/air-conditioning/BBQ) belong in AMENITY_ALLOWLIST and boolean slots — NEVER in FEATURE_ALLOWLIST.
- **Deep DB imports (T-011)**: `amenities` table is NOT re-exported from `@repo/db` index — use deep import `@repo/db/src/schemas/accommodation/amenity.dbschema.js`.
- **i18n 4-step (T-014)**: Creating JSON files alone is NOT enough. `config.ts` needs: namespaces array + static imports + rawTranslations registration. Missing any step = silent empty translations.
- **generateObject not extractIntent (T-010)**: Route calls `aiService.generateObject` directly with `SearchIntentOutputSchema`. `extractIntent` does not support custom output schemas.
- **sessionStorage guard (T-016, T-017)**: Every access must check `typeof sessionStorage === 'undefined'` (SSR safety) and wrap writes in `try/catch` (private-mode quota).
- **apiClient.postProtected (T-017)**: Use this, NOT raw `fetch`. Raw fetch is only for SSE streaming.
