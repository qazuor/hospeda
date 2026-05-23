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
 */
import 'leaflet/dist/leaflet.css';

import { StarIcon } from '@repo/icons';
import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { type ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Circle,
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    useMap,
    useMapEvents
} from 'react-leaflet';
import ReactLeafletClusterImport from 'react-leaflet-cluster';

// CJS/ESM interop guard.
// `react-leaflet-cluster@2.1.0` ships as CJS with the component exposed as
// `module.exports.default`. With Vite + React 19, the default import resolves
// to the wrapper object `{ default: Component }` instead of the component
// itself, causing React to throw at hydration time:
//   "Element type is invalid ... got: object. Check the render method of
//    `ListingMap`."
// Unwrap defensively: prefer `.default` when present, fall back to the import
// when the bundler already unwrapped it.
// TYPE-WORKAROUND: react-leaflet-cluster ships CJS exporting the component on `module.exports.default`; Vite+React 19 may resolve the default import to the wrapper `{ default: Component }` instead of the component, so we peek at `.default` defensively and the cast tells TS the wrapper shape exists at runtime.
const MarkerClusterGroup = ((
    ReactLeafletClusterImport as unknown as {
        default?: typeof ReactLeafletClusterImport;
    }
).default ?? ReactLeafletClusterImport) as typeof ReactLeafletClusterImport;

import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import type { SupportedLocale } from '@/lib/i18n';
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

export type ListingMapProps = AccommodationProps | DestinationProps;

const ACCOMMODATION_MAX_ZOOM = 17;
const DESTINATION_MAX_ZOOM = 19;
const DEFAULT_BOUNDS_DEBOUNCE_MS = 300;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Escapes HTML-significant characters before we inject accommodation
 * names + prices into a Leaflet divIcon `html` string. Names come from the
 * API and could in theory contain `<`, `>`, `&` or quotes.
 */
function escapeHtmlForPill(text: string): string {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

/**
 * Decorative pulsing halo rendered on top of the item the user picked from
 * the cards sidebar. Two stacked CircleMarkers: a steady center dot in
 * brand-accent and an outer ring that scales/fades via a CSS keyframe. The
 * halo doesn't change the map viewport — it just calls the user's eye to
 * the right spot while the rest of the listing keeps reacting to pans.
 */
const PULSE_PANE = 'pulseHaloPane';

function PulseHalo({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
        // Dedicated pane stacked above markerPane (600) and cluster icons,
        // so the pulse always renders above the clusters at the same spot.
        let pane = map.getPane(PULSE_PANE);
        if (!pane) {
            pane = map.createPane(PULSE_PANE);
            pane.style.zIndex = '660';
            pane.style.pointerEvents = 'none';
        }
        // We use a divIcon (HTML + CSS) instead of CircleMarker because
        // CircleMarker renders as a generic <path d="...">, and SVG `r`
        // can't be tweened from CSS while `transform: scale` on a path
        // doesn't pivot reliably across browsers. HTML elements animate
        // predictably and let us layer a steady center dot under an
        // expanding ring with full CSS control.
        const icon = L.divIcon({
            className: styles.pulseIcon,
            html: `
              <span class="${styles.pulseRing}" aria-hidden="true"></span>
              <span class="${styles.pulseRing} ${styles.pulseRingDelayed}" aria-hidden="true"></span>
              <span class="${styles.pulseCore}" aria-hidden="true"></span>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });
        const marker = L.marker([lat, lng], {
            icon,
            pane: PULSE_PANE,
            interactive: false,
            keyboard: false,
            zIndexOffset: 1000
        }).addTo(map);
        return () => {
            marker.remove();
        };
    }, [map, lat, lng]);
    return null;
}

/**
 * Mount-only `map.fitBounds(...)` to frame all initial items in view. Runs
 * once on first paint; subsequent pans/zooms are controlled by the user.
 * `useMap` here grabs the Leaflet instance owned by the parent MapContainer.
 */
function FitBoundsOnce({
    bounds,
    maxZoom
}: {
    bounds: [[number, number], [number, number]];
    maxZoom: number;
}) {
    const map = useMap();
    const appliedRef = useRef(false);
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only; we deliberately use the bounds/map/maxZoom captured at first render and never re-fit on prop changes (the user controls panning after mount)
    useEffect(() => {
        if (appliedRef.current) return;
        appliedRef.current = true;
        // The container's height changes between mount and the moment the
        // mobile-fullscreen script publishes --wave-bar-compact, so Leaflet's
        // cached container size is stale and leaves tiles missing. Force it
        // to remeasure before applying bounds.
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [40, 40], maxZoom });

        // Also re-invalidate whenever the container resizes (e.g. mobile
        // browser chrome collapsing on scroll, orientation change). Leaflet
        // otherwise won't request the tiles for the newly revealed area and
        // leaves a gray gap.
        const container = map.getContainer();
        const ro = new ResizeObserver(() => map.invalidateSize());
        ro.observe(container);
        return () => ro.disconnect();
    }, []);
    return null;
}

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
        initialBounds,
        hoveredItemId,
        selectedCoord,
        onBoundsChange,
        onMarkerClick,
        ariaLabel,
        i18nStrings,
        isAuthenticated = false,
        locale = 'es'
    } = props;

    const isAccommodationMode = props.mode === 'accommodation-list';
    const maxZoom = isAccommodationMode ? ACCOMMODATION_MAX_ZOOM : DESTINATION_MAX_ZOOM;

    // selectedCoord is passed directly from the parent (the cards sidebar
    // resolves the coord at click time so the halo survives even when the
    // item leaves the live result set during pan/zoom).

    const accentColor = 'var(--brand-accent)';
    const highlightColor = 'var(--primary, #2563eb)';

    /*
     * For accommodations we split rendering into two layers, only one of
     * which is fed into MarkerClusterGroup:
     *
     *   - `accommodationCircles` (NOT clustered): the semi-transparent
     *     privacy Circle for each item. These render directly under the
     *     cluster group so they remain anchored to the actual coord
     *     regardless of clustering decisions.
     *   - `clusterableMarkers` (CLUSTERED): the pill Markers. The cluster
     *     decides when to fold a group of pills into a single counter icon.
     *
     * Why split: MarkerClusterGroup counts every layer it receives as
     * cluster-eligible and groups any two layers whose pixel distance is
     * < maxClusterRadius. If we send Circle + Marker for the same item,
     * both sit at the exact same lat/lng (pixel distance 0), so the
     * library always groups them into a cluster of count >= 2 — at any
     * zoom — and we never reach "1 item, no cluster". Pulling Circles out
     * of the group makes the cluster count match the actual item count.
     *
     * Destination mode keeps the simpler single-Marker-per-item layout.
     *
     * --- Stable-element cache (cluster flicker mitigation) ---
     * `useViewportSearch` re-fetches and re-replaces the items array on
     * every pan/zoom; the new array is a brand-new JS reference, so a
     * naive iteration would produce brand-new React elements (and brand-new
     * L.divIcon instances) for accommodations that didn't actually change.
     * MarkerClusterGroup sees the new children, tears the existing
     * Leaflet markers off the map, and adds new ones — that's what the
     * user sees as a "flicker" while paneando.
     *
     * To prevent that, we keep a `cacheRef` keyed by item id. On every
     * render we compute a signature for each item from the fields that
     * actually affect the rendered marker; if the cached signature
     * matches we reuse the same `<Circle>` and `<Marker>` element
     * references, and React (and react-leaflet-cluster) treat them as
     * unchanged. Entries for items that fell out of the result set are
     * pruned at the end of each pass.
     */
    const accommodationCacheRef = useRef<
        Map<string, { signature: string; circle: ReactElement; marker: ReactElement }>
    >(new Map());
    const destinationCacheRef = useRef<Map<string, { signature: string; marker: ReactElement }>>(
        new Map()
    );

    const { clusterableMarkers, accommodationCircles } = useMemo(() => {
        if (isAccommodationMode) {
            const cache = accommodationCacheRef.current;
            const seenIds = new Set<string>();
            const markers: ReactElement[] = [];
            const circles: ReactElement[] = [];
            for (const item of props.items) {
                seenIds.add(item.id);
                const isHovered = hoveredItemId === item.id;
                const priceLabel = item.priceLabel?.trim();
                /*
                 * Signature: every field that, if changed, should rebuild
                 * the Circle+Marker pair (position, label text, hover state,
                 * favorite state, popup body content). Locale/auth gates
                 * apply globally and are already part of the outer
                 * useMemo deps, so they're not re-checked per item.
                 */
                const signature = [
                    isHovered ? '1' : '0',
                    item.name,
                    priceLabel ?? '',
                    item.approximateLocation.lat,
                    item.approximateLocation.lng,
                    item.approximateLocation.radiusMeters,
                    item.typeLabel ?? '',
                    item.cityName ?? '',
                    item.summary ?? '',
                    item.isFeatured ? '1' : '0',
                    item.featuredLabel ?? '',
                    item.averageRating ?? '',
                    item.reviewsCount ?? '',
                    item.reviewsLabel ?? '',
                    item.detailHref ?? '',
                    item.isFavorited ? '1' : '0',
                    item.favoriteBookmarkId ?? '',
                    item.bookmarkCount ?? ''
                ].join('|');

                const cached = cache.get(item.id);
                if (cached && cached.signature === signature) {
                    circles.push(cached.circle);
                    markers.push(cached.marker);
                    continue;
                }

                /*
                 * Two-line pill when a price is available:
                 *   line 1: accommodation name (semibold)
                 *   line 2: price label (regular)
                 * Single-line pill when there is no price.
                 */
                const pillBody = priceLabel
                    ? `<span class="${styles.itemPillName}">${escapeHtmlForPill(item.name)}</span><span class="${styles.itemPillPrice}">${escapeHtmlForPill(priceLabel)}</span>`
                    : `<span class="${styles.itemPillName}">${escapeHtmlForPill(item.name)}</span>`;
                const pillIcon = L.divIcon({
                    className: styles.itemPill,
                    html: `<span class="${styles.itemPillInner}${
                        isHovered ? ` ${styles.itemPillHovered}` : ''
                    }${priceLabel ? ` ${styles.itemPillStacked}` : ''}">${pillBody}</span>`,
                    iconSize: [0, 0],
                    iconAnchor: [0, 0]
                });
                const circle = (
                    <Circle
                        key={`${item.id}-circle`}
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
                    />
                );
                const marker = (
                    <Marker
                        key={`${item.id}-pill`}
                        position={[item.approximateLocation.lat, item.approximateLocation.lng]}
                        icon={pillIcon}
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
                                isAuthenticated={isAuthenticated}
                                locale={locale}
                            />
                        </Popup>
                    </Marker>
                );
                cache.set(item.id, { signature, circle, marker });
                circles.push(circle);
                markers.push(marker);
            }
            // Drop cached entries for items that left the current viewport
            // — keeps the map bounded and avoids stale closures lingering.
            for (const id of cache.keys()) {
                if (!seenIds.has(id)) cache.delete(id);
            }
            return { clusterableMarkers: markers, accommodationCircles: circles };
        }

        const cache = destinationCacheRef.current;
        const seenIds = new Set<string>();
        const markers: ReactElement[] = [];
        for (const item of props.items) {
            seenIds.add(item.id);
            const signature = [
                item.name,
                item.coordinates.lat,
                item.coordinates.lng,
                item.thumbnailUrl ?? '',
                item.accommodationsCount ?? '',
                item.accommodationsLabel ?? '',
                item.description ?? '',
                item.detailHref ?? ''
            ].join('|');
            const cached = cache.get(item.id);
            if (cached && cached.signature === signature) {
                markers.push(cached.marker);
                continue;
            }
            const marker = (
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
            );
            cache.set(item.id, { signature, marker });
            markers.push(marker);
        }
        for (const id of cache.keys()) {
            if (!seenIds.has(id)) cache.delete(id);
        }
        return { clusterableMarkers: markers, accommodationCircles: [] as ReactElement[] };
    }, [
        props.items,
        isAccommodationMode,
        hoveredItemId,
        onMarkerClick,
        i18nStrings,
        isAuthenticated,
        locale
    ]);

    /*
     * When the runtime-affecting context flips (locale, auth, click handler,
     * i18n strings, or the mode itself) the cached elements still wrap the
     * stale closure / callback, so we drop the caches and force them to
     * rebuild on the next render. Item-level changes are handled by the
     * per-item signature above; this effect is the "everything-else" reset.
     */
    // biome-ignore lint/correctness/useExhaustiveDependencies: each dep is a deliberate cache-invalidation signal; the effect body does not read them, it only fires .clear() when any of them changes.
    useEffect(() => {
        accommodationCacheRef.current.clear();
        destinationCacheRef.current.clear();
    }, [isAccommodationMode, onMarkerClick, i18nStrings, isAuthenticated, locale]);

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
                {initialBounds && (
                    <FitBoundsOnce
                        bounds={initialBounds}
                        maxZoom={maxZoom}
                    />
                )}
                <BoundsReporter
                    onBoundsChange={onBoundsChange}
                    debounceMs={DEFAULT_BOUNDS_DEBOUNCE_MS}
                />
                {accommodationCircles}
                <MarkerClusterGroup chunkedLoading>{clusterableMarkers}</MarkerClusterGroup>
                {selectedCoord && (
                    <PulseHalo
                        lat={selectedCoord.lat}
                        lng={selectedCoord.lng}
                    />
                )}
            </MapContainer>
            {isAccommodationMode && (
                <p className={styles.disclaimer}>{i18nStrings.approximateDisclaimer}</p>
            )}
        </div>
    );
}

function AccommodationPopupContent({
    item,
    viewDetailsLabel,
    isAuthenticated,
    locale
}: {
    readonly item: AccommodationListingItem;
    readonly viewDetailsLabel?: string;
    readonly isAuthenticated: boolean;
    readonly locale: SupportedLocale;
}) {
    const hasRating =
        typeof item.averageRating === 'number' &&
        item.averageRating > 0 &&
        typeof item.reviewsCount === 'number' &&
        item.reviewsCount > 0;
    const hasHeaderRow =
        Boolean(item.typeLabel) ||
        (item.isFeatured && Boolean(item.featuredLabel)) ||
        Boolean(item.id);
    return (
        <div className={styles.popupCard}>
            <div className={styles.popupBody}>
                {hasHeaderRow ? (
                    <div className={styles.popupHeader}>
                        <div className={styles.popupHeaderChips}>
                            {item.typeLabel ? (
                                <span className={styles.popupTypeChip}>{item.typeLabel}</span>
                            ) : null}
                            {item.isFeatured && item.featuredLabel ? (
                                <span className={`${styles.popupFeaturedBadge} featured-badge`}>
                                    <StarIcon
                                        size={12}
                                        weight="fill"
                                        aria-hidden="true"
                                    />
                                    <span>{item.featuredLabel}</span>
                                </span>
                            ) : null}
                        </div>
                        <FavoriteButton
                            entityId={item.id}
                            entityType="ACCOMMODATION"
                            initialIsFavorited={item.isFavorited}
                            initialBookmarkId={item.favoriteBookmarkId ?? null}
                            count={item.bookmarkCount}
                            variant="compact"
                            locale={locale}
                            isAuthenticated={isAuthenticated}
                        />
                    </div>
                ) : null}
                <div className={styles.popupTitleBlock}>
                    <h3 className={styles.popupTitle}>{item.name}</h3>
                    {item.cityName ? <p className={styles.popupCity}>{item.cityName}</p> : null}
                </div>
                {item.summary ? <p className={styles.popupSummary}>{item.summary}</p> : null}
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
                <div className={styles.popupFooter}>
                    {item.priceLabel ? (
                        <span className={styles.popupPrice}>{item.priceLabel}</span>
                    ) : (
                        <span aria-hidden="true" />
                    )}
                    {item.detailHref ? (
                        <a
                            href={item.detailHref}
                            className={styles.popupCta}
                        >
                            <span>{viewDetailsLabel ?? 'Ver más'}</span>
                            <span aria-hidden="true">→</span>
                        </a>
                    ) : null}
                </div>
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
