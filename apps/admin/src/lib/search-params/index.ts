/**
 * Search Parameters System - TanStack Router Integration
 *
 * This module provides type-safe search parameter handling for TanStack Router
 * with validation, defaults, and convenient hooks for common patterns.
 *
 * @example
 * ```typescript
 * import { entityDetailSearchSchema, useEntityDetailSearch } from '@/lib/search-params';
 *
 * export const Route = createFileRoute('/accommodations/$id/')({
 *     validateSearch: entityDetailSearchSchema,
 *     component: AccommodationViewPage
 * });
 *
 * function AccommodationViewPage() {
 *     const search = Route.useSearch();
 *     const { switchTab, toggleEdit } = useEntityDetailSearch(
 *         search,
 *         entityDetailSearchSchema,
 *         defaultEntityDetailSearch
 *     );
 *
 *     return (
 *         <div>
 *             <button onClick={() => switchTab('relations')}>
 *                 Relations
 *             </button>
 *             <button onClick={toggleEdit}>
 *                 {search.edit ? 'Cancel' : 'Edit'}
 *             </button>
 *         </div>
 *     );
 * }
 * ```
 */

// Export schemas and types
export {
    authSearchSchema,
    baseEntitySearchSchema,
    dashboardSearchSchema,
    entityDetailSearchSchema,
    entityListSearchSchema,
    type AuthSearch,
    type BaseEntitySearch,
    type DashboardSearch,
    type EntityDetailSearch,
    type EntityListSearch,
    type SearchParamsFromSchema
} from './schemas';

// Export default values
export {
    defaultDashboardSearch,
    defaultEntityDetailSearch,
    defaultEntityListSearch,
    mergeWithDefaults,
    safeParseSearchParams
} from './schemas';

// Export hooks
export {
    useEntityDetailSearch,
    useEntityListSearch,
    useEntitySearch
} from './hooks/useEntitySearch';

export {
    useDebouncedFilters,
    useDebouncedSearch
} from './hooks/useDebouncedSearch';

/**
 * Utility function to create a route with validated search params
 * This is a convenience wrapper around createFileRoute with search validation
 *
 * @example
 * ```typescript
 * export const Route = createValidatedRoute('/accommodations/$id/', {
 *     searchSchema: entityDetailSearchSchema,
 *     defaults: defaultEntityDetailSearch,
 *     component: AccommodationViewPage
 * });
 * ```
 */
import { createFileRoute } from '@tanstack/react-router';
import type { z } from 'zod';
import {
    type EntityDetailSearch,
    type EntityListSearch,
    defaultEntityDetailSearch,
    defaultEntityListSearch,
    entityDetailSearchSchema,
    entityListSearchSchema,
    safeParseSearchParams
} from './schemas';

export const createValidatedRoute = <TPath extends string, TSchema extends z.ZodSchema>(
    path: TPath,
    options: {
        readonly searchSchema: TSchema;
        readonly defaults?: Partial<z.infer<TSchema>>;
        readonly component: React.ComponentType;
        readonly loader?: (params: {
            readonly params: Record<string, string>;
            readonly context: unknown;
        }) => Promise<unknown> | unknown;
        readonly beforeLoad?: (params: {
            readonly params: Record<string, string>;
            readonly context: unknown;
        }) => Promise<unknown> | unknown;
    }
) => {
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router path type compatibility
    return createFileRoute(path as any)({
        validateSearch: (search: unknown) =>
            safeParseSearchParams(options.searchSchema, search, options.defaults),
        // biome-ignore lint/suspicious/noExplicitAny: TanStack Router component type compatibility
        component: options.component as any,
        loader: options.loader,
        beforeLoad: options.beforeLoad
    });
};

/**
 * Pre-configured route creators for common entity types
 */
export const createEntityDetailRoute = <TPath extends string>(
    path: TPath,
    options: {
        readonly component: React.ComponentType;
        readonly loader?: Parameters<typeof createValidatedRoute>[1]['loader'];
        readonly beforeLoad?: Parameters<typeof createValidatedRoute>[1]['beforeLoad'];
        readonly defaults?: Partial<EntityDetailSearch>;
    }
) => {
    return createValidatedRoute(path, {
        searchSchema: entityDetailSearchSchema,
        defaults: { ...defaultEntityDetailSearch, ...options.defaults },
        component: options.component,
        loader: options.loader,
        beforeLoad: options.beforeLoad
    });
};

export const createEntityListRoute = <TPath extends string>(
    path: TPath,
    options: {
        readonly component: React.ComponentType;
        readonly loader?: Parameters<typeof createValidatedRoute>[1]['loader'];
        readonly beforeLoad?: Parameters<typeof createValidatedRoute>[1]['beforeLoad'];
        readonly defaults?: Partial<EntityListSearch>;
    }
) => {
    return createValidatedRoute(path, {
        searchSchema: entityListSearchSchema,
        defaults: { ...defaultEntityListSearch, ...options.defaults },
        component: options.component,
        loader: options.loader,
        beforeLoad: options.beforeLoad
    });
};
