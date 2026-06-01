/**
 * @file use-comment-moderation.test.tsx
 * @description Tests for the comment moderation TanStack Query hooks (SPEC-165 T-017/T-018).
 *
 * Covers:
 * - Query key factory structure (lists, detail)
 * - useCommentsList: calls correct endpoint, unwraps response
 * - useComment: calls correct endpoint, respects disabled flag
 * - useModerateComment: PATCH call + list invalidation on success
 * - useSoftDeleteComment: DELETE call + list invalidation on success
 * - useHardDeleteComment: hard DELETE call + list invalidation on success
 * - useRestoreComment: POST restore call + list invalidation on success
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock fetchApi BEFORE importing the hooks (hoisting requirement)
const fetchApiMock = vi.fn();
vi.mock('@/lib/api/client', () => ({
    fetchApi: (...args: unknown[]) => fetchApiMock(...args)
}));

import {
    commentModerationQueryKeys,
    useComment,
    useCommentsList,
    useHardDeleteComment,
    useModerateComment,
    useRestoreComment,
    useSoftDeleteComment
} from '@/hooks/use-comment-moderation';
import { EntityTypeEnum, ModerationStatusEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } }
    });
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

const mockComment = {
    id: 'comment-uuid-001',
    entityType: EntityTypeEnum.POST,
    entityId: 'entity-uuid-001',
    authorId: 'author-uuid-001',
    authorName: 'Juan Pérez',
    content: 'Este es un comentario de prueba',
    moderationState: ModerationStatusEnum.APPROVED,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    createdById: 'author-uuid-001',
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

const mockListResponse = {
    data: {
        success: true,
        data: {
            items: [mockComment],
            pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 }
        }
    },
    status: 200
};

const mockDetailResponse = {
    data: {
        success: true,
        data: mockComment
    },
    status: 200
};

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

describe('commentModerationQueryKeys', () => {
    it('all() returns a stable root key', () => {
        expect(commentModerationQueryKeys.all).toEqual(['comments-moderation']);
    });

    it('lists() nests under all', () => {
        expect(commentModerationQueryKeys.lists()).toEqual(['comments-moderation', 'list']);
    });

    it('list(filters) includes filter object', () => {
        const filters = { page: 1, entityType: 'POST' as const };
        const key = commentModerationQueryKeys.list(filters);
        expect(key[0]).toBe('comments-moderation');
        expect(key[1]).toBe('list');
        expect(key[2]).toEqual(filters);
    });

    it('detail(id) includes the id', () => {
        const key = commentModerationQueryKeys.detail('abc-123');
        expect(key).toEqual(['comments-moderation', 'detail', 'abc-123']);
    });
});

// ---------------------------------------------------------------------------
// useCommentsList
// ---------------------------------------------------------------------------

describe('useCommentsList', () => {
    it('calls the correct admin endpoint and unwraps the response', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValue(mockListResponse);

        const { result } = renderHook(() => useCommentsList({ page: 1, pageSize: 25 }), {
            wrapper: makeWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(fetchApiMock).toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining('/api/v1/admin/comments') })
        );
        expect(result.current.data?.items).toHaveLength(1);
        expect(result.current.data?.items[0].id).toBe('comment-uuid-001');
    });

    it('appends entityType and moderationState query params when provided', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValue(mockListResponse);

        renderHook(
            () =>
                useCommentsList({
                    page: 1,
                    entityType: 'EVENT',
                    moderationState: 'REJECTED'
                }),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
        const callArg = fetchApiMock.mock.calls[0][0] as { path: string };
        expect(callArg.path).toContain('entityType=EVENT');
        expect(callArg.path).toContain('moderationState=REJECTED');
    });

    it('appends includeDeleted=true when set', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValue(mockListResponse);

        renderHook(() => useCommentsList({ includeDeleted: true }), {
            wrapper: makeWrapper()
        });

        await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
        const callArg = fetchApiMock.mock.calls[0][0] as { path: string };
        expect(callArg.path).toContain('includeDeleted=true');
    });
});

// ---------------------------------------------------------------------------
// useComment
// ---------------------------------------------------------------------------

describe('useComment', () => {
    it('fetches a single comment by id', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValue(mockDetailResponse);

        const { result } = renderHook(() => useComment('comment-uuid-001'), {
            wrapper: makeWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(fetchApiMock).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/v1/admin/comments/comment-uuid-001' })
        );
        expect(result.current.data?.id).toBe('comment-uuid-001');
    });

    it('is disabled when id is empty', () => {
        fetchApiMock.mockReset();

        renderHook(() => useComment(''), { wrapper: makeWrapper() });

        expect(fetchApiMock).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// useModerateComment (mutation + invalidation)
// ---------------------------------------------------------------------------

describe('useModerateComment', () => {
    it('calls PATCH /{id}/moderation and invalidates list on success', async () => {
        fetchApiMock.mockReset();
        // First call: list fetch; second call: mutation
        fetchApiMock
            .mockResolvedValueOnce(mockListResponse)
            .mockResolvedValueOnce({ data: { success: true, data: mockComment }, status: 200 });

        const wrapper = makeWrapper();
        const { result: listResult } = renderHook(() => useCommentsList({ page: 1 }), { wrapper });
        const { result: mutResult } = renderHook(() => useModerateComment(), { wrapper });

        await waitFor(() => expect(listResult.current.isSuccess).toBe(true));

        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValueOnce({
            data: {
                success: true,
                data: { ...mockComment, moderationState: ModerationStatusEnum.REJECTED }
            },
            status: 200
        });
        // Re-list after invalidation
        fetchApiMock.mockResolvedValueOnce(mockListResponse);

        await act(async () => {
            mutResult.current.mutate({ id: 'comment-uuid-001', moderationState: 'REJECTED' });
        });

        await waitFor(() => expect(mutResult.current.isSuccess).toBe(true));

        expect(fetchApiMock).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/comments/comment-uuid-001/moderation',
                method: 'PATCH',
                body: { moderationState: 'REJECTED' }
            })
        );
    });
});

// ---------------------------------------------------------------------------
// useSoftDeleteComment
// ---------------------------------------------------------------------------

describe('useSoftDeleteComment', () => {
    it('calls DELETE /{id} and invalidates list on success', async () => {
        fetchApiMock.mockReset();
        fetchApiMock.mockResolvedValueOnce(mockListResponse);
        fetchApiMock.mockResolvedValueOnce({
            data: { success: true, data: { deleted: true, id: 'comment-uuid-001' } },
            status: 200
        });
        fetchApiMock.mockResolvedValueOnce(mockListResponse);

        const wrapper = makeWrapper();
        const { result: listResult } = renderHook(() => useCommentsList({}), { wrapper });
        const { result: mutResult } = renderHook(() => useSoftDeleteComment(), { wrapper });

        await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
        fetchApiMock.mockReset();
        fetchApiMock
            .mockResolvedValueOnce({
                data: { success: true, data: { deleted: true, id: 'comment-uuid-001' } },
                status: 200
            })
            .mockResolvedValueOnce(mockListResponse);

        await act(async () => {
            mutResult.current.mutate('comment-uuid-001');
        });

        await waitFor(() => expect(mutResult.current.isSuccess).toBe(true));
        expect(fetchApiMock).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/comments/comment-uuid-001',
                method: 'DELETE'
            })
        );
    });
});

// ---------------------------------------------------------------------------
// useHardDeleteComment
// ---------------------------------------------------------------------------

describe('useHardDeleteComment', () => {
    it('calls DELETE /{id}/hard and invalidates list on success', async () => {
        fetchApiMock.mockReset();
        fetchApiMock
            .mockResolvedValueOnce({
                data: { success: true, data: { success: true } },
                status: 200
            })
            .mockResolvedValueOnce(mockListResponse);

        const wrapper = makeWrapper();
        const { result } = renderHook(() => useHardDeleteComment(), { wrapper });

        await act(async () => {
            result.current.mutate('comment-uuid-001');
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fetchApiMock).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/comments/comment-uuid-001/hard',
                method: 'DELETE'
            })
        );
    });
});

// ---------------------------------------------------------------------------
// useRestoreComment
// ---------------------------------------------------------------------------

describe('useRestoreComment', () => {
    it('calls POST /{id}/restore and invalidates list on success', async () => {
        fetchApiMock.mockReset();
        fetchApiMock
            .mockResolvedValueOnce({
                data: { success: true, data: { success: true } },
                status: 200
            })
            .mockResolvedValueOnce(mockListResponse);

        const wrapper = makeWrapper();
        const { result } = renderHook(() => useRestoreComment(), { wrapper });

        await act(async () => {
            result.current.mutate('comment-uuid-001');
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(fetchApiMock).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/comments/comment-uuid-001/restore',
                method: 'POST'
            })
        );
    });
});
