/**
 * @file map-controls.client.tsx
 * @description Leaflet primitives shared by the two LocationMap
 * implementations (`LocationMapInner.client.tsx` for approximate/exact and
 * `MultiMarkerMapInner.client.tsx` for the HOS-146 POI map).
 *
 * These live in their own module rather than in either implementation so the
 * two can stay independent async chunks: if one imported the other for a
 * shared control, the bundler would pull both (and everything they import)
 * into whichever chunk loads first — which is exactly what this split exists
 * to avoid. See `LocationMap.client.tsx` for the per-mode lazy dispatch.
 */
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/** OpenStreetMap raster tiles — the tile source for every map in the app. */
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Fits initial pins at the measured size, retaining the user's viewport after interaction. */
export function FitListingBounds({
    bounds,
    maxZoom,
    accommodation = false
}: {
    readonly bounds?: [[number, number], [number, number]];
    readonly maxZoom: number;
    readonly accommodation?: boolean;
}) {
    const map = useMap();
    const initial = useRef(bounds);
    const interacted = useRef(false);
    useEffect(() => {
        const container = map.getContainer();
        const stopFitting = () => {
            interacted.current = true;
        };
        const measure = () => {
            if (!container.clientWidth || !container.clientHeight) return;
            map.invalidateSize({ pan: false });
            if (initial.current && !interacted.current) {
                // Leaflet uses [x, y]. Leave room for half the 220px pill and its stacked height.
                map.fitBounds(initial.current, {
                    padding: accommodation ? [120, 56] : [40, 52],
                    maxZoom,
                    animate: false
                });
            }
        };
        const events = ['pointerdown', 'wheel', 'keydown'] as const;
        for (const event of events)
            container.addEventListener(event, stopFitting, { capture: true, passive: true });
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => {
            observer.disconnect();
            for (const event of events) container.removeEventListener(event, stopFitting, true);
        };
    }, [map, maxZoom, accommodation]);
    return null;
}

/**
 * Toggles Leaflet's scrollWheelZoom handler based on whether the map is
 * "active". When inactive, the page scrolls normally over the map; when
 * active, mouse-wheel zooms the map.
 *
 * @param props.active - Whether scroll-wheel zoom should be enabled
 */
export function ScrollWheelZoomController({ active }: { readonly active: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (active) {
            map.scrollWheelZoom.enable();
        } else {
            map.scrollWheelZoom.disable();
        }
    }, [map, active]);
    return null;
}
