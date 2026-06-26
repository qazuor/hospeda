import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';

/**
 * Admin hook to check if a specific feature flag is enabled.
 * Uses the protected endpoint with admin context.
 *
 * @param key - The feature flag key to check
 * @returns Object with `isEnabled` boolean, `isLoading`, and `error` state
 */
export function useFeatureFlag(key: string) {
    const { data, isLoading, error } = useQuery<Record<string, boolean>>({
        queryKey: ['feature-flags', 'me'],
        queryFn: async () => {
            const response = await fetchApi<Record<string, boolean>>({
                path: '/api/v1/protected/feature-flags/me'
            });
            return response.data;
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000
    });

    return {
        isEnabled: data?.[key] ?? false,
        isLoading,
        error
    };
}
