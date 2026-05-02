/**
 * @file AccommodationsListingMap.client.tsx
 * @description Hydrated wrapper that combines `ListingMap` with the
 * `useViewportSearch` hook (SPEC-097, US-06). The Astro page hands over the
 * SSR-rendered list of accommodation cards as `initialItems`; from there on
 * the wrapper handles refetching as the map viewport changes.
 *
 * When `showSidebar` is true, also renders a `MapCardsSidebar` on the right
 * (desktop) or as a bottom sheet (mobile), with marker↔card hover sync.
 *
 * Pages cannot pass callbacks to islands directly (Astro only serializes
 * data), so this island composes the hook + the ListingMap entirely on the
 * client side.
 */
import { useCallback, useMemo, useState } from 'react';

import type { AccommodationCardData } from '@/data/types';
import { useViewportSearch } from '@/hooks/useViewportSearch';
import type { SupportedLocale } from '@/lib/i18n';

import layoutStyles from './AccommodationsListingMap.module.css';
import { ListingMap } from './ListingMap.client';
import { MapCardsSidebar } from './MapCardsSidebar.client';

interface SidebarI18n {
    readonly resultsHeading: string;
    /** Pluralised count templates with `{{count}}` placeholder — page resolves. */
    readonly resultsCountOne: string;
    readonly resultsCountOther: string;
    readonly emptyState: string;
    readonly openSheet: string;
    readonly closeSheet: string;
}

interface AccommodationsListingMapProps {
    readonly initialItems: ReadonlyArray<AccommodationCardData>;
    readonly initialCenter: [number, number];
    readonly initialZoom?: number;
    readonly ariaLabel: string;
    readonly i18nStrings: {
        readonly attribution: string;
        readonly approximateDisclaimer: string;
        readonly viewDetails?: string;
    };
    /**
     * Localised label for the type chip on each popup, keyed by the API's
     * `type` slug (e.g. `{ HOTEL: 'Hotel', CABIN: 'Cabaña' }`). Resolved on
     * the page side so the island stays i18n-agnostic.
     */
    readonly typeLabels?: Record<string, string>;
    /**
     * Pre-built localised URL for each accommodation's detail page, keyed by
     * accommodation id. Built on the Astro page using `buildUrl()` so the
     * island doesn't need locale-aware routing logic.
     */
    readonly detailHrefById?: Record<string, string>;
    /**
     * Pre-formatted "X reseñas" label per accommodation id. Built on the page
     * via `tPlural()` so we can ship plural rules from `@repo/i18n` without
     * serializing functions across the island boundary.
     */
    readonly reviewsLabelById?: Record<string, string>;
    /** Localised "Destacado" / "Featured" badge used on featured cards. */
    readonly featuredLabel?: string;
    /** When true, render the cards sidebar (desktop) and bottom sheet (mobile). */
    readonly showSidebar?: boolean;
    readonly sidebarI18n?: SidebarI18n;
    readonly extraSearchParams?: Record<string, unknown>;
    /**
     * SPEC-098 T-044: Whether the current visitor is authenticated.
     * Forwarded to each accommodation popup's FavoriteButton.
     * Defaults to false (guest) when not provided.
     */
    readonly isAuthenticated?: boolean;
    /**
     * SPEC-098 T-044: Active locale forwarded to FavoriteButton for aria-labels.
     * Defaults to 'es'.
     */
    readonly locale?: SupportedLocale;
}

export function AccommodationsListingMap({
    initialItems,
    initialCenter,
    initialZoom,
    ariaLabel,
    i18nStrings,
    typeLabels,
    detailHrefById,
    reviewsLabelById,
    featuredLabel,
    showSidebar = false,
    sidebarI18n,
    extraSearchParams,
    isAuthenticated = false,
    locale = 'es'
}: AccommodationsListingMapProps) {
    const { items, onBoundsChange } = useViewportSearch({
        initialItems,
        pageSize: 100,
        extraParams: extraSearchParams
    });

    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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
                    typeLabel: typeLabels?.[card.type] ?? card.type,
                    cityName: card.cityName,
                    summary: card.summary,
                    isFeatured: card.isFeatured,
                    featuredLabel: card.isFeatured ? featuredLabel : undefined,
                    averageRating: card.averageRating,
                    reviewsCount: card.reviewsCount,
                    detailHref: detailHrefById?.[card.id],
                    approximateLocation: card.approximateLocation as {
                        lat: number;
                        lng: number;
                        radiusMeters: number;
                    },
                    // SPEC-098 T-044: forward bookmark state for popup FavoriteButton
                    isFavorited: card.isFavorited,
                    favoriteBookmarkId: card.favoriteBookmarkId ?? null,
                    bookmarkCount: card.bookmarkCount
                })),
        [items, typeLabels, detailHrefById, featuredLabel]
    );

    const itemsWithLabels = useMemo(
        () =>
            mapItems.map((it) => ({
                ...it,
                reviewsLabel: reviewsLabelById?.[it.id]
            })),
        [mapItems, reviewsLabelById]
    );

    const onMarkerClick = useCallback((id: string) => setHoveredItemId(id), []);

    const sidebarCountFn = useCallback(
        (n: number) => {
            const tpl =
                n === 1
                    ? (sidebarI18n?.resultsCountOne ?? '{{count}} resultado')
                    : (sidebarI18n?.resultsCountOther ?? '{{count}} resultados');
            return tpl.replace('{{count}}', String(n)).replace('{count}', String(n));
        },
        [sidebarI18n?.resultsCountOne, sidebarI18n?.resultsCountOther]
    );

    if (!showSidebar || !sidebarI18n) {
        return (
            <ListingMap
                mode="accommodation-list"
                items={itemsWithLabels}
                initialCenter={initialCenter}
                initialZoom={initialZoom}
                hoveredItemId={hoveredItemId}
                onMarkerClick={onMarkerClick}
                onBoundsChange={onBoundsChange}
                ariaLabel={ariaLabel}
                i18nStrings={i18nStrings}
                isAuthenticated={isAuthenticated}
                locale={locale}
            />
        );
    }

    return (
        <div className={layoutStyles.split}>
            <div className={layoutStyles.mapPane}>
                <ListingMap
                    mode="accommodation-list"
                    items={itemsWithLabels}
                    initialCenter={initialCenter}
                    initialZoom={initialZoom}
                    hoveredItemId={hoveredItemId}
                    onMarkerClick={onMarkerClick}
                    onBoundsChange={onBoundsChange}
                    ariaLabel={ariaLabel}
                    i18nStrings={i18nStrings}
                    isAuthenticated={isAuthenticated}
                    locale={locale}
                />
            </div>
            <div className={layoutStyles.sidebarPane}>
                <MapCardsSidebar
                    items={itemsWithLabels}
                    hoveredItemId={hoveredItemId}
                    onCardHover={setHoveredItemId}
                    i18n={{
                        resultsHeading: sidebarI18n.resultsHeading,
                        resultsCount: sidebarCountFn,
                        emptyState: sidebarI18n.emptyState,
                        openSheet: sidebarI18n.openSheet,
                        closeSheet: sidebarI18n.closeSheet
                    }}
                />
            </div>
        </div>
    );
}
