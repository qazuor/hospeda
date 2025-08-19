/**
 * Schemas for PostService.
 * Re-export Zod schemas for posts from @repo/schemas to keep a single source of truth.
 */

export {
    GetPostByCategoryInputSchema,
    GetPostByRelatedAccommodationInputSchema,
    GetPostByRelatedDestinationInputSchema,
    GetPostByRelatedEventInputSchema,
    GetPostFeaturedInputSchema,
    GetPostNewsInputSchema,
    GetPostStatsInputSchema,
    GetPostSummaryInputSchema,
    LikePostInputSchema,
    CreatePostServiceSchema as PostCreateInputSchema,
    PostFilterInputSchema,
    UpdatePostServiceSchema as PostUpdateSchema
} from '@repo/schemas';

export { PostSchema } from '@repo/schemas';

// Re-export types expected by service-core tests/factories
export type {
    CreatePostInput as PostCreateInput,
    UpdatePostInput as PostUpdateInput
} from '@repo/schemas';
