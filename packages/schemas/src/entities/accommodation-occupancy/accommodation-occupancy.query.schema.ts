import { z } from 'zod';
import { OccupancyDateSchema } from './accommodation-occupancy-date.schema.js';

/**
 * AccommodationOccupancy query schemas (HOS-43 Phase 1).
 */

/**
 * Input for the `GET .../occupancy` range endpoints (public, protected, and
 * admin tiers).
 *
 * `from`/`to` are `YYYY-MM-DD` strings, half-open interval semantics
 * (`date >= from AND date < to`) — matches the `NOT EXISTS` search filter
 * documented in the spec (section 5): the day equal to `to` is NOT included,
 * mirroring "check-out day is free" hotel semantics.
 *
 * @example
 * ```ts
 * AccommodationOccupancyRangeQuerySchema.parse({
 *   from: '2026-07-01',
 *   to: '2026-08-01',
 * });
 * ```
 */
export const AccommodationOccupancyRangeQuerySchema = z
    .object({
        from: OccupancyDateSchema,
        to: OccupancyDateSchema
    })
    .refine((data) => data.from < data.to, {
        message: 'zodError.accommodationOccupancy.range.fromBeforeTo',
        path: ['to']
    });

/**
 * TypeScript type for the range query input, inferred from
 * {@link AccommodationOccupancyRangeQuerySchema}.
 */
export type AccommodationOccupancyRangeQuery = z.infer<
    typeof AccommodationOccupancyRangeQuerySchema
>;
