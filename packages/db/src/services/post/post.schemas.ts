import type { PostId, PostType } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PostCategoryEnum } from '@repo/types/enums/post-category.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { z } from 'zod';

/**
 * Input schema for getById.
 *
 * @example
 * const input = { id: 'post-uuid' as PostId };
 */
export const getByIdInputSchema = z.object({
    id: z.string().min(1, 'Post ID is required') as unknown as z.ZodType<PostId>
});

/**
 * Output type for getById.
 *
 * @example
 * const output = { post: postObjectOrNull };
 */
export type GetByIdInput = z.infer<typeof getByIdInputSchema>;
export type GetByIdOutput = { post: PostType | null };

/**
 * Input schema for getBySlug.
 *
 * @example
 * const input = { slug: 'my-post-slug' };
 */
export const getBySlugInputSchema = z.object({
    slug: z.string().min(1, 'Post slug is required')
});

/**
 * Output type for getBySlug.
 *
 * @example
 * const output = { post: postObjectOrNull };
 */
export type GetBySlugInput = z.infer<typeof getBySlugInputSchema>;
export type GetBySlugOutput = { post: PostType | null };

/**
 * Input schema for list.
 *
 * @example
 * const input = { limit: 10, offset: 0 };
 */
export const listInputSchema = z.object({
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
 * const input: ListInput = { limit: 10, offset: 0 };
 */
export type ListInput = z.infer<typeof listInputSchema>;

/**
 * Output type for list.
 * @example
 * const output: ListOutput = { posts: [mockPost] };
 */
export type ListOutput = { posts: PostType[] };

/**
 * Input schema for search (advanced search).
 *
 * @example
 * const input = { q: 'foo', category: 'news', limit: 10, offset: 0 };
 */
export const searchInputSchema = z.object({
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
 * const input: SearchInput = { q: 'foo', limit: 10, offset: 0 };
 */
export type SearchInput = z.infer<typeof searchInputSchema>;

/**
 * Output type for search.
 * @example
 * const output: SearchOutput = { posts: [mockPost], total: 1 };
 */
export type SearchOutput = { posts: PostType[]; total: number };

/**
 * Input schema for getByCategory.
 *
 * @example
 * const input = { category: PostCategoryEnum.EVENTS, limit: 10, offset: 0 };
 */
export const getByCategoryInputSchema = z.object({
    category: z.nativeEnum(PostCategoryEnum),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['title', 'createdAt']).optional()
});

/**
 * Input type for getByCategory.
 * @example
 * const input: GetByCategoryInput = { category: PostCategoryEnum.EVENTS, limit: 10, offset: 0 };
 */
export type GetByCategoryInput = z.infer<typeof getByCategoryInputSchema>;

/**
 * Output type for getByCategory.
 * @example
 * const output: GetByCategoryOutput = { posts: [mockPost] };
 */
export type GetByCategoryOutput = { posts: PostType[] };

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
export const createPostInputSchema = z.object({
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
 * const input: CreatePostInput = { ... };
 */
export type CreatePostInput = z.infer<typeof createPostInputSchema>;

/**
 * Output type for create post.
 * @example
 * const output: CreatePostOutput = { post };
 */
export type CreatePostOutput = { post: PostType };

/**
 * Input schema for update post.
 * Allows updating all writable fields except id, createdAt, createdById, updatedAt, updatedById, deletedAt, deletedById.
 *
 * @example
 * const input = { id: 'post-uuid', title: 'Updated title' };
 */
export const updatePostInputSchema = z.object({
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
 * const input: UpdatePostInput = { id: 'post-uuid', title: 'Updated title' };
 */
export type UpdatePostInput = z.infer<typeof updatePostInputSchema>;

/**
 * Output type for update post.
 * @example
 * const output: UpdatePostOutput = { post };
 */
export type UpdatePostOutput = { post: PostType | null };

/**
 * Output type for hard delete post.
 * @example
 * const output: HardDeleteOutput = { success: true };
 */
export type HardDeleteOutput = { success: boolean };

/**
 * Input schema for getByRelatedAccommodation.
 *
 * @example
 * const input = { accommodationId: 'acc-uuid' };
 */
export const getByRelatedAccommodationInputSchema = z.object({
    accommodationId: z.string().min(1, 'Accommodation ID is required')
});

/**
 * Input type for getByRelatedAccommodation.
 * @example
 * const input: GetByRelatedAccommodationInput = { accommodationId: 'acc-uuid' };
 */
export type GetByRelatedAccommodationInput = z.infer<typeof getByRelatedAccommodationInputSchema>;

/**
 * Output type for getByRelatedAccommodation.
 * @example
 * const output: GetByRelatedAccommodationOutput = { posts: [mockPost] };
 */
export type GetByRelatedAccommodationOutput = { posts: PostType[] };

/**
 * Input schema for getByRelatedDestination.
 *
 * @example
 * const input = { destinationId: 'dest-uuid' };
 */
export const getByRelatedDestinationInputSchema = z.object({
    destinationId: z.string().min(1, 'Destination ID is required')
});

/**
 * Input type for getByRelatedDestination.
 * @example
 * const input: GetByRelatedDestinationInput = { destinationId: 'dest-uuid' };
 */
export type GetByRelatedDestinationInput = z.infer<typeof getByRelatedDestinationInputSchema>;

/**
 * Output type for getByRelatedDestination.
 * @example
 * const output: GetByRelatedDestinationOutput = { posts: [mockPost] };
 */
export type GetByRelatedDestinationOutput = { posts: PostType[] };

/**
 * Input schema for getByRelatedEvent.
 *
 * @example
 * const input = { eventId: 'event-uuid' };
 */
export const getByRelatedEventInputSchema = z.object({
    eventId: z.string().min(1, 'Event ID is required')
});

/**
 * Input type for getByRelatedEvent.
 * @example
 * const input: GetByRelatedEventInput = { eventId: 'event-uuid' };
 */
export type GetByRelatedEventInput = z.infer<typeof getByRelatedEventInputSchema>;

/**
 * Output type for getByRelatedEvent.
 * @example
 * const output: GetByRelatedEventOutput = { posts: [mockPost] };
 */
export type GetByRelatedEventOutput = { posts: PostType[] };
