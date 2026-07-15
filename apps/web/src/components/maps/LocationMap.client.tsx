/**
 * @file LocationMap.client.tsx
 * @description Privacy-aware Leaflet map island for accommodation/destination
 * detail pages (SPEC-097). Renders a `Circle` for accommodations (approximate
 * mode), a `Marker` for destinations (exact mode), or a set of pins for a
 * destination's points of interest (multi mode, HOS-146). Always rendered
 * with `client:only="react"` because Leaflet requires `window` and cannot SSR.
 *
 * SPEC-269: Leaflet and react-leaflet are lazy-loaded via React.lazy so they
 * are NOT included in the eager island bundle. The actual implementation lives
 * in `LocationMapInner.client.tsx` which becomes a separate async chunk.
 */

import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/shared/feedback/Spinner';
import styles from './LocationMap.module.css';

// ---------------------------------------------------------------------------
// Types — exported so call-sites and LocationMapInner can share them without
// importing leaflet/react-leaflet. The type-only shape lives here to keep the
// outer wrapper free of any heavy imports.
// ---------------------------------------------------------------------------

/**
 * Strings every mode needs. Per-mode strings live on that mode's own
 * `i18nStrings` type instead of being optional here — an "optional field that
 * a JSDoc line says is required in mode X" compiles happily when omitted, and
 * the map then renders an empty element where the text should be. The
 * discriminated union below makes each requirement a compile error instead.
 */
interface LocationMapCommonStrings {
    readonly attribution: string;
    /**
     * Hint shown over the map while scroll-wheel zoom is disabled.
     * Defaults to "Hacé click en el mapa para activar el zoom".
     */
    readonly interactionHint?: string;
}

interface LocationMapApproximateStrings extends LocationMapCommonStrings {
    /**
     * The privacy notice rendered under an approximate map (SPEC-097). REQUIRED:
     * without it the map silently renders an empty bordered bar where the
     * "location is approximate" disclosure should be.
     */
    readonly approximateDisclaimer: string;
}

interface LocationMapExactStrings extends LocationMapCommonStrings {
    /** Popup text fallback when the `markerLabel` prop is omitted. */
    readonly markerLabel: string;
}

interface LocationMapMultiStrings extends LocationMapCommonStrings {
    /**
     * Label for the toggle that zooms out from the PRIMARY-only "city view" to
     * reveal the NEARBY pins too (HOS-146).
     */
    readonly showSurroundingsLabel: string;
    /** Label for the same toggle once expanded (HOS-146). */
    readonly hideSurroundingsLabel: string;
}

interface LocationMapCommonProps {
    readonly zoom?: number;
    readonly ariaLabel: string;
    readonly className?: string;
}

interface LocationMapApproximateProps extends LocationMapCommonProps {
    readonly mode: 'approximate';
    readonly lat: number;
    readonly lng: number;
    readonly radiusMeters: number;
    readonly i18nStrings: LocationMapApproximateStrings;
}

interface LocationMapExactProps extends LocationMapCommonProps {
    readonly mode: 'exact';
    readonly lat: number;
    readonly lng: number;
    readonly markerLabel?: string;
    readonly i18nStrings: LocationMapExactStrings;
}

/**
 * A single pin rendered by `mode: 'multi'` (HOS-146 — destination POI map).
 * `label`/`typeLabel` arrive already locale-resolved (via `translatePoiName` /
 * `translatePoiTypeLabel`) so this module never needs to know about i18n.
 */
export interface LocationMapMultiMarker {
    readonly id: string;
    readonly lat: number;
    readonly long: number;
    /** POI type — resolves the pin glyph via the same mapping the grid uses. */
    readonly type: string;
    /** PRIMARY (city-core) vs NEARBY (far-out) — drives the pin style and the initial viewport. */
    readonly relation: 'PRIMARY' | 'NEARBY';
    /** Popup title. */
    readonly label: string;
    /** Popup subtitle. */
    readonly typeLabel: string;
}

/** `[[south, west], [north, east]]` — Leaflet's `fitBounds` corner order. */
export type LocationMapBoundsTuple = readonly [
    readonly [number, number],
    readonly [number, number]
];

interface LocationMapMultiProps extends LocationMapCommonProps {
    readonly mode: 'multi';
    readonly markers: ReadonlyArray<LocationMapMultiMarker>;
    /** Bounds to fit on mount — frames only the PRIMARY markers ("city view"). */
    readonly initialBounds: LocationMapBoundsTuple;
    /**
     * Bounds to fit when the "ver alrededores" toggle is activated — frames
     * PRIMARY + NEARBY. Omit when there is nothing extra to reveal (no
     * NEARBY markers); the toggle button is hidden in that case.
     */
    readonly surroundingsBounds?: LocationMapBoundsTuple;
    readonly i18nStrings: LocationMapMultiStrings;
}

/** Public prop type for LocationMap (shared with LocationMapInner). */
export type LocationMapProps =
    | LocationMapApproximateProps
    | LocationMapExactProps
    | LocationMapMultiProps;

// ---------------------------------------------------------------------------
// Lazy-loaded inner implementations (async chunks — load Leaflet on demand).
//
// One chunk PER MODE, not one for all three: the multi-marker POI map needs
// `react-dom/server` + the @repo/icons POI-type table to build its pins, and a
// shared chunk would make every accommodation detail page and destination
// mini-map download that too. Splitting here (rather than nesting a second
// Suspense inside the inner map) also keeps it to one network round-trip per
// map, not two.
// ---------------------------------------------------------------------------
const LocationMapInner = lazy(() =>
    import('./LocationMapInner.client').then((mod) => ({ default: mod.LocationMapInner }))
);

const MultiMarkerMapInner = lazy(() =>
    import('./MultiMarkerMapInner.client').then((mod) => ({ default: mod.MultiMarkerMapInner }))
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
 * The inner Leaflet/react-leaflet implementations are async-chunked via
 * React.lazy and rendered inside a Suspense boundary, dispatched by `mode`.
 * Call-sites keep using `<LocationMap client:only="react" ... />` — nothing
 * changes externally.
 *
 * @param props - {@link LocationMapProps}
 */
export function LocationMap(props: LocationMapProps) {
    return (
        <Suspense fallback={<MapSkeleton />}>
            {props.mode === 'multi' ? (
                <MultiMarkerMapInner {...props} />
            ) : (
                <LocationMapInner {...props} />
            )}
        </Suspense>
    );
}
