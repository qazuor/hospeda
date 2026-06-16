---
spec-id: SPEC-215
title: Destination climate & live weather
type: feature
complexity: high
status: in-progress
created: 2026-06-10T22:05:00Z
---

# SPEC-215 — Destination climate & live weather

## Overview

**Goal.** Replace the "coming soon" climate placeholder on destination detail pages
with real content: (1) structured **seasonal climate** data per destination (DB-stored,
seeded, admin-editable) and (2) **live current conditions** via Open-Meteo, rendered
together in the destination sidebar.

**Motivation.** The destination detail sidebar already reserves a slot
(`DestinationClimatePlaceholder.astro`) promising "información sobre el clima y la mejor
época para visitar este destino". No climate data is stored today; the `climate` /
`bestSeason` stubs in the HTTP schema are orphaned (parsed then dropped by the service).
This spec delivers the actual feature.

**Success criteria.** Each destination can carry structured seasonal climate + best
season to visit, editable in admin and seeded for existing destinations. The detail page
renders that data plus a live current-conditions badge. No external API key required.

**Locked design decisions (user, 2026-06-10).**

1. Approach: **seasonal structured climate + live current conditions** (combined).
2. Sourcing (seasonal): **seed + admin-editable**.
3. Live provider: **Open-Meteo** — free, **no API key** for non-commercial use.
   Verified against <https://open-meteo.com/en/docs> on 2026-06-10: current conditions at
   `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,is_day`.

**Confirmed design decisions (user, 2026-06-15).**

4. Live-weather cache: **`weather_current jsonb` column** on `destinations` (KISS, no extra table).
5. Dead HTTP stubs: **remove** the orphaned `climate`/`bestSeason` filter fields and the
   service drop-logic (they are unrelated dead filters).
6. Seasonal seed values: **derived offline from the Open-Meteo Climate API** via a build-time
   helper script (NOT a runtime dependency); output baked into the seed JSON.
7. Cron interval: **every 12h** (was 3h).
8. **Forecast IS in scope** (overrides the previous Out-of-Scope exclusion): fetch and cache
   **`daily` forecast for 16 days** (Open-Meteo free maximum, no key) alongside current
   conditions. Per-day fields: `date`, `tempMinC`, `tempMaxC`, `weatherCode`, `precipMm`.
   The cached payload becomes `{ current: {...}, daily: [...16], fetchedAt }`.

**Baseline.** File refs verified against `origin/staging` @ 446aa9152 on 2026-06-10.

---

## User Stories & Acceptance Criteria

### US-1 — Visitor sees seasonal climate + best season

GIVEN a destination with climate data,
WHEN a visitor opens its detail page,
THEN the sidebar shows the best season to visit and per-season climate (avg temp range,
rainfall) in the active locale (es/en/pt), replacing the placeholder.

### US-2 — Visitor sees live current conditions

GIVEN a destination with coordinates,
WHEN the detail page loads,
THEN a live current-conditions badge shows (temperature, condition icon/label) AND a
16-day daily forecast (per-day min/max temp, condition icon, precipitation) sourced from
Open-Meteo, fresh within the cron interval.

### US-3 — Graceful degradation

GIVEN live weather is unavailable (API down, no cache, or no coordinates),
WHEN the page renders,
THEN the seasonal climate still shows and the live badge degrades to a neutral
"no disponible" state — never an error or broken layout.

### US-4 — Admin edits climate

GIVEN an admin on the destination edit form,
WHEN they open the Climate section,
THEN they can set best season and per-season values, and save persists them.

### US-5 — Existing destinations are seeded

GIVEN the seeded destinations,
WHEN the DB is seeded,
THEN featured destinations (at minimum) carry seasonal climate data.

---

## Technical Approach

### Part A — Seasonal climate (structured, DB + seed + admin)

**Data model.** Add a structured `climate` JSONB column on `destinations` (matches the
project pattern of JSONB subtypes: `location`, `media`, `seo`, `rating`).

Proposed shape (`DestinationClimateSchema` in `packages/schemas`):

```ts
climate: {
  bestSeason: ClimateSeasonEnum,            // 'spring' | 'summer' | 'autumn' | 'winter'
  bestMonths?: string,                       // optional free label, e.g. "Oct–Mar"
  seasons: {
    spring?: { avgTempMinC: number; avgTempMaxC: number; rainfallMm?: number },
    summer?: { ... },
    autumn?: { ... },
    winter?: { ... }
  },
  note?: I18nText                            // optional free description (es/en/pt)
} | null
```

**Touched files:**

- `packages/schemas/src/entities/destination/subtypes/destination.climate.schema.ts` — new `DestinationClimateSchema` + `ClimateSeasonEnum`.
- `packages/schemas/src/entities/destination/destination.schema.ts` — add `climate` to `DestinationSchema`.
- Clean up the orphaned stubs: remove the dead `climate`/`bestSeason` filter fields from
  `destination.http.schema.ts` (L44/86) and the silent-drop logic in
  `destination.service.ts` (L330–344), OR repurpose them — decision: **remove** (they are
  dead filter fields, unrelated to this structured content).
- `packages/db/src/schemas/destination/destination.dbschema.ts` — add `climate jsonb` column. Structural migration via `pnpm db:generate` + `pnpm db:migrate`.
- `packages/service-core/src/services/destination/destination.service.ts` — include `climate` in create/update/read.
- Admin: new section `apps/admin/src/features/destinations/config/sections/climate.consolidated.ts` + wire into the destination edit form (`$id_.edit.tsx`). TanStack Form + Zod from `@repo/schemas`.
- Seed: add `climate` to `packages/seed/src/data/destination/*.json` (featured destinations at minimum). Values hand-authored or derived offline from Open-Meteo Climate API (optional helper, not a runtime dependency).
- i18n: extend `packages/i18n/src/locales/{es,en,pt}/destination.json` — keys `climate`, `bestSeason`, `summer/winter/spring/autumn`, `rainfall` partly exist; add the rest (per-field labels, units).

### Part B — Live current conditions (Open-Meteo)

**Client (service-core).** `packages/service-core/src/services/weather/clients/open-meteo.client.ts`
— native `fetch()` class, configurable `baseUrl` + `timeoutMs`, no key. Requests BOTH
`current=...` AND `daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum`
with `forecast_days=16`. Maps each Open-Meteo `weather_code` (WMO codes) to an internal
condition enum and icon key, for both current conditions and each daily entry.

**Caching — cron → DB (follows the exchange-rate-fetch pattern).**

- `apps/api/src/cron/jobs/destination-weather-fetch.job.ts` — fetches current conditions +
  16-day daily forecast for all published destinations with coordinates, writes to a
  `weather_current jsonb` cache column on `destinations` (confirmed: column, not a separate
  table). Cached payload shape: `{ current: {...}, daily: [...16], fetchedAt }`. Advisory lock
  (new key), `withTransaction`, `dryRun` support. Registered in `schedules.manifest.ts` + `registry.ts`.
- Interval: every 12h (current-conditions + multi-day forecast does not need minute-level freshness).
- Rationale: the detail page is ISR-24h; reading weather directly in SSR would be stale up
  to 24h. Cron→DB + a client island keeps it fresh without per-request external calls.

**Public endpoint.** `GET /api/v1/public/destinations/:id/weather` — returns the cached
current conditions (typed shape) for one destination. Thin route over the service.

**Web rendering.**

- Replace `apps/web/src/components/destination/DestinationClimatePlaceholder.astro` with a
  real `DestinationClimateCard.astro` that SSR-renders the seasonal climate from
  `destination.climate`, and embeds a small React island (`DestinationWeatherLive.client.tsx`,
  `client:idle`/`client:visible`) that fetches the public weather endpoint and renders both
  the live current-conditions badge and the 16-day daily forecast strip.
- WMO `weather_code` → icon (`@repo/icons`) + i18n label mapping in web.

**Env / ops.** Open-Meteo needs **no API key** → no new env var, no Coolify step. Base URL
is a config constant (overridable). One new cron added to the manifest.

### Patterns / constraints

- No `any`; `import type`; named exports; RO-RO; Zod source of truth; integer-safe values.
- Migrations two-carriles: structural columns → `db:generate`/`db:migrate`; `db:apply-extras` after.
- Web styling = CSS Modules (not Tailwind). Admin = Tailwind + TanStack Form.
- Public endpoint under `/api/v1/public/*` (no auth), per route architecture.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Open-Meteo unavailable / slow | Medium | Cron tolerates failure; serve last cache; UI degrades to "no disponible"; client island never blocks render |
| Destinations without coordinates | Low | Skip live fetch; show seasonal climate only |
| Seasonal seed data accuracy | Low | Hand-authored/derived offline; label as approximate; admin-editable to correct |
| WMO weather_code mapping gaps | Low | Map the documented WMO code set; fall back to a generic condition + label |
| ISR-24h staleness of live badge | Medium | Live badge comes from a client island hitting the public endpoint, not SSR — independent of ISR |
| New cron load (fetch per destination) | Low | Batch/throttle within the job; 3h interval; advisory lock prevents overlap across replicas |
| Open-Meteo non-commercial terms | Low | Confirm usage stays within non-commercial; key-based commercial tier exists if needed later |

## Out of Scope

- Weather-based search/filtering of destinations (the dead `climate`/`bestSeason` filters are removed, not implemented).
- Deriving seasonal averages live from the Open-Meteo Climate API at runtime (seasonal data is seeded; the Climate API is used offline to derive seed values per decision 6).
- Severe-weather alerts/notifications.
- Forecast beyond 16 days, or sub-daily (hourly) forecast resolution.

## Suggested Tasks (phased)

- **Setup/DB**: `climate jsonb` + `weather_current jsonb` columns + migration.
- **Schema**: `DestinationClimateSchema` + `ClimateSeasonEnum`; add to `DestinationSchema`; remove dead HTTP stubs + service drop-logic.
- **Service**: include `climate` in destination CRUD; weather cache read/write.
- **Weather client**: Open-Meteo client in service-core (current + 16-day daily forecast) + WMO code mapping.
- **Cron**: `destination-weather-fetch` job (12h) + manifest + registry + advisory lock.
- **Public API**: `GET /api/v1/public/destinations/:id/weather` (current + forecast) (+ integration test).
- **Admin UI**: Climate section in destination edit form (+ component test).
- **Seed helper**: offline script deriving seasonal averages from the Open-Meteo Climate API.
- **Seed**: populate `climate` for featured/existing destinations (from the helper output).
- **Web**: `DestinationClimateCard.astro` (seasonal SSR) + `DestinationWeatherLive.client.tsx` island (current badge + 16-day forecast strip); replace placeholder.
- **i18n**: complete climate/season/weather keys (es/en/pt) + WMO labels.
- **Testing**: client (mocked Open-Meteo), cron (dry-run), endpoint, schema, graceful-degradation.
- **Docs**: weather cron in the cron docs; climate field in destination admin doc.

## Internal Review Notes

- **Verified on staging:** no climate storage exists; orphaned `climate`/`bestSeason` HTTP
  stubs dropped by the service; `weatherSatisfaction` is a user rating (not climate);
  `DestinationClimatePlaceholder.astro` is the insertion point (sidebar 3rd card); all seed
  destinations have `location.coordinates`; exchange-rate-fetch cron is the reference pattern.
- **Verified external API:** Open-Meteo current-conditions endpoint + no-key non-commercial
  use (<https://open-meteo.com/en/docs>, 2026-06-10).
- **Open questions — RESOLVED (user, 2026-06-15):** (1) cache → `weather_current` column;
  (2) seasonal seed values → derived offline from the Open-Meteo Climate API helper;
  (3) cron interval → 12h; (4) dead HTTP stubs → removed; (5) forecast → IN scope, 16-day daily.
