# Destination Climate & Weather (SPEC-215)

Destination detail pages show two related pieces of weather information:

1. **Seasonal climate** — structured, editorial data stored per destination
   (best season to visit, per-season average temperatures and rainfall). Stored,
   seeded, and edited in the admin.
2. **Live current conditions + 16-day forecast** — fetched from Open-Meteo,
   cached in the database by a cron, and rendered by a client island.

## Data model

Two nullable `jsonb` columns on `destinations`:

| Column | Shape | Source |
|--------|-------|--------|
| `climate` | `DestinationClimateSchema` (`bestSeason`, `bestMonths?`, `seasons.{spring,summer,autumn,winter}?`, `note?`) | Seed + admin-edited |
| `weather_current` | `DestinationWeatherCacheSchema` (`{ current, daily[≤16], fetchedAt }`) | Cron-populated |

Both schemas live in `@repo/schemas`
(`entities/destination/subtypes/destination.{climate,weather}.schema.ts`).

## Editing seasonal climate (admin)

The destination edit form has a **Climate** section
(`apps/admin/src/features/destinations/config/sections/climate.consolidated.ts`):
best season, recommended months, per-season min/max temperature (°C, integer)
and average rainfall (mm), plus an optional localized note. Values are
approximate and admin-correctable. The section is shown in view/edit modes (not
on initial create).

## Live weather (cron → DB → public endpoint → island)

- **Cron**: `destination-weather-fetch` (`apps/api/src/cron/jobs/`), every 12h,
  advisory lock `43031`. Fetches current conditions + a 16-day daily forecast
  from Open-Meteo for every published destination that has coordinates and writes
  the result to `weather_current`. Tolerates per-destination failures (last cache
  is served) and supports `dryRun`.
- **Provider**: [Open-Meteo](https://open-meteo.com/en/docs) — **no API key** for
  non-commercial use, so there is **no env var and no Coolify step**. The base URL
  is a configurable constant on the client.
- **Public endpoint**: `GET /api/v1/public/destinations/:id/weather` returns the
  cached payload (or `null` when uncached), behind the destination public
  visibility gate.
- **Web**: `DestinationClimateCard.astro` SSR-renders the seasonal climate and
  embeds `DestinationWeatherIsland` (`client:idle`), which fetches the endpoint
  and renders the current badge + forecast strip. If weather is unavailable
  (no coordinates, cron has not run, or a fetch error) the island degrades to a
  neutral "unavailable" line — the seasonal climate still renders.

## Seeding

Seasonal climate for featured destinations is derived offline from the Open-Meteo
Climate API and baked into the seed JSON (`packages/seed/src/data/destination/`).
The derivation is a build-time helper, not a runtime dependency.
