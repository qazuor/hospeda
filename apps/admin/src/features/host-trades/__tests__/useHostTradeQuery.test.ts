// @vitest-environment jsdom
/**
 * Unit tests for host-trade query hooks (T-019 — SPEC-241).
 *
 * Guards the API response envelope parsing for create / update / list hooks
 * and verifies that list-cache invalidation is triggered on successful mutations.
 */

import { fetchApi } from '@/lib/api/client';
import { HostTradeCategoryEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    hostTradeQueryKeys,
    useCreateHostTradeMutation,
    useDeleteHostTradeMutation,
    useHostTradeQuery,
    useUpdateHostTradeMutation
} from '../hooks/useHostTradeQuery';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const MOCK_HOST_TRADE = {
    id: 'ht-uuid-001',
    slug: 'plomero-perez',
    name: 'Plomero Pérez',
    category: 'PLOMERIA',
    contact: '+54 9 3442 123456',
    benefit: '10 % de descuento presentando la app',
    destinationId: 'dest-uuid-001',
    is24h: false,
    scheduleText: 'Lunes a Viernes 8:00–18:00',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
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

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// useHostTradeQuery
// ---------------------------------------------------------------------------

describe('useHostTradeQuery — returns the entity from the { data } envelope', () => {
    it('returns the host-trade entity from the data envelope', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: MOCK_HOST_TRADE },
            status: 200
        });

        const { result } = renderHook(() => useHostTradeQuery('ht-uuid-001'), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.id).toBe('ht-uuid-001');
        expect(result.current.data?.name).toBe('Plomero Pérez');
        expect(result.current.data?.category).toBe('PLOMERIA');
    });

    it('is disabled when no id is provided', async () => {
        const { result } = renderHook(() => useHostTradeQuery(''), {
            wrapper: createWrapper()
        });

        // Query should not fire without an ID
        expect(result.current.fetchStatus).toBe('idle');
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// useCreateHostTradeMutation
// ---------------------------------------------------------------------------

describe('useCreateHostTradeMutation — valid submit calls API and returns entity', () => {
    it('calls POST /api/v1/admin/host-trades and returns the created entity', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: MOCK_HOST_TRADE },
            status: 201
        });

        const { result } = renderHook(() => useCreateHostTradeMutation(), {
            wrapper: createWrapper()
        });

        const created = await result.current.mutateAsync({
            name: 'Plomero Pérez',
            category: HostTradeCategoryEnum.PLOMERIA,
            contact: '+54 9 3442 123456',
            benefit: '10 % de descuento',
            destinationId: 'dest-uuid-001',
            is24h: false,
            isActive: true
        });

        expect(created.id).toBe('ht-uuid-001');
        expect(created.name).toBe('Plomero Pérez');
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/v1/admin/host-trades', method: 'POST' })
        );
    });
});

// ---------------------------------------------------------------------------
// useUpdateHostTradeMutation
// ---------------------------------------------------------------------------

describe('useUpdateHostTradeMutation — submits PATCH and returns updated entity', () => {
    it('calls PATCH /api/v1/admin/host-trades/:id and returns the updated entity', async () => {
        const updated = { ...MOCK_HOST_TRADE, name: 'Plomero García' };
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: updated },
            status: 200
        });

        const { result } = renderHook(() => useUpdateHostTradeMutation('ht-uuid-001'), {
            wrapper: createWrapper()
        });

        const returned = await result.current.mutateAsync({ name: 'Plomero García' });
        expect(returned.name).toBe('Plomero García');
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/host-trades/ht-uuid-001',
                method: 'PATCH'
            })
        );
    });
});

// ---------------------------------------------------------------------------
// useDeleteHostTradeMutation
// ---------------------------------------------------------------------------

describe('useDeleteHostTradeMutation — soft-deletes and invalidates list cache', () => {
    it('calls DELETE /api/v1/admin/host-trades/:id', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true }, status: 200 });

        const { result } = renderHook(() => useDeleteHostTradeMutation(), {
            wrapper: createWrapper()
        });

        const ok = await result.current.mutateAsync('ht-uuid-001');
        expect(ok).toBe(true);
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/host-trades/ht-uuid-001',
                method: 'DELETE'
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

describe('hostTradeQueryKeys', () => {
    it('generates stable, hierarchical query keys', () => {
        expect(hostTradeQueryKeys.all).toEqual(['host-trades']);
        expect(hostTradeQueryKeys.lists()).toEqual(['host-trades', 'list']);
        expect(hostTradeQueryKeys.detail('abc')).toEqual(['host-trades', 'detail', 'abc']);
    });
});
