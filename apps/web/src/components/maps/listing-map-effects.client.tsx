import L from 'leaflet';
import { useCallback, useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { ListingBBox } from './ListingMap.client';
import styles from './ListingMap.module.css';

const PULSE_PANE = 'pulseHaloPane';

/**
 * Decorative pulsing halo rendered on top of the item the user picked from
 * the cards sidebar. Two stacked CircleMarkers: a steady center dot in
 * brand-accent and an outer ring that scales/fades via a CSS keyframe. The
 * halo doesn't change the map viewport — it just calls the user's eye to
 * the right spot while the rest of the listing keeps reacting to pans.
 */
export function PulseHalo({ lat, lng }: { readonly lat: number; readonly lng: number }) {
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

/** Reports the latest map bounds after move and zoom events settle. */
export function BoundsReporter({
    onBoundsChange,
    debounceMs
}: {
    readonly onBoundsChange?: (bbox: ListingBBox) => void;
    readonly debounceMs: number;
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
