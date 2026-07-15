import { useCallback, useEffect, useRef, useState } from 'react';
import type { ListingBBox } from '@/components/maps/ListingMap.client';
import type { AccommodationCardData } from '@/data/types';
/**
 * @file useViewportSearch.ts
 * @description Connects the listing map's bbox events to a debounced search
 * (SPEC-097, US-06). Refetches accommodations when the user pans/zooms the
 * map; updates state in place so the map and the items list stay in sync
 * without a full page reload.
 *
 * Designed for islands that already render an SSR-prepared list of items —
 * the hook is initialised with that list and only switches to fetched results
 * after the first viewport change.
 */
import { accommodationsApi } from '@/lib/api/endpoints';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';
import { toAccommodationCardProps } from '@/lib/api/transforms';

const DEFAULT_DEBOUNCE_MS = 500;

interface UseViewportSearchInput {
    readonly initialItems: ReadonlyArray<AccommodationCardData>;
    readonly pageSize?: number;
    readonly extraParams?: Record<string, unknown>;
    readonly debounceMs?: number;
    readonly locale?: string;
    /**
     * HOS-186: when true, each refetch merges bookmark state into the new items
     * via a single bulk check before they reach the DOM. Guests never fetch.
     */
    readonly isAuthenticated?: boolean;
}

interface UseViewportSearchOutput {
    readonly items: ReadonlyArray<AccommodationCardData>;
    readonly isFetching: boolean;
    readonly onBoundsChange: (bbox: ListingBBox) => void;
}

/**
 * Resolves bookmark state for a freshly fetched page of cards with ONE bulk
 * request (HOS-186).
 *
 * `toAccommodationCardProps` leaves `isFavorited === undefined`, which is
 * exactly the condition that makes each `FavoriteButton` fire its own /check on
 * mount. Merging here — before the items are handed to `setItems` — means the
 * new cards never reach the DOM in that state, so the buttons mount already
 * hydrated and the N+1 never happens. Doing this in an effect after the render
 * would be too late: React runs child effects before parent ones, so every
 * button would already have fired.
 *
 * Degrades silently on failure: the un-merged items are returned and each
 * button falls back to its own /check, which is the safety net it exists for.
 */
async function mergeFavoriteState({
    items,
    isAuthenticated,
    signal
}: {
    readonly items: ReadonlyArray<AccommodationCardData>;
    readonly isAuthenticated: boolean;
    readonly signal: AbortSignal;
}): Promise<ReadonlyArray<AccommodationCardData>> {
    if (!isAuthenticated || items.length === 0) return items;
    try {
        const result = await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: items.map((item) => item.id)
        });
        if (signal.aborted || !result.ok) return items;
        const checks = result.data.checks;
        return items.map((item) => {
            const entry = checks[item.id];
            if (!entry) return item;
            return {
                ...item,
                isFavorited: entry.isBookmarked,
                favoriteBookmarkId: entry.bookmarkId
            };
        });
    } catch {
        return items;
    }
}

/**
 * Hook for refetching accommodations as the map viewport changes.
 *
 * The hook owns a small debounce timer and an in-flight AbortController so
 * rapid pan/zoom events don't pile up unfinished requests. Errors fall back to
 * keeping the current items list — never erase the map silently.
 */
export function useViewportSearch({
    initialItems,
    pageSize = 100,
    extraParams,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    locale = 'es',
    isAuthenticated = false
}: UseViewportSearchInput): UseViewportSearchOutput {
    const [items, setItems] = useState<ReadonlyArray<AccommodationCardData>>(initialItems);
    const [isFetching, setIsFetching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            abortRef.current?.abort();
        };
    }, []);

    const onBoundsChange = useCallback(
        (bbox: ListingBBox) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                abortRef.current?.abort();
                const ac = new AbortController();
                abortRef.current = ac;
                setIsFetching(true);
                try {
                    const result = await accommodationsApi.list({
                        ...extraParams,
                        pageSize,
                        bboxNorth: bbox.north,
                        bboxSouth: bbox.south,
                        bboxEast: bbox.east,
                        bboxWest: bbox.west
                    });
                    if (ac.signal.aborted) return;
                    if (result.ok) {
                        const next = result.data.items.map((item) =>
                            toAccommodationCardProps({
                                // TYPE-WORKAROUND: toAccommodationCardProps expects an opaque record because it accepts shapes from multiple endpoints; the search endpoint payload is structurally compatible.
                                item: item as unknown as Record<string, unknown>,
                                locale
                            })
                        );
                        const merged = await mergeFavoriteState({
                            items: next,
                            isAuthenticated,
                            signal: ac.signal
                        });
                        if (ac.signal.aborted) return;
                        setItems(merged);
                    }
                } finally {
                    if (!ac.signal.aborted) setIsFetching(false);
                }
            }, debounceMs);
        },
        [debounceMs, pageSize, extraParams, locale, isAuthenticated]
    );

    return { items, isFetching, onBoundsChange };
}
