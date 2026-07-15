/**
 * @file LocationMapInner.client.tsx
 * @description Inner Leaflet implementation for LocationMap's single-point
 * modes (`approximate` / `exact`), extracted so it can be async-chunked via
 * React.lazy (SPEC-269 T-269-02b).
 *
 * The outer `LocationMap.client.tsx` lazy-imports this file so Leaflet is never
 * included in the eager island bundle — it loads as a separate async chunk when
 * the Suspense boundary resolves.
 *
 * `mode: 'multi'` (the HOS-146 destination POI map) lives in its OWN chunk,
 * `MultiMarkerMapInner.client.tsx`, and is dispatched by mode in
 * `LocationMap.client.tsx`. Keeping it out of this file is deliberate: POI pins
 * need `react-dom/server` + the `@repo/icons` POI-type table, which the
 * accommodation detail map and the destination mini-map (this file's only
 * callers) would otherwise download for nothing.
 *
 * Do NOT import this file directly from Astro pages or other components;
 * use the `LocationMap` re-export from `LocationMap.client.tsx` instead.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import type { LocationMapProps } from './LocationMap.client';
import styles from './LocationMap.module.css';
import { ScrollWheelZoomController, TILE_URL } from './map-controls.client';

L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl.src ?? iconRetinaUrl,
    iconUrl: iconUrl.src ?? iconUrl,
    shadowUrl: iconShadowUrl.src ?? iconShadowUrl
});

const APPROXIMATE_MAX_ZOOM = 17;
const EXACT_MAX_ZOOM = 19;

/**
 * Tiny inner component that fits the map view to the requested center after
 * mount; needed because react-leaflet does not always re-center on prop
 * updates triggered by Astro re-hydration.
 */
function MapView({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
    const map = useMap();
    const isFirstRun = useRef(true);
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        map.setView([lat, lng], zoom);
    }, [map, lat, lng, zoom]);
    return null;
}

/**
 * Approximate (`Circle`) / exact (`Marker`) single-point map. Loaded as an
 * async chunk via React.lazy in LocationMap.client.tsx — never imported
 * eagerly.
 *
 * @param props - the `mode: 'approximate' | 'exact'` members of {@link LocationMapProps}
 */
export function LocationMapInner(
    props: Extract<LocationMapProps, { mode: 'approximate' | 'exact' }>
) {
    const { lat, lng, zoom = 14, ariaLabel, className } = props;
    // `i18nStrings` is read through `props` (not destructured) wherever a
    // mode-specific string is needed: destructuring it up here would detach it
    // from the `props.mode` discriminant, collapsing it to the union of both
    // string shapes and losing the per-mode requirements the union encodes.
    // Only the fields common to every mode are safe to read off the union.
    const { attribution, interactionHint: interactionHintOverride } = props.i18nStrings;
    const isApproximate = props.mode === 'approximate';
    const maxZoom = isApproximate ? APPROXIMATE_MAX_ZOOM : EXACT_MAX_ZOOM;

    const mapRoot = `${styles.root}${className ? ` ${className}` : ''}`;

    /**
     * "Active" means the user has clicked the map and scroll-wheel zoom is
     * enabled. Until then, mouse wheel passes through to page scroll.
     */
    const [isActive, setIsActive] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Deactivate when the user clicks/taps outside the map, so scrolling the
    // page over the map afterwards does not zoom it.
    useEffect(() => {
        if (!isActive) return;
        const handlePointerDown = (event: PointerEvent): void => {
            if (containerRef.current?.contains(event.target as Node)) return;
            setIsActive(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isActive]);

    const interactionHint = interactionHintOverride ?? 'Hacé click en el mapa para activar el zoom';

    const handleActivate = (): void => {
        if (!isActive) setIsActive(true);
    };

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" is the correct ARIA for an interactive map widget that contains focusable Leaflet controls.
        <div
            role="group"
            ref={containerRef}
            className={mapRoot}
            aria-label={ariaLabel}
        >
            <div className={styles.mapWrapper}>
                <MapContainer
                    center={[lat, lng]}
                    zoom={zoom}
                    maxZoom={maxZoom}
                    scrollWheelZoom={false}
                    className={styles.container}
                >
                    <TileLayer
                        attribution={attribution}
                        url={TILE_URL}
                        maxZoom={maxZoom}
                    />
                    <MapView
                        lat={lat}
                        lng={lng}
                        zoom={zoom}
                    />
                    <ScrollWheelZoomController active={isActive} />
                    {props.mode === 'approximate' ? (
                        <Circle
                            center={[lat, lng]}
                            radius={props.radiusMeters}
                            pathOptions={{
                                color: 'var(--brand-accent)',
                                fillColor: 'var(--brand-accent)',
                                fillOpacity: 0.18,
                                weight: 2
                            }}
                        />
                    ) : (
                        <Marker position={[lat, lng]}>
                            <Popup>{props.markerLabel ?? props.i18nStrings.markerLabel}</Popup>
                        </Marker>
                    )}
                </MapContainer>
                {!isActive && (
                    // Purely visual hint (aria-hidden): the map remains fully operable
                    // via Leaflet's own +/- controls and keyboard nav without it, so
                    // no keyboard-equivalent handler is needed on this non-interactive div.
                    <div
                        className={styles.activationHint}
                        onClick={handleActivate}
                        aria-hidden="true"
                    >
                        <span className={styles.activationHintText}>{interactionHint}</span>
                    </div>
                )}
            </div>
            {props.mode === 'approximate' && (
                <p className={styles.disclaimer}>{props.i18nStrings.approximateDisclaimer}</p>
            )}
        </div>
    );
}
