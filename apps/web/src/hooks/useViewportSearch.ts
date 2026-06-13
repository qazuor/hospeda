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
import { toAccommodationCardProps } from '@/lib/api/transforms';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ListingBBox } from '@/components/maps/ListingMap.client';

const DEFAULT_DEBOUNCE_MS = 500;

interface UseViewportSearchInput {
    readonly initialItems: ReadonlyArray<AccommodationCardData>;
    readonly pageSize?: number;
    readonly extraParams?: Record<string, unknown>;
    readonly debounceMs?: number;
    readonly locale?: string;
}

interface UseViewportSearchOutput {
    readonly items: ReadonlyArray<AccommodationCardData>;
    readonly isFetching: boolean;
    readonly onBoundsChange: (bbox: ListingBBox) => void;
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
    locale = 'es'
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
                        setItems(next);
                    }
                } finally {
                    if (!ac.signal.aborted) setIsFetching(false);
                }
            }, debounceMs);
        },
        [debounceMs, pageSize, extraParams, locale]
    );

    return { items, isFetching, onBoundsChange };
}
