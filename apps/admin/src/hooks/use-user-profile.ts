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
import type { ProfileEditInput, UserProtected, UserSettings } from '@repo/schemas';
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
                path: `/api/v1/admin/users/${userId}`
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
 * Subset of `UserSettings` that the admin settings page may write.
 *
 * Admin users may update both web-surface and admin-surface theme/language
 * preferences, plus the shared notification + newsletter preferences.
 *
 * SPEC-096 / REQ-096-32 (T-056).
 */
export type AdminUserSettingsPatch = Pick<
    UserSettings,
    'themeWeb' | 'themeAdmin' | 'languageWeb' | 'languageAdmin' | 'notifications' | 'newsletter'
>;

/**
 * Mutation hook for updating user settings via the admin API endpoint.
 *
 * Sends a PATCH request with the updated settings and invalidates the
 * user profile cache on success. Accepts the four per-surface theme /
 * language fields plus shared notification and newsletter preferences.
 *
 * SPEC-096 / REQ-096-32 (T-056).
 *
 * @param params - Hook parameters
 * @param params.userId - The user ID whose settings to update
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const mutation = useUpdateUserSettings({ userId: user?.id });
 * mutation.mutate({ themeAdmin: 'dark', languageAdmin: 'en' });
 * ```
 */
export function useUpdateUserSettings({ userId }: { readonly userId: string | undefined }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: Partial<AdminUserSettingsPatch>): Promise<UserProtected> => {
            const response = await fetchApi<unknown>({
                path: `/api/v1/admin/users/${userId}`,
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

/**
 * Mutation hook for updating user profile fields (display name, name parts,
 * bio, avatar, phone) via the admin API endpoint.
 *
 * Validation is enforced by `ProfileEditSchema` on the client (form layer)
 * and re-validated on the server. The body is sent as a partial PATCH.
 *
 * SPEC-096 / REQ-096-31 (T-055).
 *
 * @param params - Hook parameters
 * @param params.userId - The user ID whose profile to update
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const mutation = useUpdateUserProfile({ userId: user?.id });
 * mutation.mutate({
 *   displayName: 'María',
 *   firstName: 'María',
 *   lastName: 'García',
 * });
 * ```
 */
export function useUpdateUserProfile({ userId }: { readonly userId: string | undefined }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (profile: ProfileEditInput): Promise<UserProtected> => {
            // Map ProfileEditSchema (flat) onto the User PATCH shape:
            // - displayName / firstName / lastName / phone live at the top level.
            // - bio + avatarUrl live under `profile`.
            const body: Record<string, unknown> = {
                displayName: profile.displayName,
                firstName: profile.firstName,
                lastName: profile.lastName
            };

            if (profile.phone !== undefined) {
                body.phone = profile.phone === '' ? null : profile.phone;
            }

            const profileNested: Record<string, unknown> = {};
            if (profile.bio !== undefined) {
                profileNested.bio = profile.bio === '' ? null : profile.bio;
            }
            if (profile.avatarUrl !== undefined) {
                // The flat ProfileEditSchema field `avatarUrl` maps onto the
                // nested `profile.avatar` field on the User entity.
                profileNested.avatar = profile.avatarUrl === '' ? null : profile.avatarUrl;
            }
            if (Object.keys(profileNested).length > 0) {
                body.profile = profileNested;
            }

            const response = await fetchApi<unknown>({
                path: `/api/v1/admin/users/${userId}`,
                method: 'PATCH',
                body
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
