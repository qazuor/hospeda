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

// Response schemas (Zod schemas for OpenAPI)
// NOTE: For runtime response helpers, import from '../utils/response-helpers'
export {
    apiErrorCodes,
    errorResponseSchema,
    httpStatusCodes,
    paginatedListResponseSchema,
    paginationMetadataSchema,
    successResponseSchema
} from './response-schemas';

export type { ApiResponse, PaginationData } from './response-schemas';
