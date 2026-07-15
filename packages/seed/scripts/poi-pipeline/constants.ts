/**
 * HOS-141 — Fixed constants for the POI data-cleaning pipeline.
 *
 * All values here are hand-reviewed, deterministic, and committed as source
 * (no runtime inference) so the pipeline's behavior is auditable and its
 * output is reproducible.
 */

/**
 * Destination-slug reconciliation table (HOS-141 spec §6.1 step 2, G-4).
 *
 * Maps the two CSV `destinationSlug` values that do not match a real seeded
 * destination fixture slug to their canonical counterparts. The reconciler
 * (T-004) applies this table first, then validates every resulting slug
 * against the real destination catalog, failing loudly on any slug not
 * covered here and not already real (never silently dropping rows).
 *
 * Verified 2026-07-13 against the 22 seeded destination fixtures: these are
 * the ONLY two mismatches (no third exists).
 */
export const DESTINATION_SLUG_FIXUPS: Readonly<Record<string, string>> = {
    'pueblo-liebig': 'liebig',
    'villa-paranacito': 'paranacito'
} as const;

/**
 * Fixed regional qualifier appended to every geocoding query to disambiguate
 * short/generic addresses (HOS-141 spec §6.1 step 5). Sent as a suffix on the
 * address string handed to the geocoder.
 */
export const REGIONAL_QUALIFIER = ', Entre Rios, Argentina';

/**
 * Pinned ISO date stamped into every auto-geocode marker for a batch run. It
 * MUST be a fixed constant (not `new Date()`) so re-running the pipeline
 * produces byte-identical output (AC-7 idempotency). Bump it only for a
 * deliberate re-geocode batch.
 */
export const GEOCODE_BATCH_DATE = '2026-07-13';

/**
 * Maximum allowed geocoded distance from a POI's assigned destination center.
 *
 * HOS-177 deliberately uses a conservative fixed radius: the measured audit
 * showed that 15km catches the clearly-bad long-tail while preserving the
 * genuine ~10-13km Parque Nacional El Palmar / rural-primary cases.
 */
export const DESTINATION_RADIUS_GUARD_KM = 15;

/**
 * Extra slack granted to rows whose own address explicitly states
 * "a N km de <destino>". The stated distance remains the authority; this just
 * avoids rejecting a good geocode over minor cartographic / wording drift.
 */
export const EXPLICIT_DISTANCE_TOLERANCE_KM = 4;

/**
 * Very small radius around the destination center that strongly suggests the
 * geocoder matched the TOWN itself rather than the requested POI.
 */
export const DESTINATION_CENTROID_GUARD_METERS = 80;

/**
 * Substring stamped into (and searchable within) the `notes` of any POI whose
 * coordinates were derived by the pipeline's geocoder rather than
 * cartographically verified. A future human-verification pass can find these
 * rows with `WHERE notes LIKE '%auto-geocoded%'` (HOS-141 spec §6.1 step 7).
 *
 * This is the stable marker token; use {@link buildAutoGeocodeMarker} to build
 * the full human-readable annotation.
 */
export const AUTO_GEOCODE_MARKER = 'auto-geocoded';

/**
 * Builds the full auto-geocode provenance annotation appended to a geocoded
 * POI's `notes` (HOS-141 spec §6.1 step 7). Always contains
 * {@link AUTO_GEOCODE_MARKER} so it stays discoverable by substring search.
 *
 * @param params.provider - Geocoding provider identifier, e.g. `nominatim`.
 * @param params.isoDate - ISO-8601 date the coordinates were derived.
 * @returns The annotation sentence to append to `notes`.
 */
export function buildAutoGeocodeMarker(params: {
    readonly provider: string;
    readonly isoDate: string;
}): string {
    const { provider, isoDate } = params;
    return `Coordinates ${AUTO_GEOCODE_MARKER} from address on ${isoDate} via ${provider}; pending human cartographic verification.`;
}
