import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import { BaseFaqSchema } from '../../common/faq.schema.js';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseLocationFields } from '../../common/location.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { TagsFields } from '../../common/tags.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/index.js';
import { AccommodationIaDataSchema } from './subtypes/accommodation.ia.schema.js';
import { AccommodationPriceSchema } from './subtypes/accommodation.price.schema.js';

/**
 * Accommodation Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an Accommodation entity
 * using base field objects for consistency and maintainability.
 */
export const AccommodationSchema = z.object({
    // Base fields
    id: AccommodationIdSchema,
    ...BaseAuditFields,

    // Entity fields - specific to accommodation
    slug: z
        .string()
        .min(3, { message: 'zodError.accommodation.slug.min' })
        .max(50, { message: 'zodError.accommodation.slug.max' }),
    name: z
        .string()
        .min(3, { message: 'zodError.accommodation.name.min' })
        .max(100, { message: 'zodError.accommodation.name.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.accommodation.summary.min' })
        .max(300, { message: 'zodError.accommodation.summary.max' }),
    description: z
        .string()
        .min(30, { message: 'zodError.accommodation.description.min' })
        .max(2000, { message: 'zodError.accommodation.description.max' }),
    isFeatured: z.boolean().default(false),

    // Base field groups
    ...BaseLifecycleFields,
    ...BaseModerationFields,
    ...BaseVisibilityFields,
    ...BaseReviewFields,
    ...BaseSeoFields,
    ...BaseContactFields,
    ...BaseLocationFields,
    ...BaseMediaFields,
    ...BaseAdminFields,

    // Accommodation-specific core fields
    type: AccommodationTypeEnumSchema,
    destinationId: DestinationIdSchema,
    ownerId: UserIdSchema,

    // Optional related data
    iaData: z.array(AccommodationIaDataSchema).optional(),
    faqs: z.array(BaseFaqSchema).optional(),
    price: AccommodationPriceSchema.optional(),
    ...TagsFields,

    // Extra Info
    extraInfo: z
        .object({
            capacity: z.number().int({
                message: 'zodError.accommodation.extraInfo.capacity.required'
            }),
            minNights: z.number().int({
                message: 'zodError.accommodation.extraInfo.minNights.required'
            }),
            maxNights: z.number().int().optional(),
            bedrooms: z.number().int({
                message: 'zodError.accommodation.extraInfo.bedrooms.required'
            }),
            beds: z.number().int().optional(),
            bathrooms: z.number().int({
                message: 'zodError.accommodation.extraInfo.bathrooms.required'
            }),
            smokingAllowed: z.boolean().optional(),
            extraInfo: z.array(z.string()).optional()
        })
        .optional()
});
export type Accommodation = z.infer<typeof AccommodationSchema>;
