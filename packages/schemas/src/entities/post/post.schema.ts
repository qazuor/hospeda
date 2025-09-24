import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostIdSchema,
    PostSponsorshipIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { PostCategoryEnumSchema } from '../../enums/index.js';
import { TagSchema } from '../tag/tag.schema.js';

/**
 * Post Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Post entity
 * using base field objects for consistency and maintainability.
 */
export const PostSchema = z.object({
    // Base fields
    id: PostIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    ...BaseModerationFields,
    ...BaseSeoFields,
    ...BaseVisibilityFields,
    // Tags
    tags: z.array(TagSchema).optional(),

    // Post-specific core fields
    slug: z
        .string({
            message: 'zodError.post.slug.required'
        })
        .min(1, { message: 'zodError.post.slug.min' }),

    title: z
        .string({
            message: 'zodError.post.title.required'
        })
        .min(3, { message: 'zodError.post.title.min' })
        .max(150, { message: 'zodError.post.title.max' }),

    summary: z
        .string({
            message: 'zodError.post.summary.required'
        })
        .min(10, { message: 'zodError.post.summary.min' })
        .max(300, { message: 'zodError.post.summary.max' }),

    content: z
        .string({
            message: 'zodError.post.content.required'
        })
        .min(100, { message: 'zodError.post.content.min' })
        .max(50000, { message: 'zodError.post.content.max' }),

    category: PostCategoryEnumSchema,

    isFeatured: z.boolean().default(false),
    isFeaturedInWebsite: z.boolean().default(false),
    expiresAt: z.date().optional(),

    // Author
    authorId: UserIdSchema,

    // Media
    ...BaseMediaFields,

    // Post-specific flags
    isNews: z.boolean().default(false),

    // Social engagement
    likes: z.number().int().min(0).default(0),
    comments: z.number().int().min(0).default(0),
    shares: z.number().int().min(0).default(0),

    // Display fields
    publishedAt: z.coerce.date().optional(), // Publication date (can be different from createdAt)
    readingTimeMinutes: z.number().int().min(0).default(5), // Estimated reading time

    // Related entities
    relatedDestinationId: DestinationIdSchema.optional(),
    relatedAccommodationId: AccommodationIdSchema.optional(),
    relatedEventId: EventIdSchema.optional(),

    // Sponsorship
    sponsorshipId: PostSponsorshipIdSchema.optional()
});

/**
 * Type export for the main Post entity
 */
export type Post = z.infer<typeof PostSchema>;
