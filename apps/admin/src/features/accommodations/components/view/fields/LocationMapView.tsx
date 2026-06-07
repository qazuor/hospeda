/**
 * @file LocationMapView.tsx
 * @description Read-only Leaflet map for the admin accommodation view page
 * (SPEC-097). Renders the exact pin since admin viewers always have
 * `ACCOMMODATION_LOCATION_EXACT_VIEW` (or are owners). Used as the embedded
 * map inside `LocationViewField` to replace the legacy "view on Google Maps"
 * external link.
 *
 * SSR safety: the actual Leaflet/react-leaflet implementation lives in
 * `LocationMapInner.tsx` and is loaded via `clientOnly(() => import(...))`
 * inside `React.lazy`. The TanStack-Start babel compiler strips the inner
 * dynamic import from the server build (replaced with a throwing arrow
 * function), so Leaflet (`window`-dependent at module init) never reaches
 * the SSR bundle. The `isMounted` guard ensures we never invoke the lazy
 * component during SSR, which would otherwise hit the throwing function.
 */
import { clientOnly } from '@tanstack/react-start';
import * as React from 'react';

const LazyLocationMapInner = React.lazy(
    clientOnly(() =>
        import('./LocationMapInner').then((mod) => ({ default: mod.LocationMapInner }))
    )
);

export interface LocationMapViewProps {
    readonly lat: number;
    readonly lng: number;
    readonly markerLabel?: string;
    readonly zoom?: number;
}

/**
 * Reserves the same 280px-tall frame as the inner map so the layout does
 * not jump when the chunk finishes loading on the client.
 */
function MapPlaceholder(): React.ReactElement {
    return (
        <div
            aria-hidden="true"
            className="overflow-hidden rounded-md border border-border bg-muted"
            style={{ width: '100%', height: 280 }}
        />
    );
}

export function LocationMapView({ lat, lng, markerLabel, zoom = 15 }: LocationMapViewProps) {
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <MapPlaceholder />;
    }

    return (
        <React.Suspense fallback={<MapPlaceholder />}>
            <LazyLocationMapInner
                lat={lat}
                lng={lng}
                markerLabel={markerLabel}
                zoom={zoom}
            />
        </React.Suspense>
    );
}
