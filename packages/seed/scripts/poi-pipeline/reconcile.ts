/**
 * HOS-141 T-004 — Destination-slug reconciliation (pipeline stage 2).
 *
 * The CSV's `destinationSlug` values must resolve to real seeded destination
 * slugs before any POI can be attached to a destination. Two CSV values do
 * not match a real fixture slug (`pueblo-liebig`, `villa-paranacito`); those
 * are fixed via {@link DESTINATION_SLUG_FIXUPS}. Any value that neither maps
 * through the fixup table nor already matches a real slug is a hard error —
 * the pipeline fails loud rather than silently dropping the POI (G-4, R-5).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINATION_SLUG_FIXUPS } from './constants.js';
import type { RawCsvRow } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the seeded destination fixture directory. */
const DESTINATION_DATA_DIR = path.resolve(__dirname, '../../src/data/destination');

/** Minimal destination metadata the pipeline needs at runtime. */
export interface RealDestinationRecord {
    readonly slug: string;
    readonly name: string;
    readonly center: {
        readonly lat: number;
        readonly long: number;
    };
}

interface RawDestinationFixture {
    readonly slug?: unknown;
    readonly name?: unknown;
    readonly location?: {
        readonly coordinates?: {
            readonly lat?: unknown;
            readonly long?: unknown;
        };
    };
}

/**
 * Loads the real seeded destination catalog (slug + display name + center).
 *
 * @param params.dir - Override for the fixture directory (defaults to the real
 *   seed data dir). Primarily for tests.
 * @returns The destination catalog keyed by slug.
 */
export function loadRealDestinations(
    params: { readonly dir?: string } = {}
): Map<string, RealDestinationRecord> {
    const dir = params.dir ?? DESTINATION_DATA_DIR;
    const destinations = new Map<string, RealDestinationRecord>();

    for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) {
            continue;
        }
        const parsed = JSON.parse(
            readFileSync(path.join(dir, file), 'utf8')
        ) as RawDestinationFixture;
        const slug = typeof parsed.slug === 'string' ? parsed.slug : null;
        const name = typeof parsed.name === 'string' ? parsed.name : null;
        const lat = Number(parsed.location?.coordinates?.lat);
        const long = Number(parsed.location?.coordinates?.long);

        if (slug === null || name === null || !Number.isFinite(lat) || !Number.isFinite(long)) {
            throw new Error(
                `Destination fixture '${file}' is missing a valid slug/name/location.coordinates center.`
            );
        }

        destinations.set(slug, {
            slug,
            name,
            center: { lat, long }
        });
    }

    return destinations;
}

/**
 * Loads the set of real seeded destination slugs from the destination fixture
 * JSON files (`packages/seed/src/data/destination/*.json`). Reading the
 * fixtures at runtime keeps the reconciler correct if the destination catalog
 * changes, rather than hard-coding a slug list that could drift.
 *
 * @param params.dir - Override for the fixture directory (defaults to the real
 *   seed data dir). Primarily for tests.
 * @returns The set of real destination slugs.
 */
export function loadRealDestinationSlugs(params: { readonly dir?: string } = {}): Set<string> {
    return new Set(loadRealDestinations(params).keys());
}

/**
 * Reconciles a single raw destination slug: applies the fixup table, then
 * verifies the result is a real seeded slug.
 *
 * @param params.slug - The raw CSV `destinationSlug`.
 * @param params.realSlugs - The set of real seeded destination slugs.
 * @returns The reconciled slug, or `null` if it does not resolve to a real one.
 */
export function reconcileDestinationSlug(params: {
    readonly slug: string;
    readonly realSlugs: ReadonlySet<string>;
}): string | null {
    const { slug, realSlugs } = params;
    const mapped = DESTINATION_SLUG_FIXUPS[slug] ?? slug;
    return realSlugs.has(mapped) ? mapped : null;
}

/**
 * A raw row paired with its reconciled destination slug.
 */
export interface ReconciledRow {
    /** The original raw CSV row. */
    readonly row: RawCsvRow;
    /** The reconciled (real) destination slug. */
    readonly destinationSlug: string;
}

/**
 * Reconciles every row's destination slug, failing loud if ANY row's slug does
 * not resolve to a real seeded destination (G-4). The error lists every
 * offending `(id, destinationSlug)` so a data fix is unambiguous.
 *
 * @param params.rows - The raw CSV rows.
 * @param params.realSlugs - The set of real seeded destination slugs (defaults
 *   to {@link loadRealDestinationSlugs}).
 * @returns Each row paired with its reconciled destination slug.
 * @throws {Error} If one or more rows have an unresolvable destination slug.
 */
export function reconcileRows(params: {
    readonly rows: readonly RawCsvRow[];
    readonly realSlugs?: ReadonlySet<string>;
}): ReconciledRow[] {
    const { rows } = params;
    const realSlugs = params.realSlugs ?? loadRealDestinationSlugs();

    const reconciled: ReconciledRow[] = [];
    const unresolved: string[] = [];

    for (const row of rows) {
        const destinationSlug = reconcileDestinationSlug({ slug: row.destinationSlug, realSlugs });
        if (destinationSlug === null) {
            unresolved.push(`  ${row.id} (destinationSlug='${row.destinationSlug}')`);
            continue;
        }
        reconciled.push({ row, destinationSlug });
    }

    if (unresolved.length > 0) {
        throw new Error(
            `POI destination reconciliation failed for ${unresolved.length} row(s) — ` +
                `add a DESTINATION_SLUG_FIXUPS entry or fix the CSV:\n${unresolved.join('\n')}`
        );
    }

    return reconciled;
}
