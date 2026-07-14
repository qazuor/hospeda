---
title: "What's Nearby" POI Section on Accommodation Detail
linear: HOS-145
statusSource: linear
created: 2026-07-11
type: feature
areas:
  - web
---

# "What's Nearby" POI Section on Accommodation Detail

## 1. Summary

Add a "What's nearby" section to the accommodation detail page on the web app, listing points of interest (POIs) within a radius of the accommodation's coordinates.

## 2. Problem

Tourists booking an accommodation want to know what's around it (beaches, restaurants, landmarks) before deciding. Hospeda already has proximity-search infrastructure server-side but no consumer-facing UI surfaces it on the accommodation page.

## 3. Goals

- G-1: Show a list of nearby POIs on the accommodation detail page, ordered by distance.
- G-2: Reuse the existing proximity-search capability rather than building new distance logic.
- G-3: Keep the feature low-cost — no new backend computation beyond what already exists.

## 4. Non-goals

- NG-1: No map visualization here (that's HOS-146, destination-level).
- NG-2: No thematic/category filtering of the nearby list (that's HOS-147).
- NG-3: No handling of POIs without coordinates — those are excluded entirely from this section.

## 5. Current baseline

Proximity search already exists server-side: the public POI endpoint accepts `poiId`/`poiSlug` params, defaults to a 5km radius, and computes distance via Haversine in `@repo/db` `packages/db/src/utils/geo.ts`. Web-side locale collapse for multilang POI name/description goes through `apps/web/src/lib/resolve-i18n-text.ts`. The accommodation detail page does not currently query or render POI proximity data. The POI catalog is being expanded from 12 curated POIs to ~914 under HOS-142; this feature is only meaningful once that import lands.

## 6. Proposed design

### 6.1 Baseline correction (two spec assumptions were wrong)

The original §5 assumed "proximity search already exists server-side, only the UI is missing". Investigation (2026-07-14) found two gaps that reshape the design:

1. **The direction we need does NOT exist.** What exists is the *inverse*: "accommodations near a POI" (`packages/service-core/src/services/accommodation/accommodation.poi-proximity.helper.ts`). `PointOfInterestService`/`PointOfInterestModel` have zero geo-query capability — no `lat`/`long`/`radius` search params, and `geo.ts` is never imported there. We must build "POIs near a coordinate". The Haversine primitives in `packages/db/src/utils/geo.ts` (`buildWithinRadiusClause`, `buildDistanceOrderByExpr`) are reusable, so no new distance math is written — only the wiring.
2. **The accommodation's exact coordinates are privacy-gated.** `applyAccommodationLocationPrivacy` (`accommodation.projections.ts`) strips `location.coordinates` for any actor that is not the owner or an `ACCOMMODATION_LOCATION_EXACT_VIEW` holder. The public wire payload never carries real coordinates — only `approximateLocation.{lat,lng}` (deliberately obfuscated by a few hundred meters).

### 6.2 Chosen approach — dedicated SSR endpoint centered on the OBFUSCATED `approximateLocation`, via a visibility-gated read (revised 2026-07-14 judgment-day)

**Superseded design note**: the original 2026-07-14 decision below (reading the accommodation's REAL coordinates) shipped, but a same-day judgment-day review found it defeats SPEC-097 location privacy via trilateration, and separately bypasses accommodation visibility. The owner chose to fix both by re-centering the search on `approximateLocation` (the same obfuscated coordinate `applyAccommodationLocationPrivacy` already computes for every other read) instead of the real coordinate, read via the normal visibility-gated `getBySlug` path.

**Why the real-coordinate design was wrong (trilateration, #2)**: even though the accommodation's own coordinate was never echoed back, each returned POI already carries its own PUBLIC exact `lat`/`long`, and each POI's `distanceKm` was computed against the REAL accommodation coordinate. Three or more POI distances from known POI coordinates are enough to trilaterate the real accommodation coordinate to near-exactness — a side channel the original design did not account for. Centering the search on `approximateLocation` instead means every distance already carries the same random per-accommodation obfuscation offset (≤~141m, see `packages/service-core/src/utils/location-obfuscation.ts`) as the public location circle shown elsewhere in the product, so no amount of POI trilateration can recover a better fix than that circle already discloses.

**Why the raw `model.findOne` read was wrong (visibility bypass, #1)**: the original implementation read the accommodation via a raw, relation-free `model.findOne({ slug })` specifically to dodge the privacy PROJECTION hook — but that same raw read also skipped `_canView`, the VISIBILITY check. DRAFT / PRIVATE / soft-deleted / suspended accommodations leaked their proximity data to anyone who knew (or guessed) the slug, entirely independent of the coordinate-privacy question. `AccommodationService.getNearbyPois` now reads via `this.getBySlug(actor, slug, ctx)` — the same gated path (`getByField` ⇒ `_canView` ⇒ `_afterGetByField`) every other accommodation read uses. This single change fixes both problems at once: `_canView` enforces visibility, and `_afterGetByField` is what actually computes `approximateLocation` in the first place, so the method can no longer regress to reading real coordinates even by accident — there is no "raw" read path left to bypass to.

The real coordinate at `accommodation.location.coordinates.{lat,long}` is no longer read by this feature at all. POI `lat`/`long` are still plain nullable `doublePrecision` columns and still feed the geo helpers directly (no `buildJsonbCoordinateExprs`, no `::numeric` cast), with an explicit `isNotNull` guard (~78% of the POI v2 dataset has no coordinates and must be excluded).

### 6.3 Layers (bottom-up, each reuses what exists)

1. **DB (`packages/db`)** — `PointOfInterestModel.findWithinRadius({ lat, long, radiusKm, limit })`: builds `buildWithinRadiusClause` + `buildDistanceOrderByExpr` against `pointsOfInterest.lat/long`, filters `lifecycleState = ACTIVE` and `deletedAt IS NULL` and `lat/long IS NOT NULL`, orders by distance ascending, applies `limit`. Returns POI rows plus the computed `distanceKm`. Generic — reusable by HOS-146 (map) / HOS-147 (thematic filter).
2. **Service (`packages/service-core`)** —
   - `PointOfInterestService.getNearby({ lat, long, radiusKm, limit }, actor, ctx?)`: `runWithLoggingAndValidation` wrapper over the model method; returns POIs projected to the public shape plus `distanceKm`.
   - `AccommodationService.getNearbyPois({ slug, radiusKm, limit }, actor, ctx?)`: reads the accommodation via the visibility-gated `getBySlug` (not visible / not found / no coordinates all resolve to `[]`, uniform); delegates to `PointOfInterestService.getNearby` centered on the OBFUSCATED `approximateLocation.{lat,lng}` (field remapped `lng → long`), never the real coordinate. Returns only the POI list — no accommodation coordinate (real or approximate) is ever included in the result.
3. **API (`apps/api`)** — `GET /api/v1/public/accommodations/:slug/nearby-pois?radius=&limit=` via `createPublicRoute`. Validates query params (defaults + bounds), responds `{ items: NearbyPoi[] }` where `NearbyPoi = PointOfInterestPublic & { distanceKm }`. Cached (300s like the sibling public POI routes), rate-limited.
4. **Web (`apps/web`)** —
   - `accommodationsApi.getNearbyPois({ slug, radius })` client fn in `apps/web/src/lib/api/endpoints.ts`.
   - `WhatsNearbySection.astro` (new, `apps/web/src/components/accommodation/`): presentational, mirrors `DestinationPOISection.astro`. Renders per-POI icon (`getPointOfInterestTypeIcon`), name (`translatePoiName`), type badge (`translatePoiTypeLabel`), formatted **distance**, and optional clamped description (`resolveI18nText`).
   - SSR fetch in `apps/web/src/pages/[lang]/alojamientos/[slug].astro`, inserted right after `<LocationSection />` (~line 578), passing `items` + `locale` to the section.
   - i18n key `accommodations.detail.nearbyPoi.title` in es/en/pt.

## 7. Data model / contracts

- **No DB schema change.** POI table already has `lat`/`long` (`doublePrecision`, nullable) and the destination relation. No migration.
- **New service method signatures** (RO-RO):
  - `PointOfInterestModel.findWithinRadius(params: { lat: number; long: number; radiusKm: number; limit: number }): Promise<Array<PointOfInterest & { distanceKm: number }>>`
  - `PointOfInterestService.getNearby(params: { lat: number; long: number; radiusKm: number; limit: number }, actor: Actor, ctx?: ServiceContext): Promise<Result<NearbyPoi[]>>`
  - `AccommodationService.getNearbyPois(params: { slug: string; radiusKm?: number; limit?: number }, actor: Actor, ctx?: ServiceContext): Promise<Result<NearbyPoi[]>>`
- **New schema** (`packages/schemas`, POI entity): `NearbyPoiSchema = PointOfInterestPublicSchema.extend({ distanceKm: z.number().nonnegative() })`; query-params schema `NearbyPoiQuerySchema = { radius?: number (default 5, min 0.1, max 20), limit?: number (default 12, min 1, max 50) }`.
- **HTTP contract**: `GET /api/v1/public/accommodations/:slug/nearby-pois` → `200 { items: NearbyPoi[] }`. The response is a uniform `200` with an empty `items` array for every "nothing to show" case — no coordinates, no POIs in range, an unknown/unresolvable slug, AND (revised 2026-07-14 judgment-day) a not-visible accommodation (DRAFT / PRIVATE without permission / soft-deleted / suspended). The underlying service read is visibility-gated (`getBySlug`), so a not-visible or unknown slug are indistinguishable to the caller by design — both collapse to the same uniform `200 { items: [] }`, preserving the same anti-enumeration property the original "no 404" decision already established. **Deliberately NOT a 404/403 for either case** (decision 2026-07-14): this is a section embedded in the accommodation detail page, not a canonical POI REST resource; the parent page already issues the real `getBySlug` 404/gating for the page itself, accommodation slugs and POIs are both public data (no sensitive enumeration surface), and returning `[]` avoids an extra existence/visibility query on every page render. The accommodation's coordinates (real or approximate) are NEVER part of the response (AC-4).

## 8. UX / UI behavior

- Section title: `t('accommodations.detail.nearbyPoi.title')` (e.g. "Qué hay cerca").
- Flat list/grid ordered by ascending distance (nearest first). No category grouping (that is HOS-147, see NG-2).
- Each item shows: type icon, resolved POI name, type badge, distance, optional 2-line-clamped description.
- **Distance formatting**: `< 1 km` shown in meters rounded to the nearest 50 m (e.g. "350 m"); `>= 1 km` shown in km with one decimal (e.g. "1,2 km"). Locale-aware separator via i18n.
- **Empty state**: if the accommodation has no coordinates, or there are zero POIs within the radius, the section renders **nothing** (no header, no placeholder) — same convention as `DestinationPOISection.astro`. This supersedes the earlier "empty-state UI needed" note: showing an empty "What's nearby" box adds noise, not value.
- No map here (NG-1 — that is HOS-146, destination-level).

## 9. Acceptance criteria

- AC-1 (BDD): Given a public accommodation with real coordinates and ≥1 ACTIVE POI within 5 km, when a visitor opens its detail page, then a "What's nearby" section lists those POIs ordered nearest-first, each with a distance.
- AC-2: Given an accommodation with no coordinates, when the page renders, then no "What's nearby" section appears and no error occurs.
- AC-3: Given an accommodation whose nearby POIs are all soft-deleted / non-ACTIVE / coordinate-less, when the page renders, then those POIs are excluded and (if none remain) the section does not render.
- AC-4 (privacy): The `nearby-pois` API response never contains the accommodation's latitude/longitude in any form; only POI data + `distanceKm`.
- AC-5 (REVISED 2026-07-14 judgment-day): Distances are computed from the accommodation's OBFUSCATED `approximateLocation` (privacy-safe, SPEC-097), **not** the real coordinate — the real coordinate is never read by this feature. Distances therefore carry the same deterministic-per-accommodation offset (≤~141m) as the public location circle shown elsewhere; this is by design and prevents trilateration of the real coordinate via POI distances (see §6.2, §10 R-4).
- AC-6: `radius`/`limit` query params are honored within their bounds; out-of-bounds values are rejected or clamped per the schema.
- AC-7: POI names/type labels/descriptions resolve via the existing i18n helpers, with the humanized-slug fallback (no `[MISSING:` leaks).
- AC-8 (ADDED 2026-07-14 judgment-day): Given a DRAFT / PRIVATE (without permission) / soft-deleted / owner-suspended accommodation with real coordinates and nearby POIs, when an actor without view access requests its `nearby-pois` endpoint, then the response is a uniform `200 { items: [] }` — no proximity data leaks for a non-viewable accommodation. Enforced by the same visibility-gated `getBySlug` read used everywhere else, not a bespoke check.

## 10. Risks

- R-1: POIs with null coordinates must be excluded before they reach the numeric SQL path (`isNotNull` guard in the model) — otherwise NULL propagation yields wrong/empty distances. Mirrors the guard in `accommodation.poi-proximity.helper.ts`.
- R-2: Accommodations without coordinates cannot use this section at all — handled as the empty state (AC-2), not an error.
- R-3: Data density unknown until the 914-POI catalog (HOS-142) is fully seeded in the target env — the 5 km / 12-item defaults may need tuning against real data. Defaults are configurable via query params, so no redeploy is needed to adjust the UI's request.
- R-4 (RESOLVED 2026-07-14 judgment-day — trilateration + visibility bypass): the original design ("real coordinate never echoed back, so it's safe") missed two things, found in the same-day judgment-day review: (1) each returned POI already carries its own public exact `lat`/`long`, so distances computed against the REAL accommodation coordinate let a caller trilaterate that coordinate to near-exactness from 3+ POI distances — a side channel independent of whether the coordinate itself was ever in the response body; (2) the raw `model.findOne({ slug })` read used to dodge the coordinate-privacy PROJECTION also happened to dodge the VISIBILITY check (`_canView`), so DRAFT/PRIVATE/soft-deleted/suspended accommodations leaked proximity data regardless of the coordinate question. Fix: center the search on the OBFUSCATED `approximateLocation` (already computed by the standard privacy projection) via the standard visibility-gated `getBySlug` read — this closes both the trilateration side-channel (AC-5) and the visibility bypass (AC-8) with the same change, and structurally removes the "raw read" path that made the regression possible in the first place. The original guard ("explicit test asserting the response shape contains no lat/long", AC-4) remains necessary but was not SUFFICIENT on its own — it is now paired with an explicit trilateration-safety assertion (obfuscated-not-real coordinate as search center) and a visibility test (AC-8).

## 11. Open questions

- OQ-1 (RESOLVED): Default radius/max count → **5 km radius, 12 POIs max** (5 km matches the proximity default; 12 keeps the accommodation card readable). Both overridable via `radius`/`limit` query params; revisit against real 914-POI density.
- OQ-2 (RESOLVED): Grouping → **flat distance-ordered list** for v1. Category grouping/filtering is HOS-147 (NG-2).

## 12. Implementation notes

- Reuse, do NOT resurrect: `translatePoiName` / `translatePoiTypeLabel` (`apps/web/src/lib/poi-labels.ts`), `resolveI18nText` (`apps/web/src/lib/resolve-i18n-text.ts`), `getPointOfInterestTypeIcon` (`apps/web/src/lib/poi-type-icons.ts`), and the "render nothing when empty" convention.
- `geo.ts` helpers take already-numeric `SQL` fragments; pass `pointsOfInterest.lat` / `pointsOfInterest.long` directly (they are `doublePrecision`, not JSONB) — no `buildJsonbCoordinateExprs`.
- Public route pattern: `createPublicRoute` + `getActorFromContext`; may read raw entity via the service (not `getDb()` directly) so the coord-privacy boundary stays in one place.
- Tests: model geo query (in-range / out-of-range / null-coord exclusion / ordering), both service methods (incl. no-coordinates → `[]`), route integration (incl. AC-4 privacy assertion), and web transform/render + distance formatting.
- This endpoint is the first real consumer of a POI proximity search; keep `PointOfInterestService.getNearby` generic so HOS-146/147 can reuse it.

## 13. Linear

Canonical tracking:
HOS-145

Depends on: HOS-142 (POI catalog import/seed of 914 POIs).
