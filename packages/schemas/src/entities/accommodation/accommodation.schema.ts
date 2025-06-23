import { z } from 'zod';
import { AdminInfoSchema } from '../../common/admin.schema.js';
import {
    AccommodationIdSchema,
    ContactInfoSchema,
    DestinationIdSchema,
    LocationSchema,
    MediaSchema,
    SocialNetworkSchema,
    UserIdSchema
} from '../../common/index.js';
import {
    AccommodationTypeEnumSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    VisibilityEnumSchema
} from '../../enums/index.js';
import { DestinationSchema } from '../destination/destination.schema.js';
import { TagSchema } from '../tag/tag.schema.js';
import { UserSchema } from '../user/user.schema.js';
import { AccommodationAmenitySchema } from './accommodation.amenity.schema.js';
import { ExtraInfoSchema } from './accommodation.extrainfo.schema.js';
import { AccommodationFaqSchema } from './accommodation.faq.schema.js';
import { AccommodationFeatureSchema } from './accommodation.feature.schema.js';
import { AccommodationIaDataSchema } from './accommodation.ia.schema.js';
import { AccommodationPriceSchema } from './accommodation.price.schema.js';
import { AccommodationRatingSchema } from './accommodation.rating.schema.js';
import { AccommodationReviewSchema } from './accommodation.review.schema.js';
import { ScheduleSchema } from './accommodation.schedule.schema.js';

/**
 * Note: The AccommodationSchema is defined by explicitly listing all properties instead of merging
 * helper schemas (e.g., WithIdSchema, WithAuditSchema). This approach is a deliberate
 * architectural choice to prevent circular dependency issues that can arise in testing
 * frameworks like Vitest. By flattening the structure, we ensure stable and
 * predictable module resolution during tests.
 */
export const AccommodationSchema = z.object({
    // From WithIdSchema
    id: AccommodationIdSchema,

    // From WithAuditSchema
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    createdById: UserIdSchema,
    updatedById: UserIdSchema,
    deletedAt: z.coerce.date().optional(),
    deletedById: UserIdSchema.optional(),

    // From WithLifecycleStateSchema
    lifecycleState: LifecycleStatusEnumSchema,

    // From WithVisibilitySchema
    visibility: VisibilityEnumSchema,

    // From WithReviewStateSchema
    reviewsCount: z.number(),
    averageRating: z.number(),

    // From WithModerationStatusSchema
    moderationState: ModerationStatusEnumSchema,

    // From WithTagsSchema
    tags: z.array(TagSchema).optional(),

    // From WithSeoSchema
    seo: z
        .object({
            title: z.string().min(30).max(60).optional(),
            description: z.string().min(70).max(160).optional(),
            keywords: z.array(z.string()).optional()
        })
        .optional(),

    // From WithAdminInfoSchema
    adminInfo: AdminInfoSchema.optional(),

    // Own Properties
    slug: z.string().min(3).max(50),
    name: z.string().min(3).max(100),
    summary: z.string().min(10).max(300),
    type: AccommodationTypeEnumSchema,
    description: z.string().min(30).max(2000),
    contactInfo: ContactInfoSchema.optional(),
    socialNetworks: SocialNetworkSchema.optional(),
    price: AccommodationPriceSchema.optional(),
    location: LocationSchema.optional(),
    media: MediaSchema.optional(),
    isFeatured: z.boolean(),
    ownerId: UserIdSchema,
    owner: UserSchema.optional(),
    destinationId: DestinationIdSchema,
    destination: DestinationSchema.optional(),
    features: z.array(AccommodationFeatureSchema).optional(),
    amenities: z.array(AccommodationAmenitySchema).optional(),
    reviews: z.array(AccommodationReviewSchema).optional(),
    rating: AccommodationRatingSchema.optional(),
    schedule: ScheduleSchema.optional(),
    extraInfo: ExtraInfoSchema.optional(),
    faqs: z.array(AccommodationFaqSchema).optional(),
    iaData: z.array(AccommodationIaDataSchema).optional()
});

export const AccommodationFilterInputSchema = z.object({
    city: z.string().optional(),
    country: z.string().optional(),
    tags: z.array(TagSchema).optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    q: z.string().optional() // free text search
});

// Input para ordenamiento de resultados
export const AccommodationSortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt', 'averageRating', 'reviewsCount', 'price']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});
