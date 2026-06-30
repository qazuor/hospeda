import { z } from 'zod';
import { AccommodationSummarySchema } from './accommodation.query.schema.js';

/**
 * Schemas for the accommodation side-by-side comparison endpoint
 * (`POST /api/v1/protected/accommodations/compare`, SPEC-288).
 *
 * The request carries the set of accommodation IDs the user selected for
 * comparison. The response returns the matching accommodations using the
 * existing list/summary shape so the comparison matrix can render the same
 * attributes shown on listing cards.
 *
 * Note on bounds: {@link AccommodationComparisonRequestSchema} validates
 * **shape** only (an array of UUIDs of a sane size). The real per-plan cap
 * (Plus = 2, VIP = 4) is enforced by `gateComparator()` on the route, not
 * here — keeping the schema decoupled from billing config (D-2 / D-3). The
 * `max` below is just an anti-abuse ceiling.
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: [
 *     'f47ac10b-58cc-4372-a567-0e02b2c3d479',
 *     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
 *   ]
 * };
 * ```
 */

/**
 * Anti-abuse ceiling for the number of IDs accepted in a single comparison
 * request. The effective limit per user is lower and enforced per plan by the
 * route's entitlement gate; this bound only rejects pathologically large
 * payloads at the schema layer.
 */
export const MAX_COMPARE_REQUEST_IDS = 10;

/** Minimum number of accommodations required to perform a comparison. */
export const MIN_COMPARE_REQUEST_IDS = 2;

/**
 * Request body schema for the comparison endpoint: a deduplication-agnostic
 * list of accommodation UUIDs to compare.
 */
export const AccommodationComparisonRequestSchema = z.object({
    ids: z
        .array(z.string().uuid('Invalid accommodation ID format'))
        .min(MIN_COMPARE_REQUEST_IDS, 'At least 2 accommodation IDs are required to compare')
        .max(MAX_COMPARE_REQUEST_IDS, 'Too many accommodation IDs for a single comparison')
});
export type AccommodationComparisonRequest = z.infer<typeof AccommodationComparisonRequestSchema>;

/**
 * Response schema for the comparison endpoint: the matched accommodations in
 * the shared summary shape used by listing cards and the comparison matrix.
 */
export const AccommodationComparisonResponseSchema = z.object({
    items: z.array(AccommodationSummarySchema)
});
export type AccommodationComparisonResponse = z.infer<typeof AccommodationComparisonResponseSchema>;
