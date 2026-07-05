// @vitest-environment jsdom
/**
 * @file useAccommodationImportStatusQuery.test.ts
 * @description Unit tests for `useAccommodationImportStatusQuery` (HOS-50 T-014).
 *
 * Covers:
 *  - query is disabled (no fetch) when no run handle is passed
 *  - query fetches the status endpoint when a run handle is present
 *  - `computeImportStatusRefetchInterval` keeps polling while unsettled
 *  - `computeImportStatusRefetchInterval` stops polling once settled
 */

import type {
    AccommodationImportAsyncStartResponse,
    AccommodationImportStatusResponse
} from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    computeImportStatusRefetchInterval,
    useAccommodationImportStatusQuery
} from '../useAccommodationImportStatusQuery';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const RUN_HANDLE: AccommodationImportAsyncStartResponse = {
    runId: 'run-abc123',
    datasetId: 'dataset-xyz789',
    source: 'airbnb',
    startedAt: '2026-07-02T09:20:00.000Z',
    url: 'https://airbnb.com/rooms/123'
};

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('useAccommodationImportStatusQuery', () => {
    it('should NOT fetch when no run handle is present', () => {
        const { result } = renderHook(() => useAccommodationImportStatusQuery(null), {
            wrapper: createWrapper()
        });

        expect(result.current.isFetching).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });

    it('should fetch the status endpoint when a run handle is present', async () => {
        const responseData: AccommodationImportStatusResponse = { settled: false };
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: responseData },
            status: 200
        } as never);

        const { result } = renderHook(() => useAccommodationImportStatusQuery(RUN_HANDLE), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual(responseData);
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: expect.stringContaining(
                    '/api/v1/protected/accommodations/import-from-url/status'
                )
            })
        );

        const [call] = mockedFetchApi.mock.calls;
        const path = (call?.[0] as { path: string }).path;
        expect(path).toContain(`runId=${RUN_HANDLE.runId}`);
        expect(path).toContain(`datasetId=${RUN_HANDLE.datasetId}`);
        expect(path).toContain(`source=${RUN_HANDLE.source}`);
    });
});

describe('computeImportStatusRefetchInterval', () => {
    it('should keep polling (5s) when the run is not settled', () => {
        expect(computeImportStatusRefetchInterval(undefined)).toBe(5_000);
        expect(computeImportStatusRefetchInterval({ settled: false })).toBe(5_000);
    });

    it('should stop polling once the run has settled', () => {
        expect(
            computeImportStatusRefetchInterval({
                settled: true,
                failureCode: 'timeout'
            })
        ).toBe(false);
    });
});
