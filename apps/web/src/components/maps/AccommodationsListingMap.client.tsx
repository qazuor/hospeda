/**
 * @file AccommodationsListingMap.client.tsx
 * @description Hydrated wrapper that combines `ListingMap` with the
 * `useViewportSearch` hook (SPEC-097, US-06). The Astro page hands over the
 * SSR-rendered list of accommodation cards as `initialItems`; from there on
 * the wrapper handles refetching as the map viewport changes.
 *
 * Pages cannot pass callbacks to islands directly (Astro only serializes
 * data), so this island composes the hook + the ListingMap entirely on the
 * client side.
 */
import { useMemo } from 'react';

import type { AccommodationCardData } from '@/data/types';
import { useViewportSearch } from '@/hooks/useViewportSearch';

import { ListingMap } from './ListingMap.client';

interface AccommodationsListingMapProps {
    readonly initialItems: ReadonlyArray<AccommodationCardData>;
    readonly initialCenter: [number, number];
    readonly initialZoom?: number;
    readonly ariaLabel: string;
    readonly i18nStrings: {
        readonly attribution: string;
        readonly approximateDisclaimer: string;
    };
    readonly extraSearchParams?: Record<string, unknown>;
}

export function AccommodationsListingMap({
    initialItems,
    initialCenter,
    initialZoom,
    ariaLabel,
    i18nStrings,
    extraSearchParams
}: AccommodationsListingMapProps) {
    const { items, onBoundsChange } = useViewportSearch({
        initialItems,
        pageSize: 50,
        extraParams: extraSearchParams
    });

    const mapItems = useMemo(
        () =>
            items
                .filter((card) => card.approximateLocation)
                .map((card) => ({
                    id: card.id,
                    slug: card.slug,
                    name: card.name,
                    thumbnailUrl: card.featuredImage.url,
                    priceLabel: card.price
                        ? `${card.price.amount} ${card.price.currency}`
                        : undefined,
                    approximateLocation: card.approximateLocation as {
                        lat: number;
                        lng: number;
                        radiusMeters: number;
                    }
                })),
        [items]
    );

    return (
        <ListingMap
            mode="accommodation-list"
            items={mapItems}
            initialCenter={initialCenter}
            initialZoom={initialZoom}
            onBoundsChange={onBoundsChange}
            ariaLabel={ariaLabel}
            i18nStrings={i18nStrings}
        />
    );
}
