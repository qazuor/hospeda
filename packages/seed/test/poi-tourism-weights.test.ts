/**
 * @fileoverview
 * Dual-write guard for the POI tourism-relevance weight scale.
 *
 * Data-migration `0032-poi-tourism-display-weights` inlines the
 * category → weight table (migrations are frozen historical records, so it
 * cannot import a shared constant). That leaves the baseline fixtures free to
 * drift away from it silently: a fresh `db:fresh` would then produce different
 * weights than a migrated environment, and nothing would fail.
 *
 * This test re-derives every fixture's expected `displayWeight` and
 * `isFeatured` from the migration's own table and asserts the JSON agrees. Edit
 * one side without the other and it fails, naming the fixtures.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const FIXTURE_DIR = resolve(__dirname, '../src/data/pointOfInterest');
const MIGRATION_PATH = resolve(
    __dirname,
    '../src/data-migrations/0032-poi-tourism-display-weights.ts'
);

/**
 * The 12 HOS-113 legacy fixtures carry no `categories` array — they received
 * theirs from data-migration 0012 — so their primary category is pinned here,
 * mirroring the same map inside 0032. Includes the three flagship corrections
 * that migration applies (two thermal complexes filed under `other`, the
 * national park under `park`).
 */
const LEGACY_PRIMARY_CATEGORY: Readonly<Record<string, string>> = {
    autodromo_concepcion_del_uruguay: 'sports_venue',
    balneario_itape: 'beach',
    basilica_inmaculada_concepcion: 'monument',
    complejo_termal_concordia: 'thermal_complex',
    isla_del_puerto: 'natural_area',
    mirador_costanera: 'viewpoint',
    palacio_san_jose: 'museum',
    parque_nacional_el_palmar: 'natural_area',
    parque_unzue: 'park',
    playa_banco_pelay: 'beach',
    plaza_francisco_ramirez: 'square',
    termas_de_federacion: 'thermal_complex'
};

const FEATURED_AT_OR_ABOVE = 100;

interface PoiFixture {
    readonly slug: string;
    readonly displayWeight: number;
    readonly isFeatured: boolean;
    readonly categories?: ReadonlyArray<{ readonly slug: string; readonly isPrimary?: boolean }>;
}

/**
 * Parse the `WEIGHT_BY_CATEGORY` table straight out of the migration source.
 * Reading the real file (rather than duplicating the table here) is what makes
 * this a drift guard instead of a third copy to keep in sync.
 */
function parseMigrationWeightTable(): Record<string, number> {
    const src = readFileSync(MIGRATION_PATH, 'utf8');
    const block = src.match(
        /const WEIGHT_BY_CATEGORY: Readonly<Record<string, number>> = \{([\s\S]*?)\n\};/
    );

    if (!block?.[1]) {
        throw new Error('Could not locate WEIGHT_BY_CATEGORY in 0032 — did the migration change?');
    }

    const table: Record<string, number> = {};
    for (const [, slug, weight] of block[1].matchAll(/^\s*(\w+):\s*(\d+),?\s*$/gm)) {
        table[slug as string] = Number(weight);
    }

    return table;
}

function loadFixtures(): PoiFixture[] {
    return readdirSync(FIXTURE_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => JSON.parse(readFileSync(resolve(FIXTURE_DIR, file), 'utf8')) as PoiFixture);
}

const WEIGHT_BY_CATEGORY = parseMigrationWeightTable();
const fixtures = loadFixtures();

function primaryCategoryOf(fixture: PoiFixture): string | undefined {
    const fromArray = fixture.categories?.find((category) => category.isPrimary)?.slug;
    return fromArray ?? LEGACY_PRIMARY_CATEGORY[fixture.slug];
}

describe('POI tourism-relevance weights — baseline vs migration 0032', () => {
    it('parses a complete table out of the migration (guard is not vacuous)', () => {
        expect(Object.keys(WEIGHT_BY_CATEGORY).length).toBeGreaterThanOrEqual(38);
        expect(WEIGHT_BY_CATEGORY.museum).toBe(100);
        expect(WEIGHT_BY_CATEGORY.health).toBe(25);
    });

    it('loads the whole fixture catalog', () => {
        expect(fixtures.length).toBeGreaterThan(800);
    });

    it('resolves a primary category for every fixture', () => {
        const unresolved = fixtures.filter((f) => !primaryCategoryOf(f)).map((f) => f.slug);

        expect(unresolved).toEqual([]);
    });

    it('gives every fixture the weight its primary category maps to', () => {
        const wrong = fixtures
            .map((fixture) => {
                const category = primaryCategoryOf(fixture) as string;
                const expected = WEIGHT_BY_CATEGORY[category];
                return expected !== undefined && fixture.displayWeight !== expected
                    ? `${fixture.slug}: ${category} => expected ${expected}, got ${fixture.displayWeight}`
                    : null;
            })
            .filter((entry): entry is string => entry !== null);

        expect(wrong).toEqual([]);
    });

    it('derives isFeatured from the weight, never independently', () => {
        const wrong = fixtures
            .filter(
                (fixture) => fixture.isFeatured !== fixture.displayWeight >= FEATURED_AT_OR_ABOVE
            )
            .map(
                (fixture) => `${fixture.slug}: w=${fixture.displayWeight} f=${fixture.isFeatured}`
            );

        expect(wrong).toEqual([]);
    });

    it('never ranks a service above a museum — the inversion this replaced', () => {
        // The pre-migration data had health at avg 100 and museum at 98.
        for (const service of ['health', 'services', 'government', 'transport']) {
            expect(WEIGHT_BY_CATEGORY[service]).toBeLessThan(WEIGHT_BY_CATEGORY.museum as number);
        }
        expect(WEIGHT_BY_CATEGORY.square).toBeLessThan(WEIGHT_BY_CATEGORY.museum as number);
    });

    it('keeps the region-defining draws in the top tier', () => {
        for (const slug of ['thermal_complex', 'beach', 'natural_area', 'museum']) {
            expect(WEIGHT_BY_CATEGORY[slug]).toBe(100);
        }
    });
});
