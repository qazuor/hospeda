import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithSeoSchema,
    WithTagsSchema
} from '../../common/index.js';
import { PostCategoryEnumSchema, VisibilityEnumSchema } from '../../enums/index.js';
import { PostSponsorSchema } from './post.sponsor.schema.js';
import { PostSponsorshipSchema } from './post.sponsorship.schema.js';

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
    .extend({
        /** Post title, 3-150 characters */
        title: z
            .string()
            .min(3, { message: 'zodError.post.title.min' })
            .max(150, { message: 'zodError.post.title.max' }),
        /** Post content, 10-5000 characters */
        content: z
            .string()
            .min(10, { message: 'zodError.post.content.min' })
            .max(5000, { message: 'zodError.post.content.max' }),
        /** Author user ID */
        authorId: z.string().uuid({ message: 'zodError.post.authorId.invalidUuid' }),
        /** Post category, 3-50 characters */
        category: z
            .string()
            .min(3, { message: 'zodError.post.category.min' })
            .max(50, { message: 'zodError.post.category.max' }),
        /** Sponsorship details, optional */
        sponsorship: PostSponsorshipSchema.optional(),
        /** Sponsor details, optional */
        sponsor: PostSponsorSchema.optional()
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
