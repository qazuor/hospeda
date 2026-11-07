#!/usr/bin/env tsx
/**
 * @file check-catalog-slug-single-table.ts
 * @description HOS-2059 G-5: one catalog slug lives in exactly ONE catalog
 * table.
 *
 * The rule the catalog follows (D-1): an AMENITY is something the guest USES,
 * a FEATURE is what the place IS, and a POLICY is a rule of the place. A
 * concept therefore belongs to one table. Before HOS-2059, `laundry_service`
 * and `luggage_storage` existed as BOTH an amenity and a feature, so a host
 * could tick either, the public detail could show both, and a search filter
 * on one missed the listings that ticked the other.
 *
 * ## The predicate
 *
 * Every `slug` under `packages/seed/src/data/amenity/*.json` is absent from
 * `packages/seed/src/data/feature/*.json`, and vice versa. Red names every
 * shared slug and the two fixture files that carry it.
 *
 * It also fails when either directory yields ZERO slugs: a scan that found
 * nothing would otherwise report "no duplicates" for a catalog it never read.
 *
 * ## What it does NOT check
 *
 * - The live database. A retired row is soft-deleted, so its slug stays taken
 *   in its own table; the seed baseline is what new rows are written from.
 * - Synonyms (`wifi` vs `wifi_full_property`). Two slugs for one concept is a
 *   curation decision, not something a string comparison can see.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Repository root, resolved from this script's location. */
export const REPO_ROOT = resolve(HERE, '..');

/** Catalog fixture directories, relative to the repository root. */
export const CATALOG_DIRS = {
    amenity: 'packages/seed/src/data/amenity',
    feature: 'packages/seed/src/data/feature'
} as const;

/** One slug that appears in both catalogs. */
export interface CrossTableSlug {
    readonly slug: string;
    readonly amenityFile: string;
    readonly featureFile: string;
}

/**
 * Reads every fixture's `slug` in one directory.
 *
 * @param input - The directory to scan.
 * @returns A map from slug to the fixture file name that declares it.
 */
export function readCatalogSlugs({ dir }: { readonly dir: string }): ReadonlyMap<string, string> {
    const slugs = new Map<string, string>();
    for (const file of readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .sort()) {
        const parsed: unknown = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
        if (typeof parsed === 'object' && parsed !== null && 'slug' in parsed) {
            const { slug } = parsed;
            if (typeof slug === 'string' && slug.length > 0) slugs.set(slug, file);
        }
    }
    return slugs;
}

/**
 * Finds every slug present in both catalogs.
 *
 * @param input - The amenity and feature slug maps.
 * @returns The shared slugs, sorted.
 */
export function findCrossTableSlugs({
    amenities,
    features
}: {
    readonly amenities: ReadonlyMap<string, string>;
    readonly features: ReadonlyMap<string, string>;
}): readonly CrossTableSlug[] {
    const shared: CrossTableSlug[] = [];
    for (const [slug, amenityFile] of amenities) {
        const featureFile = features.get(slug);
        if (featureFile) shared.push({ slug, amenityFile, featureFile });
    }
    return shared.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Runs the guard against a repository root.
 *
 * @param root - Repository root (the real one, or a fixture tree in tests).
 * @returns The process exit code: 0 green, 1 red.
 */
export function run(root: string): number {
    const amenities = readCatalogSlugs({ dir: join(root, CATALOG_DIRS.amenity) });
    const features = readCatalogSlugs({ dir: join(root, CATALOG_DIRS.feature) });

    if (amenities.size === 0 || features.size === 0) {
        console.log(
            `ERROR: read ${amenities.size} amenity and ${features.size} feature slug(s). An empty scan proves nothing; check ${CATALOG_DIRS.amenity} and ${CATALOG_DIRS.feature}.`
        );
        return 1;
    }

    const shared = findCrossTableSlugs({ amenities, features });
    if (shared.length > 0) {
        console.log('ERROR: these slugs exist as BOTH an amenity and a feature:\n');
        for (const item of shared) {
            console.log(`  ${item.slug}`);
            console.log(`    amenity: ${CATALOG_DIRS.amenity}/${item.amenityFile}`);
            console.log(`    feature: ${CATALOG_DIRS.feature}/${item.featureFile}`);
        }
        console.log(
            '\nFix: keep the row in ONE table (amenity = what the guest USES, feature = what the place IS) and retire the other with a data-migration that moves its relations (see 0147-hos-2059-catalog-curation).'
        );
        return 1;
    }

    console.log(
        `OK: ${amenities.size} amenity and ${features.size} feature slug(s), none in both catalogs.`
    );
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    process.exit(run(REPO_ROOT));
}
