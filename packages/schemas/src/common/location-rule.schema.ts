/**
 * One-address rule schemas (HOS-1810): the 409 reason, the admin exception body
 * and the repeated-address report.
 *
 * The rule applies to accommodation and venue only; experiences are out.
 */
import { z } from 'zod';

/**
 * Machine-readable reason of the 409 `ALREADY_EXISTS` answered when a listing is
 * published (or its address moved) onto a place another listing of the SAME
 * owner already occupies. `handleRouteError` gates the public `details` on it.
 */
export const DUPLICATE_LOCATION_REASON = 'DUPLICATE_LOCATION' as const;

/**
 * Names of the partial UNIQUE indexes that back the rule at the database
 * (one PUBLISHED, live, non-excepted listing per owner and place key). A
 * `23505` on either one is a concurrent publish that the service pre-check
 * could not see, and is answered as `DUPLICATE_LOCATION`.
 */
export const LOCATION_KEY_UNIQUE_INDEXES: readonly string[] = [
    'accommodations_ownerId_locationKey_published_uniq',
    'venues_ownerId_locationKey_published_uniq'
];

/** Minimum length of an exception reason: it is an audit record, not a flag. */
export const LOCATION_EXCEPTION_REASON_MIN = 10;

/** Body of `POST .../location-exception`. */
export const LocationExceptionInputSchema = z.object({
    reason: z
        .string({ message: 'zodError.locationException.reason.required' })
        .trim()
        .min(LOCATION_EXCEPTION_REASON_MIN, { message: 'zodError.locationException.reason.min' })
        .max(500, { message: 'zodError.locationException.reason.max' })
});
export type LocationExceptionInput = z.infer<typeof LocationExceptionInputSchema>;

/** Response of the exception routes. */
export const LocationExceptionResultSchema = z.object({
    id: z.string().uuid(),
    hasException: z.boolean()
});
export type LocationExceptionResult = z.infer<typeof LocationExceptionResultSchema>;

/** Query of `GET .../location-duplicates` (`page` + `pageSize`, never `limit`). */
export const LocationDuplicatesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
export type LocationDuplicatesQuery = z.infer<typeof LocationDuplicatesQuerySchema>;

/** One group of published listings that share a place key. */
export const LocationDuplicateGroupSchema = z.object({
    locationKey: z.string(),
    listings: z.array(z.object({ id: z.string().uuid(), ownerId: z.string().uuid() })),
    ownerCount: z.number().int(),
    sameOwner: z.boolean()
});
export type LocationDuplicateGroupOutput = z.infer<typeof LocationDuplicateGroupSchema>;

/** Response of `GET .../location-duplicates`. */
export const LocationDuplicatesResponseSchema = z.object({
    items: z.array(LocationDuplicateGroupSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int()
});
export type LocationDuplicatesResponse = z.infer<typeof LocationDuplicatesResponseSchema>;
