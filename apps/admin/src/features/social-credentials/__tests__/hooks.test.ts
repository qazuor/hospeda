// @vitest-environment jsdom
/**
 * Tests for social credential vault hooks (HOS-64 G-4, T-028).
 *
 * No pre-existing hook tests exist for the mirrored `ai-settings` feature, so
 * these follow the lighter render-hook pattern used elsewhere in this app
 * (e.g. features/faqs/hooks/__tests__/useFaqs.test.ts): mock `fetchApi`,
 * assert the query unwraps the envelope correctly, and assert every mutation
 * invalidates the `social-credentials` query key on success.
 */

import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    socialCredentialsQueryKeys,
    useCreateSocialCredentialMutation,
    useDeleteSocialCredentialMutation,
    useRotateSocialCredentialMutation,
    useSocialCredentialsQuery,
    useUpdateSocialCredentialMutation
} from '../hooks';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const MASKED_CREDENTIAL = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    key: 'make_webhook_url' as const,
    label: 'Production webhook',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
};

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const Wrapper = ({ children }: { readonly children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
    return { Wrapper, invalidateSpy };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('useSocialCredentialsQuery', () => {
    it('unwraps the nested { data: { items: [...] } } envelope into an array', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { items: [MASKED_CREDENTIAL], pagination: {} } },
            status: 200
        });

        const { Wrapper } = createWrapper();
        const { result } = renderHook(() => useSocialCredentialsQuery(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([MASKED_CREDENTIAL]);
        expect(mockedFetchApi).toHaveBeenCalledWith({ path: '/api/v1/admin/social/credentials' });
    });

    it('never exposes secret fields on the returned items', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { items: [MASKED_CREDENTIAL], pagination: {} } },
            status: 200
        });

        const { Wrapper } = createWrapper();
        const { result } = renderHook(() => useSocialCredentialsQuery(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const item = result.current.data?.[0];
        expect(item).toBeDefined();
        expect(item && 'ciphertext' in item).toBe(false);
        expect(item && 'plaintext' in item).toBe(false);
    });
});

describe('useCreateSocialCredentialMutation', () => {
    it('POSTs the payload and invalidates the credentials query on success', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { id: MASKED_CREDENTIAL.id, key: 'make_webhook_url' } },
            status: 201
        });

        const { Wrapper, invalidateSpy } = createWrapper();
        const { result } = renderHook(() => useCreateSocialCredentialMutation(), {
            wrapper: Wrapper
        });

        const created = await result.current.mutateAsync({
            key: 'make_webhook_url',
            plaintext: 'https://hook.make.com/secret'
        });

        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/social/credentials',
            method: 'POST',
            body: { key: 'make_webhook_url', plaintext: 'https://hook.make.com/secret' }
        });
        expect(created.id).toBe(MASKED_CREDENTIAL.id);
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: socialCredentialsQueryKeys.credentials
            })
        );
    });
});

describe('useRotateSocialCredentialMutation', () => {
    it('POSTs to /{key}/rotate and invalidates the credentials query on success', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { id: 'new-id', key: 'make_webhook_url' } },
            status: 200
        });

        const { Wrapper, invalidateSpy } = createWrapper();
        const { result } = renderHook(() => useRotateSocialCredentialMutation(), {
            wrapper: Wrapper
        });

        await result.current.mutateAsync({
            key: 'make_webhook_url',
            payload: { newPlaintext: 'https://hook.make.com/new-secret' }
        });

        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/social/credentials/make_webhook_url/rotate',
            method: 'POST',
            body: { newPlaintext: 'https://hook.make.com/new-secret' }
        });
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: socialCredentialsQueryKeys.credentials
            })
        );
    });
});

describe('useUpdateSocialCredentialMutation', () => {
    it('PATCHes /{key} and invalidates the credentials query on success', async () => {
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: { id: MASKED_CREDENTIAL.id, key: 'make_webhook_url' }
            },
            status: 200
        });

        const { Wrapper, invalidateSpy } = createWrapper();
        const { result } = renderHook(() => useUpdateSocialCredentialMutation(), {
            wrapper: Wrapper
        });

        await result.current.mutateAsync({
            key: 'make_webhook_url',
            payload: { label: 'New label' }
        });

        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/social/credentials/make_webhook_url',
            method: 'PATCH',
            body: { label: 'New label' }
        });
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: socialCredentialsQueryKeys.credentials
            })
        );
    });
});

describe('useDeleteSocialCredentialMutation', () => {
    it('DELETEs /{key} and invalidates the credentials query on success', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { key: 'make_webhook_url' } },
            status: 200
        });

        const { Wrapper, invalidateSpy } = createWrapper();
        const { result } = renderHook(() => useDeleteSocialCredentialMutation(), {
            wrapper: Wrapper
        });

        const deleted = await result.current.mutateAsync('make_webhook_url');

        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/social/credentials/make_webhook_url',
            method: 'DELETE'
        });
        expect(deleted.key).toBe('make_webhook_url');
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: socialCredentialsQueryKeys.credentials
            })
        );
    });
});
