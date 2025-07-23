import { PostSchema, PostFilterInputSchema as _PostFilterInputSchema } from '@repo/schemas';
import type { PostType } from '@repo/types';
import { VisibilityEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Schema for creating a post (alias of PostSchema)
 */
export const PostCreateSchema = PostSchema;

/**
 * Schema for updating a post (all fields optional, no id required)
 */
export const PostUpdateSchema = PostSchema.deepPartial().strict();

/**
 * Schema for filtering posts
 */
export const PostFilterInputSchema = _PostFilterInputSchema.strict();

/**
 * Schema for creating a post (only user-provided fields)
 */
export const PostCreateInputSchema = PostSchema.omit({
    id: true,
    slug: true,
    comments: true,
    shares: true,
    likes: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
}).strict();

export type PostCreateInput = z.infer<typeof PostCreateInputSchema>;
export type PostUpdateInput = z.infer<typeof PostUpdateSchema>;
export type PostFilterInput = z.infer<typeof PostFilterInputSchema>;

export const GetNewsInputSchema = z.object({
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional()
});

export type GetNewsInput = z.infer<typeof GetNewsInputSchema>;

export const GetFeaturedInputSchema = z.object({
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional()
});

export type GetFeaturedInput = z.infer<typeof GetFeaturedInputSchema>;

export const GetByCategoryInputSchema = z.object({
    category: z.string().min(1, 'Category is required'),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional()
});

export type GetByCategoryInput = z.infer<typeof GetByCategoryInputSchema>;

export const GetByRelatedDestinationInputSchema = z.object({
    destinationId: z.string().uuid('Invalid destinationId'),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional()
});

export type GetByRelatedDestinationInput = z.infer<typeof GetByRelatedDestinationInputSchema>;

export const GetByRelatedAccommodationInputSchema = z.object({
    accommodationId: z.string().uuid('Invalid accommodationId'),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional()
});

export type GetByRelatedAccommodationInput = z.infer<typeof GetByRelatedAccommodationInputSchema>;

export const GetByRelatedEventInputSchema = z.object({
    eventId: z.string().uuid('Invalid eventId'),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional()
});

export type GetByRelatedEventInput = z.infer<typeof GetByRelatedEventInputSchema>;

export const LikePostInputSchema = z
    .object({
        postId: z.string().uuid('Invalid postId')
    })
    .strict();

export type LikePostInput = z.infer<typeof LikePostInputSchema>;

/**
 * Schema for fetching a single post summary, by id o slug
 */
export const GetPostSummaryInputSchema = z
    .object({
        id: z.string().uuid().optional(),
        slug: z.string().optional()
    })
    .superRefine((data, ctx) => {
        if (!data.id && !data.slug) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Either id or slug must be provided'
            });
        }
    });

export type GetPostSummaryInput = z.infer<typeof GetPostSummaryInputSchema>;

/**
 * Schema for fetching post stats, by id o slug
 */
export const GetPostStatsInputSchema = GetPostSummaryInputSchema;
export type GetPostStatsInput = z.infer<typeof GetPostStatsInputSchema>;

/**
 * DTO for post summary (for cards/lists, no content)
 */
export type PostSummaryType = {
    id: string;
    slug: string;
    title: string;
    category: string;
    media: PostType['media'];
    isFeatured: boolean;
    isNews: boolean;
    createdAt: Date;
    authorId: string;
    summary: string;
};

/**
 * DTO for post stats
 */
export type PostStatsType = {
    likes: number;
    comments: number;
    shares: number;
};
