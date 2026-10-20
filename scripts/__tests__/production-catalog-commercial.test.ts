import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-catalog-sql.js';
import { catalogId, PRODUCTION_PLAN_CATALOG } from '../production-catalog/catalog.js';
import { PRODUCTION_PLAN_PRICES } from '../production-catalog/commercial-catalog.js';
import {
    buildAddonLoads,
    buildBillingOptionLoad,
    buildCommercialCatalogLoads,
    generateCommercialCatalogSql
} from '../production-catalog/commercial-loads.js';

const MIGRATIONS = resolve('packages/db/src/migrations');
const MIGRATION_0176 = '0176_production_catalog_prices_addons.sql';

/**
 * The owner's live production prices (2026-10-20), ARS minor units, written by
 * hand so the test does not agree with the data file by construction.
 */
const EXPECTED_PRICES: Readonly<Record<string, readonly [number, number]>> = {
    'accommodation:owner-basico': [1_800_000, 18_000_000],
    'accommodation:owner-pro': [3_500_000, 35_000_000],
    'accommodation:owner-premium': [6_500_000, 65_000_000],
    'gastronomy:gastronomy-basico': [3_000_000, 30_000_000],
    'gastronomy:gastronomy-pro': [6_500_000, 65_000_000],
    'gastronomy:gastronomy-premium': [8_000_000, 80_000_000],
    'experience:experience-basico': [1_500_000, 15_000_000],
    'experience:experience-pro': [3_500_000, 35_000_000],
    'experience:experience-premium': [5_000_000, 50_000_000],
    'tourist:tourist-vip': [1_500_000, 15_000_000],
    'partner:partner-silver': [1_500_000, 15_000_000],
    'partner:partner-gold': [3_000_000, 30_000_000]
};

const directories: string[] = [];
afterEach(() => {
    for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Copies the real migrations into a temp dir, minus the files named. */
function migrationsWithout({ omit }: { readonly omit: readonly string[] }): string {
    const dir = mkdtempSync(join(tmpdir(), 'g18-commercial-'));
    directories.push(dir);
    for (const name of readdirSync(MIGRATIONS)) {
        if (name.endsWith('.sql') && !omit.includes(name)) {
            copyFileSync(join(MIGRATIONS, name), join(dir, name));
        }
    }
    return dir;
}

describe('production catalog prices (billing_option)', () => {
    it('every sellable plan has a monthly and an annual option at the live price', () => {
        // Arrange
        const load = buildCommercialCatalogLoads().billing_option;
        const sellable = PRODUCTION_PLAN_CATALOG.filter((plan) => plan.role === null);

        // Act
        const bySellablePlan = sellable.map((plan) => {
            const versionId = planVersionId({ vertical: plan.vertical, slug: plan.slug });
            const options = load.rows
                .filter((row) => row[1] === versionId)
                .map((row) => `${row[2]}=${row[3]} ${row[4]}`);
            return { key: `${plan.vertical}:${plan.slug}`, options };
        });

        // Assert
        expect(sellable).toHaveLength(12);
        expect(Object.keys(EXPECTED_PRICES)).toHaveLength(12);
        expect(load.rows).toHaveLength(24);
        for (const { key, options } of bySellablePlan) {
            const [monthly, annual] = EXPECTED_PRICES[key] ?? [];
            expect(options, key).toEqual([`monthly=${monthly} ARS`, `annual=${annual} ARS`]);
        }
    });

    it('no role plan (trial, pre-trial, floor) is priced', () => {
        const roleVersionIds = new Set(
            PRODUCTION_PLAN_CATALOG.filter((plan) => plan.role !== null).map((plan) =>
                planVersionId({ vertical: plan.vertical, slug: plan.slug })
            )
        );
        expect(roleVersionIds.size).toBe(15);
        expect(
            buildBillingOptionLoad().rows.filter((row) => roleVersionIds.has(row[1] as string))
        ).toEqual([]);
    });

    it('refuses a sellable plan without a price, and a price for a role plan', () => {
        expect(() => buildBillingOptionLoad({ prices: PRODUCTION_PLAN_PRICES.slice(1) })).toThrow(
            'Sellable plans without a price: accommodation:owner-basico.'
        );
        expect(() =>
            buildBillingOptionLoad({
                prices: [
                    ...PRODUCTION_PLAN_PRICES,
                    { vertical: 'accommodation', slug: 'floor', amounts: { monthly: 1, annual: 1 } }
                ]
            })
        ).toThrow('Price for accommodation:floor names no sellable catalog plan.');
    });
});

describe('production catalog add-ons', () => {
    it('loads the ten mapped add-ons and leaves the properties pack out', () => {
        const [addon, version, entitlement, limit, product] = buildAddonLoads();
        expect(addon.rows.map((row) => row[1])).toEqual([
            'extra-accommodations-5',
            'extra-photos-20',
            'extra-gastronomies-1',
            'extra-experiences-1',
            'visibility-boost-7d',
            'visibility-boost-30d',
            'visibility-boost-gastronomy-7d',
            'visibility-boost-gastronomy-30d',
            'visibility-boost-experience-7d',
            'visibility-boost-experience-30d'
        ]);
        expect(addon.rows.some((row) => row[1] === 'extra-properties-5')).toBe(false);
        expect(version.rows).toHaveLength(10);
        expect(entitlement.rows.map((row) => row[2])).toEqual(Array(6).fill('featured_listing'));
        expect(limit.rows.map((row) => `${row[2]}+${row[3]}`)).toEqual([
            'max_accommodations+5',
            'max_photos_per_accommodation+20',
            'max_gastronomies+1',
            'max_experiences+1'
        ]);
        expect(product.rows.map((row) => `${row[3]} ${row[5]} ${row[6]} ${row[7]}`)).toEqual([
            '1300000 PERIODICO monthly {accommodation}',
            '500000 PERIODICO monthly {accommodation}',
            '1500000 PERIODICO monthly {gastronomy}',
            '1500000 PERIODICO monthly {experience}',
            '500000 UNA_VEZ null {accommodation}',
            '1500000 UNA_VEZ null {accommodation}',
            '500000 UNA_VEZ null {gastronomy}',
            '1500000 UNA_VEZ null {gastronomy}',
            '500000 UNA_VEZ null {experience}',
            '1500000 UNA_VEZ null {experience}'
        ]);
    });

    it('a periodic product never sells a fixed-days version (extras 046)', () => {
        const [, version, , , product] = buildAddonLoads();
        const validity = new Map(version.rows.map((row) => [row[0], row[2]]));
        for (const row of product.rows) {
            if (row[5] === 'PERIODICO')
                expect(validity.get(row[2])).toBe('WHILE_SUBSCRIPTION_ALIVE');
            else expect(validity.get(row[2])).toBe('FIXED_DAYS');
        }
    });
});

describe('migration 0176 and GUARD:G18', () => {
    it('0176 is byte-identical to the generator after its header', () => {
        const sql = readFileSync(join(MIGRATIONS, MIGRATION_0176), 'utf8');
        expect(sql.slice(sql.indexOf('\n') + 1)).toBe(generateCommercialCatalogSql());
    });

    it('G18 over the real history compares the prices and the add-ons, green', () => {
        const result = run();
        expect(result.exitCode, result.output).toBe(0);
        expect(result.output).toContain('billing_option 24 row(s)');
        expect(result.output).toContain('addon_product 10 row(s)');
    });

    it('mutation: without 0176 G18 is red and names every sellable plan option', () => {
        const result = run({ migrationsDir: migrationsWithout({ omit: [MIGRATION_0176] }) });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('FAIL load production catalog billing_option');
        expect(result.output).toContain('FAIL load production catalog addon_product');
        for (const row of buildBillingOptionLoad().rows) {
            expect(result.output).toContain(`key '${row[0]}'`);
        }
    });
});

/** Version 1 id of a plan, as 0144 derives it. */
function planVersionId({
    vertical,
    slug
}: {
    readonly vertical: string;
    readonly slug: string;
}): string {
    return catalogId(`plan:${vertical}:${slug}:version:1`);
}
