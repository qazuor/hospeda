/**
 * Query Keys System - TanStack Query Best Practices
 *
 * This module provides a hierarchical, type-safe query key management system
 * following TanStack Query best practices for cache invalidation and organization.
 *
 * @example
 * ```typescript
 * import { accommodationQueryKeys, useEntityQueryKeys } from '@/lib/query-keys';
 *
 * // Use pre-defined query keys
 * const queryKey = accommodationQueryKeys.detail('123');
 *
 * // Use the hook for cache management
 * const { invalidateDetail, prefetchDetail } = useEntityQueryKeys('accommodation');
 * ```
 */

// Export factory functions
export {
    createCustomQueryKey,
    createEntityQueryKeys,
    getEntityInvalidationKey,
    isEntityQueryKey,
    type BaseQueryKey,
    type QueryKeyFromFactory
} from './factory';

// Export pre-defined query keys for common entities
export {
    accommodationQueryKeys,
    destinationQueryKeys,
    eventQueryKeys,
    globalQueryKeys,
    postQueryKeys,
    reviewQueryKeys,
    sponsorQueryKeys,
    userQueryKeys
} from './factory';

// Export hooks
export { useEntityQueryKeys } from './hooks/useEntityQueryKeys';

// Import the hook for use in factory functions
import { useEntityQueryKeys } from './hooks/useEntityQueryKeys';

/**
 * Utility function to create entity-specific query key hooks
 * This provides a more convenient API for specific entities
 *
 * @example
 * ```typescript
 * const useAccommodationQueryKeys = createEntityQueryKeysHook('accommodation');
 * const { invalidateDetail } = useAccommodationQueryKeys();
 * ```
 */
export const createEntityQueryKeysHook = (entityName: string) => {
    return () => useEntityQueryKeys(entityName);
};

// Pre-defined hooks for common entities
export const useAccommodationQueryKeys = createEntityQueryKeysHook('accommodation');
export const useDestinationQueryKeys = createEntityQueryKeysHook('destination');
export const usePostQueryKeys = createEntityQueryKeysHook('post');
export const useEventQueryKeys = createEntityQueryKeysHook('event');
export const useUserQueryKeys = createEntityQueryKeysHook('user');
export const useReviewQueryKeys = createEntityQueryKeysHook('review');
export const useSponsorQueryKeys = createEntityQueryKeysHook('sponsor');
