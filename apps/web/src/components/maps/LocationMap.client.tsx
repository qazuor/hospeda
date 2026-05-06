/**
 * @file LocationMap.client.tsx
 * @description Privacy-aware Leaflet map island for accommodation/destination
 * detail pages (SPEC-097). Renders a `Circle` for accommodations (approximate
 * mode) or a `Marker` for destinations (exact mode). Always rendered with
 * `client:only="react"` because Leaflet requires `window` and cannot SSR.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import styles from './LocationMap.module.css';

L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl.src ?? iconRetinaUrl,
    iconUrl: iconUrl.src ?? iconUrl,
    shadowUrl: iconShadowUrl.src ?? iconShadowUrl
});

interface LocationMapStrings {
    readonly attribution: string;
    readonly approximateDisclaimer: string;
    readonly markerLabel: string;
    /**
     * Hint shown over the map while scroll-wheel zoom is disabled.
     * Defaults to "Hacé click en el mapa para activar el zoom".
     */
    readonly interactionHint?: string;
}

interface LocationMapBaseProps {
    readonly lat: number;
    readonly lng: number;
    readonly zoom?: number;
    readonly ariaLabel: string;
    readonly i18nStrings: LocationMapStrings;
    readonly className?: string;
}

interface LocationMapApproximateProps extends LocationMapBaseProps {
    readonly mode: 'approximate';
    readonly radiusMeters: number;
}

interface LocationMapExactProps extends LocationMapBaseProps {
    readonly mode: 'exact';
    readonly markerLabel?: string;
}

export type LocationMapProps = LocationMapApproximateProps | LocationMapExactProps;

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

export function LocationMap(props: LocationMapProps) {
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
