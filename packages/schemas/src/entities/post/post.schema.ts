import { z } from 'zod';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostSponsorshipIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import {
    MediaSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithSeoSchema,
    WithTagsSchema,
    WithVisibilitySchema
} from '../../common/index.js';
import { PostCategoryEnumSchema, VisibilityEnumSchema } from '../../enums/index.js';

/**
 * Post schema definition using Zod for validation.
 * Includes sponsorship, sponsor, and extras as optional fields.
 */
export const PostSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .merge(WithModerationStatusSchema)
    .merge(WithTagsSchema)
    .merge(WithSeoSchema)
    .merge(WithVisibilitySchema)
    .extend({
        slug: z
            .string({
                required_error: 'zodError.post.slug.required',
                invalid_type_error: 'zodError.post.slug.invalidType'
            })
            .min(1, { message: 'zodError.post.slug.min' }),
        /** Post title, 3-150 characters */
        title: z
            .string()
            .min(3, { message: 'zodError.post.title.min' })
            .max(150, { message: 'zodError.post.title.max' }),
        summary: z
            .string()
            .min(10, { message: 'zodError.post.summary.min' })
            .max(200, { message: 'zodError.post.summary.max' }),
        /** Post content, 10-5000 characters */
        content: z
            .string()
            .min(10, { message: 'zodError.post.content.min' })
            .max(5000, { message: 'zodError.post.content.max' }),
        media: MediaSchema,
        /** Author user ID */
        authorId: UserIdSchema,
        /** Post category, 3-50 characters */
        category: PostCategoryEnumSchema,
        sponsorshipId: PostSponsorshipIdSchema.optional(),
        relatedDestinationId: DestinationIdSchema.optional(),
        relatedAccommodationId: AccommodationIdSchema.optional(),
        relatedEventId: EventIdSchema.optional(),
        isFeatured: z.boolean(),
        isNews: z.boolean(),
        isFeaturedInWebsite: z.boolean(),
        expiresAt: z.date().optional(),
        likes: z.number().int(),
        comments: z.number().int(),
        shares: z.number().int()
    });

// Input para filtros de búsqueda de posts
export const PostFilterInputSchema = z.object({
    category: PostCategoryEnumSchema.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    isNews: z.boolean().optional(),
    isFeaturedInWebsite: z.boolean().optional(),
    authorId: z.string().optional(),
    q: z.string().optional() // free text search
});

// Input para ordenamiento de resultados
export const PostSortInputSchema = z.object({
    sortBy: z.enum(['title', 'createdAt', 'category', 'likes', 'comments', 'shares']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});
