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
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/** OpenStreetMap raster tiles — the tile source for every map in the app. */
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

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
