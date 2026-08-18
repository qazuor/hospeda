// @vitest-environment jsdom
/**
 * Tests for useAccommodationMedia hooks (SPEC-204).
 *
 * Mirrors the useFaqs test pattern:
 *   - Mock fetchApi at module level
 *   - Wrap hooks in a fresh QueryClientProvider with retries disabled
 *   - Assert: correct path/method/body sent to fetchApi
 *   - Assert: list query invalidated on mutation success
 *   - Assert: correct data returned from response envelope
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { accommodationQueryKeys } from '../accommodationQueryKeys';
import {
    accommodationMediaQueryKeys,
    useAccommodationMediaAdd,
    useAccommodationMediaList,
    useAccommodationMediaRemove,
    useAccommodationMediaSetFeatured
} from '../useAccommodationMedia';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockedFetchApi = vi.mocked(fetchApi);

/** Builds a minimal valid AccommodationMedia fixture. */
function makeMedia(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'media-1',
        accommodationId: 'acc-1',
        url: 'https://example.com/photo.jpg',
        moderationState: 'APPROVED',
        state: 'visible',
        isFeatured: false,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides
    };
}

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
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
// useAccommodationMediaList
// ---------------------------------------------------------------------------

describe('useAccommodationMediaList — response envelope parsing', () => {
    it('calls GET with ?state=visible and unwraps data.media array', async () => {
        const items = [makeMedia({ id: 'media-1' }), makeMedia({ id: 'media-2' })];
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { media: items } },
            status: 200
        });

        const { result } = renderHook(() => useAccommodationMediaList('acc-1'), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/accommodations/acc-1/media?state=visible'
            })
        );
        expect(Array.isArray(result.current.data)).toBe(true);
        expect(result.current.data).toHaveLength(2);
    });

    it('returns an empty array when data.media is absent', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: {} },
            status: 200
        });

        const { result } = renderHook(() => useAccommodationMediaList('acc-1'), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data).toEqual([]);
    });

    it('is disabled when accommodationId is empty', () => {
        const { result } = renderHook(() => useAccommodationMediaList(''), {
            wrapper: createWrapper()
        });

        // Query should not fire (enabled: false) — stays idle
        expect(result.current.fetchStatus).toBe('idle');
        expect(mockedFetchApi).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// useAccommodationMediaAdd
// ---------------------------------------------------------------------------

describe('useAccommodationMediaAdd', () => {
    it('POSTs to the media endpoint and returns the created row', async () => {
        const newRow = makeMedia({ id: 'new-1', url: 'https://example.com/new.jpg' });
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { media: newRow } },
            status: 201
        });

        const { result } = renderHook(() => useAccommodationMediaAdd('acc-1'), {
            wrapper: createWrapper()
        });

        const created = await result.current.mutateAsync({
            url: 'https://example.com/new.jpg',
            publicId: 'hospeda/dev/new-1',
            moderationState: ModerationStatusEnum.APPROVED
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/accommodations/acc-1/media',
                method: 'POST',
                body: expect.objectContaining({ url: 'https://example.com/new.jpg' })
            })
        );
        expect(created.id).toBe('new-1');
    });

    it('throws when response envelope is missing data.media', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: {} },
            status: 201
        });

        const { result } = renderHook(() => useAccommodationMediaAdd('acc-1'), {
            wrapper: createWrapper()
        });

        await expect(
            result.current.mutateAsync({ url: 'https://example.com/x.jpg' })
        ).rejects.toThrow('addMedia response');
    });

    it('invalidates the list query on success', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { media: makeMedia() } },
            status: 201
        });

        const wrapper = ({ children }: { readonly children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children);

        const { result } = renderHook(() => useAccommodationMediaAdd('acc-1'), { wrapper });

        await act(async () => {
            await result.current.mutateAsync({ url: 'https://example.com/x.jpg' });
        });

        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: accommodationMediaQueryKeys.list('acc-1')
            })
        );
    });
});

// ---------------------------------------------------------------------------
// useAccommodationMediaRemove
// ---------------------------------------------------------------------------

describe('useAccommodationMediaRemove', () => {
    it('calls DELETE on the correct endpoint and invalidates list', async () => {
        mockedFetchApi.mockResolvedValue({ data: {}, status: 200 });

        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        const wrapper = ({ children }: { readonly children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children);

        const { result } = renderHook(() => useAccommodationMediaRemove('acc-1'), { wrapper });

        await act(async () => {
            await result.current.mutateAsync({ mediaId: 'media-42' });
        });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/accommodations/acc-1/media/media-42',
                method: 'DELETE'
            })
        );
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: accommodationMediaQueryKeys.list('acc-1')
            })
        );
    });
});

// ---------------------------------------------------------------------------
// useAccommodationMediaSetFeatured
// ---------------------------------------------------------------------------

describe('useAccommodationMediaSetFeatured', () => {
    it('PUTs to /featured endpoint and returns the updated row', async () => {
        const updatedRow = makeMedia({ id: 'media-7', isFeatured: true });
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { media: updatedRow } },
            status: 200
        });

        const { result } = renderHook(() => useAccommodationMediaSetFeatured('acc-1'), {
            wrapper: createWrapper()
        });

        const returned = await result.current.mutateAsync({ mediaId: 'media-7' });

        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/accommodations/acc-1/media/media-7/featured',
                method: 'PUT'
            })
        );
        expect(returned.isFeatured).toBe(true);
    });

    it('throws when response envelope is missing data.media', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: {} },
            status: 200
        });

        const { result } = renderHook(() => useAccommodationMediaSetFeatured('acc-1'), {
            wrapper: createWrapper()
        });

        await expect(result.current.mutateAsync({ mediaId: 'media-7' })).rejects.toThrow(
            'setFeatured response'
        );
    });

    it('invalidates the list query on success', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { media: makeMedia({ isFeatured: true }) } },
            status: 200
        });

        const wrapper = ({ children }: { readonly children: React.ReactNode }) =>
            React.createElement(QueryClientProvider, { client: queryClient }, children);

        const { result } = renderHook(() => useAccommodationMediaSetFeatured('acc-1'), {
            wrapper
        });

        await act(async () => {
            await result.current.mutateAsync({ mediaId: 'media-1' });
        });

        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: accommodationMediaQueryKeys.list('acc-1')
            })
        );
    });
});

// ---------------------------------------------------------------------------
// HOS-389 §3 — the cached ENTITY must be invalidated too
// ---------------------------------------------------------------------------

describe('gallery mutations invalidate the cached accommodation (HOS-389 §3)', () => {
    /**
     * Before this fix each mutation invalidated only the media list, so the edit
     * page kept rendering the stale entity — whose server-composed `media`
     * object feeds the quality score — and reported "no cover" right after a
     * cover was uploaded, until some unrelated refetch happened to refresh it.
     */
    const ACCOMMODATION_ID = 'acc-1';

    let queryClient: QueryClient;
    let invalidateSpy: ReturnType<typeof vi.spyOn>;

    function wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    }

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        });
        invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    });

    it('add invalidates the accommodation detail as well as the media list', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { media: makeMedia() } },
            status: 201
        });

        const { result } = renderHook(() => useAccommodationMediaAdd(ACCOMMODATION_ID), {
            wrapper
        });

        await act(async () => {
            await result.current.mutateAsync({
                url: 'https://example.com/x.jpg',
                publicId: 'x'
            } as never);
        });

        // The resolved key, not the helper: this is what proves the media hook
        // and the entity hook agree on where the cached entity lives.
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: accommodationQueryKeys.detail(ACCOMMODATION_ID)
            })
        );
        // An addition, not a swap — the list must still be invalidated.
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: accommodationMediaQueryKeys.list(ACCOMMODATION_ID)
            })
        );
        expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });

    it('set-featured invalidates the accommodation detail', async () => {
        // The loudest case: promoting a cover is exactly when the page's
        // "no cover" signal has to stop being true.
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: { media: makeMedia() } },
            status: 200
        });

        const { result } = renderHook(() => useAccommodationMediaSetFeatured(ACCOMMODATION_ID), {
            wrapper
        });

        await act(async () => {
            await result.current.mutateAsync({ mediaId: 'media-1' } as never);
        });

        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: accommodationQueryKeys.detail(ACCOMMODATION_ID)
            })
        );
    });
});
