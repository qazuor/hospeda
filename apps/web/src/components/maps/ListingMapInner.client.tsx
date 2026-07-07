/**
 * @file ListingMapInner.client.tsx
 * @description Inner Leaflet implementation for ListingMap, extracted so it
 * can be async-chunked via React.lazy (SPEC-269 T-269-02b).
 *
 * This module is the ONLY place that statically imports `leaflet`,
 * `react-leaflet`, and `react-leaflet-cluster` for the listing map. The outer
 * `ListingMap.client.tsx` lazy-imports this file so Leaflet + the cluster
 * plugin never land in an eager island bundle.
 *
 * Do NOT import this file directly from Astro pages or other components;
 * use the `ListingMap` re-export from `ListingMap.client.tsx` instead.
 */
import 'leaflet/dist/leaflet.css';

import { StarIcon } from '@repo/icons';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import {
    type ReactElement,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { createPortal } from 'react-dom';
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
import type {
    AccommodationListingItem,
    DestinationListingItem,
    ListingBBox,
    ListingMapProps
} from './ListingMap.client';
import styles from './ListingMap.module.css';

// HOS-95: Leaflet's `Icon.Default._getIconUrl` prepends its CSS-detected
// `imagePath` (e.g. `.../leaflet/dist/images/`) to whatever `iconUrl` we set.
// Since the bundler already resolves these imports to fully-qualified URLs,
// that prepend produces a DOUBLED, broken path (the default `<Marker>` icon
// then 404s and renders as a broken image on the destinations map and any
// exact-mode detail map). Deleting the override makes Leaflet use the base
// `Icon._getIconUrl`, which returns our explicit URL verbatim.
// biome-ignore lint/performance/noDelete: one-time module-load reset of a prototype method; not a hot path.
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
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

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

/**
 * Closes any open popup as soon as the user starts dragging or zooming the map
 * (HOS-95, both listing maps). We listen to `dragstart` / `zoomstart` — NOT
 * `movestart`/`moveend` — because the popup's own `autoPan` pans the map when it
 * opens, which would fire a move event and immediately close the popup we just
 * opened. `dragstart` only fires on genuine user drag (not programmatic
 * `panTo`), and `autoPan` never zooms, so both events are safe. On the
 * accommodations map this also neutralises the BETA-47 problem (auto-pans
 * fighting the user's drag): there is never an open popup mid-drag to pan
 * against, because it closes the moment the drag starts.
 */
function ClosePopupOnInteract() {
    const map = useMapEvents({
        dragstart: () => map.closePopup(),
        zoomstart: () => map.closePopup()
    });
    return null;
}

/**
 * Floating accommodation card, rendered OUTSIDE the Leaflet container (portaled
 * into the map's `.root` wrapper) so it is never clipped by the container's
 * rounded `overflow: hidden`, and positioned so the whole card stays inside the
 * map viewport WITHOUT moving the map (HOS-95).
 *
 * Why not a Leaflet `<Popup>` + autoPan here (unlike the destinations map): on
 * the accommodations map, panning the map fires `moveend`, which makes
 * `useViewportSearch` refetch the results for the new viewport. So an autoPan on
 * popup-open reshuffled the pills and moved the one just clicked — the popup felt
 * "off". This card keeps the map still: it projects the marker's lat/lng to a
 * container pixel with `latLngToContainerPoint`, anchors the card above the
 * marker, then clamps left/top so the card is fully within the map rectangle
 * (padding on every side). It closes on drag/zoom start and on a background map
 * click, mirroring popup semantics.
 */
const FLOATING_CARD_PADDING = 12;
const FLOATING_CARD_GAP_ABOVE_MARKER = 18;

function AccommodationCardPopup({
    item,
    viewDetailsLabel,
    isAuthenticated,
    locale,
    onClose
}: {
    readonly item: AccommodationListingItem;
    readonly viewDetailsLabel?: string;
    readonly isAuthenticated: boolean;
    readonly locale: SupportedLocale;
    readonly onClose: () => void;
}) {
    const map = useMap();
    const cardRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    // Measure the card and clamp it inside the map rectangle. Runs after layout
    // (so `offsetWidth/Height` are real) and on container resize. No continuous
    // follow is needed — the card closes the moment the user drags or zooms.
    useLayoutEffect(() => {
        const place = () => {
            const card = cardRef.current;
            if (!card) return;
            const point = map.latLngToContainerPoint([
                item.approximateLocation.lat,
                item.approximateLocation.lng
            ]);
            const size = map.getSize();
            const cw = card.offsetWidth;
            const ch = card.offsetHeight;
            const pad = FLOATING_CARD_PADDING;
            const left = Math.max(pad, Math.min(point.x - cw / 2, size.x - cw - pad));
            const top = Math.max(
                pad,
                Math.min(point.y - ch - FLOATING_CARD_GAP_ABOVE_MARKER, size.y - ch - pad)
            );
            setPos({ left, top });
        };
        place();
        const container = map.getContainer();
        const ro = new ResizeObserver(place);
        ro.observe(container);
        return () => ro.disconnect();
    }, [map, item]);

    useMapEvents({
        dragstart: onClose,
        zoomstart: onClose,
        click: onClose
    });

    const root = map.getContainer().parentElement;
    if (!root) return null;

    return createPortal(
        <div
            ref={cardRef}
            className={styles.floatingCard}
            style={{
                left: pos ? `${pos.left}px` : '0',
                top: pos ? `${pos.top}px` : '0',
                visibility: pos ? 'visible' : 'hidden'
            }}
        >
            <button
                type="button"
                className={styles.floatingCardClose}
                onClick={onClose}
                aria-label="Cerrar"
            >
                ×
            </button>
            <AccommodationPopupContent
                item={item}
                viewDetailsLabel={viewDetailsLabel}
                isAuthenticated={isAuthenticated}
                locale={locale}
            />
        </div>,
        root
    );
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
        isAuthenticated = false,
        locale = 'es'
    } = props;

    const isAccommodationMode = props.mode === 'accommodation-list';
    const maxZoom = isAccommodationMode ? ACCOMMODATION_MAX_ZOOM : DESTINATION_MAX_ZOOM;

    // HOS-95: id of the accommodation whose floating card is open (accommodation
    // map only — destinations still use a Leaflet <Popup>). `null` = none open.
    const [openCardId, setOpenCardId] = useState<string | null>(null);

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
                    icon={DESTINATION_ICON}
                    eventHandlers={{
                        click: () => onMarkerClick?.(item.id)
                    }}
                >
                    <Popup
                        className={styles.popup}
                        maxWidth={300}
                        minWidth={280}
                        // HOS-95: destinations auto-pan so an edge-pin popup (e.g.
                        // Concordia at the top) is never clipped by the rounded map
                        // frame — the map nudges to bring the full popup into view.
                        // This is destination-ONLY: the accommodation popup above keeps
                        // autoPan disabled (BETA-47), because on that map many markers +
                        // viewport-search refetch made queued auto-pans fight the user's
                        // drag. Destinations are a static ~22-item set, so it's safe.
                        autoPan={true}
                        autoPanPadding={[24, 24]}
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
        // isAuthenticated/locale are NOT deps: since HOS-95 the markers no longer
        // render popup content (the accommodation card is a separate portal), so
        // marker elements don't depend on auth/locale anymore.
    }, [props.items, isAccommodationMode, hoveredItemId, onMarkerClick, i18nStrings]);

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

    // The accommodation whose floating card is open (if any). Resolved from the
    // live item list, so if a viewport refetch drops it the card just closes.
    const openAccommodationItem =
        isAccommodationMode && openCardId
            ? (props.items as ReadonlyArray<AccommodationListingItem>).find(
                  (it) => it.id === openCardId
              )
            : undefined;

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" is the correct ARIA for an interactive map widget that contains focusable Leaflet controls.
        <div
            role="group"
            className={styles.root}
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
                        showCoverageOnHover={false}
                    >
                        {clusterableMarkers}
                    </MarkerClusterGroup>
                ) : (
                    clusterableMarkers
                )}
                {/* Destinations use a Leaflet <Popup>, so close it on drag/zoom.
                    Accommodations use the floating card, which manages its own
                    close-on-interact inside AccommodationCardPopup. */}
                {!isAccommodationMode && <ClosePopupOnInteract />}
                {openAccommodationItem && (
                    <AccommodationCardPopup
                        key={openAccommodationItem.id}
                        item={openAccommodationItem}
                        viewDetailsLabel={i18nStrings.viewDetails}
                        isAuthenticated={isAuthenticated}
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
                        role="img"
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
                    {/* Eager: the popup only mounts on click, so the image is
                        wanted immediately; lazy just delayed it (HOS-95). */}
                    <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className={styles.popupImage}
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
