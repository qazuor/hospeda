/**
 * HOS-2058 -- the seed baseline and data-migration 0146 agree.
 *
 * Dual-write (HOS-25): a fresh DB gets `features.category` and the moved
 * amenity `type` from the JSON fixtures; an already-seeded DB gets them from
 * 0146. This reads both off disk and fails if they drift, and checks the seed
 * JSON schemas still validate the enum values (and keep `category` optional so
 * fixtures added by other in-flight work keep validating).
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

describe('feature fixtures carry a category (HOS-2058)', () => {
    const fixtures = readDir('feature');
    const migrationCategoryBySlug = new Map(
        Object.entries(FEATURE_CATEGORY_BACKFILL).flatMap(([category, slugs]) =>
            slugs.map((slug) => [slug, category] as const)
        )
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
        // Scoped to the backfill on purpose: features added by other in-flight
        // work (e.g. dj_sets/karaoke from HOS-1787) may land without a category
        // while the column is nullable, and must not break this test.
        const bySlug = new Map(fixtures.map((fixture) => [fixture.slug, fixture]));
        for (const slug of migrationCategoryBySlug.keys()) {
            expect(bySlug.get(slug)?.category, slug).toBeDefined();
        }
    });

    it('every fixture that declares a category uses a FeatureCategoryEnum value', () => {
        const valid = new Set<string>(Object.values(FeatureCategoryEnum));
        for (const fixture of fixtures) {
            if (fixture.category === undefined) continue;
            expect(valid.has(fixture.category), fixture.slug).toBe(true);
        }
    });

    it('the baseline category equals the data-migration category for every backfilled slug', () => {
        const bySlug = new Map(fixtures.map((fixture) => [fixture.slug, fixture.category]));
        for (const [slug, category] of migrationCategoryBySlug) {
            expect(bySlug.get(slug), slug).toBe(category);
        }
    });

    it('feature.schema.json validates category against the enum and keeps it optional', () => {
        const schema = readSchema('feature.schema.json');
        expect(schema.properties.category?.enum).toEqual(Object.values(FeatureCategoryEnum));
        expect(schema.required).not.toContain('category');
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
