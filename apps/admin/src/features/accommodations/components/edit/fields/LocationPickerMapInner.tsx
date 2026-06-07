/**
 * @file LocationPickerMapInner.tsx
 * @description Client-only Leaflet map for the LocationPickerField. Loaded
 * by `LocationPickerField` via `clientOnly(() => import(...))` inside
 * `React.lazy` — the TanStack-Start babel compiler strips the inner dynamic
 * import from the server build (replaced with a throwing arrow function),
 * so the `leaflet` runtime (which references `window` at module init) never
 * reaches the SSR bundle.
 *
 * Split out of `LocationPickerField` so the parent form can stay free of
 * leaflet/react-leaflet imports. `PickerMarker` lives here because it must
 * be rendered inside `<MapContainer>` (uses `useMap` from react-leaflet).
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

// TYPE-WORKAROUND: Vite asset imports return `{ src: string }` in dev and a bare string in prod build; fall back to the string form when the object shape is absent.
L.Icon.Default.mergeOptions({
    iconRetinaUrl: (iconRetinaUrl as { src?: string }).src ?? (iconRetinaUrl as unknown as string),
    iconUrl: (iconUrl as { src?: string }).src ?? (iconUrl as unknown as string),
    shadowUrl: (iconShadowUrl as { src?: string }).src ?? (iconShadowUrl as unknown as string)
});

interface PickerMarkerProps {
    position: [number, number] | null;
    onMove: (lat: number, lng: number) => void;
    disabled?: boolean;
}

function PickerMarker({ position, onMove, disabled }: PickerMarkerProps) {
    const map = useMap();
    useEffect(() => {
        if (position) map.setView(position, map.getZoom());
    }, [map, position]);

    if (!position) return null;
    return (
        <Marker
            position={position}
            draggable={!disabled}
            eventHandlers={{
                dragend: (event) => {
                    const target = event.target as L.Marker;
                    const next = target.getLatLng();
                    onMove(next.lat, next.lng);
                }
            }}
        />
    );
}

export interface LocationPickerMapInnerProps {
    readonly center: [number, number];
    readonly defaultZoom: number;
    readonly markerPosition: [number, number] | null;
    readonly disabled?: boolean;
    readonly onMove: (lat: number, lng: number) => void;
}

export function LocationPickerMapInner({
    center,
    defaultZoom,
    markerPosition,
    disabled,
    onMove
}: LocationPickerMapInnerProps) {
    return (
        <MapContainer
            center={center}
            zoom={defaultZoom}
            scrollWheelZoom={false}
            style={{ width: '100%', height: 360, borderRadius: 12 }}
        >
            <TileLayer
                attribution="© OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
            />
            <PickerMarker
                position={markerPosition}
                onMove={onMove}
                disabled={disabled}
            />
        </MapContainer>
    );
}
