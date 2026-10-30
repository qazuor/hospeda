import { z } from 'zod';

/**
 * Request body for administrative action 23 (ACC:23): purge another owner's
 * listing at that owner's request. The reason is mandatory and lands in the
 * audit event's "why" field (`listing.status_changed.reason`).
 */
export const ListingPurgeOnRequestSchema = z.object({
    reason: z
        .string({ message: 'zodError.common.listingPurgeOnRequest.reason.required' })
        .trim()
        .min(1, { message: 'zodError.common.listingPurgeOnRequest.reason.required' })
        .max(2000, { message: 'zodError.common.listingPurgeOnRequest.reason.max' })
});

/** Response returned after administrative action 23 ran PB12 on the listing. */
export const ListingPurgeOnRequestResponseSchema = z.object({
    purged: z.literal(true)
});

/** Validated body of administrative action 23. */
export type ListingPurgeOnRequest = z.infer<typeof ListingPurgeOnRequestSchema>;
/** Response of administrative action 23. */
export type ListingPurgeOnRequestResponse = z.infer<typeof ListingPurgeOnRequestResponseSchema>;
