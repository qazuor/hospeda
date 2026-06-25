import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './fetch-api';

/**
 * Hook to check if a specific feature flag is enabled for the current user.
 * Uses the protected endpoint (includes user context for overrides).
 *
 * @param key - The feature flag key to check
 * @returns Object with `isEnabled` boolean, `isLoading`, and `error` state
 *
 * @example
 * ```tsx
 * const { isEnabled, isLoading } = useFeatureFlag('calendar');
 *
 * if (isLoading) return <Spinner />;
 * if (!isEnabled) return <FeatureUnavailable />;
 * return <CalendarFeature />;
 * ```
 */
export function useFeatureFlag(key: string) {
    const { data, isLoading, error } = useQuery<Record<string, boolean>>({
        queryKey: ['feature-flags', 'me'],
        queryFn: async () => {
            try {
                const response = await fetchApi('/api/v1/protected/feature-flags/me');
                return response as Record<string, boolean>;
            } catch {
                // Fallback to public endpoint if not authenticated
                const response = await fetchApi('/api/v1/public/feature-flags/me');
                return response as Record<string, boolean>;
            }
        },
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000 // 5 minutes
    });

    return {
        isEnabled: data?.[key] ?? false,
        isLoading,
        error
    };
}

/**
 * Hook to get all evaluated feature flags for the current user.
 *
 * @returns Object with all flags as key-value pairs, `isLoading`, and `error` state
 */
export function useAllFeatureFlags() {
    const { data, isLoading, error } = useQuery<Record<string, boolean>>({
        queryKey: ['feature-flags', 'all'],
        queryFn: async () => {
            try {
                const response = await fetchApi('/api/v1/protected/feature-flags/me');
                return response as Record<string, boolean>;
            } catch {
                const response = await fetchApi('/api/v1/public/feature-flags/me');
                return response as Record<string, boolean>;
            }
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000
    });

    return {
        flags: data ?? {},
        isLoading,
        error
    };
}
