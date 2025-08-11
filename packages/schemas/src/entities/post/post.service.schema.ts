import { z } from 'zod';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostIdSchema
} from '../../common/id.schema.js';
import { PostCategoryEnumSchema, VisibilityEnumSchema } from '../../enums/index.js';
import { PostSchema } from './post.schema.js';

/**
 * Service-layer schemas for Post entity. Centralized in @repo/schemas.
 */

export const CreatePostServiceSchema = PostSchema.omit({
    id: true,
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

export const UpdatePostServiceSchema = z
    .object({ id: PostIdSchema })
    .merge(CreatePostServiceSchema.partial().strict());
export type UpdatePostInput = z.infer<typeof UpdatePostServiceSchema>;

export const PaginationSchema = z
    .object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional()
    })
    .strict();

export const GetNewsInputSchema = z
    .object({
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetNewsInput = z.infer<typeof GetNewsInputSchema>;

export const GetFeaturedInputSchema = z
    .object({
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetFeaturedInput = z.infer<typeof GetFeaturedInputSchema>;

export const GetByCategoryInputSchema = z
    .object({
        category: PostCategoryEnumSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetByCategoryInput = z.infer<typeof GetByCategoryInputSchema>;

export const GetByRelatedDestinationInputSchema = z
    .object({
        destinationId: DestinationIdSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetByRelatedDestinationInput = z.infer<typeof GetByRelatedDestinationInputSchema>;

export const GetByRelatedAccommodationInputSchema = z
    .object({
        accommodationId: AccommodationIdSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetByRelatedAccommodationInput = z.infer<typeof GetByRelatedAccommodationInputSchema>;

export const GetByRelatedEventInputSchema = z
    .object({
        eventId: EventIdSchema,
        visibility: VisibilityEnumSchema.optional(),
        fromDate: z.coerce.date().optional(),
        toDate: z.coerce.date().optional()
    })
    .merge(PaginationSchema.partial())
    .strict();
export type GetByRelatedEventInput = z.infer<typeof GetByRelatedEventInputSchema>;

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
