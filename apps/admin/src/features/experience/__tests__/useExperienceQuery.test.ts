// @vitest-environment jsdom
/**
 * @file useExperienceQuery.test.ts
 * Unit tests for experience CRUD hooks (SPEC-240 T-031).
 *
 * Tests cover:
 *  - useExperienceQuery — detail fetch + enabled flag
 *  - useCreateExperienceMutation — POST + return value
 *  - useUpdateExperienceMutation — PUT/PATCH + return value
 *  - useDeleteExperienceMutation — DELETE + return value
 *  - useRestoreExperienceMutation — restore POST + return value
 *  - useAssignExperienceOwnerMutation — assign-owner POST + method
 *  - useModerateExperienceReviewMutation — review moderation POST
 *  - useExperiencePendingReviewsQuery — pending reviews list
 *
 * Pattern: assert on the return value of `mutateAsync` (not `result.current.isSuccess`),
 * since React state updates are async and may not settle immediately after the call.
 */

import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    useAssignExperienceOwnerMutation,
    useCreateExperienceMutation,
    useDeleteExperienceMutation,
    useExperiencePendingReviewsQuery,
    useExperienceQuery,
    useModerateExperienceReviewMutation,
    useRestoreExperienceMutation,
    useUpdateExperienceMutation
} from '../hooks/useExperienceQuery';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

const EXPERIENCE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const MOCK_EXPERIENCE = {
    id: EXPERIENCE_ID,
    name: 'Paseo en kayak',
    type: 'KAYAK_RENTAL',
    priceFrom: 0,
    priceUnit: 'per_hour',
    isPriceOnRequest: false,
    hasActiveSubscription: true,
    lifecycleState: 'ACTIVE',
    moderationState: 'APPROVED',
    isFeatured: false,
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
        data: { success: true, data: MOCK_EXPERIENCE },
        status: 200
    } as never);
}

function mockMutationSuccess(data: unknown = MOCK_EXPERIENCE) {
    mockedFetchApi.mockResolvedValue({
        data: { success: true, data },
        status: 200
    } as never);
}

function mockListSuccess(items: unknown[] = [MOCK_EXPERIENCE]) {
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

describe('useExperienceQuery', () => {
    it('should fetch an experience by ID', async () => {
        mockDetailSuccess();

        const { result } = renderHook(() => useExperienceQuery(EXPERIENCE_ID), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toMatchObject({ id: EXPERIENCE_ID, name: 'Paseo en kayak' });
    });

    it('should NOT fetch when enabled is false', () => {
        const { result } = renderHook(() => useExperienceQuery(EXPERIENCE_ID, { enabled: false }), {
            wrapper: createWrapper()
        });

        expect(result.current.isFetching).toBe(false);
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

describe('useCreateExperienceMutation', () => {
    it('should create an experience and resolve with the entity', async () => {
        mockMutationSuccess();

        const { result } = renderHook(() => useCreateExperienceMutation(), {
            wrapper: createWrapper()
        });

        const created = await result.current.mutateAsync({
            name: 'Paseo en kayak',
            type: 'KAYAK_RENTAL'
        } as never);

        expect(created).toMatchObject({ id: EXPERIENCE_ID, name: 'Paseo en kayak' });
        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    });

    it('should throw on API error', async () => {
        mockedFetchApi.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useCreateExperienceMutation(), {
            wrapper: createWrapper()
        });

        await expect(result.current.mutateAsync({ name: 'Fail' } as never)).rejects.toThrow(
            'Network error'
        );
    });
});

describe('useUpdateExperienceMutation', () => {
    it('should PUT/PATCH an experience and return the updated entity', async () => {
        const updated = { ...MOCK_EXPERIENCE, name: 'Paseo en kayak actualizado' };
        mockMutationSuccess(updated);

        const { result } = renderHook(() => useUpdateExperienceMutation(), {
            wrapper: createWrapper()
        });

        const returned = await result.current.mutateAsync({
            id: EXPERIENCE_ID,
            data: { name: 'Paseo en kayak actualizado' }
        } as never);

        expect(returned).toMatchObject({ name: 'Paseo en kayak actualizado' });
    });
});

describe('useDeleteExperienceMutation', () => {
    it('should DELETE an experience by ID', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true }, status: 200 } as never);

        const { result } = renderHook(() => useDeleteExperienceMutation(), {
            wrapper: createWrapper()
        });

        const returnedId = await result.current.mutateAsync(EXPERIENCE_ID);

        expect(returnedId).toBe(EXPERIENCE_ID);
        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE' }));
    });
});

describe('useRestoreExperienceMutation', () => {
    it('should restore a soft-deleted experience', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true }, status: 200 } as never);

        const { result } = renderHook(() => useRestoreExperienceMutation(), {
            wrapper: createWrapper()
        });

        const returnedId = await result.current.mutateAsync(EXPERIENCE_ID);

        expect(returnedId).toBe(EXPERIENCE_ID);
        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    });
});

describe('useAssignExperienceOwnerMutation', () => {
    it('should POST to assign-owner endpoint', async () => {
        mockMutationSuccess();

        const { result } = renderHook(() => useAssignExperienceOwnerMutation(), {
            wrapper: createWrapper()
        });

        const newOwnerId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

        const returned = await result.current.mutateAsync({
            id: EXPERIENCE_ID,
            ownerId: newOwnerId
        });

        expect(returned).toMatchObject({ id: EXPERIENCE_ID });
        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    });
});

describe('useModerateExperienceReviewMutation', () => {
    it('should POST a review moderation decision (APPROVED)', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true }, status: 200 } as never);

        const { result } = renderHook(() => useModerateExperienceReviewMutation(), {
            wrapper: createWrapper()
        });

        const reviewId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

        await result.current.mutateAsync({ reviewId, decision: 'APPROVED' });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: expect.stringContaining(reviewId)
            })
        );
    });

    it('should POST a rejection decision (REJECTED)', async () => {
        mockedFetchApi.mockResolvedValue({ data: { success: true }, status: 200 } as never);

        const { result } = renderHook(() => useModerateExperienceReviewMutation(), {
            wrapper: createWrapper()
        });

        await result.current.mutateAsync({
            reviewId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            decision: 'REJECTED'
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
    });
});

describe('useExperiencePendingReviewsQuery', () => {
    it('should fetch pending reviews list', async () => {
        const mockReviews = [{ id: 'r1', comment: 'Excelente paseo', rating: 5 }];
        mockListSuccess(mockReviews);

        const { result } = renderHook(
            () => useExperiencePendingReviewsQuery({ page: 1, pageSize: 20 }),
            { wrapper: createWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should return empty items when no reviews pending', async () => {
        mockListSuccess([]);

        const { result } = renderHook(
            () => useExperiencePendingReviewsQuery({ page: 1, pageSize: 20 }),
            { wrapper: createWrapper() }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.items).toHaveLength(0);
    });
});
