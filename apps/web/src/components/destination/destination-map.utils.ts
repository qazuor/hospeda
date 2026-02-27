/**
 * Pure utility functions extracted from LitoralMap.astro frontmatter and inline script.
 * Enables unit testing of coordinate conversion and text truncation logic.
 */

/** Geographic bounds defining the map region */
interface GeoBounds {
    /** Minimum latitude (southern boundary) */
    readonly latMin: number;
    /** Maximum latitude (northern boundary) */
    readonly latMax: number;
    /** Minimum longitude (western boundary) */
    readonly lonMin: number;
    /** Maximum longitude (eastern boundary) */
    readonly lonMax: number;
}

/** Input for converting geographic coordinates to SVG position */
interface GeoToSvgInput {
    /** Latitude as a string (parsed to number) */
    readonly lat: string;
    /** Longitude as a string (parsed to number) */
    readonly lon: string;
    /** Geographic bounds of the map region */
    readonly bounds: GeoBounds;
    /** SVG viewBox width in pixels */
    readonly svgWidth: number;
    /** SVG viewBox height in pixels */
    readonly svgHeight: number;
}

/** Result of coordinate conversion */
interface GeoToSvgResult {
    /** SVG x coordinate */
    readonly x: number;
    /** SVG y coordinate */
    readonly y: number;
}

/**
 * Default geographic bounds for the Litoral/Entre Rios region.
 * Matches the constants in LitoralMap.astro.
 */
export const DEFAULT_BOUNDS: GeoBounds = {
    latMin: -34.1,
    latMax: -29.9,
    lonMin: -60.9,
    lonMax: -57.4
} as const;

/** Default SVG dimensions matching LitoralMap.astro */
export const DEFAULT_SVG_WIDTH = 200;
export const DEFAULT_SVG_HEIGHT = 280;

/** Inset margin applied to the SVG coordinate space */
const SVG_MARGIN = 20;

/**
 * Convert geographic coordinates (lat/lon strings) to SVG pixel position.
 * Applies clamping to the provided bounds and inverts the Y axis
 * (higher latitude = lower Y in SVG space).
 * Returns null if the input strings cannot be parsed to valid numbers.
 *
 * @param input - Lat/lon strings, geographic bounds, and SVG dimensions
 * @returns SVG coordinates or null if input is invalid
 */
export function geoToSvg({
    lat,
    lon,
    bounds,
    svgWidth,
    svgHeight
}: GeoToSvgInput): GeoToSvgResult | null {
    const latNum = Number.parseFloat(lat);
    const lonNum = Number.parseFloat(lon);

    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
        return null;
    }

    const clampedLat = Math.max(bounds.latMin, Math.min(bounds.latMax, latNum));
    const clampedLon = Math.max(bounds.lonMin, Math.min(bounds.lonMax, lonNum));

    const usableWidth = svgWidth - SVG_MARGIN * 2;
    const usableHeight = svgHeight - SVG_MARGIN * 2;

    const x =
        ((clampedLon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * usableWidth + SVG_MARGIN;
    /* Invert Y axis: higher latitude = lower Y in SVG */
    const y =
        ((bounds.latMax - clampedLat) / (bounds.latMax - bounds.latMin)) * usableHeight +
        SVG_MARGIN;

    return { x, y };
}

/** Input for truncating a destination name */
interface TruncateNameInput {
    /** The full name to truncate */
    readonly name: string;
    /** Maximum allowed character length */
    readonly maxLength: number;
}

/** Result of name truncation */
interface TruncateNameResult {
    /** The truncated name, with ellipsis if it exceeded maxLength */
    readonly truncated: string;
}

/**
 * Truncate a destination name for display in SVG tooltips.
 * If the name exceeds maxLength, it is clipped to (maxLength - 2) characters
 * and an ellipsis unicode character is appended.
 *
 * @param input - The name and maximum length
 * @returns The potentially truncated name
 */
export function truncateName({ name, maxLength }: TruncateNameInput): TruncateNameResult {
    if (name.length <= maxLength) {
        return { truncated: name };
    }

    return { truncated: `${name.slice(0, maxLength - 2)}\u2026` };
}

/** Input for computing tooltip position */
interface ComputeTooltipPositionInput {
    /** SVG x coordinate of the marker */
    readonly x: number;
    /** SVG y coordinate of the marker */
    readonly y: number;
    /** Width of the tooltip rectangle */
    readonly tooltipWidth: number;
    /** Total SVG viewBox width */
    readonly svgWidth: number;
}

/** Result of tooltip position computation */
interface ComputeTooltipPositionResult {
    /** Clamped x coordinate for the tooltip */
    readonly tooltipX: number;
    /** Clamped y coordinate for the tooltip */
    readonly tooltipY: number;
}

/**
 * Compute a clamped tooltip position so it never clips at SVG viewBox edges.
 * Centers the tooltip horizontally on the marker, then clamps to [0, svgWidth - tooltipWidth].
 * Positions vertically above the marker with a fixed 28px offset, clamped to min 0.
 *
 * @param input - Marker coordinates, tooltip width, and SVG width
 * @returns Clamped tooltip position
 */
export function computeTooltipPosition({
    x,
    y,
    tooltipWidth,
    svgWidth
}: ComputeTooltipPositionInput): ComputeTooltipPositionResult {
    const tooltipX = Math.max(0, Math.min(x - tooltipWidth / 2, svgWidth - tooltipWidth));
    const tooltipY = Math.max(0, y - 28);

    return { tooltipX, tooltipY };
}
