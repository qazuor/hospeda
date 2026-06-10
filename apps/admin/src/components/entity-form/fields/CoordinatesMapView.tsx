/**
 * Internal Leaflet map view used by `CoordinatesField`.
 *
 * Uses the raw `leaflet` API instead of `react-leaflet` because the 4.x
 * MapContainer / react-leaflet integration breaks under React 19 (the
 * "Map container is already initialized" error fires when the internal
 * `mapRef` callback runs against a div that still carries Leaflet's
 * `_leaflet_id` flag). Doing the bookkeeping manually here lets us own the
 * lifecycle: a single mount-time effect creates the map, sync-effects move
 * the marker / centre, and the cleanup removes the map and clears the
 * sentinel so a future re-mount on the same DOM element does not throw.
 *
 * Extracted into its own module so the parent can load it via `React.lazy`,
 * keeping `leaflet` out of the SSR bundle.
 */
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// `?url` forces Vite to return the asset URL string regardless of the
// default behaviour for the importer's file type. Without it the import
// could resolve to an ImageMetadata-like object (Astro) or a string (Vite)
// depending on the bundler, and the marker icon ends up broken because
// Leaflet receives an object where it expects a string URL.
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png?url';
import iconUrl from 'leaflet/dist/images/marker-icon.png?url';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png?url';
import * as React from 'react';

/**
 * Build a marker icon up-front and pass it explicitly to every Marker we
 * create. Using a per-marker icon side-steps the `L.Icon.Default` global
 * patching that breaks silently when the asset URLs end up wrapped in an
 * object literal (the marker container renders but the image is empty).
 */
const MARKER_ICON = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl: iconShadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export interface CoordinatesMapViewProps {
    readonly lat: number | null;
    readonly lng: number | null;
    readonly fallbackCenter: { lat: number; lng: number };
    readonly zoomFilled: number;
    readonly zoomEmpty: number;
    readonly tileUrl: string;
    readonly tileAttribution: string;
    readonly emptyHint?: string;
    readonly activationHint?: string;
    readonly disabled?: boolean;
    readonly onMove: (lat: number, lng: number) => void;
}

export function CoordinatesMapView({
    lat,
    lng,
    fallbackCenter,
    zoomFilled,
    zoomEmpty,
    tileUrl,
    tileAttribution,
    emptyHint,
    activationHint,
    disabled = false,
    onMove
}: CoordinatesMapViewProps): React.ReactNode {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<L.Map | null>(null);
    const markerRef = React.useRef<L.Marker | null>(null);

    // Activation state — mirrors apps/web/LocationMap.client.tsx pattern.
    // While "inactive" the scroll wheel is left alone so the user can scroll
    // the page over the map; clicking the map activates wheel zoom until the
    // pointer leaves the map.
    const [isActive, setIsActive] = React.useState(false);

    // Keep the latest `onMove` reachable from Leaflet event handlers without
    // re-creating the map every time the parent re-renders.
    const onMoveRef = React.useRef(onMove);
    React.useEffect(() => {
        onMoveRef.current = onMove;
    }, [onMove]);

    const hasValue = lat !== null && lng !== null;
    const initialCenter = hasValue ? [lat, lng] : [fallbackCenter.lat, fallbackCenter.lng];
    const initialZoom = hasValue ? zoomFilled : zoomEmpty;

    // Capture mount-time options so the init effect remains "run once" while
    // still honouring whatever the parent passed at first render.
    const optionsRef = React.useRef({
        center: initialCenter as [number, number],
        zoom: initialZoom,
        tileUrl,
        tileAttribution
    });

    // ------------------------------------------------------------------
    // Mount / unmount the Leaflet map exactly once per mount of this
    // component. The cleanup explicitly removes the map and clears
    // `_leaflet_id` so the DOM element can be re-initialized later.
    // ------------------------------------------------------------------
    React.useEffect(() => {
        const node = containerRef.current;
        if (!node) return;

        // Defensive — if a previous instance left state on this div, clear it
        // before init so Leaflet does not throw "already initialized".
        // TYPE-WORKAROUND: Leaflet sets `_leaflet_id` on the DOM node at runtime but
        // `HTMLDivElement` has no such property in its type; the cast reads/clears it safely.
        if ((node as unknown as { _leaflet_id?: number })._leaflet_id !== undefined) {
            // TYPE-WORKAROUND: same Leaflet sentinel property on HTMLDivElement — write path.
            (node as unknown as { _leaflet_id?: number })._leaflet_id = undefined;
        }

        const { center, zoom, tileUrl: url, tileAttribution: attribution } = optionsRef.current;
        const map = L.map(node, {
            center,
            zoom,
            zoomControl: true,
            // Wheel zoom stays off until the user activates the map (see
            // `isActive` effect). Other interactions stay on.
            scrollWheelZoom: false
        });
        L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);

        map.on('click', (e: L.LeafletMouseEvent) => {
            onMoveRef.current(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
            // Belt-and-suspenders cleanup of Leaflet's sentinel.
            // TYPE-WORKAROUND: Leaflet `_leaflet_id` sentinel on HTMLDivElement — same pattern as mount.
            if ((node as unknown as { _leaflet_id?: number })._leaflet_id !== undefined) {
                // TYPE-WORKAROUND: Leaflet `_leaflet_id` sentinel on HTMLDivElement — write path.
                (node as unknown as { _leaflet_id?: number })._leaflet_id = undefined;
            }
        };
    }, []);

    // ------------------------------------------------------------------
    // Sync the marker + centre with controlled `value` updates.
    // ------------------------------------------------------------------
    React.useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (lat === null || lng === null) {
            if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
            }
            return;
        }

        if (!markerRef.current) {
            const marker = L.marker([lat, lng], {
                draggable: !disabled,
                icon: MARKER_ICON
            }).addTo(map);
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                onMoveRef.current(pos.lat, pos.lng);
            });
            markerRef.current = marker;
            map.setView([lat, lng], zoomFilled, { animate: true });
            return;
        }

        const currentLatLng = markerRef.current.getLatLng();
        if (currentLatLng.lat !== lat || currentLatLng.lng !== lng) {
            markerRef.current.setLatLng([lat, lng]);
            map.setView([lat, lng], map.getZoom(), { animate: true });
        }
    }, [lat, lng, disabled, zoomFilled]);

    // ------------------------------------------------------------------
    // Toggle interactivity when the parent flips the disabled flag.
    // ------------------------------------------------------------------
    React.useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // `tap` is a mobile-only handler that newer @types/leaflet omits from the
        // Map type. It still exists at runtime on touch devices, so guard via cast.
        const tap = (map as L.Map & { tap?: L.Handler }).tap;

        if (disabled) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.doubleClickZoom.disable();
            map.scrollWheelZoom.disable();
            map.boxZoom.disable();
            map.keyboard.disable();
            tap?.disable();
            map.zoomControl?.remove();
            if (markerRef.current) markerRef.current.dragging?.disable();
        } else {
            map.dragging.enable();
            map.touchZoom.enable();
            map.doubleClickZoom.enable();
            map.boxZoom.enable();
            map.keyboard.enable();
            tap?.enable();
            if (markerRef.current) markerRef.current.dragging?.enable();
        }
    }, [disabled]);

    // ------------------------------------------------------------------
    // Scroll-wheel zoom: enabled when active, disabled when inactive. The
    // "active" flag flips to true on any click inside the wrapper and back
    // to false on the next click outside it. Pattern mirrors web's
    // LocationMap so the page scrolls cleanly over an unfocused map.
    // ------------------------------------------------------------------
    React.useEffect(() => {
        const map = mapRef.current;
        if (!map || disabled) return;
        if (isActive) {
            map.scrollWheelZoom.enable();
        } else {
            map.scrollWheelZoom.disable();
        }
    }, [isActive, disabled]);

    React.useEffect(() => {
        if (!isActive) return;
        const handlePointerDown = (event: PointerEvent): void => {
            if (wrapperRef.current?.contains(event.target as Node)) return;
            setIsActive(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isActive]);

    const handleActivate = (): void => {
        if (!isActive && !disabled) setIsActive(true);
    };

    return (
        <div
            ref={wrapperRef}
            className="relative h-full w-full"
            onPointerDown={handleActivate}
        >
            <div
                ref={containerRef}
                className="h-full w-full"
                data-testid="coordinates-map"
            />
            {!isActive && !disabled && activationHint && (
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute top-2 right-2 rounded-md',
                        'bg-card/90 px-2 py-1 text-foreground text-xs shadow-sm backdrop-blur'
                    )}
                >
                    {activationHint}
                </div>
            )}
            {!hasValue && emptyHint && (
                <div
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute inset-x-2 bottom-2 rounded-md',
                        'bg-card/90 px-3 py-2 text-foreground text-xs shadow-sm backdrop-blur'
                    )}
                >
                    {emptyHint}
                </div>
            )}
        </div>
    );
}
