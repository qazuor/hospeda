/**
 * Hook for fetching the full user profile from the protected API endpoint.
 *
 * Uses TanStack Query to cache and manage the user's profile data,
 * including contact info, location, social networks, and settings.
 *
 * @module use-user-profile
 */

import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';
import type { UserProtected, UserSettings } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for user profile queries
 */
export const userProfileQueryKeys = {
    all: ['user', 'profile'] as const,
    detail: (userId: string) => ['user', 'profile', userId] as const
} as const;

/**
 * Fetches the full user profile from the protected API endpoint.
 *
 * @param params - Hook parameters
 * @param params.userId - The user ID to fetch the profile for
 * @returns TanStack Query result with UserProtected data
 *
 * @example
 * ```tsx
 * const { data: profile, isLoading, error } = useUserProfile({ userId: user?.id });
 * ```
 */
export function useUserProfile({ userId }: { readonly userId: string | undefined }) {
    return useQuery({
        queryKey: userProfileQueryKeys.detail(userId ?? ''),
        queryFn: async (): Promise<UserProtected> => {
            const response = await fetchApi<unknown>({
                path: `/api/v1/protected/users/${userId}`
            });

            const apiResponse = response.data as {
                success: boolean;
                data: UserProtected;
            };

            return apiResponse.data;
        },
        enabled: Boolean(userId),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: (failureCount, error) => {
            if (isApiError(error) && error.status === 404) return false;
            return failureCount < 3;
        }
    });
}

/**
 * Mutation hook for updating user settings via the protected API endpoint.
 *
 * Sends a PATCH request with the updated settings and invalidates the
 * user profile cache on success.
 *
 * @param params - Hook parameters
 * @param params.userId - The user ID whose settings to update
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const mutation = useUpdateUserSettings({ userId: user?.id });
 * mutation.mutate({ darkMode: true, language: 'en' });
 * ```
 */
export function useUpdateUserSettings({ userId }: { readonly userId: string | undefined }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: Partial<UserSettings>): Promise<UserProtected> => {
            const response = await fetchApi<unknown>({
                path: `/api/v1/protected/users/${userId}`,
                method: 'PATCH',
                body: { settings }
            });

            const apiResponse = response.data as {
                success: boolean;
                data: UserProtected;
            };

            return apiResponse.data;
        },
        onSuccess: (updatedUser) => {
            queryClient.setQueryData(userProfileQueryKeys.detail(userId ?? ''), updatedUser);
            queryClient.invalidateQueries({
                queryKey: userProfileQueryKeys.all
            });
        }
    });
}
