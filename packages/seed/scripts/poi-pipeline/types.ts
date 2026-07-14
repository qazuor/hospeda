/**
 * HOS-141 — Shared types for the POI data-cleaning pipeline.
 *
 * These types describe the raw CSV shape and the geocoding contract used
 * across the pipeline stages. They are intentionally standalone (no
 * `@repo/*` imports) so the pipeline stays decoupled from the seed runtime
 * (HOS-141 spec NG-1/NG-4). The final v2 fixture output shape is defined
 * later (T-010/T-012), re-frozen against the merged HOS-138 schema.
 */

/**
 * A single raw row of the consolidated POI CSV, before any cleaning.
 *
 * Every field is the verbatim CSV string value (including empty strings for
 * blank cells and semicolon-separated multi-value cells like
 * {@link RawCsvRow.categorySlugs}). Parsing, trimming, splitting, and type
 * coercion happen in later stages — this type is a faithful mirror of the
 * 20 CSV columns, nothing more.
 */
export interface RawCsvRow {
    /** Composite id, e.g. `concepcion-del-uruguay__plaza-general-francisco-ramirez`. */
    readonly id: string;
    /** Destination slug as authored in the CSV (may need reconciliation, T-004). */
    readonly destinationSlug: string;
    /** Human-readable destination name. */
    readonly destinationName: string;
    /** Destination tier (`HIGH` | `MEDIUM` | `LOW`) as a raw string. */
    readonly destinationTier: string;
    /** Relation to the destination; `PRIMARY` for all raw rows. */
    readonly relation: string;
    /** POI display name (single Spanish string). */
    readonly name: string;
    /** POI description (single Spanish string). */
    readonly description: string;
    /** POI priority (`HIGH` | `MEDIUM` | `LOW`) as a raw string. */
    readonly priority: string;
    /** Street/landmark address; 100% populated in the source data. */
    readonly address: string;
    /** Latitude as a raw string; empty for the 717 coordinate-less rows. */
    readonly lat: string;
    /** Longitude as a raw string; empty for the 717 coordinate-less rows. */
    readonly lng: string;
    /** Verification flag as a raw string (`True` | `False`). */
    readonly verified: string;
    /** Provenance URL or source note. */
    readonly source: string;
    /** ISO date of verification as a raw string; empty when unverified. */
    readonly verifiedAt: string;
    /** Free-text notes. */
    readonly notes: string;
    /** Semicolon-separated UPPER_SNAKE category slugs, e.g. `SQUARE; HISTORIC_SITE; PARK`. */
    readonly categorySlugs: string;
    /** Semicolon-separated human-readable category names. */
    readonly categoryNames: string;
    /** Semicolon-separated keywords. */
    readonly keywords: string;
    /** Semicolon-separated slugs of nearby destinations (populated on 331 rows). */
    readonly nearbyDestinationSlugs: string;
    /** Semicolon-separated names of nearby destinations. */
    readonly nearbyDestinationNames: string;
}

/**
 * The ordered list of the 20 CSV column headers, in file order.
 *
 * Used by the loader (T-003) to validate the header line and map columns to
 * {@link RawCsvRow} fields.
 */
export const CSV_COLUMNS = [
    'id',
    'destinationSlug',
    'destinationName',
    'destinationTier',
    'relation',
    'name',
    'description',
    'priority',
    'address',
    'lat',
    'lng',
    'verified',
    'source',
    'verifiedAt',
    'notes',
    'categorySlugs',
    'categoryNames',
    'keywords',
    'nearbyDestinationSlugs',
    'nearbyDestinationNames'
] as const satisfies readonly (keyof RawCsvRow)[];

/**
 * Confidence tier assigned to a geocoding attempt.
 *
 * Only `high` and `medium` results are written to `lat`/`long`; `low` is
 * treated as {@link ConfidenceTier} `unresolved` (coordinates left null,
 * listed in the report) because a wrong coordinate is worse than a missing
 * one (HOS-141 spec §6.3.1).
 */
export type ConfidenceTier = 'high' | 'medium' | 'low' | 'unresolved';

/**
 * A resolved coordinate from the geocoder.
 *
 * `resolveCoordinates` returns `null` for an unresolved address; a non-null
 * result always carries a concrete `lat`/`long` plus the tier that decides
 * whether the caller accepts it (`high`/`medium`) or rejects it as
 * effectively unresolved (`low`).
 */
export interface GeocodeResult {
    /** Resolved latitude. */
    readonly lat: number;
    /** Resolved longitude. */
    readonly long: number;
    /** Confidence tier derived from the provider's own match-quality signal. */
    readonly confidence: Exclude<ConfidenceTier, 'unresolved'>;
    /** Provider identifier that produced this result, e.g. `nominatim`. */
    readonly provider: string;
}
