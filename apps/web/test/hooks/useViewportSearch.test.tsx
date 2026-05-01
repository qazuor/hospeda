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
