/**
 * HOS-141 T-005 — Slug computation + dedup (pipeline stage 3).
 *
 * `points_of_interest.slug` is UNIQUE (HOS-113), but 46 bare POI-slug segments
 * in the CSV are claimed by more than one destination (e.g. `municipalidad` by
 * 16). Those collisions are resolved with the destination-prefix strategy
 * (HOS-138 decision, OQ-1): a colliding bare slug becomes
 * `<destinationSlug>_<poiSlug>` (both in snake_case with underscores); the
 * non-colliding slugs stay bare. The final slug set is asserted globally
 * unique (G-3).
 */
import type { ReconciledRow } from './reconcile.js';

/**
 * Converts an arbitrary slug-ish string to snake_case with underscores:
 * lowercased, every run of non-`[a-z0-9]` characters collapsed to a single
 * `_`, and leading/trailing `_` trimmed. This is the OQ-1 convention (matches
 * the 12 shipped POI fixtures + the amenity/feature catalog).
 *
 * @param value - A slug-ish string (e.g. a hyphenated CSV id segment).
 * @returns The snake_case form.
 */
export function toSnakeCase(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Extracts the POI-slug segment from a composite CSV `id`
 * (`<destinationSlug>__<poiSlug>`): everything after the first `__`.
 *
 * @param id - The composite CSV id.
 * @returns The raw POI-slug segment (still hyphenated, pre-snake_case).
 * @throws {Error} If the id has no `__` separator.
 */
export function extractPoiSegment(id: string): string {
    const separatorIndex = id.indexOf('__');
    if (separatorIndex === -1) {
        throw new Error(`POI id '${id}' has no '__' destination/POI separator.`);
    }
    return id.slice(separatorIndex + 2);
}

/**
 * A reconciled row with its final, collision-resolved POI slug.
 */
export interface SluggedRow extends ReconciledRow {
    /** The final unique POI slug (bare, or destination-prefixed on collision). */
    readonly slug: string;
}

/**
 * Computes the final POI slug for every row, resolving cross-destination
 * collisions by destination-prefixing, and asserts global uniqueness (G-3).
 *
 * A bare POI slug claimed by more than one DISTINCT reconciled destination is
 * treated as colliding: every row carrying it is prefixed
 * `<destinationSlug>_<poiSlug>`. Bare slugs used by a single destination stay
 * bare. Any residual duplicate in the final set (e.g. two identical POIs in the
 * same destination) is a hard error — the pipeline fails loud rather than
 * emitting a duplicate `slug`.
 *
 * @param params.rows - The reconciled rows (destination slug already fixed up).
 * @returns Each row with its final unique `slug`.
 * @throws {Error} If the final slug set still contains a duplicate.
 */
export function computeSlugs(params: { readonly rows: readonly ReconciledRow[] }): SluggedRow[] {
    const { rows } = params;

    // First pass: bare slug per row + the set of distinct destinations per bare slug.
    const bareSlugs = rows.map((r) => toSnakeCase(extractPoiSegment(r.row.id)));
    const destinationsByBare = new Map<string, Set<string>>();
    rows.forEach((r, i) => {
        const bare = bareSlugs[i] as string;
        const set = destinationsByBare.get(bare) ?? new Set<string>();
        set.add(r.destinationSlug);
        destinationsByBare.set(bare, set);
    });

    // Second pass: prefix colliding slugs (claimed by >1 destination).
    const slugged: SluggedRow[] = rows.map((r, i) => {
        const bare = bareSlugs[i] as string;
        const collides = (destinationsByBare.get(bare)?.size ?? 0) > 1;
        const slug = collides ? `${toSnakeCase(r.destinationSlug)}_${bare}` : bare;
        return { ...r, slug };
    });

    // Assert global uniqueness (G-3).
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const s of slugged) {
        const previous = seen.get(s.slug);
        if (previous === undefined) {
            seen.set(s.slug, s.row.id);
        } else {
            duplicates.push(`  slug='${s.slug}' claimed by both ${previous} and ${s.row.id}`);
        }
    }
    if (duplicates.length > 0) {
        throw new Error(
            `POI slug dedup produced ${duplicates.length} duplicate slug(s):\n${duplicates.join('\n')}`
        );
    }

    return slugged;
}
