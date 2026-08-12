// @vitest-environment jsdom
/**
 * Unit tests for the benefit-usage audit hooks (HOS-376 T-056).
 *
 * Three things are pinned here, and each one is a way the screen could look
 * right while querying the wrong thing:
 *
 *  - the suspension list is scoped SERVER-side (`declarationSuspended=true`);
 *  - an unset filter is omitted from the query string rather than sent empty,
 *    because `createAdminListRoute` rejects a param it cannot parse;
 *  - `reason` travels only when suspending. The endpoint's body is strict and
 *    takes no reason to lift, so a reason left in the payload from a previous
 *    dialog would turn a lift into a 400.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    hostTradeUsageQueryKeys,
    useHostTradeUsages,
    useSetDeclarationSuspension,
    useSuspendedProviders
} from '../use-host-trade-usages';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const EMPTY_PAGE = {
    data: {
        success: true,
        data: { items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } }
    },
    status: 200
};

/** Creates an isolated QueryClient wrapper with retries disabled. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

/** The path the single `fetchApi` call was made with. */
function calledPath(): string {
    const call = mockedFetchApi.mock.calls[0]?.[0];
    if (!call) {
        throw new Error('fetchApi was never called');
    }
    return call.path;
}

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// useHostTradeUsages
// ---------------------------------------------------------------------------

describe('useHostTradeUsages', () => {
    it('sends every filter that was set', async () => {
        mockedFetchApi.mockResolvedValue(EMPTY_PAGE);

        const { result } = renderHook(
            () =>
                useHostTradeUsages({
                    page: 2,
                    status: 'REJECTED',
                    creationChannel: 'EMAIL_LOOKUP'
                }),
            { wrapper: createWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const path = calledPath();
        expect(path).toContain('/api/v1/admin/host-trades/usages?');
        expect(path).toContain('status=REJECTED');
        expect(path).toContain('creationChannel=EMAIL_LOOKUP');
        expect(path).toContain('page=2');
    });

    it('omits a filter left empty instead of sending it blank', async () => {
        mockedFetchApi.mockResolvedValue(EMPTY_PAGE);

        const { result } = renderHook(
            () => useHostTradeUsages({ hostTradeId: '', status: undefined, page: 1 }),
            { wrapper: createWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const path = calledPath();
        expect(path).not.toContain('hostTradeId');
        expect(path).not.toContain('status');
    });

    it('asks for no query string at all when nothing is filtered', async () => {
        mockedFetchApi.mockResolvedValue(EMPTY_PAGE);

        const { result } = renderHook(() => useHostTradeUsages(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(calledPath()).toBe('/api/v1/admin/host-trades/usages');
    });
});

// ---------------------------------------------------------------------------
// useSuspendedProviders
// ---------------------------------------------------------------------------

describe('useSuspendedProviders', () => {
    it('scopes the read to suspended providers at the API', async () => {
        mockedFetchApi.mockResolvedValue(EMPTY_PAGE);

        const { result } = renderHook(() => useSuspendedProviders(3), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        const path = calledPath();
        expect(path).toContain('/api/v1/admin/host-trades?');
        expect(path).toContain('declarationSuspended=true');
        expect(path).toContain('page=3');
    });
});

// ---------------------------------------------------------------------------
// useSetDeclarationSuspension
// ---------------------------------------------------------------------------

describe('useSetDeclarationSuspension', () => {
    it('carries the reason when suspending', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { suspended: true } },
            status: 200
        });

        const { result } = renderHook(() => useSetDeclarationSuspension(), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({
            hostTradeId: 'ht-1',
            suspended: true,
            reason: 'Usos fabricados'
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/host-trades/ht-1/declaration-suspension',
                method: 'POST',
                body: { suspended: true, reason: 'Usos fabricados' }
            })
        );
    });

    it('drops a leftover reason when lifting', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { suspended: false } },
            status: 200
        });

        const { result } = renderHook(() => useSetDeclarationSuspension(), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({
            hostTradeId: 'ht-1',
            suspended: false,
            reason: 'stale text from the suspend dialog'
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({ body: { suspended: false } })
        );
    });
});

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

describe('hostTradeUsageQueryKeys', () => {
    it('branches both reads under one root, so a decision can invalidate both', () => {
        expect(hostTradeUsageQueryKeys.all).toEqual(['host-trade-usages']);
        expect(hostTradeUsageQueryKeys.usages()).toEqual(['host-trade-usages', 'usages']);
        expect(hostTradeUsageQueryKeys.suspensions()).toEqual(['host-trade-usages', 'suspensions']);
    });
});
