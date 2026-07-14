/**
 * @file format-distance.ts
 * @description Pure formatting util for the "distance from the accommodation"
 * value surfaced by the nearby-POI feature (HOS-145). Renders sub-kilometer
 * distances in meters (rounded to the nearest 50m) and kilometer-or-larger
 * distances with one decimal, locale-aware (`Intl.NumberFormat`).
 */
import { toBcp47Locale } from '@repo/i18n/web';

import type { SupportedLocale } from './i18n';

/** Meter values are rounded to the nearest multiple of this constant. */
const METER_ROUNDING_STEP = 50;

/** Distances below this threshold (km) render in meters instead of km. */
const KM_THRESHOLD = 1;

/** Input for {@link formatDistanceKm}. */
export interface FormatDistanceKmParams {
    /** Distance in kilometers. Negative values are clamped to 0 defensively. */
    readonly distanceKm: number;
    /** Short locale code used to select the decimal separator. */
    readonly locale: SupportedLocale;
}

/**
 * Formats a distance (in kilometers) into a human-readable, locale-aware
 * string.
 *
 * Rounding rule:
 *  - `< 1 km`: rendered in meters, rounded to the nearest 50m
 *    (e.g. `0.349` → `"350 m"`, `0.949` → `"950 m"`).
 *  - `>= 1 km`: rendered in kilometers with exactly one decimal digit,
 *    using `Intl.NumberFormat` for the locale-aware decimal separator
 *    (e.g. `1.25` → `"1,3 km"` in `es`, `"1.3 km"` in `en`).
 *
 * Negative input (should not occur — the schema guards `distanceKm` as
 * nonnegative) is clamped to `0` defensively.
 *
 * @param params - {@link FormatDistanceKmParams}
 * @returns The formatted distance string (e.g. `"350 m"`, `"1,3 km"`).
 *
 * @example
 * ```ts
 * formatDistanceKm({ distanceKm: 0.349, locale: 'es' }); // "350 m"
 * formatDistanceKm({ distanceKm: 1.25, locale: 'es' });  // "1,3 km"
 * formatDistanceKm({ distanceKm: 1.25, locale: 'en' });  // "1.3 km"
 * ```
 */
export function formatDistanceKm({ distanceKm, locale }: FormatDistanceKmParams): string {
    const clamped = Math.max(0, distanceKm);

    if (clamped < KM_THRESHOLD) {
        const meters = Math.round((clamped * 1000) / METER_ROUNDING_STEP) * METER_ROUNDING_STEP;
        return `${meters} m`;
    }

    const bcp47 = toBcp47Locale(locale);
    const formattedKm = new Intl.NumberFormat(bcp47, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(clamped);
    return `${formattedKm} km`;
}
