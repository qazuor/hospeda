/**
 * @file useViewportSearch.test.tsx
 * @description Verifies the SPEC-097 listing-map refetch hook: debounce
 * coalesces rapid bbox events, the API call is dispatched with the four bbox
 * params, and items are replaced with the transformed response on success.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const accommodationsListMock = vi.fn();
vi.mock('@/lib/api/endpoints', () => ({
    accommodationsApi: {
        list: (...args: unknown[]) => accommodationsListMock(...args)
    }
}));

const transformMock = vi.fn();
vi.mock('@/lib/api/transforms', () => ({
    toAccommodationCardProps: (...args: unknown[]) => transformMock(...args)
}));

const checkBulkMock = vi.fn();
vi.mock('@/lib/api/endpoints-protected', () => ({
    userBookmarksApi: {
        checkBulk: (...args: unknown[]) => checkBulkMock(...args)
    }
}));

import { useViewportSearch } from '@/hooks/useViewportSearch';

const initialItems = [{ id: 'a', slug: 'a', name: 'A', featuredImage: { url: '/a.jpg' } } as never];

const bbox = { north: 0, south: -1, east: 1, west: -1 };

describe('useViewportSearch', () => {
    it('starts with the SSR initialItems', () => {
        accommodationsListMock.mockReset();
        transformMock.mockReset();

        const { result } = renderHook(() => useViewportSearch({ initialItems }));
        expect(result.current.items).toEqual(initialItems);
    });

    it('debounces rapid onBoundsChange events into a single fetch', async () => {
        accommodationsListMock.mockReset();
        transformMock.mockReset();
        accommodationsListMock.mockResolvedValue({
            ok: true,
            data: { items: [{ id: 'b' }, { id: 'c' }] }
        });
        transformMock.mockImplementation(({ item }) => ({
            id: (item as { id: string }).id,
            slug: 's',
            name: 'n',
            featuredImage: { url: '' }
        }));

        const { result } = renderHook(() => useViewportSearch({ initialItems, debounceMs: 50 }));

        act(() => {
            result.current.onBoundsChange(bbox);
            result.current.onBoundsChange(bbox);
            result.current.onBoundsChange(bbox);
        });

        await waitFor(() => expect(accommodationsListMock).toHaveBeenCalledTimes(1));
        const callArgs = accommodationsListMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArgs).toMatchObject({
            bboxNorth: 0,
            bboxSouth: -1,
            bboxEast: 1,
            bboxWest: -1
        });
    });

    it('replaces items with transformed response on success', async () => {
        accommodationsListMock.mockReset();
        transformMock.mockReset();
        accommodationsListMock.mockResolvedValue({
            ok: true,
            data: { items: [{ id: 'b' }, { id: 'c' }] }
        });
        transformMock.mockImplementation(({ item }) => ({
            id: (item as { id: string }).id,
            slug: 's',
            name: 'n',
            featuredImage: { url: '' }
        }));

        const { result } = renderHook(() => useViewportSearch({ initialItems, debounceMs: 10 }));

        act(() => {
            result.current.onBoundsChange(bbox);
        });

        await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
    });

    it('forwards extraParams (active filters) alongside the bbox on every refetch (BETA-166)', async () => {
        // Regression: the map view refetches on every moveend/zoomend
        // (including the initial FitBoundsOnce mount), and previously sent
        // ONLY the bbox + pageSize — silently dropping the active listing
        // filters (types, minGuests, etc.) a few hundred ms after load.
        accommodationsListMock.mockReset();
        transformMock.mockReset();
        accommodationsListMock.mockResolvedValue({
            ok: true,
            data: { items: [] }
        });

        const extraParams = { types: 'CABIN', minGuests: 4 };
        const { result } = renderHook(() =>
            useViewportSearch({ initialItems, debounceMs: 10, extraParams })
        );

        act(() => {
            result.current.onBoundsChange(bbox);
        });

        await waitFor(() => expect(accommodationsListMock).toHaveBeenCalledTimes(1));
        const callArgs = accommodationsListMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArgs).toMatchObject({
            types: 'CABIN',
            minGuests: 4,
            bboxNorth: 0,
            bboxSouth: -1,
            bboxEast: 1,
            bboxWest: -1
        });
    });

    describe('bookmark bulk hydration on refetch (HOS-186)', () => {
        /** Arranges a successful list response returning cards `b` and `c`. */
        function arrangeListResponse(): void {
            accommodationsListMock.mockReset();
            transformMock.mockReset();
            checkBulkMock.mockReset();
            accommodationsListMock.mockResolvedValue({
                ok: true,
                data: { items: [{ id: 'b' }, { id: 'c' }] }
            });
            transformMock.mockImplementation(({ item }) => ({
                id: (item as { id: string }).id,
                slug: 's',
                name: 'n',
                featuredImage: { url: '' }
            }));
        }

        it('merges bookmark state into refetched items with ONE bulk call', async () => {
            // Regression: the map refetches on every moveend/zoomend (including
            // the initial FitBoundsOnce mount) and used to hand back items with
            // `isFavorited === undefined` — the exact condition that makes each
            // FavoriteButton fire its own /check, i.e. ~100 requests in ~2s.
            arrangeListResponse();
            checkBulkMock.mockResolvedValue({
                ok: true,
                data: {
                    checks: {
                        b: { isBookmarked: true, bookmarkId: 'bm-b' },
                        c: { isBookmarked: false, bookmarkId: null }
                    }
                }
            });

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10, isAuthenticated: true })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
            expect(checkBulkMock).toHaveBeenCalledTimes(1);
            expect(checkBulkMock).toHaveBeenCalledWith({
                entityType: 'ACCOMMODATION',
                entityIds: ['b', 'c']
            });
        });

        it('never exposes items with undefined isFavorited to the DOM (the N+1 trigger)', async () => {
            // The merge must happen BEFORE setItems: a FavoriteButton that
            // mounts with isFavorited === undefined self-hydrates, and React
            // runs child effects before parent ones, so a post-render merge
            // would be too late.
            arrangeListResponse();
            checkBulkMock.mockResolvedValue({
                ok: true,
                data: {
                    checks: {
                        b: { isBookmarked: true, bookmarkId: 'bm-b' },
                        c: { isBookmarked: false, bookmarkId: null }
                    }
                }
            });

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10, isAuthenticated: true })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
            for (const item of result.current.items) {
                expect(item.isFavorited).toBeTypeOf('boolean');
            }
            expect(result.current.items[0]?.isFavorited).toBe(true);
            expect(result.current.items[0]?.favoriteBookmarkId).toBe('bm-b');
            expect(result.current.items[1]?.isFavorited).toBe(false);
        });

        it('does not call checkBulk for guests', async () => {
            arrangeListResponse();

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10, isAuthenticated: false })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
            expect(checkBulkMock).not.toHaveBeenCalled();
        });

        it('still shows refetched items when the bulk check fails (silent degrade)', async () => {
            // Falling back to per-card self-hydration is the safety net; an
            // empty map would be far worse than N extra checks.
            arrangeListResponse();
            checkBulkMock.mockResolvedValue({ ok: false, error: { message: 'boom' } });

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10, isAuthenticated: true })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
        });

        it('still shows refetched items when the bulk check throws', async () => {
            arrangeListResponse();
            checkBulkMock.mockRejectedValue(new Error('network'));

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10, isAuthenticated: true })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
        });

        it('skips the bulk call when the refetch returns no items', async () => {
            accommodationsListMock.mockReset();
            transformMock.mockReset();
            checkBulkMock.mockReset();
            accommodationsListMock.mockResolvedValue({ ok: true, data: { items: [] } });

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10, isAuthenticated: true })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items).toEqual([]));
            expect(checkBulkMock).not.toHaveBeenCalled();
        });
    });

    it('keeps current items when API returns ok=false', async () => {
        accommodationsListMock.mockReset();
        transformMock.mockReset();
        accommodationsListMock.mockResolvedValue({ ok: false, error: { message: 'x' } });

        const { result } = renderHook(() => useViewportSearch({ initialItems, debounceMs: 10 }));

        act(() => {
            result.current.onBoundsChange(bbox);
        });

        await waitFor(() => expect(accommodationsListMock).toHaveBeenCalled());
        expect(result.current.items).toEqual(initialItems);
    });
});
