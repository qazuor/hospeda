/**
 * HOS-919 T-013 -- host-trade fixtures carry `categorySlugs` and the example
 * seeder writes the `r_host_trade_category` join rows.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import exampleManifest from '../../src/manifest-example.json';
import requiredManifest from '../../src/manifest-required.json';
import { hostTradeCategoryIdFor } from '../../src/required/hostTradeCategories.seed.js';

const insertedByTable = new Map<string, unknown[][]>();
let counter = 0;

/** Minimal drizzle stand-in recording what each table receives. */
const fakeDb = {
    insert: () => {
        return {
            values: (rows: unknown) => {
                const list = Array.isArray(rows) ? rows : [rows];
                // Table identity is unreliable here (the test and the seeder can hold
                // different `@repo/db` instances), so classify by row shape.
                const name = 'categoryId' in (list[0] as object) ? 'join' : 'hostTrades';
                insertedByTable.set(name, [...(insertedByTable.get(name) ?? []), list]);
                const chain = {
                    onConflictDoNothing: () => chain,
                    returning: async () => {
                        counter += 1;
                        return [{ id: `host-trade-uuid-${counter}` }];
                    },
                    // join inserts are awaited without `.returning()`
                    // biome-ignore lint/suspicious/noThenProperty: thenable stub for drizzle's awaitable builder
                    then: (resolve: (value: unknown) => void) => resolve(undefined)
                };
                return chain;
            }
        };
    }
};

vi.mock('../../src/utils/logger.js', () => ({
    logger: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../src/utils/summaryTracker.js', () => ({
    summaryTracker: { trackSuccess: vi.fn(), trackError: vi.fn() }
}));

import { seedHostTrades } from '../../src/example/hostTrades.seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../../src/data/hostTrade');

interface Fixture {
    readonly id: string;
    readonly categorySlugs?: readonly string[];
    readonly category?: string;
}

const fixtures: readonly Fixture[] = readdirSync(FIXTURES)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(FIXTURES, file), 'utf-8')) as Fixture);

const catalogSlugs = new Set(
    requiredManifest.hostTradeCategories.map(
        (file) =>
            (
                JSON.parse(
                    readFileSync(join(__dirname, '../../src/data/hostTradeCategory', file), 'utf-8')
                ) as { slug: string }
            ).slug
    )
);

describe('hostTrade fixtures (HOS-919)', () => {
    it('declares every fixture in the example manifest', () => {
        expect(fixtures).toHaveLength(exampleManifest.hostTrades.length);
    });

    it('gives every fixture at least one slug present in the catalog baseline', () => {
        for (const fixture of fixtures) {
            expect(fixture.categorySlugs?.length ?? 0, fixture.id).toBeGreaterThan(0);
            for (const slug of fixture.categorySlugs ?? []) {
                expect(catalogSlugs.has(slug), `${fixture.id}: ${slug}`).toBe(true);
            }
        }
    });

    it('no longer carries the legacy `category` enum', () => {
        for (const fixture of fixtures) {
            expect(fixture, fixture.id).not.toHaveProperty('category');
        }
    });

    it('maps the pool fixture to both piletas and parque-jardineria', () => {
        const pool = fixtures.find((f) => f.id === '017-hostTrade-federacion-pileta');
        expect(pool?.categorySlugs).toEqual(['piletas', 'parque-jardineria']);
    });
});

describe('seedHostTrades (HOS-919)', () => {
    beforeEach(() => {
        insertedByTable.clear();
    });

    it('inserts 20 providers without the legacy category and 21 category links', async () => {
        const context = {
            actor: { id: 'actor-1', role: 'SUPER_ADMIN', permissions: [] },
            continueOnError: false,
            idMapper: {
                getMappedDestinationId: () => 'destination-uuid',
                getMappedUserId: () => 'user-uuid',
                setMapping: vi.fn()
            }
        } as never;

        await seedHostTrades(context, { db: fakeDb as never });

        const tradeRows = (insertedByTable.get('hostTrades') ?? []).flat() as Array<
            Record<string, unknown>
        >;
        expect(tradeRows).toHaveLength(20);
        for (const row of tradeRows) {
            expect(row).not.toHaveProperty('category');
        }

        const links = (insertedByTable.get('join') ?? []).flat() as Array<{
            hostTradeId: string;
            categoryId: string;
        }>;
        expect(links).toHaveLength(21);
        expect(links.every((link) => link.hostTradeId.startsWith('host-trade-uuid-'))).toBe(true);
        expect(links.map((l) => l.categoryId)).toContain(
            hostTradeCategoryIdFor({ slug: 'parque-jardineria' })
        );
    });
});
