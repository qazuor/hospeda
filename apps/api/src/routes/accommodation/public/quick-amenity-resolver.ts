/**
 * @file quick-amenity-resolver.ts
 * @description Resolves the public boolean shortcut flags (`hasWifi`,
 * `hasPool`, `hasParking`, `allowsPets`) into the `anyAmenityGroups` domain
 * filter that the model understands.
 *
 * Each toggle maps to one or more canonical amenity slugs. The "pool" and
 * "parking" toggles intentionally include variants (`heated_pool`,
 * `covered_parking`, etc.) so the UI semantics — "has SOME kind of pool" —
 * match what users expect.
 *
 * Slugs are resolved to amenity UUIDs at process start (lazily, on first
 * call) and cached for the lifetime of the API process. The catalog is
 * essentially static at runtime; if it changes, restart the API.
 */

import { AmenityModel } from '@repo/db';

/**
 * Canonical slug groups per quick-filter toggle. Add new toggles here AND in
 * `HttpAccommodationSearchSchema` (boolean field) for them to take effect.
 *
 * The first slug of each group is the "primary" canonical name; variants
 * follow. OR semantics: a row matches if it has ANY of the listed slugs.
 */
const SLUG_GROUPS = {
    hasWifi: ['wifi'],
    hasPool: ['pool', 'heated_pool'],
    hasParking: ['parking', 'covered_parking', 'motorhome_parking', 'security_parking'],
    allowsPets: ['pet_friendly']
} as const;

export type QuickAmenityFlag = keyof typeof SLUG_GROUPS;

/** Process-lifetime cache of `slug → amenityId`. */
let slugToIdCache: Map<string, string> | null = null;

/**
 * Lazily load the full amenity catalog into the cache. Reuses the same map
 * across all subsequent calls.
 */
async function ensureCache(): Promise<Map<string, string>> {
    if (slugToIdCache) return slugToIdCache;
    const model = new AmenityModel();
    // The catalog is ~90 items today; pageSize 500 leaves headroom without
    // pagination complexity. If it ever grows past that, switch to a loop.
    const { items } = await model.findAll({}, { page: 1, pageSize: 500 });
    slugToIdCache = new Map(items.map((a) => [a.slug, a.id]));
    return slugToIdCache;
}

/**
 * Translate the public boolean shortcut flags into `anyAmenityGroups`:
 * one inner array per active toggle, containing the resolved amenity UUIDs.
 *
 * - Empty / all-false input returns `[]` so callers can spread unconditionally.
 * - A toggle whose slugs don't exist in the catalog is skipped (its inner
 *   array would be empty, which the model treats as a no-op).
 * - The order of resolved groups matches `SLUG_GROUPS` declaration order
 *   for deterministic logging / debugging.
 */
export async function resolveQuickAmenityFlags(
    flags: Partial<Record<QuickAmenityFlag, boolean>>
): Promise<string[][]> {
    const activeFlags = (Object.keys(SLUG_GROUPS) as QuickAmenityFlag[]).filter(
        (flag) => flags[flag] === true
    );
    if (activeFlags.length === 0) return [];

    const cache = await ensureCache();
    const groups: string[][] = [];
    for (const flag of activeFlags) {
        const slugs = SLUG_GROUPS[flag];
        const ids = slugs
            .map((slug) => cache.get(slug))
            .filter((id): id is string => id !== undefined);
        // ALWAYS push, even when empty. The model treats an empty inner array
        // as "no row can match" (emits `FALSE`) — that is the correct
        // semantics when the toggle is active but none of its canonical
        // slugs exist in the catalog. Skipping would silently degrade to
        // "return everything", which would mislead users into thinking the
        // filter matched some rows when it actually matched nothing.
        groups.push(ids);
    }
    return groups;
}

/**
 * Test-only. Resets the slug→id cache so tests can simulate a cold-start
 * resolver across runs.
 */
export function __resetQuickAmenityCacheForTests(): void {
    slugToIdCache = null;
}
