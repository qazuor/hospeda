import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    AccommodationIdSchema,
    AccommodationListingIdSchema,
    AccommodationListingPlanIdSchema,
    ClientIdSchema
} from '../../common/id.schema.js';
import { ListingStatusSchema } from '../../enums/index.js';

/**
 * AccommodationListing Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an AccommodationListing entity
 * using base field objects for consistency and maintainability.
 *
 * Represents the listing of an accommodation by a client with a specific plan
 */
export const AccommodationListingSchema = z.object({
    // Base fields
    id: AccommodationListingIdSchema,
    ...BaseAuditFields,

    // Core relationships
    clientId: ClientIdSchema,
    accommodationId: AccommodationIdSchema,
    listingPlanId: AccommodationListingPlanIdSchema,

    // Listing period
    fromDate: z.string().datetime({
        message: 'zodError.accommodationListing.fromDate.invalid'
    }),
    toDate: z.string().datetime({
        message: 'zodError.accommodationListing.toDate.invalid'
    }),

    // Trial information
    trialEndsAt: z
        .string()
        .datetime({
            message: 'zodError.accommodationListing.trialEndsAt.invalid'
        })
        .optional(),
    isTrial: z.boolean().default(false),

    // Status
    status: ListingStatusSchema,

    // Base admin fields
    ...BaseAdminFields
});

export type AccommodationListing = z.infer<typeof AccommodationListingSchema>;
