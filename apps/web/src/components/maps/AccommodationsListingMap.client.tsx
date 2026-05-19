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

import { resolveAmenityIcon } from '@/components/shared/cards/accommodation-card-icons';
import type { AccommodationCardData } from '@/data/types';
import { useViewportSearch } from '@/hooks/useViewportSearch';
import { getAccommodationTypeIcon } from '@/lib/accommodation-type-icons';
import type { SupportedLocale } from '@/lib/i18n';

import layoutStyles from './AccommodationsListingMap.module.css';
import { ListingMap } from './ListingMap.client';
import type { MapSidebarAmenity } from './MapCardsSidebar.client';
import { MapCardsSidebar } from './MapCardsSidebar.client';

/** Mirrors the AccommodationCard.astro constant. */
const MAX_AMENITIES = 4;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface SidebarI18n {
    readonly resultsHeading: string;
    /** Pluralised count templates with `{{count}}` placeholder — page resolves. */
    readonly resultsCountOne: string;
    readonly resultsCountOther: string;
    readonly emptyState: string;
    /**
     * Plain "View cards" label used inside the sheet header. Kept separate
     * from `openSheetCount*` so we can show a compact action label without
     * forcing the count when none is available.
     */
    readonly openSheet: string;
    /**
     * Pluralised templates with `{{count}}` for the floating sheet trigger
     * button. Renders as "Ver 100 resultados" / "View 1 result" so the user
     * always sees the result count on the CTA itself.
     */
    readonly openSheetCountOne: string;
    readonly openSheetCountOther: string;
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
    /**
     * Sidebar-only labels. Forwarded to each card in the cards sidebar so they
     * mirror the AccommodationCard look without the island knowing about i18n
     * or the colors module.
     */
    readonly newLabel?: string;
    readonly newBg?: string;
    readonly newText?: string;
    readonly featuredBg?: string;
    readonly featuredText?: string;
    readonly priceFromLabel?: string;
    readonly pricePerNightLabel?: string;
    readonly priceConsultLabel?: string;
    readonly ctaLabel?: string;
    readonly amenitiesLabel?: string;
    /** Pre-pluralised "9 fotos" / "1 foto" / "8 photos" per accommodation id. */
    readonly photosLabelById?: Record<string, string>;
    /** Locale-formatted price label per id (e.g. "$15.500" instead of
     * "15500 ARS"). Built on the page via `formatPrice` so the island stays
     * locale-agnostic. */
    readonly priceLabelById?: Record<string, string>;
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
    newLabel,
    newBg,
    newText,
    featuredBg,
    featuredText,
    priceFromLabel,
    pricePerNightLabel,
    priceConsultLabel,
    ctaLabel,
    amenitiesLabel,
    photosLabelById,
    priceLabelById,
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

    /*
     * Coords of the card the user clicked in the sidebar (desktop only).
     * Stored as raw {lat, lng} — NOT looked up by id — so the pulse halo
     * survives even when the user pans/zooms the map past the original
     * item and `useViewportSearch` drops it from the live result set.
     * We intentionally do NOT move/zoom the map; the live results keep
     * reacting to the user's viewport as before.
     *
     * The actual `handleCardSelect` is defined below `mapItems` so it can
     * read coords from the current item list.
     */
    const [selectedCoord, setSelectedCoord] = useState<{
        readonly lat: number;
        readonly lng: number;
    } | null>(null);

    /*
     * Compute the bounding box of all initial items so the map opens framed
     * around every accommodation in the current result set. We only consider
     * the SSR-provided `initialItems` (not the live `items` from viewport
     * search) so the initial framing is deterministic — after that, panning
     * is driven by the user, not by refetches.
     */
    const initialBounds = useMemo<[[number, number], [number, number]] | undefined>(() => {
        let minLat = Number.POSITIVE_INFINITY;
        let maxLat = Number.NEGATIVE_INFINITY;
        let minLng = Number.POSITIVE_INFINITY;
        let maxLng = Number.NEGATIVE_INFINITY;
        let count = 0;
        for (const item of initialItems) {
            const loc = item.approximateLocation;
            if (!loc) continue;
            if (loc.lat < minLat) minLat = loc.lat;
            if (loc.lat > maxLat) maxLat = loc.lat;
            if (loc.lng < minLng) minLng = loc.lng;
            if (loc.lng > maxLng) maxLng = loc.lng;
            count++;
        }
        if (count === 0) return undefined;
        return [
            [minLat, minLng],
            [maxLat, maxLng]
        ];
    }, [initialItems]);

    const mapItems = useMemo(
        () =>
            items
                .filter((card) => card.approximateLocation)
                .map((card) => {
                    const amenitySource = card.amenities ?? [];
                    const amenities: ReadonlyArray<MapSidebarAmenity> = amenitySource
                        .slice(0, MAX_AMENITIES)
                        .map((a) => ({
                            id: a.key ?? a.label,
                            label: a.label,
                            Icon: resolveAmenityIcon(a)
                        }));
                    const extraAmenitiesCount = Math.max(0, amenitySource.length - MAX_AMENITIES);
                    const isNew = card.createdAt
                        ? Date.now() - new Date(card.createdAt).getTime() < THIRTY_DAYS_MS
                        : false;
                    return {
                        id: card.id,
                        slug: card.slug,
                        name: card.name,
                        thumbnailUrl: card.featuredImage.url,
                        priceLabel:
                            priceLabelById?.[card.id] ??
                            (card.price?.amount != null && card.price?.currency
                                ? `${card.price.amount} ${card.price.currency}`
                                : undefined),
                        typeLabel: typeLabels?.[card.type] ?? card.type,
                        TypeIcon: getAccommodationTypeIcon({
                            type: card.type.toLowerCase()
                        }),
                        cityName: card.cityName,
                        summary: card.summary,
                        isFeatured: card.isFeatured,
                        featuredLabel: card.isFeatured ? featuredLabel : undefined,
                        featuredBg,
                        featuredText,
                        isNew,
                        newLabel: isNew ? newLabel : undefined,
                        newBg,
                        newText,
                        priceFromLabel,
                        pricePerNightLabel,
                        priceConsultLabel,
                        ctaLabel,
                        amenities,
                        extraAmenitiesCount,
                        amenitiesLabel,
                        photoCount: card.photoCount,
                        photosLabel: photosLabelById?.[card.id],
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
                    };
                }),
        [
            items,
            typeLabels,
            detailHrefById,
            featuredLabel,
            featuredBg,
            featuredText,
            newLabel,
            newBg,
            newText,
            priceFromLabel,
            pricePerNightLabel,
            priceConsultLabel,
            ctaLabel,
            amenitiesLabel,
            photosLabelById,
            priceLabelById
        ]
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

    const handleCardSelect = useCallback(
        (id: string) => {
            const match = mapItems.find((it) => it.id === id);
            if (!match) return;
            setSelectedCoord({
                lat: match.approximateLocation.lat,
                lng: match.approximateLocation.lng
            });
        },
        [mapItems]
    );

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

    const openSheetCountFn = useCallback(
        (n: number) => {
            const tpl =
                n === 1
                    ? (sidebarI18n?.openSheetCountOne ?? 'Ver {{count}} resultado')
                    : (sidebarI18n?.openSheetCountOther ?? 'Ver {{count}} resultados');
            return tpl.replace('{{count}}', String(n)).replace('{count}', String(n));
        },
        [sidebarI18n?.openSheetCountOne, sidebarI18n?.openSheetCountOther]
    );

    if (!showSidebar || !sidebarI18n) {
        return (
            <ListingMap
                mode="accommodation-list"
                items={itemsWithLabels}
                initialCenter={initialCenter}
                initialZoom={initialZoom}
                initialBounds={initialBounds}
                hoveredItemId={hoveredItemId}
                selectedCoord={selectedCoord}
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
                    initialBounds={initialBounds}
                    hoveredItemId={hoveredItemId}
                    selectedCoord={selectedCoord}
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
                    onCardSelect={handleCardSelect}
                    locale={locale}
                    isAuthenticated={isAuthenticated}
                    i18n={{
                        resultsHeading: sidebarI18n.resultsHeading,
                        resultsCount: sidebarCountFn,
                        emptyState: sidebarI18n.emptyState,
                        openSheet: sidebarI18n.openSheet,
                        openSheetCount: openSheetCountFn,
                        closeSheet: sidebarI18n.closeSheet
                    }}
                />
            </div>
        </div>
    );
}
