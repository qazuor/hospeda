import { z } from 'zod';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostSponsorshipIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithSeoSchema,
    WithVisibilitySchema
} from '../../common/index.js';
import { BaseSearchSchema } from '../../common/search.schemas.js';
import { PostCategoryEnumSchema, VisibilityEnumSchema } from '../../enums/index.js';

/**
 * Post schema definition using Zod for validation.
 *
 * Important: Avoid using schemas that rely on z.lazy() (e.g., WithTagsSchema, MediaSchema)
 * because OpenAPI extraction cannot introspect lazy schemas. We inline a simplified
 * media object and represent tags as string arrays, mirroring the approach used in
 * DestinationSchema to keep OpenAPI generation stable.
 */
export const PostSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .merge(WithModerationStatusSchema)
    .merge(WithSeoSchema)
    .merge(WithVisibilitySchema)
    .extend({
        slug: z
            .string({
                message: 'zodError.post.slug.required'
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
        /**
         * Simplified media object to avoid circular/lazy references for OpenAPI.
         * Uses only URL and optional caption/description fields.
         */
        media: z
            .object({
                featuredImage: z
                    .object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                    .optional(),
                gallery: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional(),
                videos: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional()
            })
            .optional(),
        /** Tags as simple string array to avoid z.lazy() */
        tags: z.array(z.string()).optional(),
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
export const PostFilterInputSchema = BaseSearchSchema.extend({
    filters: z
        .object({
            category: PostCategoryEnumSchema.optional(),
            visibility: VisibilityEnumSchema.optional(),
            isFeatured: z.boolean().optional(),
            isNews: z.boolean().optional(),
            isFeaturedInWebsite: z.boolean().optional(),
            authorId: z.string().optional(),
            q: z.string().optional() // free text search
        })
        .optional()
});

// Input para ordenamiento de resultados
export const PostSortInputSchema = z.object({
    sortBy: z.enum(['title', 'createdAt', 'category', 'likes', 'comments', 'shares']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});
