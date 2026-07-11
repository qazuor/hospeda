/**
 * @file LocationPickerMap.client.tsx
 * @description Raw Leaflet map for the LocationPicker (SPEC-208, Phase C PR2).
 *
 * Uses raw Leaflet (NOT react-leaflet) for React 19 compatibility.
 * This component is dynamically imported via `React.lazy()` (see
 * LocationPicker.client.tsx) so it never touches `window`/`document`
 * during SSR — Leaflet only loads once this chunk mounts on the client.
 */
import 'leaflet/dist/leaflet.css';

import { useEffect, useRef } from 'react';
import styles from './LocationPicker.module.css';

/** Props for the inner map component. */
export interface LocationPickerMapProps {
    readonly center: { readonly lat: number; readonly lng: number };
    readonly markerPosition: { readonly lat: number; readonly lng: number } | null;
    readonly disabled: boolean;
    readonly onMove: (lat: number, lng: number) => void;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DEFAULT_ZOOM = 15;

/**
 * Raw Leaflet map with a draggable marker.
 * Dynamically imported — never rendered on the server.
 */
export function LocationPickerMap({
    center,
    markerPosition,
    disabled,
    onMove
}: LocationPickerMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<unknown>(null);
    const markerRef = useRef<unknown>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // Initialize Leaflet map
    // biome-ignore lint/correctness/useExhaustiveDependencies: Leaflet map needs full re-init on prop changes
    useEffect(() => {
        if (!mapRef.current) return;
        // Dynamic import of Leaflet (client-only)
        import('leaflet').then(async (L) => {
            if (!mapRef.current) return;

            // Leaflet resolves its default marker icon URLs relative to the page,
            // which 404s under a bundler. Point them at the bundled asset URLs.
            // Astro resolves an image import to an ImageMetadata object
            // ({ src, ... }), not a bare string — read `.src` when present.
            const toAssetUrl = (mod: { default: string | { src: string } }): string =>
                typeof mod.default === 'string' ? mod.default : mod.default.src;
            const [iconMod, iconRetinaMod, shadowMod] = await Promise.all([
                import('leaflet/dist/images/marker-icon.png'),
                import('leaflet/dist/images/marker-icon-2x.png'),
                import('leaflet/dist/images/marker-shadow.png')
            ]);
            // HOS-95: Leaflet's `Icon.Default._getIconUrl` prepends its CSS-detected
            // `imagePath` (e.g. `.../leaflet/dist/images/`) to whatever `iconUrl` we
            // set. Since the bundler already resolves these imports to fully-qualified
            // URLs, that prepend produces a DOUBLED, broken path and the marker never
            // renders (see ListingMapInner.client.tsx for the same fix). Deleting the
            // override makes Leaflet use the base `Icon._getIconUrl`, which returns our
            // explicit URL verbatim.
            // biome-ignore lint/performance/noDelete: one-time reset of a prototype method; not a hot path.
            // TYPE-WORKAROUND: Leaflet's public types don't expose the internal `_getIconUrl` member we must delete.
            delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconUrl: toAssetUrl(iconMod),
                iconRetinaUrl: toAssetUrl(iconRetinaMod),
                shadowUrl: toAssetUrl(shadowMod)
            });

            const map = L.map(mapRef.current, {
                center: [center.lat, center.lng],
                zoom: DEFAULT_ZOOM,
                zoomControl: true
            });

            L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);

            // BETA-132: on first mount (or when the container is revealed after
            // being hidden/collapsed) Leaflet may cache a stale/zero container
            // size and never request tiles for the true visible area, leaving
            // the map half-loaded. Force a remeasure right after setup, then
            // keep remeasuring on every container resize (mirrors the pattern
            // in ListingMapInner.client.tsx's FitBoundsOnce).
            map.invalidateSize();
            const container = mapRef.current;
            const ro = new ResizeObserver(() => map.invalidateSize());
            ro.observe(container);
            resizeObserverRef.current = ro;

            // Add marker
            const marker = markerPosition
                ? L.marker([markerPosition.lat, markerPosition.lng], { draggable: !disabled })
                : L.marker([center.lat, center.lng], { draggable: !disabled });

            marker.addTo(map);

            // Handle marker drag
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                onMove(pos.lat, pos.lng);
            });

            // Handle map click (drop/move pin)
            map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
                if (disabled) return;
                marker.setLatLng(e.latlng);
                onMove(e.latlng.lat, e.latlng.lng);
            });

            leafletMapRef.current = map;
            markerRef.current = marker;
        });

        return () => {
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;
            if (
                leafletMapRef.current &&
                typeof (leafletMapRef.current as { remove?: () => void }).remove === 'function'
            ) {
                (leafletMapRef.current as { remove: () => void }).remove();
                leafletMapRef.current = null;
                markerRef.current = null;
            }
        };
        // Only run on mount — center/marker changes handled below
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update marker position when props change
    useEffect(() => {
        if (!markerRef.current || !markerPosition) return;
        const marker = markerRef.current as { setLatLng: (pos: [number, number]) => void };
        marker.setLatLng([markerPosition.lat, markerPosition.lng]);
    }, [markerPosition]);

    // Update map center when props change
    const prevCenterRef = useRef(center);
    useEffect(() => {
        if (!leafletMapRef.current) return;
        const map = leafletMapRef.current as {
            flyTo: (center: [number, number], zoom: number) => void;
        };
        if (prevCenterRef.current.lat !== center.lat || prevCenterRef.current.lng !== center.lng) {
            map.flyTo([center.lat, center.lng], DEFAULT_ZOOM);
        }
        prevCenterRef.current = center;
    }, [center]);

    return (
        <div
            ref={mapRef}
            className={styles.mapContainer}
            role="application"
            aria-label="Mapa de ubicación"
        />
    );
}
