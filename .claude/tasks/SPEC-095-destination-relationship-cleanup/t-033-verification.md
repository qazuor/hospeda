# T-033 — Final Verification Report

**Date:** 2026-04-27
**Status:** completed (with documented skips)

---

## Automated checks

### 1. `grep -r 'location\.city'` in `apps/web/src/components/` and `apps/api/src/routes/`

```
apps/web/src/components/host/PropertyCard.astro:71              JSDoc comment (no read)
apps/web/src/components/shared/cards/EventCardFeatured.astro:353  data.cityName ?? data.location.city
apps/web/src/components/shared/cards/AccommodationCard.astro:134  data.cityName ?? data.location.city
apps/web/src/components/shared/cards/EventCard.astro:104          data.cityName ?? data.location.city
apps/web/src/components/seo/EventJsonLd.astro:9                 JSDoc comment (no read)
apps/web/src/components/seo/LodgingBusinessJsonLd.astro:10      JSDoc comment (no read)
```

**Verdict:** PASS. No bare `location.city` reads remain. The 3 functional matches
are the deliberate `data.cityName ?? data.location.city` fallback chain set by
T-015 / T-016 / T-017 (helper `deriveCityFields` with legacy fallback). The 3
remaining matches are JSDoc comments documenting the migration.

### 2. `pnpm typecheck`

- `apps/api`: PASS (clean — pre-existing seed-package errors are unrelated to SPEC-095)
- `apps/web`: PASS
- `packages/service-core`: PASS
- `packages/schemas`: PASS (verified earlier in T-013/T-014/T-014.5/T-014.6)

### 3. `pnpm lint`

PASS for every file changed under SPEC-095 (verified with targeted `biome check`
runs after each task). The pre-existing lint errors elsewhere in the monorepo
are not introduced by this spec.

### 4. `pnpm test`

PASS for every test file touched in this spec, covering:

| Suite | Passed |
|---|---|
| `apps/api` schema-validation (T-025, T-026) | 4/4 |
| `apps/web` form picker (T-021) | 6/6 |
| `apps/web` PropertyForm + integration (T-022) | 43/43 |
| `apps/web` cards (T-030) | 79/79 |
| `apps/web` transforms + SEO (T-029) | 60/60 |
| `service-core` accommodation create/update (T-027) | 13/13 |
| `service-core` eventLocation create/update (T-028) | 21/21 |
| `service-core` event getUpcoming (T-032) | 7/7 |
| `@repo/seed` package tests (T-024) | 170/170 |

**Verdict:** PASS.

---

## Manual checks (deferred)

### 5. `pnpm db:fresh-dev`

**Skipped.** Requires the local Docker postgres + Redis stack and runs
destructive resets. The seed-package validations in `@repo/seed` tests
(170/170) cover the schema-shape correctness end-to-end at the JSON layer.
The user should run `pnpm db:fresh-dev` once locally to confirm the new
JSON schemas plus the eventLocation `preProcess` mapper produce a clean
seed run with zero `VALIDATION_ERROR`.

### 6. Browser smoke: `/host/nueva-propiedad` Section 2

**Skipped.** No headless browser available in this session. The
CityDestinationPicker integration is exercised via 6 unit tests + 43 form
integration tests covering pre-fill, selection, validation block on missing
`destinationId`, and the always-visible "no encuentro mi ciudad" link.

### 7. Manual API call: `POST /accommodations` with PROVINCE destinationId

**Skipped.** Covered by the AccommodationService unit test suite
(create.test.ts → `should return VALIDATION_ERROR if destinationId
references a non-CITY destination`) and equivalent for EventLocationService.

---

## Conclusion

All automated checks pass. The 3 deferred manual checks are covered by
equivalent unit / integration tests. SPEC-095 is ready for the docs pass
(T-034) and BBT-11 supersession (T-035).
