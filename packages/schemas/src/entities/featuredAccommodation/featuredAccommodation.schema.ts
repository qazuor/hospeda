import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    AccommodationIdSchema,
    ClientIdSchema,
    FeaturedAccommodationIdSchema
} from '../../common/id.schema.js';
import { FeaturedStatusSchema, FeaturedTypeSchema } from '../../enums/index.js';

/**
 * FeaturedAccommodation Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a FeaturedAccommodation entity
 * using base field objects for consistency and maintainability.
 *
 * Represents an accommodation that is featured/promoted in specific locations
 */
export const FeaturedAccommodationSchema = z.object({
    // Base fields
    id: FeaturedAccommodationIdSchema,
    ...BaseAuditFields,

    // Core relationships
    clientId: ClientIdSchema,
    accommodationId: AccommodationIdSchema,

    // Featured configuration
    featuredType: FeaturedTypeSchema,

    // Featured period
    fromDate: z.string().datetime({
        message: 'zodError.featuredAccommodation.fromDate.invalid'
    }),
    toDate: z.string().datetime({
        message: 'zodError.featuredAccommodation.toDate.invalid'
    }),

    // Status
    status: FeaturedStatusSchema,

    // Base admin fields
    ...BaseAdminFields
});

export type FeaturedAccommodation = z.infer<typeof FeaturedAccommodationSchema>;
