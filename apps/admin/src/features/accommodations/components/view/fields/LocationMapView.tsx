/**
 * @file LocationMapView.tsx
 * @description Read-only Leaflet map for the admin accommodation view page
 * (SPEC-097). Renders the exact pin since admin viewers always have
 * `ACCOMMODATION_LOCATION_EXACT_VIEW` (or are owners). Used as the embedded
 * map inside `LocationViewField` to replace the legacy "view on Google Maps"
 * external link.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

// TYPE-WORKAROUND: Vite asset imports return `{ src: string }` in dev and a bare string in prod build; fall back to the string form when the object shape is absent.
L.Icon.Default.mergeOptions({
    iconRetinaUrl: (iconRetinaUrl as { src?: string }).src ?? (iconRetinaUrl as unknown as string),
    iconUrl: (iconUrl as { src?: string }).src ?? (iconUrl as unknown as string),
    shadowUrl: (iconShadowUrl as { src?: string }).src ?? (iconShadowUrl as unknown as string)
});

export interface LocationMapViewProps {
    readonly lat: number;
    readonly lng: number;
    readonly markerLabel?: string;
    readonly zoom?: number;
}

export function LocationMapView({ lat, lng, markerLabel, zoom = 15 }: LocationMapViewProps) {
    return (
        <div
            className="overflow-hidden rounded-md border border-border"
            style={{ width: '100%', height: 280 }}
        >
            <MapContainer
                center={[lat, lng]}
                zoom={zoom}
                scrollWheelZoom={false}
                style={{ width: '100%', height: '100%' }}
            >
                <TileLayer
                    attribution="© OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                />
                <Marker position={[lat, lng]}>
                    {markerLabel ? <Popup>{markerLabel}</Popup> : null}
                </Marker>
            </MapContainer>
        </div>
    );
}
