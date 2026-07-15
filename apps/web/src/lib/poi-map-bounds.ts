/**
 * @file poi-map-bounds.ts
 * @description Pure bounding-box helpers for `DestinationPOIMap` (HOS-146).
 * Extracted from the Leaflet-heavy map components so the bbox math is
 * unit-testable without mocking `react-leaflet`/`leaflet`.
 */

/** A single lat/long point used to compute a bounding box. */
export interface PoiMapBoundsPoint {
    readonly lat: number;
    readonly long: number;
}

/** `[[south, west], [north, east]]` — Leaflet's `fitBounds` corner order. */
export type LatLngBoundsTuple = readonly [readonly [number, number], readonly [number, number]];

/**
 * True only for a point whose coordinates are both real, finite numbers.
 * `NaN`/`Infinity` reaching Leaflet's `fitBounds` throws `Invalid LatLng
 * object` from inside a `client:only` island with no error boundary above it —
 * i.e. a blank map, not a caught error. These helpers are exported and pure, so
 * they validate rather than trust their callers.
 */
function isFinitePoint(point: PoiMapBoundsPoint): boolean {
    return Number.isFinite(point.lat) && Number.isFinite(point.long);
}

/**
 * Computes the smallest bounding box containing every point.
 *
 * Points with a non-finite `lat`/`long` are discarded before framing (a `NaN`
 * would otherwise poison every comparison and silently produce `NaN` bounds).
 *
 * @param params.points - The points to frame. A single point degenerates to
 *   a zero-size box, which Leaflet's `fitBounds` handles gracefully (it
 *   centers on the point and applies the requested `maxZoom`).
 * @returns The bounds tuple, or `null` when there is no finite point to frame.
 *
 * @example
 * computeBounds({ points: [{ lat: -32.5, long: -58.2 }, { lat: -32.4, long: -58.1 }] });
 * // → [[-32.5, -58.2], [-32.4, -58.1]]
 */
export function computeBounds({
    points
}: {
    readonly points: ReadonlyArray<PoiMapBoundsPoint>;
}): LatLngBoundsTuple | null {
    const finitePoints = points.filter(isFinitePoint);
    if (finitePoints.length === 0) return null;

    let north = finitePoints[0].lat;
    let south = finitePoints[0].lat;
    let east = finitePoints[0].long;
    let west = finitePoints[0].long;

    for (const point of finitePoints) {
        if (point.lat > north) north = point.lat;
        if (point.lat < south) south = point.lat;
        if (point.long > east) east = point.long;
        if (point.long < west) west = point.long;
    }

    return [
        [south, west],
        [north, east]
    ];
}

/** Smallest initial radius, in km. Below this a map frames an empty block. */
const MIN_FRAME_RADIUS_KM = 1.5;
/** Largest initial radius, in km. Past this the destination stops reading as a place. */
const MAX_FRAME_RADIUS_KM = 8;
/** Share of PRIMARY POIs the initial frame aims to contain. */
const FRAME_COVERAGE_PERCENTILE = 0.9;

const KM_PER_LAT_DEGREE = 111;
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in km.
 */
export function haversineKm({
    from,
    to
}: {
    readonly from: PoiMapBoundsPoint;
    readonly to: PoiMapBoundsPoint;
}): number {
    const deltaLat = toRadians(to.lat - from.lat);
    const deltaLong = toRadians(to.long - from.long);
    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLong / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Picks the initial frame radius: the distance covering
 * {@link FRAME_COVERAGE_PERCENTILE} of `points` from `center`, clamped to
 * [{@link MIN_FRAME_RADIUS_KM}, {@link MAX_FRAME_RADIUS_KM}].
 *
 * The percentile — rather than the maximum — is what makes this robust: a
 * single mis-geocoded POI cannot stretch the frame, which is exactly what
 * broke a plain bbox fit on 20 of 22 destinations (HOS-146).
 *
 * **The outlier resistance is conditional on sample size.** With `n` points the
 * chosen index is `Math.round((n - 1) * 0.9)`, which equals `n - 1` — the
 * MAXIMUM, not a percentile — for every `n <= 6`. So for a destination with 6
 * or fewer PRIMARY POIs this degenerates to "frame the farthest one", and a
 * single bad coordinate does stretch the radius (bounded only by
 * {@link MAX_FRAME_RADIUS_KM}, which is what keeps the failure mode cosmetic).
 * That is acceptable in practice because every real destination has 24-71
 * PRIMARY POIs, but it is a property of the data, not a guarantee of this
 * function.
 *
 * @returns The radius in km. Non-finite points are ignored; defaults to
 *   {@link MIN_FRAME_RADIUS_KM} when no usable point remains (or `center`
 *   itself is not finite), so a destination with no POIs still frames sanely.
 */
export function computeFrameRadiusKm({
    center,
    points
}: {
    readonly center: PoiMapBoundsPoint;
    readonly points: ReadonlyArray<PoiMapBoundsPoint>;
}): number {
    if (!isFinitePoint(center)) return MIN_FRAME_RADIUS_KM;

    const distances = points
        .filter(isFinitePoint)
        .map((point) => haversineKm({ from: center, to: point }))
        .filter((distance) => Number.isFinite(distance))
        .sort((a, b) => a - b);
    if (distances.length === 0) return MIN_FRAME_RADIUS_KM;

    const index = Math.min(
        distances.length - 1,
        Math.max(0, Math.round((distances.length - 1) * FRAME_COVERAGE_PERCENTILE))
    );

    return Math.min(MAX_FRAME_RADIUS_KM, Math.max(MIN_FRAME_RADIUS_KM, distances[index]));
}

/**
 * Builds a bounding box of `radiusKm` around `center`.
 *
 * Anchoring the initial frame to the destination's OWN coordinates — instead
 * of to the bbox of its POIs — keeps the frame predictable regardless of POI
 * data quality (HOS-146: the HOS-141 pipeline assigns POIs up to 39 km away
 * as `PRIMARY`, and on some destinations that dispersion is systematic rather
 * than a removable outlier).
 *
 * @returns The bounds tuple, or `null` when `center` or `radiusKm` is not a
 *   finite number — a `NaN` here would reach Leaflet's `fitBounds` and throw
 *   `Invalid LatLng object` inside a `client:only` island (blank map, no error
 *   surfaced). Longitude degrees are widened by latitude so the box stays
 *   roughly square on the ground rather than in degree space.
 */
export function computeBoundsAround({
    center,
    radiusKm
}: {
    readonly center: PoiMapBoundsPoint;
    readonly radiusKm: number;
}): LatLngBoundsTuple | null {
    if (!isFinitePoint(center) || !Number.isFinite(radiusKm)) return null;

    const latDelta = radiusKm / KM_PER_LAT_DEGREE;
    const kmPerLongDegree = KM_PER_LAT_DEGREE * Math.cos(toRadians(center.lat));
    // Guard the polar degenerate case where cos(lat) → 0.
    const longDelta = kmPerLongDegree > 0.1 ? radiusKm / kmPerLongDegree : latDelta;

    return [
        [center.lat - latDelta, center.long - longDelta],
        [center.lat + latDelta, center.long + longDelta]
    ];
}
