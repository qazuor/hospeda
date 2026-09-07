/**
 * @file point-of-interest.nearby-relevance.ts
 * @description Relevance policy for the "what's nearby" point-of-interest
 * surface of the public accommodation detail page (HOS-327).
 *
 * ## What this replaces
 *
 * Until HOS-327 the surface asked one question — "which POIs sit inside a
 * FIXED 5km circle, nearest first?" — and answered it with
 * {@link PointOfInterestModel.findWithinRadius}'s distance-only ordering. That
 * treats a 25-weight neighbourhood pharmacy 300m away as strictly more
 * interesting than the Palacio San José 9km away, which is the opposite of
 * what a traveller browsing a listing wants to read.
 *
 * This module encodes the replacement: a per-POI ELASTIC radius derived from
 * the POI's own editorial weight, plus a gravity-style score
 * (`weight^1.5 / (1 + km)`) that lets relevance decay with distance instead of
 * ignoring it.
 *
 * Of the two, **the elastic radius is what changes the section** — it decides
 * who is eligible at all. The score only reorders what already got in, and its
 * exponent moved 12 positions across the whole of production; see
 * {@link NEARBY_POI_RELEVANCE_WEIGHT_EXPONENT} for that measurement.
 *
 * ## Calibration (measured against the production catalogue, 2026-09-07)
 *
 * The constants below are NOT guesses. `points_of_interest` is a curated
 * catalogue, not a pile of rows sitting on the `display_weight` default —
 * across the 842 ACTIVE POIs the weight distribution is:
 *
 * | displayWeight | POIs |
 * | ------------- | ---- |
 * | 25            | 99   |
 * | 50            | 149  |
 * | 70            | 165  |
 * | 85            | 153  |
 * | 100           | 276  |
 *
 * (`isFeatured`: 276 of 842. `verified`: 158 of 842.)
 *
 * Simulated over the 5 public production accommodations, the formula below
 * against the previous fixed-5km/top-12-by-distance behaviour:
 *
 * | metric                          | before | after |
 * | ------------------------------- | ------ | ----- |
 * | POIs shown (all 5 listings)     | 38     | 40    |
 * | of weight 25 (weak, near)       | 3      | 0     |
 * | of weight 100 (landmarks)       | 19     | 32    |
 * | farthest POI shown              | 5.0km  | 9.9km |
 * | minimum shown per accommodation | —      | 8     |
 *
 * The fixed radius was discarding 113 weight-≥85 POIs sitting between 5km and
 * 15km of a listing, 87 of them weight 100.
 *
 * Every knob is a named export precisely so the calibration can be revisited
 * against a fresh measurement without touching a line of logic.
 *
 * ## Why the policy lives here and not in SQL
 *
 * The elastic radius is a PER-ROW comparison (`distance <= f(displayWeight,
 * isFeatured)`), so it cannot be the constant-bound `WHERE` clause
 * `findWithinRadius` builds. Two shapes were available: express `f()` as a
 * SQL expression, or fetch a geographically bounded candidate set and apply
 * the policy in TypeScript. This module does the latter, deliberately:
 *
 *  - The candidate set is NOT "the whole catalogue". It is bounded by
 *    {@link NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM} (19.5km), the largest radius
 *    any POI can possibly earn, so a row that SQL would have rejected is a
 *    row this module rejects too — the filter is only moved, never widened.
 *    Around a single listing that bound admits tens of rows, not 842.
 *  - Keeping the formula in TypeScript keeps it directly unit-testable and
 *    mutation-testable. Expressed as SQL text it would need a live Postgres
 *    to assert anything about, and a duplicate TypeScript mirror to test
 *    without one — which is a drift risk with no upside at this data volume.
 *  - The scoring divisor consumes `distanceKm`, the same number the card
 *    renders, so ranking and display can never disagree.
 *
 * If the catalogue ever grows to where the candidate transfer matters, the
 * migration path is to port {@link computeElasticRadiusKm} and
 * {@link computeRelevanceScore} to SQL expressions built from these very
 * constants — the constants, not the formula, are the contract.
 */

/**
 * Base radius, in kilometers, granted to a POI carrying exactly
 * {@link NEARBY_POI_REFERENCE_DISPLAY_WEIGHT}. The former fixed radius for
 * this surface, kept as the pivot so a median-weight POI's reach is unchanged
 * by HOS-327.
 */
export const NEARBY_POI_BASE_RADIUS_KM = 5;

/**
 * The `displayWeight` that earns exactly {@link NEARBY_POI_BASE_RADIUS_KM}.
 * Matches the column's own default (`display_weight integer NOT NULL DEFAULT
 * 50`), so an uncurated POI behaves exactly as it did before HOS-327.
 */
export const NEARBY_POI_REFERENCE_DISPLAY_WEIGHT = 50;

/**
 * Lower clamp on the elastic radius, in kilometers. Binds at `displayWeight
 * <= 20`; guarantees that even the weakest POI is still eligible when it is
 * genuinely next door, so a listing in a thin part of the catalogue does not
 * end up with an empty section.
 */
export const NEARBY_POI_MIN_RADIUS_KM = 2;

/**
 * Upper clamp on the elastic radius, in kilometers, BEFORE the featured
 * multiplier. With the catalogue's observed maximum weight of 100 this clamp
 * never binds today (100 earns 10km); it exists so that raising a POI's
 * weight in the admin cannot silently pull it onto listings a province away.
 */
export const NEARBY_POI_MAX_RADIUS_KM = 15;

/**
 * Multiplier applied to the clamped radius of an `isFeatured` POI. Featured
 * is an editorial signal independent of weight (276 of 842 rows carry it), so
 * it widens reach rather than substituting for weight: weight 100 reaches
 * 10km, and 13km when also featured.
 */
export const NEARBY_POI_FEATURED_RADIUS_MULTIPLIER = 1.3;

/**
 * The largest radius any POI can earn: {@link NEARBY_POI_MAX_RADIUS_KM} times
 * {@link NEARBY_POI_FEATURED_RADIUS_MULTIPLIER}. This is the bound handed to
 * the geo query, so the candidate set is never wider than the policy could
 * possibly accept. Stays under the 20km ceiling the public
 * `NearbyPoiQuerySchema` and the service input schemas enforce.
 */
export const NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM =
    NEARBY_POI_MAX_RADIUS_KM * NEARBY_POI_FEATURED_RADIUS_MULTIPLIER;

/**
 * Exponent applied to `displayWeight` in {@link computeRelevanceScore}, so
 * editorial importance grows faster than linearly against distance. Owner
 * decision (2026-09-07): the section should favour the emblematic POI over the
 * merely close one. At 1.0 a weight-100 POI 2km away and a weight-50 POI 500m
 * away scored IDENTICALLY (both 33.33) and the tie-break handed the ranking to
 * the nearer one; at 1.5 they score 333.33 and 235.70, so the landmark wins.
 *
 * **The measured effect is small, and that is the honest framing.** Against
 * the 5 public production accommodations, `w / (1 + km)` vs
 * `w^1.5 / (1 + km)`:
 *
 * | metric                     | `w`     | `w^1.5` |
 * | -------------------------- | ------- | ------- |
 * | POIs of weight 100 shown   | 32      | 33      |
 * | POIs of weight 50 shown    | 1       | 0       |
 * | mean distance shown        | 3.62km  | 3.76km  |
 * | distance of the #1 result  | 3.34km  | 3.34km  |
 * | positions that change      | —       | 12      |
 *
 * The heavy lifting is done by the ELASTIC RADIUS, which decides who is
 * eligible at all; the exponent only reorders what already got in. Do not read
 * this constant as the thing that rescues the section — that is
 * {@link NEARBY_POI_BASE_RADIUS_KM} and its clamp.
 */
export const NEARBY_POI_RELEVANCE_WEIGHT_EXPONENT = 1.5;

/**
 * Runaway guard on the candidate set handed to the ranker — NOT a selection
 * mechanism. The entire production catalogue was 842 ACTIVE POIs when this was
 * set (2026-09-07), so the cap cannot bind at today's volume.
 *
 * **It is correct by VOLUME, not by construction, and the failure mode is the
 * bad one.** `PointOfInterestModel.findWithinRadius` applies its `LIMIT` after
 * `ORDER BY distance ASC`, so if this cap ever binds the rows it drops are the
 * FARTHEST ones — precisely the weight-85-to-100 landmarks 9-13km out that the
 * elastic radius exists to rescue. The section would quietly regress to
 * something close to its pre-HOS-327 behaviour with every test still green.
 *
 * So: when the catalogue approaches this number, raise the cap or push the
 * eligibility filter into SQL (see the module JSDoc's migration note). Do not
 * assume a green suite proves the cap is still slack — no test can observe it
 * binding.
 */
export const NEARBY_POI_CANDIDATE_LIMIT = 2000;

/**
 * Number of POIs the accommodation detail page shows by default (HOS-327,
 * down from 12). Two reasons, one of each kind: the owner asked for the
 * section to carry less visual weight than the photos, description and price
 * it competes with, and the ranking makes the tail cheaper to drop — the 8
 * kept are measurably heavier than the 12 that used to be shown.
 */
export const NEARBY_POI_DEFAULT_LIMIT = 8;

/** The relevance-bearing fields this module reads off a candidate POI. */
export interface NearbyPoiRelevanceInput {
    /** Editorial weight; `points_of_interest.display_weight` (1-100 in practice). */
    readonly displayWeight?: number | null;
    /** Editorial "featured" flag; `points_of_interest.is_featured`. */
    readonly isFeatured?: boolean | null;
    /** Great-circle distance from the search center, in kilometers. */
    readonly distanceKm: number;
}

/**
 * Normalizes a raw `displayWeight` into a usable non-negative number.
 *
 * `display_weight` is `NOT NULL DEFAULT 50` in the database, so the nullish
 * branch is defensive only (a hand-built payload, a partially-typed test
 * fixture): it degrades to the reference weight, i.e. exactly the pre-HOS-327
 * behaviour, rather than to zero.
 *
 * @param displayWeight - The raw value read off the POI row.
 * @returns A finite, non-negative weight.
 */
function normalizeDisplayWeight(displayWeight?: number | null): number {
    if (typeof displayWeight !== 'number' || !Number.isFinite(displayWeight)) {
        return NEARBY_POI_REFERENCE_DISPLAY_WEIGHT;
    }
    return Math.max(0, displayWeight);
}

/**
 * Computes the maximum distance, in kilometers, at which a given POI is still
 * eligible for the "what's nearby" section.
 *
 * `clamp(BASE × weight / REFERENCE, MIN, MAX) × (featured ? MULTIPLIER : 1)`,
 * then capped by the caller's optional ceiling. The clamp is applied BEFORE
 * the featured multiplier on purpose, so featuring always buys the same
 * proportional widening regardless of where the clamp bit.
 *
 * Reference points at today's catalogue weights: 25 → 2.5km · 50 → 5km ·
 * 70 → 7km · 85 → 8.5km · 100 → 10km (13km when also featured).
 *
 * @param params - Receive-object.
 * @param params.displayWeight - The POI's editorial weight.
 * @param params.isFeatured - Whether the POI carries the editorial featured flag.
 * @param params.radiusCapKm - Optional caller-supplied ceiling (see
 *   `PointOfInterestService.getNearbyRanked`); the result is never larger
 *   than this. Ignored when absent or not a positive finite number.
 * @returns The POI's elastic radius in kilometers.
 */
export function computeElasticRadiusKm(params: {
    readonly displayWeight?: number | null;
    readonly isFeatured?: boolean | null;
    readonly radiusCapKm?: number;
}): number {
    const { displayWeight, isFeatured, radiusCapKm } = params;

    const weight = normalizeDisplayWeight(displayWeight);
    const raw = (NEARBY_POI_BASE_RADIUS_KM * weight) / NEARBY_POI_REFERENCE_DISPLAY_WEIGHT;
    const clamped = Math.min(Math.max(raw, NEARBY_POI_MIN_RADIUS_KM), NEARBY_POI_MAX_RADIUS_KM);
    const elastic = isFeatured ? clamped * NEARBY_POI_FEATURED_RADIUS_MULTIPLIER : clamped;

    if (typeof radiusCapKm === 'number' && Number.isFinite(radiusCapKm) && radiusCapKm > 0) {
        return Math.min(elastic, radiusCapKm);
    }
    return elastic;
}

/**
 * Computes a POI's relevance score for a given search center:
 * `displayWeight ^ NEARBY_POI_RELEVANCE_WEIGHT_EXPONENT / (1 + distanceKm)`.
 *
 * A gravity-style decay, chosen over both of the degenerate alternatives the
 * surface has used or could use: pure distance ignores that some landmarks
 * are worth a detour, and pure weight would rank a landmark in the next town
 * above the one across the street. The `1 +` keeps the score finite at
 * distance zero and makes the first kilometer the most expensive one, which
 * is where a walkable/not-walkable distinction actually lives.
 *
 * The super-linear weight term is what makes editorial importance outweigh
 * proximity rather than merely trade against it — see
 * {@link NEARBY_POI_RELEVANCE_WEIGHT_EXPONENT}, whose doc carries the measured
 * effect of the exponent (small, and deliberately documented as such).
 *
 * Higher is better. Deliberately NOT clamped or normalized — the value is
 * only ever compared against other scores from the same call.
 *
 * A weight of exactly 0 scores 0 at every distance (`0 ^ 1.5 === 0`), so a
 * zero-weight POI can be eligible (the 2km clamp) yet always rank last.
 *
 * @param params - Receive-object.
 * @param params.displayWeight - The POI's editorial weight.
 * @param params.distanceKm - Great-circle distance from the search center.
 * @returns The relevance score; higher ranks first.
 */
export function computeRelevanceScore(params: {
    readonly displayWeight?: number | null;
    readonly distanceKm: number;
}): number {
    const { displayWeight, distanceKm } = params;
    const weight = normalizeDisplayWeight(displayWeight);
    const distance = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
    return weight ** NEARBY_POI_RELEVANCE_WEIGHT_EXPONENT / (1 + distance);
}

/**
 * Applies the full HOS-327 relevance policy to a candidate POI list: drops
 * every POI sitting beyond its own {@link computeElasticRadiusKm}, orders the
 * survivors by {@link computeRelevanceScore} descending, and slices to
 * `limit`.
 *
 * Ties are broken by ascending distance and then by ascending `slug`, so the
 * order is fully deterministic across calls and across Postgres plan changes.
 * The tie-break is load-bearing rather than cosmetic: exact ties still occur
 * at the catalogue's five discrete weights — a weight-100 POI 7km away and a
 * weight-25 POI at the doorstep both score exactly 125 — and the nearer one
 * wins.
 *
 * Pure: never mutates the input array.
 *
 * @param params - Receive-object.
 * @param params.pois - The candidate POIs, each carrying `distanceKm`.
 * @param params.limit - Maximum number of POIs to return.
 * @param params.radiusCapKm - Optional ceiling applied to every POI's elastic
 *   radius (a caller-supplied `radius` narrows the section; it can never
 *   widen it past {@link NEARBY_POI_ABSOLUTE_MAX_RADIUS_KM}).
 * @returns A new array of at most `limit` POIs, most relevant first.
 */
export function rankNearbyPois<
    T extends NearbyPoiRelevanceInput & { readonly slug: string }
>(params: {
    readonly pois: readonly T[];
    readonly limit: number;
    readonly radiusCapKm?: number;
}): T[] {
    const { pois, limit, radiusCapKm } = params;

    if (limit <= 0) return [];

    const eligible = pois.filter(
        (poi) =>
            poi.distanceKm <=
            computeElasticRadiusKm({
                displayWeight: poi.displayWeight,
                isFeatured: poi.isFeatured,
                radiusCapKm
            })
    );

    return eligible
        .map((poi) => ({
            poi,
            score: computeRelevanceScore({
                displayWeight: poi.displayWeight,
                distanceKm: poi.distanceKm
            })
        }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.poi.distanceKm !== b.poi.distanceKm) return a.poi.distanceKm - b.poi.distanceKm;
            return a.poi.slug.localeCompare(b.poi.slug);
        })
        .slice(0, limit)
        .map((entry) => entry.poi);
}
