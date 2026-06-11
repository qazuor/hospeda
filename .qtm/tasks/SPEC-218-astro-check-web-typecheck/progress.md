# SPEC-218 Progress

## Outcome

`astro check` is now part of `apps/web`'s typecheck gate and the tree is clean.

| Stage | astro check errors | Locals errors | tsc --noEmit |
|-------|--------------------|---------------|--------------|
| Baseline (staging @ 2a6292ba6) | **185** / 484 files / 63 hints | 117 (57 locale + 53 user + 7 cspNonce) | green |
| After T-001 (`files: ["src/env.d.ts"]`) | **68** | 0 | green |
| After Phase 2 (68 real `.astro` fixes) | **0** / 486 files / 64 hints | 0 | green |

## Root cause (corrected)

The `App.Locals` augmentation already existed in `apps/web/src/env.d.ts`. It was
never loaded: TypeScript `include` globs (`src/**/*.ts`) do not pull an
unreferenced global-ambient `.d.ts` into the program, and nothing imports it.
Fix = list it in `tsconfig.json` `files`. Proven via `tsc --listFilesOnly` /
`--showConfig` (env.d.ts absent) and a `@ts-expect-error` probe (augmentation
dead under tsc too — the app only built because middleware casts `locals`).

## Tasks

All 10 complete (T-001…T-010). See `state.json` / `TODOs.md`.

## Real bugs caught by the new gate (the W6/W8 class)

- `result.data.total` → `result.data.pagination.total` on ~10 listing pages
  (pagination total was `undefined` at runtime → 0 pages).
- `Footer.astro`: `result.success` (never existed; `ApiResult` discriminates on
  `ok`) → the platform-stats block never ran in production.
- `featuresApi.getAccommodations` / `eventsApi.getByLocation` — non-existent
  methods (runtime `TypeError`) replaced with the correct list calls.
- `class` → `className` on React island props; logger arg order; i18n object
  labels rendered as `[object Object]` resolved via `resolveI18nText`.

## Known limitations (pre-existing, out of scope)

- `alojamientos/comodidades/[slug]`: lists all accommodations, not filtered by
  amenity (pre-existing `TODO`, blocked on backend JOIN verification). SPEC-218
  only fixed the type errors there; the functional filter gap is unchanged.
- `eventos/en/[slug]`: the public API has no by-event-location filter; the page
  scopes events to the location's `destinationId` and shows an empty state when
  the location has none. A true by-location filter needs a new API endpoint.
