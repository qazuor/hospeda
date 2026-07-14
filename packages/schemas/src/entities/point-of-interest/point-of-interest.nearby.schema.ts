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
 */
export const NearbyPoiQuerySchema = z.object({
    /** Search radius in kilometers. Defaults to 5km. */
    radius: z.coerce
        .number({ message: 'zodError.pointOfInterest.nearby.radius.invalidType' })
        .min(0.1, { message: 'zodError.pointOfInterest.nearby.radius.min' })
        .max(20, { message: 'zodError.pointOfInterest.nearby.radius.max' })
        .default(5),

    /** Maximum number of results to return. Defaults to 12. */
    limit: z.coerce
        .number({ message: 'zodError.pointOfInterest.nearby.limit.invalidType' })
        .min(1, { message: 'zodError.pointOfInterest.nearby.limit.min' })
        .max(50, { message: 'zodError.pointOfInterest.nearby.limit.max' })
        .default(12)
});

export type NearbyPoiQuery = z.infer<typeof NearbyPoiQuerySchema>;
