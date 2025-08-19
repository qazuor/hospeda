// Core schemas
export * from './accommodation.base.schema.js';
export * from './accommodation.service.schema.js';

// Request and response schemas
export * from './accommodation.requests.schema.js';
export * from './accommodation.responses.schema.js';

// Composition schemas (export only non-conflicting schemas)
export {
    AccommodationByDestinationSchema,
    AccommodationCreateCompositionSchema,
    AccommodationDetailSchema,
    AccommodationListItemSchema,
    AccommodationSearchCompositionSchema,
    AccommodationSearchFiltersSchema,
    AccommodationSearchPaginationSchema,
    AccommodationSearchSortSchema,
    AccommodationStatsSchema,
    AccommodationSummarySchema,
    AccommodationUpdateCompositionSchema,
    TopRatedAccommodationsSchema
} from './accommodation.composition.schema.js';

// Reviews
export * from './accommodation.rating.schema.js';
export * from './accommodation.review.schema.js';
