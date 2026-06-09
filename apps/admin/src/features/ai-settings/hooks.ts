import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    AiCredentialDeleteResponse,
    AiCredentialMasked,
    AiCredentialMutationResponse,
    AiPromptVersion,
    AiSettingsResponse,
    AiSettingsValue,
    CreateAiCredentialPayload,
    CreateAiPromptPayload,
    RotateAiCredentialPayload,
    UpdateAiCredentialPayload
} from './types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** TanStack Query keys for AI settings, credentials, and prompts. */
export const aiSettingsQueryKeys = {
    settings: ['ai-settings'] as const,
    credentials: ['ai-credentials'] as const,
    prompts: ['ai-prompts'] as const
};

// ---------------------------------------------------------------------------
// Settings API calls
// ---------------------------------------------------------------------------

/**
 * Fetch the global AI settings blob.
 *
 * @returns The `AiSettingsResponse` wrapping the validated settings value.
 */
async function fetchAiSettings(): Promise<AiSettingsResponse> {
    const result = await fetchApi<{ success: boolean; data: AiSettingsResponse }>({
        path: '/api/v1/admin/ai/settings'
    });
    return result.data.data as AiSettingsResponse;
}

/**
 * Replace the entire AI settings blob (PUT — all-or-nothing).
 *
 * @param payload - The full `AiSettingsValue` to persist.
 * @returns The updated `AiSettingsResponse`.
 */
async function updateAiSettings(payload: AiSettingsValue): Promise<AiSettingsResponse> {
    const result = await fetchApi<{ success: boolean; data: AiSettingsResponse }>({
        path: '/api/v1/admin/ai/settings',
        method: 'PUT',
        body: payload
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Credentials API calls
// ---------------------------------------------------------------------------

/**
 * Fetch all masked AI credentials.
 *
 * @returns Array of `AiCredentialMasked` records.
 */
async function fetchAiCredentials(): Promise<AiCredentialMasked[]> {
    const result = await fetchApi<{
        success: boolean;
        data: { items: AiCredentialMasked[]; pagination: unknown };
    }>({
        path: '/api/v1/admin/ai/credentials'
    });
    return result.data.data.items;
}

/**
 * Create a new AI provider credential.
 *
 * @param payload - Provider ID, plaintext API key, and optional label.
 * @returns The created credential's ID and provider ID.
 */
async function createAiCredential(
    payload: CreateAiCredentialPayload
): Promise<AiCredentialMutationResponse> {
    const result = await fetchApi<{ success: boolean; data: AiCredentialMutationResponse }>({
        path: '/api/v1/admin/ai/credentials',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Rotate the API key for an existing credential.
 *
 * @param providerId - The provider whose key to rotate.
 * @param payload - The new plaintext key.
 * @returns The rotated credential's ID and provider ID.
 */
async function rotateAiCredential(
    providerId: string,
    payload: RotateAiCredentialPayload
): Promise<AiCredentialMutationResponse> {
    const result = await fetchApi<{ success: boolean; data: AiCredentialMutationResponse }>({
        path: `/api/v1/admin/ai/credentials/${providerId}/rotate`,
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

/**
 * Delete an AI provider credential.
 *
 * @param providerId - The provider credential to delete.
 * @returns The deleted provider's ID.
 */
async function deleteAiCredential(providerId: string): Promise<AiCredentialDeleteResponse> {
    const result = await fetchApi<{ success: boolean; data: AiCredentialDeleteResponse }>({
        path: `/api/v1/admin/ai/credentials/${providerId}`,
        method: 'DELETE'
    });
    return result.data.data;
}

/**
 * Update credential metadata (label, models, baseURL) for an existing credential.
 *
 * @param providerId - The provider whose metadata to update.
 * @param payload - The metadata fields to update.
 * @returns The updated credential's ID and provider ID.
 */
async function updateAiCredential(
    providerId: string,
    payload: UpdateAiCredentialPayload
): Promise<AiCredentialMutationResponse> {
    const result = await fetchApi<{ success: boolean; data: AiCredentialMutationResponse }>({
        path: `/api/v1/admin/ai/credentials/${providerId}`,
        method: 'PATCH',
        body: payload
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Hooks — Settings
// ---------------------------------------------------------------------------

/**
 * Hook to fetch the global AI settings.
 *
 * Uses a 5-minute stale time and single retry to avoid hammering the API
 * on transient failures.
 */
export const useAiSettingsQuery = () => {
    return useQuery({
        queryKey: aiSettingsQueryKeys.settings,
        queryFn: fetchAiSettings,
        staleTime: 5 * 60 * 1000,
        retry: 1
    });
};

/**
 * Hook to replace the entire AI settings blob.
 *
 * Invalidates the settings query on success so the UI reflects the
 * server-persisted state.
 */
export const useUpdateAiSettingsMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: AiSettingsValue) => updateAiSettings(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: aiSettingsQueryKeys.settings });
        }
    });
};

// ---------------------------------------------------------------------------
// Hooks — Credentials
// ---------------------------------------------------------------------------

/**
 * Hook to fetch all masked AI credentials.
 */
export const useAiCredentialsQuery = () => {
    return useQuery({
        queryKey: aiSettingsQueryKeys.credentials,
        queryFn: fetchAiCredentials,
        staleTime: 2 * 60 * 1000,
        retry: 1
    });
};

/**
 * Hook to create a new AI credential.
 *
 * Invalidates the credentials list on success.
 */
export const useCreateAiCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateAiCredentialPayload) => createAiCredential(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: aiSettingsQueryKeys.credentials });
        }
    });
};

/**
 * Hook to rotate an AI credential key.
 *
 * Invalidates both credentials and settings queries on success, since
 * rotating a key may affect provider availability.
 */
export const useRotateAiCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            providerId,
            payload
        }: {
            readonly providerId: string;
            readonly payload: RotateAiCredentialPayload;
        }) => rotateAiCredential(providerId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: aiSettingsQueryKeys.credentials });
            queryClient.invalidateQueries({ queryKey: aiSettingsQueryKeys.settings });
        }
    });
};

/**
 * Hook to delete an AI credential.
 *
 * Invalidates both credentials and settings queries on success.
 */
export const useDeleteAiCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (providerId: string) => deleteAiCredential(providerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: aiSettingsQueryKeys.credentials });
            queryClient.invalidateQueries({ queryKey: aiSettingsQueryKeys.settings });
        }
    });
};

/**
 * Hook to update credential metadata (label, models, baseURL).
 *
 * Invalidates the credentials list on success.
 */
export const useUpdateAiCredentialMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            providerId,
            payload
        }: {
            readonly providerId: string;
            readonly payload: UpdateAiCredentialPayload;
        }) => updateAiCredential(providerId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: aiSettingsQueryKeys.credentials });
        }
    });
};

// ---------------------------------------------------------------------------
// Prompts API calls
// ---------------------------------------------------------------------------

/**
 * Fetch all prompt versions for a given AI feature.
 *
 * @param feature - The AI feature identifier (e.g. 'chat', 'text_improve').
 * @returns Array of `AiPromptVersion` records, ordered by version descending.
 */
async function fetchAiPrompts(feature: string): Promise<AiPromptVersion[]> {
    const result = await fetchApi<{
        success: boolean;
        data: { items: AiPromptVersion[]; pagination: unknown };
    }>({
        path: `/api/v1/admin/ai/prompts?feature=${feature}`
    });
    return result.data.data.items;
}

/**
 * Create a new prompt version for a feature.
 *
 * @param payload - Feature, content, and whether to activate immediately.
 * @returns The created `AiPromptVersion`.
 */
async function createAiPrompt(payload: CreateAiPromptPayload): Promise<AiPromptVersion> {
    const result = await fetchApi<{ success: boolean; data: AiPromptVersion }>({
        path: '/api/v1/admin/ai/prompts',
        method: 'POST',
        body: payload
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Hooks — Prompts
// ---------------------------------------------------------------------------

/**
 * Hook to fetch all prompt versions for a specific AI feature.
 *
 * Uses a 2-minute stale time and single retry.
 */
export const useAiPromptsQuery = (feature: string) => {
    return useQuery({
        queryKey: [...aiSettingsQueryKeys.prompts, feature],
        queryFn: () => fetchAiPrompts(feature),
        staleTime: 2 * 60 * 1000,
        retry: 1
    });
};

/**
 * Hook to create a new prompt version.
 *
 * Invalidates the prompts query for the affected feature on success.
 */
export const useCreateAiPromptMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: CreateAiPromptPayload) => createAiPrompt(payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [...aiSettingsQueryKeys.prompts, variables.feature]
            });
        }
    });
};
