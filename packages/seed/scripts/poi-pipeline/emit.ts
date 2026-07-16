/**
 * HOS-141 T-012 — Final per-POI fixture emit (pipeline stages 6-8, G-5, G-7).
 *
 * Assembles one v2 fixture object per POI from the reconciled + slugged +
 * category-normalized row plus its geocode outcome. The shape mirrors the real
 * merged `points_of_interest` v2 columns (T-010) extended with the
 * `categories` M2M assignments HOS-142 wires to `r_poi_category`.
 *
 * Provenance (G-5): rows that already had coordinates in the CSV pass their
 * `verified`/`verifiedAt`/`source`/`notes` through unmodified. Rows whose
 * coordinates were derived by the geocoder are forced `verified: false` and get
 * an auto-geocode marker appended to `notes` so a future human-verification
 * pass can find them. `type` is the deprecated-transitional column derived from
 * the primary category via HOS-139's `deriveTypeFromCategorySlug`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveTypeFromCategorySlug } from '@repo/schemas';
import type { PoiCategoryAssignment } from './categories.js';
import { AUTO_GEOCODE_MARKER, buildAutoGeocodeMarker } from './constants.js';
import { splitSemicolon } from './loader.js';
import type { GeocodeResult, RawCsvRow } from './types.js';

/** Localized text with Spanish populated from the CSV; en/pt left null. */
interface EsOnlyI18n {
    readonly es: string;
    readonly en: null;
    readonly pt: null;
}

/**
 * A single POI category assignment as emitted in the fixture (mirrors
 * {@link PoiCategoryAssignment}).
 */
export interface EmittedCategory {
    readonly slug: string;
    readonly isPrimary: boolean;
}

/**
 * The emitted v2 POI fixture shape (domain content only). HOS-142 owns the
 * final placement into the seed data folder plus the deterministic fixture id /
 * `$schema` header (§6.4), so those are intentionally not emitted here.
 */
export interface PoiFixture {
    readonly slug: string;
    readonly lat: number | null;
    readonly long: number | null;
    readonly type: string;
    readonly icon: null;
    readonly description: string;
    readonly nameI18n: EsOnlyI18n;
    readonly descriptionI18n: EsOnlyI18n;
    readonly translationMeta: Record<string, never>;
    readonly address: string;
    readonly keywords: readonly string[];
    readonly hasOwnPage: boolean;
    readonly isBuiltin: boolean;
    readonly isFeatured: boolean;
    readonly displayWeight: number;
    readonly verified: boolean;
    readonly verifiedAt: string | null;
    readonly source: string | null;
    readonly notes: string | null;
    readonly lifecycleState: 'ACTIVE';
    readonly categories: readonly EmittedCategory[];
}

/** Maps a CSV priority to its display weight (spec §7). */
const DISPLAY_WEIGHT_BY_PRIORITY: Readonly<Record<string, number>> = {
    HIGH: 100,
    MEDIUM: 50,
    LOW: 10
};

/** Reads the primary category slug from an ordered assignment list. */
function primaryCategorySlug(categories: readonly PoiCategoryAssignment[]): string {
    const primary = categories.find((c) => c.isPrimary) ?? categories[0];
    if (primary === undefined) {
        throw new Error('Cannot emit a POI with no categories.');
    }
    return primary.slug;
}

/** Trims a CSV cell to a value or null. */
function orNull(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Seed fixtures intentionally do not persist raw `verifiedAt` CSV strings.
 *
 * The CSV carries spreadsheet/export-level date cells (e.g. `46214`) rather
 * than a trustworthy domain timestamp. The seed contract is therefore to keep
 * `verifiedAt` null unless a future curation pass introduces a typed date on
 * purpose.
 */
function sanitizeVerifiedAt(_value: string): null {
    return null;
}

/** Source field max length enforced by the POI schema. */
const MAX_SOURCE_LENGTH = 200;

/**
 * Picks the first semicolon-delimited source entry that fits the schema limit.
 */
function sanitizeSource(value: string): string | null {
    for (const candidate of splitSemicolon(value)) {
        if (candidate.length <= MAX_SOURCE_LENGTH) {
            return candidate;
        }
    }
    return null;
}

/**
 * Builds one v2 POI fixture object from a fully-processed row.
 *
 * @param params.row - The raw CSV row (provenance source).
 * @param params.slug - The final unique slug (from dedup).
 * @param params.categories - The normalized, ordered category assignments.
 * @param params.geocoded - The accepted geocode result for a row that had no
 *   CSV coordinates, or `null` (row already had coords, or geocoding was
 *   unresolved/low-confidence).
 * @param params.geocodeIsoDate - Stable ISO date stamped into the auto-geocode
 *   marker (must be deterministic for idempotency — pinned per batch, not
 *   `new Date()` per run).
 * @returns The emitted fixture object.
 */
export function buildPoiFixture(params: {
    readonly row: RawCsvRow;
    readonly slug: string;
    readonly categories: readonly PoiCategoryAssignment[];
    readonly geocoded: GeocodeResult | null;
    readonly geocodeIsoDate: string;
}): PoiFixture {
    const { row, slug, categories, geocoded, geocodeIsoDate } = params;

    const hadOriginalCoords = row.lat.trim() !== '' && row.lng.trim() !== '';
    const csvVerified = row.verified.trim().toLowerCase() === 'true';

    let lat: number | null;
    let long: number | null;
    let verified: boolean;
    let verifiedAt: string | null;
    let notes: string | null;

    if (hadOriginalCoords) {
        lat = Number(row.lat);
        long = Number(row.lng);
        verified = csvVerified;
        verifiedAt = sanitizeVerifiedAt(row.verifiedAt);
        notes = orNull(row.notes);
    } else if (geocoded === null) {
        // Unresolved: keep null coordinates (OQ-4), carry provenance unchanged.
        lat = null;
        long = null;
        verified = csvVerified;
        verifiedAt = sanitizeVerifiedAt(row.verifiedAt);
        notes = orNull(row.notes);
    } else {
        // Coordinates derived by the pipeline: never claim verification (G-5).
        lat = geocoded.lat;
        long = geocoded.long;
        verified = false;
        verifiedAt = null;
        const marker = buildAutoGeocodeMarker({
            provider: geocoded.provider,
            isoDate: geocodeIsoDate
        });
        const existing = orNull(row.notes);
        notes = existing ? `${existing} ${marker}` : marker;
    }

    const description = row.description.trim();

    return {
        slug,
        lat,
        long,
        type: deriveTypeFromCategorySlug(primaryCategorySlug(categories)),
        icon: null,
        description,
        nameI18n: { es: row.name.trim(), en: null, pt: null },
        descriptionI18n: { es: description, en: null, pt: null },
        translationMeta: {},
        address: row.address.trim(),
        keywords: splitSemicolon(row.keywords),
        hasOwnPage: false,
        isBuiltin: true,
        isFeatured: row.priority.trim().toUpperCase() === 'HIGH',
        displayWeight: DISPLAY_WEIGHT_BY_PRIORITY[row.priority.trim().toUpperCase()] ?? 50,
        verified,
        verifiedAt,
        source: sanitizeSource(row.source),
        notes,
        lifecycleState: 'ACTIVE',
        categories: categories.map((c) => ({ slug: c.slug, isPrimary: c.isPrimary }))
    };
}

/** Injectable filesystem seam for writing fixtures (defaults to node fs). */
export interface FixtureWriteIO {
    /** Ensures the output directory exists. */
    ensureDir(dir: string): void;
    /** Writes one fixture file. */
    writeFile(filePath: string, contents: string): void;
}

/** Default node-fs-backed {@link FixtureWriteIO}. */
export function nodeFixtureWriteIO(): FixtureWriteIO {
    return {
        ensureDir: (dir) => mkdirSync(dir, { recursive: true }),
        writeFile: (filePath, contents) => writeFileSync(filePath, contents)
    };
}

/**
 * Writes one `<slug>.json` file per fixture into the output directory (§6.4:
 * a staged location, NEVER the live seed data folder). Deterministic: fixtures
 * are sorted by slug and pretty-printed so re-runs diff cleanly (AC-7).
 *
 * @param params.fixtures - The fixtures to write.
 * @param params.outputDir - The staged output directory.
 * @param params.io - Filesystem seam (defaults to node fs).
 * @returns The number of files written.
 */
export function writePoiFixtures(params: {
    readonly fixtures: readonly PoiFixture[];
    readonly outputDir: string;
    readonly io?: FixtureWriteIO;
}): number {
    const { fixtures, outputDir, io = nodeFixtureWriteIO() } = params;
    io.ensureDir(outputDir);
    const sorted = [...fixtures].sort((a, b) => a.slug.localeCompare(b.slug));
    for (const fixture of sorted) {
        io.writeFile(
            join(outputDir, `${fixture.slug}.json`),
            `${JSON.stringify(fixture, null, 4)}\n`
        );
    }
    return sorted.length;
}

/** Re-exported marker token so callers can assert/search provenance. */
export { AUTO_GEOCODE_MARKER };
