import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    CreateSocialCredentialPayload,
    RotateSocialCredentialPayload,
    SocialCredentialDeleteResponse,
    SocialCredentialKey,
    SocialCredentialMasked,
    SocialCredentialMutationResponse,
    UpdateSocialCredentialPayload
} from './types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** TanStack Query keys for the social credential vault. */
export const socialCredentialsQueryKeys = {
    credentials: ['social-credentials'] as const
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetch all masked social credentials.
 *
 * @returns Array of `SocialCredentialMasked` records.
 */
async function fetchSocialCredentials(): Promise<SocialCredentialMasked[]> {
    const result = await fetchApi<{
        success: boolean;
        data: { items: SocialCredentialMasked[]; pagination: unknown };
    }>({
        path: '/api/v1/admin/social/credentials'
    });
    return result.data.data.items;
}

/**
 * Create a new social credential.
 *
 * @param payload - Key, plaintext secret, and optional label.
 * @returns The created credential's ID and key.
 */
async function createSocialCredential(
    payload: CreateSocialCredentialPayload
): Promise<SocialCredentialMutationResponse> {
    const result = await fetchApi<{ success: boolean; data: SocialCredentialMutationResponse }>({
        path: '/api/v1/admin/social/credentials',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Rotate the secret for an existing social credential.
 *
 * @param key - The credential key to rotate.
 * @param payload - The new plaintext secret.
 * @returns The rotated credential's ID and key.
 */
async function rotateSocialCredential(
    key: SocialCredentialKey,
    payload: RotateSocialCredentialPayload
): Promise<SocialCredentialMutationResponse> {
    const result = await fetchApi<{ success: boolean; data: SocialCredentialMutationResponse }>({
        path: `/api/v1/admin/social/credentials/${key}/rotate`,
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Update a social credential's label metadata. Does not touch the secret.
 *
 * @param key - The credential key to update.
 * @param payload - The metadata fields to update.
 * @returns The updated credential's ID and key.
 */
async function updateSocialCredential(
    key: SocialCredentialKey,
    payload: UpdateSocialCredentialPayload
): Promise<SocialCredentialMutationResponse> {
    const result = await fetchApi<{ success: boolean; data: SocialCredentialMutationResponse }>({
        path: `/api/v1/admin/social/credentials/${key}`,
        method: 'PATCH',
        body: payload
    });
    return result.data.data;
}

/**
 * Delete a social credential.
 *
 * @param key - The credential key to delete.
 * @returns The deleted credential's key.
 */
async function deleteSocialCredential(
    key: SocialCredentialKey
): Promise<SocialCredentialDeleteResponse> {
    const result = await fetchApi<{ success: boolean; data: SocialCredentialDeleteResponse }>({
        path: `/api/v1/admin/social/credentials/${key}`,
        method: 'DELETE'
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Hook to fetch all masked social credentials.
 */
export const useSocialCredentialsQuery = () => {
    return useQuery({
        queryKey: socialCredentialsQueryKeys.credentials,
        queryFn: fetchSocialCredentials,
        staleTime: 2 * 60 * 1000,
        retry: 1
    });
};

/**
 * Hook to create a new social credential.
 *
 * Invalidates the credentials list on success.
 */
export const useCreateSocialCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateSocialCredentialPayload) => createSocialCredential(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: socialCredentialsQueryKeys.credentials });
        }
    });
};

/**
 * Hook to rotate a social credential's secret.
 *
 * Invalidates the credentials list on success.
 */
export const useRotateSocialCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            key,
            payload
        }: {
            readonly key: SocialCredentialKey;
            readonly payload: RotateSocialCredentialPayload;
        }) => rotateSocialCredential(key, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: socialCredentialsQueryKeys.credentials });
        }
    });
};

/**
 * Hook to update a social credential's label metadata.
 *
 * Invalidates the credentials list on success.
 */
export const useUpdateSocialCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            key,
            payload
        }: {
            readonly key: SocialCredentialKey;
            readonly payload: UpdateSocialCredentialPayload;
        }) => updateSocialCredential(key, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: socialCredentialsQueryKeys.credentials });
        }
    });
};

/**
 * Hook to delete a social credential.
 *
 * Invalidates the credentials list on success.
 */
export const useDeleteSocialCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (key: SocialCredentialKey) => deleteSocialCredential(key),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: socialCredentialsQueryKeys.credentials });
        }
    });
};
