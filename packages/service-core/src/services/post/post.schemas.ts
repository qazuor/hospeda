/**
 * Schemas for PostService.
 * Re-export Zod schemas for posts from @repo/schemas to keep a single source of truth.
 */

export {
    GetByCategoryInputSchema,
    GetByRelatedAccommodationInputSchema,
    GetByRelatedDestinationInputSchema,
    GetByRelatedEventInputSchema,
    GetFeaturedInputSchema,
    GetNewsInputSchema,
    GetPostStatsInputSchema,
    GetPostSummaryInputSchema,
    LikePostInputSchema,
    CreatePostServiceSchema as PostCreateInputSchema,
    PostFilterInputSchema,
    UpdatePostServiceSchema as PostUpdateSchema
} from '@repo/schemas/entities/post/index.js';

export { PostSchema } from '@repo/schemas/entities/post/post.schema.js';

// Re-export types expected by service-core tests/factories
export type {
    CreatePostInput as PostCreateInput,
    UpdatePostInput as PostUpdateInput
} from '@repo/schemas/entities/post/post.service.schema.js';
