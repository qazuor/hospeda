import type { PostId, PostType } from '@repo/types';
import { LifecycleStatusEnum, PostCategoryEnum, VisibilityEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Input schema for getById.
 *
 * @example
 * const input = { id: 'post-uuid' as PostId };
 */
export const PostGetByIdInputSchema = z.object({
    id: z.string().min(1, 'Post ID is required') as unknown as z.ZodType<PostId>
});

/**
 * Output type for getById.
 *
 * @example
 * const output = { post: postObjectOrNull };
 */
export type PostGetByIdInput = z.infer<typeof PostGetByIdInputSchema>;
export type PostGetByIdOutput = { post: PostType | null };

/**
 * Input schema for getBySlug.
 *
 * @example
 * const input = { slug: 'my-post-slug' };
 */
export const PostGetBySlugInputSchema = z.object({
    slug: z.string().min(1, 'Post slug is required')
});

/**
 * Output type for getBySlug.
 *
 * @example
 * const output = { post: postObjectOrNull };
 */
export type PostGetBySlugInput = z.infer<typeof PostGetBySlugInputSchema>;
export type PostGetBySlugOutput = { post: PostType | null };

/**
 * Input schema for list.
 *
 * @example
 * const input = { limit: 10, offset: 0 };
 */
export const PostListInputSchema = z.object({
    q: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    category: z.string().optional(),
    authorId: z.string().optional(),
    lifecycle: z.string().optional(),
    visibility: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['title', 'createdAt']).optional()
});

/**
 * Input type for list.
 * @example
 * const input: PostListInput = { limit: 10, offset: 0 };
 */
export type PostListInput = z.infer<typeof PostListInputSchema>;

/**
 * Output type for list.
 * @example
 * const output: PostListOutput = { posts: [mockPost] };
 */
export type PostListOutput = { posts: PostType[] };

/**
 * Input schema for search (advanced search).
 *
 * @example
 * const input = { q: 'foo', category: 'news', limit: 10, offset: 0 };
 */
export const PostSearchInputSchema = z.object({
    q: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    category: z.nativeEnum(PostCategoryEnum).optional(),
    authorId: z.string().optional(),
    lifecycle: z.nativeEnum(LifecycleStatusEnum).optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['title', 'createdAt']).optional()
});

/**
 * Input type for search.
 * @example
 * const input: PostSearchInput = { q: 'foo', limit: 10, offset: 0 };
 */
export type PostSearchInput = z.infer<typeof PostSearchInputSchema>;

/**
 * Output type for search.
 * @example
 * const output: PostSearchOutput = { posts: [mockPost], total: 1 };
 */
export type PostSearchOutput = { posts: PostType[]; total: number };

/**
 * Input schema for getByCategory.
 *
 * @example
 * const input = { category: PostCategoryEnum.EVENTS, limit: 10, offset: 0 };
 */
export const PostGetByCategoryInputSchema = z.object({
    category: z.nativeEnum(PostCategoryEnum),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['title', 'createdAt']).optional()
});

/**
 * Input type for getByCategory.
 * @example
 * const input: PostGetByCategoryInput = { category: PostCategoryEnum.EVENTS, limit: 10, offset: 0 };
 */
export type PostGetByCategoryInput = z.infer<typeof PostGetByCategoryInputSchema>;

/**
 * Output type for getByCategory.
 * @example
 * const output: PostGetByCategoryOutput = { posts: [mockPost] };
 */
export type PostGetByCategoryOutput = { posts: PostType[] };

/**
 * Input schema for create post.
 *
 * @example
 * const input = {
 *   slug: 'my-post',
 *   category: PostCategoryEnum.BLOG,
 *   title: 'Title',
 *   summary: 'Summary',
 *   content: 'Content',
 *   media: { url: 'image.jpg' },
 *   authorId: 'user-uuid',
 *   visibility: VisibilityEnum.PUBLIC
 * };
 */
export const PostCreateInputSchema = z.object({
    slug: z.string().min(1, 'Slug is required'),
    category: z.nativeEnum(PostCategoryEnum),
    title: z.string().min(1, 'Title is required'),
    summary: z.string().min(1, 'Summary is required'),
    content: z.string().min(1, 'Content is required'),
    media: z.object({ url: z.string().url('Invalid media URL') }),
    authorId: z.string().min(1, 'Author ID is required'),
    sponsorshipId: z.string().optional(),
    relatedDestinationId: z.string().optional(),
    relatedAccommodationId: z.string().optional(),
    relatedEventId: z.string().optional(),
    visibility: z.nativeEnum(VisibilityEnum),
    isFeatured: z.boolean().optional(),
    isNews: z.boolean().optional(),
    isFeaturedInWebsite: z.boolean().optional(),
    expiresAt: z.coerce.date().optional(),
    likes: z.number().int().optional(),
    comments: z.number().int().optional(),
    shares: z.number().int().optional()
    // SEO, tags, audit fields, etc. can be added as needed
});

/**
 * Input type for create post.
 * @example
 * const input: PostCreateInput = { ... };
 */
export type PostCreateInput = z.infer<typeof PostCreateInputSchema>;

/**
 * Output type for create post.
 * @example
 * const output: PostCreateOutput = { post };
 */
export type PostCreateOutput = { post: PostType };

/**
 * Input schema for update post.
 * Allows updating all writable fields except id, createdAt, createdById, updatedAt, updatedById, deletedAt, deletedById.
 *
 * @example
 * const input = { id: 'post-uuid', title: 'Updated title' };
 */
export const PostUpdateInputSchema = z.object({
    id: z.string().min(1, 'Post ID is required'),
    slug: z.string().optional(),
    category: z.nativeEnum(PostCategoryEnum).optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    media: z.any().optional(),
    authorId: z.string().optional(),
    sponsorshipId: z.string().optional(),
    relatedDestinationId: z.string().optional(),
    relatedAccommodationId: z.string().optional(),
    relatedEventId: z.string().optional(),
    visibility: z.nativeEnum(VisibilityEnum).optional(),
    isFeatured: z.boolean().optional(),
    isNews: z.boolean().optional(),
    isFeaturedInWebsite: z.boolean().optional(),
    expiresAt: z.coerce.date().optional(),
    likes: z.number().int().optional(),
    comments: z.number().int().optional(),
    shares: z.number().int().optional()
    // SEO, tags, audit fields, etc. can be added as needed
});

/**
 * Input type for update post.
 * @example
 * const input: PostUpdateInput = { id: 'post-uuid', title: 'Updated title' };
 */
export type PostUpdateInput = z.infer<typeof PostUpdateInputSchema>;

/**
 * Output type for update post.
 * @example
 * const output: PostUpdateOutput = { post };
 */
export type PostUpdateOutput = { post: PostType | null };

/**
 * Output type for hard delete post.
 * @example
 * const output: PostHardDeleteOutput = { success: true };
 */
export type PostHardDeleteOutput = { success: boolean };

/**
 * Input schema for getByRelatedAccommodation.
 *
 * @example
 * const input = { accommodationId: 'acc-uuid' };
 */
export const PostGetByRelatedAccommodationInputSchema = z.object({
    accommodationId: z.string().min(1, 'Accommodation ID is required')
});

/**
 * Input type for getByRelatedAccommodation.
 * @example
 * const input: PostGetByRelatedAccommodationInput = { accommodationId: 'acc-uuid' };
 */
export type PostGetByRelatedAccommodationInput = z.infer<
    typeof PostGetByRelatedAccommodationInputSchema
>;

/**
 * Output type for getByRelatedAccommodation.
 * @example
 * const output: PostGetByRelatedAccommodationOutput = { posts: [mockPost] };
 */
export type PostGetByRelatedAccommodationOutput = { posts: PostType[] };

/**
 * Input schema for getByRelatedDestination.
 *
 * @example
 * const input = { destinationId: 'dest-uuid' };
 */
export const PostGetByRelatedDestinationInputSchema = z.object({
    destinationId: z.string().min(1, 'Destination ID is required')
});

/**
 * Input type for getByRelatedDestination.
 * @example
 * const input: PostGetByRelatedDestinationInput = { destinationId: 'dest-uuid' };
 */
export type PostGetByRelatedDestinationInput = z.infer<
    typeof PostGetByRelatedDestinationInputSchema
>;

/**
 * Output type for getByRelatedDestination.
 * @example
 * const output: PostGetByRelatedDestinationOutput = { posts: [mockPost] };
 */
export type PostGetByRelatedDestinationOutput = { posts: PostType[] };

/**
 * Input schema for getByRelatedEvent.
 *
 * @example
 * const input = { eventId: 'event-uuid' };
 */
export const PostGetByRelatedEventInputSchema = z.object({
    eventId: z.string().min(1, 'Event ID is required')
});

/**
 * Input type for getByRelatedEvent.
 * @example
 * const input: PostGetByRelatedEventInput = { eventId: 'event-uuid' };
 */
export type PostGetByRelatedEventInput = z.infer<typeof PostGetByRelatedEventInputSchema>;

/**
 * Output type for getByRelatedEvent.
 * @example
 * const output: PostGetByRelatedEventOutput = { posts: [mockPost] };
 */
export type PostGetByRelatedEventOutput = { posts: PostType[] };

/**
 * Input schema for getFeatured.
 *
 * @example
 * const input = {};
 */
export const PostGetFeaturedInputSchema = z.object({}).strict();

/**
 * Input type for getFeatured.
 * @example
 * const input: PostGetFeaturedInput = {};
 */
export type PostGetFeaturedInput = z.infer<typeof PostGetFeaturedInputSchema>;

/**
 * Output type for getFeatured.
 * @example
 * const output: PostGetFeaturedOutput = { posts: [mockPost] };
 */
export type PostGetFeaturedOutput = { posts: PostType[] };

/**
 * Input schema for getNews.
 *
 * @example
 * const input = {};
 */
export const PostGetNewsInputSchema = z.object({}).strict();

/**
 * Input type for getNews.
 * @example
 * const input: PostGetNewsInput = {};
 */
export type PostGetNewsInput = z.infer<typeof PostGetNewsInputSchema>;

/**
 * Output type for getNews.
 * @example
 * const output: PostGetNewsOutput = { posts: [mockPost] };
 */
export type PostGetNewsOutput = { posts: PostType[] };
