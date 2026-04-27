/**
 * SEO address derivation helpers (SPEC-095).
 *
 * The accommodation and event entities no longer carry a flat `city`/`state`/
 * `country` shape — geographic context lives on the `cityDestination`
 * relation. JSON-LD components need the legacy `addressLocality` /
 * `addressRegion` / `addressCountry` triplet, so this module bridges the gap
 * by parsing the destination's materialized `path`.
 */

/**
 * Pure helper: derive structured address parts from a `cityDestination` path.
 *
 * Path convention: `/{country}/{region}/{province}/{city}` for Argentine
 * destinations (e.g. `/argentina/litoral/entre-rios/concepcion-del-uruguay`).
 * The province segment lives at index 2 (zero-based). Other segments are
 * decorative for SEO purposes and not currently consumed downstream.
 *
 * Country is hardcoded to `AR` for MVP — multi-country support is deferred
 * until destinations outside Argentina ship.
 *
 * @param cityName - Display name for the city (e.g. `'Concepción del Uruguay'`).
 *   Used as the `addressLocality` value.
 * @param cityPath - Materialized destination path
 *   (e.g. `/argentina/litoral/entre-rios/concepcion-del-uruguay`). Used to
 *   parse the province slug for `addressRegion`.
 * @returns `{ addressLocality, addressRegion, addressCountry }` — all strings,
 *   empty when the source data is missing.
 */
export function parseCityPathToAddress({
    cityName,
    cityPath
}: {
    readonly cityName: string;
    readonly cityPath: string;
}): {
    readonly addressLocality: string;
    readonly addressRegion: string;
    readonly addressCountry: string;
} {
    const segments = cityPath.split('/').filter((s) => s.length > 0);
    // Argentine paths: [country, region, province, city] → province at index 2.
    const provinceSlug = segments.length >= 3 ? (segments[2] ?? '') : '';
    return {
        addressLocality: cityName,
        addressRegion: provinceSlug,
        addressCountry: 'AR'
    };
}
