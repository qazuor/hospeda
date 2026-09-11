/**
 * Point Of Interest Nearby Schemas (HOS-145)
 *
 * Schemas for the "POIs near an accommodation" feature — the public detail
 * page surfaces nearby landmarks with their distance from the accommodation.
 */
import { z } from 'zod';
import { PointOfInterestPublicSchema } from './point-of-interest.access.schema.js';

/**
 * NEARBY POI SCHEMA
 *
 * Extends the public POI schema with `distanceKm`, the great-circle distance
 * (in kilometers) from the accommodation used as the search center. This
 * stays in sync with `PointOfInterestPublicSchema` automatically since it is
 * derived via `.extend()` rather than redefining POI fields by hand.
 */
export const NearbyPoiSchema = PointOfInterestPublicSchema.extend({
    /** Distance from the accommodation, in kilometers. Never negative. */
    distanceKm: z.number().nonnegative({ message: 'zodError.pointOfInterest.distanceKm.min' })
});

export type NearbyPoi = z.infer<typeof NearbyPoiSchema>;

/**
 * NEARBY POI QUERY SCHEMA
 *
 * HTTP-compatible query-params schema for
 * `GET /public/accommodations/:slug/nearby-pois`. Both fields arrive as
 * query strings and are coerced to numbers, matching the coercion pattern
 * used for `lat`/`long`/`displayWeight` in
 * `PointOfInterestCreateHttpSchema` (`point-of-interest.http.schema.ts`).
 *
 * HOS-327 changed both fields, and `radius` changed MEANING rather than
 * validity — the same values are still accepted and still narrow the result.
 * The endpoint no longer searches one fixed circle: each POI is eligible
 * within a radius derived from its own editorial weight (see
 * `point-of-interest.nearby-relevance.ts`), so a single default radius has
 * nothing left to describe.
 */
export const NearbyPoiQuerySchema = z.object({
    /**
     * Optional CEILING on the per-POI elastic radius, in kilometers — not the
     * search radius. Supplying it narrows the result to POIs within that many
     * kilometers; a POI whose own elastic radius is smaller stays bound by its
     * own. Omitted (the default) means "no extra ceiling": each POI's weight
     * decides, bounded by the 19.5km widest radius any POI can earn.
     *
     * Deliberately has NO default. A default here would be a hard cap applied
     * on every request — with the pre-HOS-327 `.default(5)` still in place the
     * elastic radius could never exceed 5km and the whole ranking would be
     * inert.
     */
    radius: z.coerce
        .number({ message: 'zodError.pointOfInterest.nearby.radius.invalidType' })
        .min(0.1, { message: 'zodError.pointOfInterest.nearby.radius.min' })
        .max(20, { message: 'zodError.pointOfInterest.nearby.radius.max' })
        .optional(),

    /** Maximum number of results to return. Defaults to 8 (HOS-327, was 12). */
    limit: z.coerce
        .number({ message: 'zodError.pointOfInterest.nearby.limit.invalidType' })
        .min(1, { message: 'zodError.pointOfInterest.nearby.limit.min' })
        .max(50, { message: 'zodError.pointOfInterest.nearby.limit.max' })
        .default(8)
});

export type NearbyPoiQuery = z.infer<typeof NearbyPoiQuerySchema>;
