/**
 * Base schemas exports
 */

// Base schemas
export {
    commonFieldSchemas,
    dateRangeQuerySchema,
    geolocationQuerySchema,
    idParamSchema,
    languageQuerySchema,
    paginationQuerySchema,
    searchQuerySchema,
    searchWithPaginationSchema
} from './base-schemas';

// Response schemas
export {
    apiErrorCodes,
    createErrorResponse,
    createSuccessResponse,
    errorResponseSchema,
    httpStatusCodes,
    paginatedListResponseSchema,
    paginationMetadataSchema,
    successResponseSchema
} from './response-schemas';

export type { ApiResponse, PaginationData } from './response-schemas';
