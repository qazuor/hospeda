export {
    PostCreateSchema,
    PostFilterSchema,
    PostUpdateSchema
} from './post.requests.schema.js';
export {
    PostDetailSchema,
    PostListItemSchema,
    PostStatsSchema,
    PostSummarySchema
} from './post.responses.schema.js';
export * from './post.schema.js';
export {
    CreatePostServiceSchema,
    GetPostByCategoryInputSchema,
    GetPostByRelatedAccommodationInputSchema,
    GetPostByRelatedDestinationInputSchema,
    GetPostByRelatedEventInputSchema,
    GetPostFeaturedInputSchema,
    GetPostNewsInputSchema,
    GetPostStatsInputSchema,
    GetPostSummaryInputSchema,
    LikePostInputSchema,
    PaginationSchema,
    PostFilterInputSchema,
    UpdatePostServiceSchema
} from './post.service.schema.js';
export type {
    CreatePostInput,
    GetPostByCategoryInput,
    GetPostByRelatedAccommodationInput,
    GetPostByRelatedDestinationInput,
    GetPostByRelatedEventInput,
    GetPostFeaturedInput,
    GetPostNewsInput,
    GetPostStatsInput,
    GetPostSummaryInput,
    UpdatePostInput
} from './post.service.schema.js';
export * from './post.sponsor.schema.js';
export * from './post.sponsorship.schema.js';
