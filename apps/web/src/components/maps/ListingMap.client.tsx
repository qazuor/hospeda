/**
 * @file ListingMap.client.tsx
 * @description Multi-marker map for listing pages (SPEC-097, US-06/US-07).
 *
 * - Mode `accommodation-list`: renders one privacy-aware Circle per item
 *   (max zoom 17 to keep the obfuscation effective).
 * - Mode `destination-list`: renders one Marker per item (destinations are
 *   public landmarks).
 *
 * Emits `onBoundsChange` (debounced 300ms) so the surrounding page can refetch
 * the listing with viewport bbox filters. Highlights an item visually when its
 * id matches `hoveredItemId` (used by sidebar hover sync).
 *
 * SPEC-098 T-044: AccommodationPopupContent renders a FavoriteButton in the
 * top-right corner of the thumbnail image when the item id is available.
 *
 * SPEC-269: Leaflet, react-leaflet, and react-leaflet-cluster are lazy-loaded
 * via React.lazy so they are NOT included in the eager island bundle. The full
 * implementation lives in `ListingMapInner.client.tsx`.
 */
import { Spinner } from '@/components/shared/feedback/Spinner';
import type { SupportedLocale } from '@/lib/i18n';
import { Suspense, lazy } from 'react';
import styles from './ListingMap.module.css';

// ---------------------------------------------------------------------------
// Types — exported so AccommodationsListingMap and ListingMapInner can share
// them without importing leaflet/react-leaflet. Defined here to keep them
// at the public boundary (this file) while the heavy implementation is async.
// ---------------------------------------------------------------------------

export interface ListingBBox {
    readonly north: number;
    readonly south: number;
    readonly east: number;
    readonly west: number;
}

export interface AccommodationListingItem {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly thumbnailUrl?: string;
    readonly priceLabel?: string;
    readonly typeLabel?: string;
    readonly cityName?: string;
    readonly summary?: string;
    readonly isFeatured?: boolean;
    /** Pre-localised "Destacado" / "Featured" label, only used when isFeatured. */
    readonly featuredLabel?: string;
    readonly averageRating?: number;
    readonly reviewsCount?: number;
    /** Pre-localised label like "12 reseñas" or "1 review". */
    readonly reviewsLabel?: string;
    readonly detailHref?: string;
    readonly approximateLocation: { lat: number; lng: number; radiusMeters: number };
    /**
     * SPEC-098 T-044: Whether the current user has already favorited this item.
     * Undefined for guests or when the bulk-check was not performed — the
     * FavoriteButton single-check fallback handles this on mount.
     */
    readonly isFavorited?: boolean;
    /**
     * SPEC-098 T-044: Bookmark id when the entity is already favorited.
     * Null when not favorited. Undefined when no bulk-check was performed.
     */
    readonly favoriteBookmarkId?: string | null;
    /**
     * SPEC-098 T-044: Total public count of users who bookmarked this
     * accommodation. Used by FavoriteButton's `compact` variant.
     */
    readonly bookmarkCount?: number;
}

export interface DestinationListingItem {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly thumbnailUrl?: string;
    readonly accommodationsCount?: number;
    /** Pre-localised label like "12 alojamientos". */
    readonly accommodationsLabel?: string;
    readonly description?: string;
    readonly detailHref?: string;
    readonly coordinates: { lat: number; lng: number };
}

interface ListingMapStrings {
    readonly attribution: string;
    readonly approximateDisclaimer: string;
    readonly viewDetails?: string;
}

interface BaseProps {
    readonly initialCenter: [number, number];
    readonly initialZoom?: number;
    /**
     * When provided, the map initializes with `fitBounds` over this rectangle
     * instead of `center + zoom`. Use it to frame all visible items on mount.
     * Tuple is `[[southLat, westLng], [northLat, eastLng]]` (Leaflet's
     * `LatLngBoundsExpression` corner order).
     */
    readonly initialBounds?: [[number, number], [number, number]];
    readonly hoveredItemId?: string | null;
    /**
     * Coords of the currently-pulsing item — passed as raw {lat, lng} so the
     * halo survives even when the user pans the map past the original item
     * and `useViewportSearch` drops it from the live result set. Driven by
     * the cards sidebar click on desktop.
     */
    readonly selectedCoord?: { readonly lat: number; readonly lng: number } | null;
    readonly onBoundsChange?: (bbox: ListingBBox) => void;
    readonly onMarkerClick?: (id: string) => void;
    readonly ariaLabel: string;
    readonly i18nStrings: ListingMapStrings;
    /**
     * SPEC-098 T-044: Whether the current visitor is authenticated.
     * Forwarded to FavoriteButton inside each accommodation popup.
     * Defaults to false (guest) when not provided.
     */
    readonly isAuthenticated?: boolean;
    /**
     * SPEC-098 T-044: Active locale forwarded to FavoriteButton for aria-labels
     * and i18n strings. Defaults to 'es'.
     */
    readonly locale?: SupportedLocale;
}

interface AccommodationProps extends BaseProps {
    readonly mode: 'accommodation-list';
    readonly items: ReadonlyArray<AccommodationListingItem>;
}

interface DestinationProps extends BaseProps {
    readonly mode: 'destination-list';
    readonly items: ReadonlyArray<DestinationListingItem>;
}

/** Public prop type for ListingMap (shared with ListingMapInner). */
export type ListingMapProps = AccommodationProps | DestinationProps;

// ---------------------------------------------------------------------------
// Lazy-loaded inner implementation (async chunk — loads Leaflet on demand)
// ---------------------------------------------------------------------------
const ListingMapInner = lazy(() =>
    import('./ListingMapInner.client').then((mod) => ({ default: mod.ListingMapInner }))
);

// ---------------------------------------------------------------------------
// Skeleton fallback — sized to match the map container dimensions so there
// is no Cumulative Layout Shift (CLS) while the Leaflet chunk loads.
// ---------------------------------------------------------------------------
function MapSkeleton() {
    return (
        <div
            className={`${styles.root} ${styles.skeleton}`}
            aria-hidden="true"
        >
            <Spinner
                size="lg"
                label="Cargando mapa…"
            />
        </div>
    );
}

/**
 * Multi-marker Leaflet map for listing pages.
 *
 * The inner Leaflet/react-leaflet/react-leaflet-cluster implementation is
 * async-chunked via React.lazy and rendered inside a Suspense boundary.
 * Call-sites keep using `<ListingMap client:only="react" ... />` unchanged.
 *
 * @param props - {@link ListingMapProps}
 */
export function ListingMap(props: ListingMapProps) {
    return (
        <Suspense fallback={<MapSkeleton />}>
            <ListingMapInner {...props} />
        </Suspense>
    );
}
