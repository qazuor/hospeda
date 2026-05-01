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
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';

import styles from './ListingMap.module.css';

L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl.src ?? iconRetinaUrl,
    iconUrl: iconUrl.src ?? iconUrl,
    shadowUrl: iconShadowUrl.src ?? iconShadowUrl
});

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
    readonly hoveredItemId?: string | null;
    readonly onBoundsChange?: (bbox: ListingBBox) => void;
    readonly onMarkerClick?: (id: string) => void;
    readonly ariaLabel: string;
    readonly i18nStrings: ListingMapStrings;
}

interface AccommodationProps extends BaseProps {
    readonly mode: 'accommodation-list';
    readonly items: ReadonlyArray<AccommodationListingItem>;
}

interface DestinationProps extends BaseProps {
    readonly mode: 'destination-list';
    readonly items: ReadonlyArray<DestinationListingItem>;
}

export type ListingMapProps = AccommodationProps | DestinationProps;

const ACCOMMODATION_MAX_ZOOM = 17;
const DESTINATION_MAX_ZOOM = 19;
const DEFAULT_BOUNDS_DEBOUNCE_MS = 300;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function BoundsReporter({
    onBoundsChange,
    debounceMs
}: {
    onBoundsChange?: (bbox: ListingBBox) => void;
    debounceMs: number;
}) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const emit = useCallback(
        (bbox: ListingBBox) => {
            if (!onBoundsChange) return;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => onBoundsChange(bbox), debounceMs);
        },
        [onBoundsChange, debounceMs]
    );

    const map = useMapEvents({
        moveend: () => {
            const b = map.getBounds();
            emit({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest()
            });
        },
        zoomend: () => {
            const b = map.getBounds();
            emit({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest()
            });
        }
    });

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return null;
}

export function ListingMap(props: ListingMapProps) {
    const {
        initialCenter,
        initialZoom = 8,
        hoveredItemId,
        onBoundsChange,
        onMarkerClick,
        ariaLabel,
        i18nStrings
    } = props;

    const isAccommodationMode = props.mode === 'accommodation-list';
    const maxZoom = isAccommodationMode ? ACCOMMODATION_MAX_ZOOM : DESTINATION_MAX_ZOOM;

    const accentColor = 'var(--accent, #f59e0b)';
    const highlightColor = 'var(--primary, #2563eb)';

    const renderedMarkers = useMemo(() => {
        if (isAccommodationMode) {
            return props.items.map((item) => {
                const isHovered = hoveredItemId === item.id;
                return (
                    <Circle
                        key={item.id}
                        center={[item.approximateLocation.lat, item.approximateLocation.lng]}
                        radius={item.approximateLocation.radiusMeters}
                        pathOptions={{
                            color: isHovered ? highlightColor : accentColor,
                            fillColor: isHovered ? highlightColor : accentColor,
                            fillOpacity: isHovered ? 0.35 : 0.18,
                            weight: isHovered ? 3 : 2
                        }}
                        eventHandlers={{
                            click: () => onMarkerClick?.(item.id)
                        }}
                    >
                        <Popup
                            className={styles.popup}
                            maxWidth={300}
                            minWidth={280}
                            autoPanPadding={[40, 40]}
                        >
                            <AccommodationPopupContent
                                item={item}
                                viewDetailsLabel={i18nStrings.viewDetails}
                            />
                        </Popup>
                    </Circle>
                );
            });
        }
        return props.items.map((item) => (
            <Marker
                key={item.id}
                position={[item.coordinates.lat, item.coordinates.lng]}
                eventHandlers={{
                    click: () => onMarkerClick?.(item.id)
                }}
            >
                <Popup
                    className={styles.popup}
                    maxWidth={300}
                    minWidth={280}
                    autoPanPadding={[40, 40]}
                >
                    <DestinationPopupContent
                        item={item}
                        viewDetailsLabel={i18nStrings.viewDetails}
                    />
                </Popup>
            </Marker>
        ));
    }, [props.items, isAccommodationMode, hoveredItemId, onMarkerClick, i18nStrings]);

    return (
        <div
            className={styles.root}
            aria-label={ariaLabel}
            role="img"
        >
            <MapContainer
                center={initialCenter}
                zoom={initialZoom}
                maxZoom={maxZoom}
                scrollWheelZoom
                className={styles.container}
            >
                <TileLayer
                    attribution={i18nStrings.attribution}
                    url={TILE_URL}
                    maxZoom={maxZoom}
                />
                <BoundsReporter
                    onBoundsChange={onBoundsChange}
                    debounceMs={DEFAULT_BOUNDS_DEBOUNCE_MS}
                />
                <MarkerClusterGroup chunkedLoading>{renderedMarkers}</MarkerClusterGroup>
            </MapContainer>
            {isAccommodationMode && (
                <p className={styles.disclaimer}>{i18nStrings.approximateDisclaimer}</p>
            )}
        </div>
    );
}

function AccommodationPopupContent({
    item,
    viewDetailsLabel
}: {
    item: AccommodationListingItem;
    viewDetailsLabel?: string;
}) {
    const hasRating =
        typeof item.averageRating === 'number' &&
        item.averageRating > 0 &&
        typeof item.reviewsCount === 'number' &&
        item.reviewsCount > 0;
    return (
        <div className={styles.popupCard}>
            {item.thumbnailUrl ? (
                <div className={styles.popupImageWrapper}>
                    <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className={styles.popupImage}
                        loading="lazy"
                    />
                    {item.typeLabel ? (
                        <span className={styles.popupTypeChip}>{item.typeLabel}</span>
                    ) : null}
                </div>
            ) : null}
            <div className={styles.popupBody}>
                <div className={styles.popupTitleRow}>
                    <h3 className={styles.popupTitle}>{item.name}</h3>
                    {item.isFeatured && item.featuredLabel ? (
                        <span className={styles.popupFeaturedBadge}>{item.featuredLabel}</span>
                    ) : null}
                </div>
                {item.cityName ? <p className={styles.popupCity}>{item.cityName}</p> : null}
                {item.summary ? <p className={styles.popupSummary}>{item.summary}</p> : null}
                <div className={styles.popupMeta}>
                    {hasRating ? (
                        <span
                            className={styles.popupRating}
                            aria-label={`${item.averageRating?.toFixed(1)} estrellas`}
                        >
                            <span aria-hidden="true">★</span>
                            <span>{item.averageRating?.toFixed(1)}</span>
                            <span className={styles.popupReviewsCount}>
                                {item.reviewsLabel ?? `(${item.reviewsCount})`}
                            </span>
                        </span>
                    ) : null}
                    {item.priceLabel ? (
                        <span className={styles.popupPrice}>{item.priceLabel}</span>
                    ) : null}
                </div>
                {item.detailHref ? (
                    <a
                        href={item.detailHref}
                        className={styles.popupCta}
                    >
                        {viewDetailsLabel ?? 'Ver más'}
                    </a>
                ) : null}
            </div>
        </div>
    );
}

function DestinationPopupContent({
    item,
    viewDetailsLabel
}: {
    item: DestinationListingItem;
    viewDetailsLabel?: string;
}) {
    return (
        <div className={styles.popupCard}>
            {item.thumbnailUrl ? (
                <div className={styles.popupImageWrapper}>
                    <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className={styles.popupImage}
                        loading="lazy"
                    />
                </div>
            ) : null}
            <div className={styles.popupBody}>
                <h3 className={styles.popupTitle}>{item.name}</h3>
                {item.description ? <p className={styles.popupCity}>{item.description}</p> : null}
                {item.accommodationsLabel ? (
                    <p className={styles.popupCount}>{item.accommodationsLabel}</p>
                ) : typeof item.accommodationsCount === 'number' ? (
                    <p className={styles.popupCount}>
                        {`${item.accommodationsCount} alojamientos`}
                    </p>
                ) : null}
                {item.detailHref ? (
                    <a
                        href={item.detailHref}
                        className={styles.popupCta}
                    >
                        {viewDetailsLabel ?? 'Ver más'}
                    </a>
                ) : null}
            </div>
        </div>
    );
}
