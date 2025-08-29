/**
 * @file Server Functions Module Index
 *
 * This module provides a complete server functions system with TanStack Query integration
 * for optimal data fetching, caching, and mutations in the admin application.
 */

// Core types
export type {
    CrudOperation,
    EntityServerConfig,
    ListQueryParams,
    ListResult,
    ServerContext,
    ServerFunctionInput,
    ServerFunctionOptions,
    ServerFunctionResult
} from './types';

// TanStack Query integration
export {
    createCacheInvalidator,
    createEntityDetailQuery,
    createEntityListQuery,
    createEntityMutation,
    createOptimisticUpdates,
    createQueryKeyFactory
} from './query-integration';

// Entity-specific implementations are preferred over generic abstractions
// See accommodations-simple-functions.ts and useAccommodationsSimple.ts for the pattern
