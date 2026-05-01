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
import { useEffect, useRef } from 'react';
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

export function LocationMap(props: LocationMapProps) {
    const { lat, lng, zoom = 14, ariaLabel, i18nStrings, className } = props;
    const isApproximate = props.mode === 'approximate';
    const maxZoom = isApproximate ? APPROXIMATE_MAX_ZOOM : EXACT_MAX_ZOOM;

    const mapRoot = `${styles.root}${className ? ` ${className}` : ''}`;

    return (
        <div
            className={mapRoot}
            aria-label={ariaLabel}
            role="img"
        >
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
                {isApproximate ? (
                    <Circle
                        center={[lat, lng]}
                        radius={props.radiusMeters}
                        pathOptions={{
                            color: 'var(--accent, #f59e0b)',
                            fillColor: 'var(--accent, #f59e0b)',
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
            {isApproximate && (
                <p className={styles.disclaimer}>{i18nStrings.approximateDisclaimer}</p>
            )}
        </div>
    );
}
