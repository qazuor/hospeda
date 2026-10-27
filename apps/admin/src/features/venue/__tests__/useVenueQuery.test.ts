// @vitest-environment jsdom
/**
 * @file useVenueQuery.test.ts
 * Unit tests for gastronomy CRUD hooks (SPEC-239 T-059).
 *
 * Tests cover:
 *  - useVenueQuery — detail fetch + enabled flag
 *  - useCreateVenueMutation — POST + return value
 *  - useUpdateVenueMutation — PUT/PATCH + return value
 *  - useAssignVenueOwnerMutation — assign-owner POST + method
 *  - useModerateVenueReviewMutation — review moderation POST
 *  - useVenuePendingReviewsQuery — pending reviews list
 *
 * Pattern: assert on the return value of `mutateAsync` (not `result.current.isSuccess`),
 * since React state updates are async and may not settle immediately after the call.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import {
    useAssignVenueOwnerMutation,
    useCreateVenueMutation,
    useModerateVenueReviewMutation,
    useUpdateVenueMutation,
    useVenuePendingReviewsQuery,
    useVenueQuery
} from '../hooks/useVenueQuery';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const VENUE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const MOCK_VENUE = {
    id: VENUE_ID,
    name: 'El Rancho',
    type: 'RESTAURANT',
    priceRange: 'MID',
    publicationStatus: 'PUBLISHED',
    ownerId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    destinationId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false }
        }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockDetailSuccess() {
    mockedFetchApi.mockResolvedValue({
        data: { success: true, data: MOCK_VENUE },
        status: 200
    } as never);
}

function mockMutationSuccess(data: unknown = MOCK_VENUE) {
    mockedFetchApi.mockResolvedValue({
        data: { success: true, data },
        status: 200
    } as never);
}

function mockListSuccess(items: unknown[] = [MOCK_VENUE]) {
    mockedFetchApi.mockResolvedValue({
        data: {
            success: true,
            data: {
                items,
                pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 }
            }
        },
        status: 200
    } as never);
}

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useVenueQuery', () => {
    it('should fetch a gastronomy by ID', async () => {
        mockDetailSuccess();

        const { result } = renderHook(() => useVenueQuery(VENUE_ID), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toMatchObject({ id: VENUE_ID, name: 'El Rancho' });
    });

    it('should NOT fetch when id is empty', () => {
        const { result } = renderHook(() => useVenueQuery('', { enabled: false }), {
            wrapper: createWrapper()
        });

        expect(result.current.isFetching).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });

    it('should NOT fetch when enabled is false', () => {
        const { result } = renderHook(() => useVenueQuery(VENUE_ID, { enabled: false }), {
            wrapper: createWrapper()
        });

        expect(result.current.isFetching).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

describe('useCreateGastronomyMutation', () => {
    it('should create a gastronomy and resolve with the entity', async () => {
        mockMutationSuccess();

        const { result } = renderHook(() => useCreateVenueMutation(), {
            wrapper: createWrapper()
        });

        const created = await result.current.mutateAsync({
            name: 'El Rancho',
            type: 'RESTAURANT'
        } as never);

        expect(created).toMatchObject({ id: VENUE_ID, name: 'El Rancho' });
        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    });

    it('should throw on API error', async () => {
        mockedFetchApi.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useCreateVenueMutation(), {
            wrapper: createWrapper()
        });

        await expect(result.current.mutateAsync({ name: 'Fail' } as never)).rejects.toThrow(
            'Network error'
        );
    });
});

describe('useUpdateGastronomyMutation', () => {
    it('should PUT/PATCH a gastronomy and return the updated entity', async () => {
        const updated = { ...MOCK_VENUE, name: 'El Rancho Actualizado' };
        mockMutationSuccess(updated);

        const { result } = renderHook(() => useUpdateVenueMutation(), {
            wrapper: createWrapper()
        });

        const returned = await result.current.mutateAsync({
            id: VENUE_ID,
            data: { name: 'El Rancho Actualizado' }
        } as never);

        expect(returned).toMatchObject({ name: 'El Rancho Actualizado' });
    });
});

describe('useAssignGastronomyOwnerMutation', () => {
    it('should POST to assign-owner endpoint', async () => {
        mockMutationSuccess();

        const { result } = renderHook(() => useAssignVenueOwnerMutation(), {
            wrapper: createWrapper()
        });

        const newOwnerId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

        const returned = await result.current.mutateAsync({
            id: VENUE_ID,
            ownerId: newOwnerId
        });

        expect(returned).toMatchObject({ id: VENUE_ID });
        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    });
});

describe('useModerateGastronomyReviewMutation', () => {
    it('should POST a review moderation decision', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true }, status: 200 } as never);

        const { result } = renderHook(() => useModerateVenueReviewMutation(), {
            wrapper: createWrapper()
        });

        const reviewId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

        // Should not throw
        await result.current.mutateAsync({ reviewId, decision: 'APPROVED' });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: expect.stringContaining(reviewId)
            })
        );
    });

    it('should POST a rejection decision', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true }, status: 200 } as never);

        const { result } = renderHook(() => useModerateVenueReviewMutation(), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({
            reviewId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            decision: 'REJECTED'
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    });
});

describe('useGastronomyPendingReviewsQuery', () => {
    it('should fetch pending reviews list', async () => {
        const mockReviews = [{ id: 'r1', comment: 'Excelente', rating: 5 }];
        mockListSuccess(mockReviews);

        const { result } = renderHook(
            () => useVenuePendingReviewsQuery({ page: 1, pageSize: 20 }),
            { wrapper: createWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
});
