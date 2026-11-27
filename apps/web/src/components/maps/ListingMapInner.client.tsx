/**
 * @file ListingMapInner.client.tsx
 * @description Inner Leaflet implementation for ListingMap, extracted so it
 * can be async-chunked via React.lazy (SPEC-269 T-269-02b).
 *
 * The outer `ListingMap.client.tsx` lazy-imports this file and its Leaflet-specific
 * children so Leaflet and the cluster
 * plugin never land in an eager island bundle.
 *
 * Do NOT import this file directly from Astro pages or other components;
 * use the `ListingMap` re-export from `ListingMap.client.tsx` instead.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer } from 'react-leaflet';
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

import { cn } from '@/lib/cn';
import { createTranslations } from '@/lib/i18n';
import { AccommodationCardPopup } from './AccommodationCardPopup.client';
import { DestinationMapCard } from './DestinationMapCard';
import type {
    AccommodationListingItem,
    DestinationListingItem,
    ListingMapProps
} from './ListingMap.client';
import styles from './ListingMap.module.css';
import { BoundsReporter, PulseHalo } from './listing-map-effects.client';
import { FitListingBounds, TILE_URL } from './map-controls.client';

// HOS-95: Leaflet's `Icon.Default._getIconUrl` prepends its CSS-detected
// `imagePath` (e.g. `.../leaflet/dist/images/`) to whatever `iconUrl` we set.
// Since the bundler already resolves these imports to fully-qualified URLs,
// that prepend produces a DOUBLED, broken path (the default `<Marker>` icon
// then 404s and renders as a broken image on the destinations map and any
// exact-mode detail map). Deleting the override makes Leaflet use the base
// `Icon._getIconUrl`, which returns our explicit URL verbatim.
// TYPE-WORKAROUND: Leaflet's public types don't expose the internal `_getIconUrl` member we must delete.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl.src ?? iconRetinaUrl,
    iconUrl: iconUrl.src ?? iconUrl,
    shadowUrl: iconShadowUrl.src ?? iconShadowUrl
});

const ACCOMMODATION_MAX_ZOOM = 17;
const DESTINATION_MAX_ZOOM = 19;
const DEFAULT_BOUNDS_DEBOUNCE_MS = 300;
const clusterIcon = (cluster: { getChildCount(): number }) =>
    L.divIcon({
        className: styles.cluster,
        html: String(cluster.getChildCount()),
        iconSize: [44, 44]
    });

/*
 * HOS-95 destination-pin: a solid brand-accent teardrop with a white centre dot,
 * for the destination markers ONLY (accommodations use their own pills). The
 * fill uses CSS custom properties inherited from :root, so dark mode / token
 * changes apply automatically. Built once and shared across all destination
 * markers (a divIcon is stateless — Leaflet clones its DOM per marker).
 */
const DESTINATION_PIN_SVG = `<svg viewBox="0 0 24 24" width="30" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="var(--brand-accent, #ea6d24)" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>`;

const DESTINATION_ICON: L.DivIcon = L.divIcon({
    className: styles.destPinReset,
    html: `<span class="${styles.destPin}">${DESTINATION_PIN_SVG}</span>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38]
});

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
 * Full Leaflet + react-leaflet-cluster implementation of ListingMap.
 * Loaded as an async chunk via React.lazy in ListingMap.client.tsx.
 *
 * @param props - {@link ListingMapProps}
 */
export function ListingMapInner(props: ListingMapProps) {
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
        locale = 'es'
    } = props;

    const isAccommodationMode = props.mode === 'accommodation-list';
    const accommodationI18nStrings = props.mode === 'accommodation-list' ? props.i18nStrings : null;
    const maxZoom = isAccommodationMode ? ACCOMMODATION_MAX_ZOOM : DESTINATION_MAX_ZOOM;

    const { t } = createTranslations(locale);
    // Selected marker on either listing map. `null` means no card is open.
    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const invokingMarker = useRef<L.Marker | null>(null);

    const dismissDestination = () => {
        const marker = invokingMarker.current;
        invokingMarker.current = null;
        setOpenCardId(null);
        marker?.getElement()?.focus();
    };

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
            for (const item of props.items as ReadonlyArray<AccommodationListingItem>) {
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
                            click: () => {
                                onMarkerClick?.(item.id);
                                setOpenCardId(item.id);
                            }
                        }}
                    />
                );
                const marker = (
                    // HOS-95: no Leaflet <Popup> here — the accommodation card is a
                    // floating portal (AccommodationCardPopup) opened via `openCardId`,
                    // so opening it never pans/moves the map (which would trigger a
                    // useViewportSearch refetch). Click just records which card to show.
                    <Marker
                        key={`${item.id}-pill`}
                        position={[item.approximateLocation.lat, item.approximateLocation.lng]}
                        icon={pillIcon}
                        eventHandlers={{
                            click: () => {
                                onMarkerClick?.(item.id);
                                setOpenCardId(item.id);
                            }
                        }}
                    />
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
        for (const item of props.items as ReadonlyArray<DestinationListingItem>) {
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
                    alt={item.name}
                    title={item.name}
                    icon={DESTINATION_ICON}
                    eventHandlers={{
                        click: ({ target }) => {
                            invokingMarker.current = target as L.Marker;
                            setOpenCardId(item.id);
                            onMarkerClick?.(item.id);
                        }
                    }}
                />
            );
            cache.set(item.id, { signature, marker });
            markers.push(marker);
        }
        for (const id of cache.keys()) {
            if (!seenIds.has(id)) cache.delete(id);
        }
        return { clusterableMarkers: markers, accommodationCircles: [] as ReactElement[] };
        // isAuthenticated/locale are NOT deps: since HOS-95 the markers no longer
        // render popup content (the accommodation card is a separate portal), so
        // marker elements don't depend on auth/locale anymore.
    }, [props.items, isAccommodationMode, hoveredItemId, onMarkerClick]);

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
    }, [isAccommodationMode, onMarkerClick, i18nStrings, locale]);

    // The accommodation whose floating card is open (if any). Resolved from the
    // live item list, so if a viewport refetch drops it the card just closes.
    const openAccommodationItem =
        isAccommodationMode && openCardId
            ? (props.items as ReadonlyArray<AccommodationListingItem>).find(
                  (it) => it.id === openCardId
              )
            : undefined;
    const openDestination =
        props.mode === 'destination-list'
            ? props.items.find(({ id }) => id === openCardId)
            : undefined;

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" is the correct ARIA for an interactive map widget that contains focusable Leaflet controls.
        <div
            role="group"
            className={cn(styles.root, isAccommodationMode && styles.hasDisclaimer)}
            aria-label={ariaLabel}
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
                    <FitListingBounds
                        bounds={initialBounds}
                        maxZoom={initialZoom}
                        accommodation={isAccommodationMode}
                    />
                )}
                <BoundsReporter
                    onBoundsChange={onBoundsChange}
                    debounceMs={DEFAULT_BOUNDS_DEBOUNCE_MS}
                />
                {accommodationCircles}
                {/*
                 * Accommodations cluster (100+ items, dense); destinations do NOT
                 * (HOS-95) — with ~22 spread-out destinations the numbered cluster
                 * bubbles read as counts rather than places, so we render the pins
                 * directly. `showCoverageOnHover={false}` hides the convex-hull
                 * polygon Leaflet.markercluster draws on cluster hover; click-to-zoom
                 * is a separate option (`zoomToBoundsOnClick`, still default `true`).
                 */}
                {isAccommodationMode ? (
                    <MarkerClusterGroup
                        chunkedLoading
                        iconCreateFunction={clusterIcon}
                        showCoverageOnHover={false}
                    >
                        {clusterableMarkers}
                    </MarkerClusterGroup>
                ) : (
                    clusterableMarkers
                )}
                {openAccommodationItem && accommodationI18nStrings && (
                    <AccommodationCardPopup
                        key={openAccommodationItem.id}
                        item={openAccommodationItem}
                        viewDetailsLabel={accommodationI18nStrings.viewDetails}
                        priceConsultLabel={accommodationI18nStrings.priceConsult}
                        consultAvailabilityLabel={accommodationI18nStrings.consultAvailability}
                        locale={locale}
                        onClose={() => setOpenCardId(null)}
                    />
                )}
                {selectedCoord && (
                    <PulseHalo
                        lat={selectedCoord.lat}
                        lng={selectedCoord.lng}
                    />
                )}
            </MapContainer>
            {openDestination && (
                <DestinationMapCard
                    key={openDestination.id}
                    item={openDestination}
                    closeLabel={t('common.close')}
                    viewDetailsLabel={i18nStrings.viewDetails ?? t('maps.viewDetails')}
                    onClose={dismissDestination}
                />
            )}
            {isAccommodationMode && (
                <p className={styles.disclaimer}>{i18nStrings.approximateDisclaimer}</p>
            )}
        </div>
    );
}
