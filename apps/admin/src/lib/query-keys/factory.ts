import type { EntityQueryParams } from '@/components/entity-list/types';

/**
 * Type-safe query key factory for hierarchical query key management
 * Follows TanStack Query best practices for cache invalidation and organization
 */

/**
 * Base query key structure for all entities
 */
export type BaseQueryKey = readonly [string, ...unknown[]];

/**
 * Entity-specific query key factory
 * Creates hierarchical query keys for better cache management
 */
export const createEntityQueryKeys = (entityName: string) => {
    return {
        /**
         * Root key for all entity-related queries
         * Used for invalidating all entity data
         */
        all: [entityName] as const,

        /**
         * Keys for list-related queries
         */
        lists: () => [...createEntityQueryKeys(entityName).all, 'list'] as const,

        /**
         * Specific list query with filters
         * @param filters - Query parameters for filtering
         */
        list: (filters: EntityQueryParams) =>
            [...createEntityQueryKeys(entityName).lists(), filters] as const,

        /**
         * Keys for detail-related queries
         */
        details: () => [...createEntityQueryKeys(entityName).all, 'detail'] as const,

        /**
         * Specific detail query
         * @param id - Entity ID
         */
        detail: (id: string) => [...createEntityQueryKeys(entityName).details(), id] as const,

        /**
         * Keys for relation-related queries
         */
        relations: (id: string) =>
            [...createEntityQueryKeys(entityName).detail(id), 'relations'] as const,

        /**
         * Specific relation query
         * @param id - Entity ID
         * @param relationType - Type of relation (e.g., 'reviews', 'images')
         */
        relation: (id: string, relationType: string) =>
            [...createEntityQueryKeys(entityName).relations(id), relationType] as const,

        /**
         * Keys for search-related queries
         */
        searches: () => [...createEntityQueryKeys(entityName).all, 'search'] as const,

        /**
         * Specific search query
         * @param query - Search query string
         * @param filters - Additional search filters
         */
        search: (query: string, filters?: Record<string, unknown>) =>
            [...createEntityQueryKeys(entityName).searches(), { query, filters }] as const,

        /**
         * Keys for virtualized list queries
         */
        virtualizedLists: () => [...createEntityQueryKeys(entityName).all, 'virtualized'] as const,

        /**
         * Specific virtualized list query
         * @param params - Query parameters for virtualized list
         */
        virtualizedList: (params: Record<string, unknown>) =>
            [...createEntityQueryKeys(entityName).virtualizedLists(), params] as const,

        /**
         * Keys for statistics and aggregated data
         */
        stats: () => [...createEntityQueryKeys(entityName).all, 'stats'] as const,

        /**
         * Specific stats query
         * @param type - Type of statistics (e.g., 'count', 'summary')
         */
        stat: (type: string) => [...createEntityQueryKeys(entityName).stats(), type] as const
    };
};

/**
 * Pre-defined query key factories for common entities
 * These can be imported directly for type safety and consistency
 */
export const accommodationQueryKeys = createEntityQueryKeys('accommodation');
export const destinationQueryKeys = createEntityQueryKeys('destination');
export const postQueryKeys = createEntityQueryKeys('post');
export const eventQueryKeys = createEntityQueryKeys('event');
export const userQueryKeys = createEntityQueryKeys('user');
export const reviewQueryKeys = createEntityQueryKeys('review');
export const sponsorQueryKeys = createEntityQueryKeys('sponsor');

/**
 * Global query key utilities
 */
export const globalQueryKeys = {
    /**
     * Keys for user session and authentication
     */
    auth: {
        all: ['auth'] as const,
        session: () => [...globalQueryKeys.auth.all, 'session'] as const,
        permissions: () => [...globalQueryKeys.auth.all, 'permissions'] as const,
        profile: () => [...globalQueryKeys.auth.all, 'profile'] as const
    },

    /**
     * Keys for application configuration and metadata
     */
    config: {
        all: ['config'] as const,
        translations: () => [...globalQueryKeys.config.all, 'translations'] as const,
        settings: () => [...globalQueryKeys.config.all, 'settings'] as const,
        features: () => [...globalQueryKeys.config.all, 'features'] as const
    },

    /**
     * Keys for dashboard and analytics data
     */
    dashboard: {
        all: ['dashboard'] as const,
        overview: () => [...globalQueryKeys.dashboard.all, 'overview'] as const,
        metrics: (timeRange: string) =>
            [...globalQueryKeys.dashboard.all, 'metrics', timeRange] as const
    }
} as const;

/**
 * Utility type to extract query key from factory function
 */
export type QueryKeyFromFactory<T> = T extends (...args: readonly unknown[]) => infer R ? R : never;

/**
 * Helper function to create custom query keys following the same pattern
 * @param namespace - The namespace for the query keys
 * @param subKeys - Additional sub-keys to append
 */
export const createCustomQueryKey = (
    namespace: string,
    ...subKeys: readonly unknown[]
): BaseQueryKey => {
    return [namespace, ...subKeys] as const;
};

/**
 * Type guard to check if a query key belongs to a specific entity
 * @param queryKey - The query key to check
 * @param entityName - The entity name to match
 */
export const isEntityQueryKey = (queryKey: unknown[], entityName: string): boolean => {
    return Array.isArray(queryKey) && queryKey[0] === entityName;
};

/**
 * Helper to invalidate all queries for a specific entity
 * Usage: queryClient.invalidateQueries({ queryKey: getEntityInvalidationKey('accommodation') })
 */
export const getEntityInvalidationKey = (entityName: string): BaseQueryKey => {
    return [entityName] as const;
};
