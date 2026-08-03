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

    describe('no client-side favorite merge on refetch (HOS-186 removed, HOS-369 WB0-5)', () => {
        // HOS-186's `mergeFavoriteState` + the `isAuthenticated` input were
        // deleted outright: FavoriteButton now resolves its own favorite state
        // from the shared `favorites-store` (one bulk check per page load), so
        // this hook has nothing left to merge and no reason to know who is
        // looking. The tests below replace the old "merges bookmark state /
        // does not call checkBulk for guests / degrades on bulk-check failure"
        // coverage, which asserted behavior of a function that no longer exists.

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

        it('no longer accepts isAuthenticated — removed from useViewportSearch input (HOS-369 WB0-5)', () => {
            // Assert — this only typechecks if the field is gone. If a future
            // change resurrects it, `@ts-expect-error` starts reporting an
            // unused-directive error and typecheck fails.
            // @ts-expect-error — isAuthenticated was removed; favorite state is resolved by FavoriteButton via the shared store, not merged here.
            const input: Parameters<typeof useViewportSearch>[0] = {
                initialItems,
                isAuthenticated: true
            };
            expect(input.initialItems).toBe(initialItems);
        });

        it('never calls checkBulk on refetch — favorite state is resolved by FavoriteButton itself', async () => {
            arrangeListResponse();

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10 })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
            expect(checkBulkMock).not.toHaveBeenCalled();
        });

        it('passes refetched items through unmodified — no favorite-state merge happens here', async () => {
            arrangeListResponse();

            const { result } = renderHook(() =>
                useViewportSearch({ initialItems, debounceMs: 10 })
            );

            act(() => {
                result.current.onBoundsChange(bbox);
            });

            await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['b', 'c']));
            for (const item of result.current.items) {
                expect(item.isFavorited).toBeUndefined();
            }
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
