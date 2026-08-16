/**
 * Integration tests: accent-insensitive text search against real PostgreSQL.
 *
 * Regression coverage for H-136 (smoke agosto 2026): the accommodation "alta"
 * city picker could not find 6 of the 22 catalog cities when the host typed
 * them WITHOUT accents. City is a required field, so the sign-up stalled.
 *
 * Root cause: `safeIlike()` emitted a bare `ILIKE`, which PostgreSQL evaluates
 * case-insensitively but ACCENT-SENSITIVELY — `'Colón' ILIKE '%Colon%'` is
 * false. The fix wraps both sides in `unaccent()`.
 *
 * Both directions are asserted on purpose: normalizing only the query would
 * still fail for a row stored WITHOUT the accent that a user searches for
 * WITH one. Half a normalization is half a fix.
 *
 * These assertions cannot be made against a mock — accent folding is a
 * database behavior — so they live in the integration suite, which creates the
 * `unaccent` extension in its global setup.
 *
 * @see packages/db/src/utils/drizzle-helpers.ts  (safeIlike, buildSearchCondition)
 * @see packages/db/src/migrations/extras/035-unaccent.extension.sql
 */
import { sql } from 'drizzle-orm';
import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildSearchCondition, safeIlike } from '../../src/utils/drizzle-helpers';
import { closeTestPool, getTestDb } from './helpers';

/** Ephemeral fixture table. Prefixed with `_` to distinguish it from real tables. */
const ACCENT_TEST_TABLE = '_accent_integration_test';

const accentTestItems = pgTable(ACCENT_TEST_TABLE, {
    id: integer('id').primaryKey(),
    name: varchar('name', { length: 255 }),
    description: varchar('description', { length: 255 })
});

/**
 * The 6 accented cities of the live 22-city catalog, verified against
 * production on 2026-08-15. These are the exact rows H-136 measured as
 * unreachable when typed without accents.
 */
const ACCENTED_CITIES: readonly { readonly id: number; readonly name: string }[] = [
    { id: 1, name: 'Colón' },
    { id: 2, name: 'Concepción del Uruguay' },
    { id: 3, name: 'Gualeguaychú' },
    { id: 4, name: 'Chajarí' },
    { id: 5, name: 'Federación' },
    { id: 6, name: 'San José' }
];

/** Unaccented control rows: they must keep matching, and prove the inverse direction. */
const CONTROL_ROWS: readonly { readonly id: number; readonly name: string }[] = [
    { id: 10, name: 'Concordia' },
    { id: 11, name: 'Villaguay' },
    // Stored WITHOUT the accent a user would naturally type WITH one.
    // This is the direction a query-only normalization would miss.
    { id: 12, name: 'Parana' }
];

async function findNames(condition: ReturnType<typeof safeIlike>): Promise<string[]> {
    const rows = await getTestDb().select().from(accentTestItems).where(condition);
    return rows.map((row) => row.name ?? '');
}

describe('accent-insensitive search — integration', () => {
    beforeAll(async () => {
        const db = getTestDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(ACCENT_TEST_TABLE)}`);
        await db.execute(
            sql`CREATE TABLE ${sql.identifier(ACCENT_TEST_TABLE)} (
                id          INTEGER PRIMARY KEY,
                name        VARCHAR(255),
                description VARCHAR(255)
            )`
        );
        await db.insert(accentTestItems).values(
            [...ACCENTED_CITIES, ...CONTROL_ROWS].map((city) => ({
                id: city.id,
                name: city.name,
                description: `Alojamientos en ${city.name}`
            }))
        );
    });

    afterAll(async () => {
        const db = getTestDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(ACCENT_TEST_TABLE)}`);
        await closeTestPool();
    });

    // -------------------------------------------------------------------------
    // Instrument check — a probe that cannot detect the positive case proves
    // nothing when it reports a negative. Assert the fixtures are really there
    // before asserting anything about accents.
    // -------------------------------------------------------------------------
    describe('fixtures', () => {
        it('should have inserted every accented city verbatim', async () => {
            // Arrange / Act
            const rows = await getTestDb().select().from(accentTestItems);

            // Assert
            expect(rows).toHaveLength(ACCENTED_CITIES.length + CONTROL_ROWS.length);
            for (const city of ACCENTED_CITIES) {
                expect(rows.map((row) => row.name)).toContain(city.name);
            }
        });

        it('should find each accented city when typed WITH its accent', async () => {
            // The positive control: if this fails, every negative below is
            // meaningless because the probe itself is broken.
            for (const city of ACCENTED_CITIES) {
                // Act
                const names = await findNames(safeIlike(accentTestItems.name, city.name));

                // Assert
                expect(names).toContain(city.name);
            }
        });
    });

    // -------------------------------------------------------------------------
    // H-136 direction 1: typed WITHOUT accent, stored WITH accent
    // -------------------------------------------------------------------------
    describe('safeIlike() — unaccented query finds the accented row', () => {
        it.each([
            ['Colon', 'Colón'],
            ['Concepcion del Uruguay', 'Concepción del Uruguay'],
            ['Gualeguaychu', 'Gualeguaychú'],
            ['Chajari', 'Chajarí'],
            ['Federacion', 'Federación'],
            ['San Jose', 'San José']
        ])('should find "%s" typed without accents', async (typed, stored) => {
            // Act
            const names = await findNames(safeIlike(accentTestItems.name, typed));

            // Assert
            expect(names).toContain(stored);
        });

        it('should find the city from a partial unaccented prefix', async () => {
            // Act — "Concepc" spans the accent position, the case the smoke
            // found people stumbling into as an undiscoverable workaround.
            const names = await findNames(safeIlike(accentTestItems.name, 'Concepcion'));

            // Assert
            expect(names).toContain('Concepción del Uruguay');
        });
    });

    // -------------------------------------------------------------------------
    // H-136 direction 2: typed WITH accent, stored WITHOUT
    // -------------------------------------------------------------------------
    describe('safeIlike() — accented query finds the unaccented row', () => {
        it('should find a row stored without an accent when searched with one', async () => {
            // Act
            const names = await findNames(safeIlike(accentTestItems.name, 'Paraná'));

            // Assert — normalizing only the query would return [] here.
            expect(names).toContain('Parana');
        });

        it('should still find an unaccented row from an unaccented query', async () => {
            // Act
            const names = await findNames(safeIlike(accentTestItems.name, 'Concordia'));

            // Assert
            expect(names).toContain('Concordia');
        });
    });

    // -------------------------------------------------------------------------
    // Non-regression: the change must not turn ILIKE into a match-everything.
    // -------------------------------------------------------------------------
    describe('safeIlike() — still discriminates', () => {
        it('should return no rows for a term present in no name', async () => {
            // Act
            const names = await findNames(safeIlike(accentTestItems.name, 'Rosario'));

            // Assert
            expect(names).toEqual([]);
        });

        it('should keep escaping the % wildcard as a literal', async () => {
            // Act — no fixture name contains a literal %, so an escaped search
            // must find nothing rather than matching every row.
            const names = await findNames(safeIlike(accentTestItems.name, '%'));

            // Assert
            expect(names).toEqual([]);
        });

        it('should keep escaping the _ wildcard as a literal', async () => {
            // Act
            const names = await findNames(safeIlike(accentTestItems.name, '_'));

            // Assert
            expect(names).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // buildSearchCondition() inherits the behavior across every column it ORs.
    // -------------------------------------------------------------------------
    describe('buildSearchCondition() — inherits accent folding', () => {
        it('should match an unaccented query across name and description', async () => {
            // Arrange
            const condition = buildSearchCondition(
                'Gualeguaychu',
                ['name', 'description'],
                accentTestItems
            );
            expect(condition).toBeDefined();

            // Act
            const rows = await getTestDb()
                .select()
                .from(accentTestItems)
                // biome-ignore lint/style/noNonNullAssertion: asserted defined above
                .where(condition!);

            // Assert
            expect(rows.map((row) => row.name)).toContain('Gualeguaychú');
        });
    });
});
