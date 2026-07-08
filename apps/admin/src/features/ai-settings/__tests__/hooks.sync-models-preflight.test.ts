// @vitest-environment jsdom
/**
 * Tests for `useSyncModelsPreflightMutation` (BETA-129 part 1).
 *
 * Guards that the preflight hook POSTs to the new static
 * `/sync-models/preview` path (not the stored-credential
 * `/{providerId}/sync-models` path) with the caller-supplied body, and
 * correctly unwraps the `{ success, data }` envelope.
 *
 * Mirrors the `renderHook` + mocked-`fetchApi` pattern used by
 * `apps/admin/src/features/billing-addons/__tests__/hooks.catalog.test.ts`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { useSyncModelsPreflightMutation } from '../hooks';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

const SAMPLE_RESULT = {
    providerId: 'openai',
    models: [{ id: 'gpt-4o', source: 'both' as const }],
    fetchedAt: '2026-07-08T12:00:00.000Z',
    hiddenModelIds: ['text-embedding-3-large']
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('useSyncModelsPreflightMutation (BETA-129 part 1)', () => {
    it('POSTs to the static /sync-models/preview path with the full body', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: SAMPLE_RESULT },
            status: 201
        });

        // Act
        const { result } = renderHook(() => useSyncModelsPreflightMutation(), {
            wrapper: createWrapper()
        });
        result.current.mutate({
            providerId: 'openai',
            plaintextKey: 'sk-not-a-real-secret',
            baseURL: 'https://custom.example.com/v1'
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Assert
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/ai/credentials/sync-models/preview',
            method: 'POST',
            body: {
                providerId: 'openai',
                plaintextKey: 'sk-not-a-real-secret',
                baseURL: 'https://custom.example.com/v1'
            }
        });
        expect(result.current.data).toEqual(SAMPLE_RESULT);
    });

    it('omits baseURL from the body when not supplied', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: SAMPLE_RESULT },
            status: 201
        });

        // Act
        const { result } = renderHook(() => useSyncModelsPreflightMutation(), {
            wrapper: createWrapper()
        });
        result.current.mutate({ providerId: 'openai', plaintextKey: 'sk-not-a-real-secret' });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Assert
        const callArgs = mockedFetchApi.mock.calls[0]?.[0] as { body: Record<string, unknown> };
        expect(Object.hasOwn(callArgs.body, 'baseURL')).toBe(false);
    });

    it('surfaces a rejected fetchApi call as a mutation error', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('provider rejected the key'));

        // Act
        const { result } = renderHook(() => useSyncModelsPreflightMutation(), {
            wrapper: createWrapper()
        });
        result.current.mutate({ providerId: 'openai', plaintextKey: 'sk-not-a-real-secret' });

        await waitFor(() => expect(result.current.isError).toBe(true));

        // Assert
        expect(result.current.error).toBeDefined();
    });
});
