/**
 * @file LocationMapInner.client.tsx
 * @description Inner Leaflet implementation for LocationMap, extracted so it
 * can be async-chunked via React.lazy (SPEC-269 T-269-02b).
 *
 * This module is the ONLY place that statically imports `leaflet` and
 * `react-leaflet` for the detail-page map. The outer `LocationMap.client.tsx`
 * lazy-imports this file so Leaflet is never included in the eager island
 * bundle — it loads as a separate async chunk when the Suspense boundary
 * resolves.
 *
 * Do NOT import this file directly from Astro pages or other components;
 * use the `LocationMap` re-export from `LocationMap.client.tsx` instead.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import type { LocationMapProps } from './LocationMap.client';
import styles from './LocationMap.module.css';

L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl.src ?? iconRetinaUrl,
    iconUrl: iconUrl.src ?? iconUrl,
    shadowUrl: iconShadowUrl.src ?? iconShadowUrl
});

const APPROXIMATE_MAX_ZOOM = 17;
const EXACT_MAX_ZOOM = 19;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

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
 * Toggles Leaflet's scrollWheelZoom handler based on whether the map is
 * "active". When inactive, the page scrolls normally over the map; when
 * active, mouse-wheel zooms the map.
 */
function ScrollWheelZoomController({ active }: { active: boolean }) {
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

/**
 * Full Leaflet implementation of LocationMap. Loaded as an async chunk via
 * React.lazy in LocationMap.client.tsx — never imported eagerly.
 *
 * @param props - {@link LocationMapProps}
 */
export function LocationMapInner(props: LocationMapProps) {
    const { lat, lng, zoom = 14, ariaLabel, i18nStrings, className } = props;
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

    const interactionHint =
        i18nStrings.interactionHint ?? 'Hacé click en el mapa para activar el zoom';

    const handleActivate = (): void => {
        if (!isActive) setIsActive(true);
    };

    return (
        <div
            ref={containerRef}
            className={mapRoot}
            aria-label={ariaLabel}
            role="img"
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
                        attribution={i18nStrings.attribution}
                        url={TILE_URL}
                        maxZoom={maxZoom}
                    />
                    <MapView
                        lat={lat}
                        lng={lng}
                        zoom={zoom}
                    />
                    <ScrollWheelZoomController active={isActive} />
                    {isApproximate ? (
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
                            <Popup>{props.markerLabel ?? i18nStrings.markerLabel}</Popup>
                        </Marker>
                    )}
                </MapContainer>
                {!isActive && (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: hint is purely visual; map remains operable via Leaflet's own +/- controls and keyboard nav.
                    <div
                        className={styles.activationHint}
                        onClick={handleActivate}
                        aria-hidden="true"
                    >
                        <span className={styles.activationHintText}>{interactionHint}</span>
                    </div>
                )}
            </div>
            {isApproximate && (
                <p className={styles.disclaimer}>{i18nStrings.approximateDisclaimer}</p>
            )}
        </div>
    );
}
