// @vitest-environment jsdom
/**
 * @file useAccommodationOccupancyQuery.test.ts
 * @description Unit tests for `useAccommodationOccupancyQuery` (HOS-43 Phase 1).
 *
 * Covers:
 *  - fetches the admin occupancy endpoint and unwraps the response envelope
 *  - returns an empty array (not undefined/an object) when `data.occupancy` is absent
 *  - the query key includes the accommodation id and optional range
 *  - `from`/`to` are forwarded as query-string params when a range is given
 *  - the query is disabled when `enabled: false` is passed
 *  - a 403 (missing ACCOMMODATION_OCCUPANCY_VIEW) response is NOT retried
 */

import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { accommodationQueryKeys } from '../accommodationQueryKeys';
import { useAccommodationOccupancyQuery } from '../useAccommodationOccupancyQuery';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const ACCOMMODATION_ID = 'acc-1';

const OCCUPANCY_ROW: AccommodationOccupancy = {
    id: 'occ-1',
    accommodationId: ACCOMMODATION_ID,
    date: '2026-07-10',
    isBlocked: true,
    source: OccupancySourceEnum.MANUAL,
    externalEventId: null,
    note: 'internal note',
    createdById: 'user-1',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z')
};

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('useAccommodationOccupancyQuery — query key', () => {
    it('builds a key scoped to the accommodation id and range', () => {
        expect(accommodationQueryKeys.occupancy(ACCOMMODATION_ID)).toEqual([
            'accommodations',
            'detail',
            ACCOMMODATION_ID,
            'relations',
            'occupancy',
            undefined
        ]);
        expect(
            accommodationQueryKeys.occupancy(ACCOMMODATION_ID, {
                from: '2026-07-01',
                to: '2026-08-01'
            })
        ).toEqual([
            'accommodations',
            'detail',
            ACCOMMODATION_ID,
            'relations',
            'occupancy',
            { from: '2026-07-01', to: '2026-08-01' }
        ]);
    });
});

describe('useAccommodationOccupancyQuery — envelope parsing', () => {
    it('unwraps the { data: { occupancy: [...] } } envelope into an array', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { occupancy: [OCCUPANCY_ROW] } },
            status: 200
        });

        const { result } = renderHook(() => useAccommodationOccupancyQuery(ACCOMMODATION_ID), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([OCCUPANCY_ROW]);
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/accommodations/${ACCOMMODATION_ID}/occupancy`
        });
    });

    it('returns an empty array (not undefined) when data.occupancy is absent', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: {} },
            status: 200
        });

        const { result } = renderHook(() => useAccommodationOccupancyQuery(ACCOMMODATION_ID), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([]);
    });

    it('forwards from/to as query-string params when a range is given', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { occupancy: [] } },
            status: 200
        });

        const { result } = renderHook(
            () =>
                useAccommodationOccupancyQuery(ACCOMMODATION_ID, {
                    range: { from: '2026-07-01', to: '2026-08-01' }
                }),
            { wrapper: createWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(mockedFetchApi).toHaveBeenCalledWith({
            path: `/api/v1/admin/accommodations/${ACCOMMODATION_ID}/occupancy?from=2026-07-01&to=2026-08-01`
        });
    });
});

describe('useAccommodationOccupancyQuery — enabled flag', () => {
    it('does not fetch when enabled is false', () => {
        const { result } = renderHook(
            () => useAccommodationOccupancyQuery(ACCOMMODATION_ID, { enabled: false }),
            { wrapper: createWrapper() }
        );

        expect(result.current.isFetching).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

describe('useAccommodationOccupancyQuery — retry gating', () => {
    it('does not retry on a 403 (missing ACCOMMODATION_OCCUPANCY_VIEW)', async () => {
        mockedFetchApi.mockRejectedValue(new ApiError('Forbidden', { status: 403 }));

        const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children);

        const { result } = renderHook(() => useAccommodationOccupancyQuery(ACCOMMODATION_ID), {
            wrapper
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(mockedFetchApi).toHaveBeenCalledTimes(1);
    });
});
