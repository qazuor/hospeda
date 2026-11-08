/**
 * HOS-2058 -- the seed baseline and data-migration 0146 agree.
 *
 * Dual-write (HOS-25): a fresh DB gets `features.category` and the moved
 * amenity `type` from the JSON fixtures; an already-seeded DB gets them from
 * 0146. This reads both off disk and fails if they drift, and checks the seed
 * JSON schemas still validate the enum values. Since release N+1 made
 * `features.category` NOT NULL, every feature fixture must declare one (a fresh
 * DB runs migrate before seed, so a fixture without it would fail the insert).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AmenitiesTypeEnum, FeatureCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    AMENITY_TYPE_MOVES,
    FEATURE_CATEGORY_BACKFILL
} from '../src/data-migrations/0146-hos-2058-feature-category-amenity-type.js';
import {
    CATALOG_MERGES,
    FEATURE_SLUG_RENAMES
} from '../src/data-migrations/0147-hos-2059-catalog-curation.js';
import { RETIRED_POLICY_FEATURE_SLUGS } from '../src/data-migrations/0154-hos-2060-retire-policy-catalog-rows.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../src');

interface Fixture {
    readonly slug: string;
    readonly category?: string;
    readonly type?: string;
}

const readDir = (dir: string): readonly Fixture[] =>
    readdirSync(join(SRC, 'data', dir))
        .filter((file) => file.endsWith('.json'))
        .map((file) => JSON.parse(readFileSync(join(SRC, 'data', dir, file), 'utf-8')) as Fixture);

const readSchema = (file: string) =>
    JSON.parse(readFileSync(join(SRC, 'schemas', file), 'utf-8')) as {
        readonly properties: Record<string, { readonly enum?: readonly string[] }>;
        readonly required: readonly string[];
    };

/**
 * HOS-2059 (0147) later retires some of the 0146 rows and renames one, and
 * HOS-2060 (0154) retires the policy features. The
 * baseline reflects the END state, so a 0146 slug is looked up under its
 * current name, and a retired one is not looked up at all.
 */
const RETIRED_FEATURES = new Set([
    ...CATALOG_MERGES.filter((merge) => merge.source.kind === 'feature').map(
        (merge) => merge.source.slug
    ),
    // HOS-2060 (0154) retires the features that stood in for house rules.
    ...RETIRED_POLICY_FEATURE_SLUGS
]);
const RENAMED_FEATURES = new Map(FEATURE_SLUG_RENAMES.map((rename) => [rename.from, rename.to]));

describe('feature fixtures carry a category (HOS-2058)', () => {
    const fixtures = readDir('feature');
    const migrationCategoryBySlug = new Map(
        Object.entries(FEATURE_CATEGORY_BACKFILL).flatMap(([category, slugs]) =>
            slugs.map((slug) => [slug, category] as const)
        )
    );
    /** The 0146 slugs still in the baseline, under their current name. */
    const liveCategoryBySlug = new Map(
        [...migrationCategoryBySlug]
            .filter(([slug]) => !RETIRED_FEATURES.has(slug))
            .map(([slug, category]) => [RENAMED_FEATURES.get(slug) ?? slug, category] as const)
    );

    it('the data-migration backfills exactly the 106 HOS-2058 slugs, each once', () => {
        expect(migrationCategoryBySlug.size).toBe(106);
        const total = Object.values(FEATURE_CATEGORY_BACKFILL).reduce(
            (sum, slugs) => sum + slugs.length,
            0
        );
        expect(total).toBe(106);
    });

    it('every backfilled slug has a fixture that declares its category', () => {
        // Scoped to the backfill; the test below covers every fixture.
        const bySlug = new Map(fixtures.map((fixture) => [fixture.slug, fixture]));
        for (const slug of liveCategoryBySlug.keys()) {
            expect(bySlug.get(slug)?.category, slug).toBeDefined();
        }
    });

    it('every fixture declares a FeatureCategoryEnum category (NOT NULL since N+1)', () => {
        const valid = new Set<string>(Object.values(FeatureCategoryEnum));
        expect(fixtures.length).toBeGreaterThan(0);
        for (const fixture of fixtures) {
            expect(fixture.category, fixture.slug).toBeDefined();
            expect(valid.has(fixture.category ?? ''), fixture.slug).toBe(true);
        }
    });

    it('the baseline category equals the data-migration category for every backfilled slug', () => {
        const bySlug = new Map(fixtures.map((fixture) => [fixture.slug, fixture.category]));
        for (const [slug, category] of liveCategoryBySlug) {
            expect(bySlug.get(slug), slug).toBe(category);
        }
    });

    it('feature.schema.json validates category against the enum and requires it (N+1)', () => {
        const schema = readSchema('feature.schema.json');
        expect(schema.properties.category?.enum).toEqual(Object.values(FeatureCategoryEnum));
        expect(schema.required).toContain('category');
    });
});

describe('amenity fixtures follow the HOS-2058 retype', () => {
    it('every moved amenity fixture carries its new type', () => {
        const bySlug = new Map(readDir('amenity').map((fixture) => [fixture.slug, fixture.type]));
        for (const move of AMENITY_TYPE_MOVES) {
            expect(bySlug.get(move.slug), move.slug).toBe(move.to);
        }
    });

    it('amenity.schema.json type enum equals AmenitiesTypeEnum', () => {
        const schema = readSchema('amenity.schema.json');
        expect(schema.properties.type?.enum).toEqual(Object.values(AmenitiesTypeEnum));
    });
});
