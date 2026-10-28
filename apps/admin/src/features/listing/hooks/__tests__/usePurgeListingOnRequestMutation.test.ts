// @vitest-environment jsdom
/**
 * Tests for `usePurgeListingOnRequestMutation` (HOS-1493, action 23).
 *
 * The hook decides WHICH listing the server purges: a path built with the
 * wrong vertical plural answers 404 for a real id, or — worse — hits the same
 * id in another vertical. Both are asserted on the exact path and body handed
 * to `fetchApi`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    type PurgeListingVertical,
    usePurgeListingOnRequestMutation
} from '../usePurgeListingOnRequestMutation';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const LISTING_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

function createClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('usePurgeListingOnRequestMutation — action 23 posts to its vertical purge route', () => {
    it.each([
        ['accommodation', '/api/v1/admin/accommodations'],
        ['venue', '/api/v1/admin/venues'],
        ['experience', '/api/v1/admin/experiences']
    ] as const satisfies readonly (readonly [
        PurgeListingVertical,
        string
    ])[])('%s: POSTs { reason } to %s/:id/purge', async (vertical, base) => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { purged: true } },
            status: 200
        });
        const { result } = renderHook(() => usePurgeListingOnRequestMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act
        const outcome = await result.current.mutateAsync({
            vertical,
            id: LISTING_ID,
            reason: 'Juan lo pidió por correo'
        });

        // Assert
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `${base}/${LISTING_ID}/purge`,
            method: 'POST',
            body: { reason: 'Juan lo pidió por correo' }
        });
        expect(outcome).toEqual({ purged: true });
    });

    it('invalidates the queries of the purged listing vertical', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { purged: true } },
            status: 200
        });
        const queryClient = createClient();
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => usePurgeListingOnRequestMutation(), {
            wrapper: createWrapper(queryClient)
        });

        // Act
        await result.current.mutateAsync({
            vertical: 'venue',
            id: LISTING_ID,
            reason: 'pedido del dueño'
        });

        // Assert
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['venues'] });
    });

    it('rejects when the route answers an error, so the caller can show it', async () => {
        // Arrange
        mockedFetchApi.mockRejectedValue(new Error('Request failed (409)'));
        const { result } = renderHook(() => usePurgeListingOnRequestMutation(), {
            wrapper: createWrapper(createClient())
        });

        // Act + Assert
        await expect(
            result.current.mutateAsync({
                vertical: 'experience',
                id: LISTING_ID,
                reason: 'pedido del dueño'
            })
        ).rejects.toThrow('Request failed (409)');
    });
});
