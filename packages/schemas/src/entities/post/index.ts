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
    GetByCategoryInputSchema,
    GetByRelatedAccommodationInputSchema,
    GetByRelatedDestinationInputSchema,
    GetByRelatedEventInputSchema,
    GetFeaturedInputSchema,
    GetNewsInputSchema,
    GetPostStatsInputSchema,
    GetPostSummaryInputSchema,
    LikePostInputSchema,
    PaginationSchema,
    PostFilterInputSchema,
    UpdatePostServiceSchema
} from './post.service.schema.js';
export * from './post.sponsor.schema.js';
export * from './post.sponsorship.schema.js';
