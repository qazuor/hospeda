/**
 * @file LocationPickerMap.client.tsx
 * @description Raw Leaflet map for the LocationPicker (SPEC-208, Phase C PR2).
 *
 * Uses raw Leaflet (NOT react-leaflet) for React 19 compatibility.
 * This component is dynamically imported with `ssr: false` to avoid
 * Leaflet touching `window` during SSR.
 */
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

    // Initialize Leaflet map
    // biome-ignore lint/correctness/useExhaustiveDependencies: Leaflet map needs full re-init on prop changes
    useEffect(() => {
        if (!mapRef.current) return;
        // Dynamic import of Leaflet (client-only)
        import('leaflet').then((L) => {
            if (!mapRef.current) return;

            const map = L.map(mapRef.current, {
                center: [center.lat, center.lng],
                zoom: DEFAULT_ZOOM,
                zoomControl: true
            });

            L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);

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
