/**
 * @file LocationMap.client.tsx
 * @description Privacy-aware Leaflet map island for accommodation/destination
 * detail pages (SPEC-097). Renders a `Circle` for accommodations (approximate
 * mode) or a `Marker` for destinations (exact mode). Always rendered with
 * `client:only="react"` because Leaflet requires `window` and cannot SSR.
 *
 * SPEC-269: Leaflet and react-leaflet are lazy-loaded via React.lazy so they
 * are NOT included in the eager island bundle. The actual implementation lives
 * in `LocationMapInner.client.tsx` which becomes a separate async chunk.
 */
import { Spinner } from '@/components/shared/feedback/Spinner';
import { Suspense, lazy } from 'react';
import styles from './LocationMap.module.css';

// ---------------------------------------------------------------------------
// Types — exported so call-sites and LocationMapInner can share them without
// importing leaflet/react-leaflet. The type-only shape lives here to keep the
// outer wrapper free of any heavy imports.
// ---------------------------------------------------------------------------

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

/** Public prop type for LocationMap (shared with LocationMapInner). */
export type LocationMapProps = LocationMapApproximateProps | LocationMapExactProps;

// ---------------------------------------------------------------------------
// Lazy-loaded inner implementation (async chunk — loads Leaflet on demand)
// ---------------------------------------------------------------------------
const LocationMapInner = lazy(() =>
    import('./LocationMapInner.client').then((mod) => ({ default: mod.LocationMapInner }))
);

// ---------------------------------------------------------------------------
// Skeleton fallback — sized to match the map container dimensions so there
// is no Cumulative Layout Shift (CLS) while the Leaflet chunk loads.
// ---------------------------------------------------------------------------
function MapSkeleton() {
    return (
        <div
            className={styles.root}
            aria-hidden="true"
        >
            <div className={`${styles.mapWrapper} ${styles.skeleton}`}>
                <Spinner
                    size="lg"
                    label="Cargando mapa…"
                />
            </div>
        </div>
    );
}

/**
 * Privacy-aware Leaflet map for detail pages.
 *
 * The inner Leaflet/react-leaflet implementation is async-chunked via
 * React.lazy and rendered inside a Suspense boundary.  Call-sites keep using
 * `<LocationMap client:only="react" ... />` — nothing changes externally.
 *
 * @param props - {@link LocationMapProps}
 */
export function LocationMap(props: LocationMapProps) {
    return (
        <Suspense fallback={<MapSkeleton />}>
            <LocationMapInner {...props} />
        </Suspense>
    );
}
