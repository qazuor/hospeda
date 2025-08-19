import { z } from 'zod';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostIdSchema
} from '../../common/id.schema.js';
import { PostCategoryEnumSchema } from '../../enums/post-category.enum.schema.js';
import { VisibilityEnumSchema } from '../../enums/visibility.enum.schema.js';
import { PostSchema } from './post.schema.js';

/**
 * Service-layer schemas for Post entity. Centralized in @repo/schemas.
 */

export const CreatePostServiceSchema = PostSchema.omit({
    id: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    likes: true,
    comments: true,
    shares: true
}).strict();
export type CreatePostInput = z.infer<typeof CreatePostServiceSchema>;

export const UpdatePostServiceSchema = CreatePostServiceSchema.partial().strict();
export type UpdatePostInput = z.infer<typeof UpdatePostServiceSchema>;

export const PaginationSchema = z
    .object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional()
    })
    .strict();

export const GetPostNewsInputSchema = z
    .object({
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetPostNewsInput = z.infer<typeof GetPostNewsInputSchema>;

export const GetPostFeaturedInputSchema = z
    .object({
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetPostFeaturedInput = z.infer<typeof GetPostFeaturedInputSchema>;

export const GetPostByCategoryInputSchema = z
    .object({
        category: PostCategoryEnumSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetPostByCategoryInput = z.infer<typeof GetPostByCategoryInputSchema>;

export const GetPostByRelatedDestinationInputSchema = z
    .object({
        destinationId: DestinationIdSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetPostByRelatedDestinationInput = z.infer<
    typeof GetPostByRelatedDestinationInputSchema
>;

export const GetPostByRelatedAccommodationInputSchema = z
    .object({
        accommodationId: AccommodationIdSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetPostByRelatedAccommodationInput = z.infer<
    typeof GetPostByRelatedAccommodationInputSchema
>;

export const GetPostByRelatedEventInputSchema = z
    .object({
        eventId: EventIdSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetPostByRelatedEventInput = z.infer<typeof GetPostByRelatedEventInputSchema>;

export const LikePostInputSchema = z.object({ postId: PostIdSchema }).strict();

export const GetPostSummaryInputSchema = z
    .object({ id: PostIdSchema.optional(), slug: z.string().min(1).optional() })
    .refine((d) => !!d.id || !!d.slug, { message: 'Either id or slug is required' })
    .strict();
export type GetPostSummaryInput = z.infer<typeof GetPostSummaryInputSchema>;

export const GetPostStatsInputSchema = GetPostSummaryInputSchema;
export type GetPostStatsInput = z.infer<typeof GetPostStatsInputSchema>;

// Re-export search input for consumers expecting it from service schema
export { PostFilterInputSchema } from './post.schema.js';
