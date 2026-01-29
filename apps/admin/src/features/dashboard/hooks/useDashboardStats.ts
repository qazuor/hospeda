/**
 * Dashboard statistics hook
 *
 * Fetches real-time counts for all entities from the API
 * Uses TanStack Query's useQueries to fetch multiple endpoints in parallel
 */

import { useQueries } from '@tanstack/react-query';

const API_BASE = '/api/v1';

type EntityCount = {
    readonly name: string;
    readonly count: number;
    readonly isLoading: boolean;
    readonly isError: boolean;
};

type DashboardStats = {
    readonly entities: EntityCount[];
    readonly isLoading: boolean;
    readonly totalEntities: number;
};

/**
 * Fetches the total count from a list endpoint
 * @param endpoint - The API endpoint to fetch from
 * @returns The total count from pagination metadata
 */
async function fetchEntityCount(endpoint: string): Promise<number> {
    const response = await fetch(`${API_BASE}${endpoint}?page=1&limit=1`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch count from ${endpoint}`);
    }

    const json = await response.json();
    // Extract total from pagination
    return json.data?.pagination?.total ?? json.metadata?.total ?? 0;
}

const ENTITY_ENDPOINTS = [
    { name: 'accommodations', endpoint: '/public/accommodations' },
    { name: 'destinations', endpoint: '/public/destinations' },
    { name: 'events', endpoint: '/public/events' },
    { name: 'posts', endpoint: '/public/posts' },
    { name: 'attractions', endpoint: '/public/attractions' },
    { name: 'users', endpoint: '/admin/users' }
] as const;

/**
 * Hook to fetch dashboard statistics
 * Fetches counts for all entities in parallel
 *
 * @returns Dashboard statistics with entity counts and loading state
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { entities, isLoading, totalEntities } = useDashboardStats();
 *
 *   if (isLoading) return <LoadingState />;
 *
 *   return (
 *     <div>
 *       <p>Total entities: {totalEntities}</p>
 *       {entities.map(entity => (
 *         <div key={entity.name}>
 *           {entity.name}: {entity.count}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboardStats(): DashboardStats {
    const results = useQueries({
        queries: ENTITY_ENDPOINTS.map((entity) => ({
            queryKey: ['dashboard', 'count', entity.name],
            queryFn: () => fetchEntityCount(entity.endpoint),
            staleTime: 5 * 60 * 1000, // 5 minutes for aggregate data
            retry: 1
        }))
    });

    const entities: EntityCount[] = ENTITY_ENDPOINTS.map((entity, index) => ({
        name: entity.name,
        count: results[index].data ?? 0,
        isLoading: results[index].isLoading,
        isError: results[index].isError
    }));

    return {
        entities,
        isLoading: results.some((r) => r.isLoading),
        totalEntities: entities.reduce((sum, e) => sum + e.count, 0)
    };
}
