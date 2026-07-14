/**
 * HOS-141 T-009 — Category normalization (pipeline stage 4, G-2, OQ-2).
 *
 * The CSV's `categorySlugs` are semicolon-separated UPPER_SNAKE values
 * (`SQUARE; HISTORIC_SITE; PARK`). HOS-139 seeded the poi_category catalog
 * with exactly these 40 values lowercased to snake_case, so normalization is
 * `value.trim().toLowerCase()` — NOT an arbitrary hand-map. Every normalized
 * slug is validated against the real seeded catalog; a value that does not
 * resolve to a real slug fails loud. The first listed category becomes the
 * primary (OQ-2 first-listed).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSemicolon } from './loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the seeded poi_category fixture directory (HOS-139). */
const POI_CATEGORY_DATA_DIR = path.resolve(__dirname, '../../src/data/poiCategory');

/**
 * Loads the set of real seeded poi_category slugs from the HOS-139 fixtures
 * (`packages/seed/src/data/poiCategory/*.json`). Read at runtime so the
 * pipeline tracks the real catalog rather than a hard-coded list.
 *
 * @param params.dir - Override for the fixture directory (defaults to the real
 *   seed data dir). Primarily for tests.
 * @returns The set of real category slugs.
 */
export function loadRealCategorySlugs(params: { readonly dir?: string } = {}): Set<string> {
    const dir = params.dir ?? POI_CATEGORY_DATA_DIR;
    const slugs = new Set<string>();
    for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) {
            continue;
        }
        const parsed = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as { slug?: unknown };
        if (typeof parsed.slug === 'string') {
            slugs.add(parsed.slug);
        }
    }
    return slugs;
}

/**
 * A POI's assignment to one category, with the primary flag.
 */
export interface PoiCategoryAssignment {
    /** The canonical poi_category slug. */
    readonly slug: string;
    /** Whether this is the POI's primary (first-listed) category. */
    readonly isPrimary: boolean;
}

/**
 * Normalizes a raw `categorySlugs` cell into ordered, validated category
 * assignments. Splits on `;`, lowercases each value, preserves order and
 * multiplicity, marks the first as primary (OQ-2), and validates every slug
 * against the real seeded catalog.
 *
 * @param params.raw - The raw `categorySlugs` cell.
 * @param params.realSlugs - The set of real seeded poi_category slugs.
 * @param params.rowId - The row id, for error context.
 * @returns The ordered category assignments (first is primary).
 * @throws {Error} If the cell is empty or any value is not a real slug.
 */
export function normalizeCategories(params: {
    readonly raw: string;
    readonly realSlugs: ReadonlySet<string>;
    readonly rowId: string;
}): PoiCategoryAssignment[] {
    const { raw, realSlugs, rowId } = params;
    const slugs = splitSemicolon(raw).map((value) => value.toLowerCase());

    if (slugs.length === 0) {
        throw new Error(
            `POI '${rowId}' has no categorySlugs — every POI needs at least one category.`
        );
    }

    const unknown = slugs.filter((slug) => !realSlugs.has(slug));
    if (unknown.length > 0) {
        throw new Error(
            `POI '${rowId}' has categor(ies) not in the seeded catalog: ${unknown.join(', ')}.`
        );
    }

    return slugs.map((slug, index) => ({ slug, isPrimary: index === 0 }));
}
