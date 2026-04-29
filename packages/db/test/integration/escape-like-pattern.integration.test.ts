/**
 * Integration tests: LIKE wildcard character escaping against real PostgreSQL.
 *
 * These tests prove that escapeLikePattern(), safeIlike(), and buildSearchCondition()
 * correctly prevent LIKE wildcard injection when executed against a real database.
 *
 * Uses the SPEC-061 infrastructure: globalSetup creates the
 * `hospeda_integration_test` database, pushes the Drizzle schema, and exports
 * `HOSPEDA_TEST_DATABASE_URL`. This file then creates a small ad-hoc table
 * dedicated to LIKE pattern fixtures.
 */
import { ilike, sql } from 'drizzle-orm';
import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    buildSearchCondition,
    escapeLikePattern,
    safeIlike
} from '../../src/utils/drizzle-helpers';
import { closeTestPool, getTestDb } from './helpers';

/** Name of the ephemeral integration test table. Prefixed with `_` to distinguish from production tables. */
const LIKE_TEST_TABLE = '_like_integration_test';

/**
 * Drizzle table definition for the ephemeral test table.
 * Matches the CREATE TABLE statement in beforeAll().
 */
const likeTestItems = pgTable(LIKE_TEST_TABLE, {
    id: integer('id').primaryKey(),
    name: varchar('name', { length: 255 })
});

describe('LIKE wildcard escaping — integration', () => {
    beforeAll(async () => {
        const db = getTestDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(LIKE_TEST_TABLE)}`);
        await db.execute(
            sql`CREATE TABLE ${sql.identifier(LIKE_TEST_TABLE)} (
                id   INTEGER PRIMARY KEY,
                name VARCHAR(255)
            )`
        );

        await db.insert(likeTestItems).values([
            { id: 1, name: '50%off sale' }, // literal percent
            { id: 2, name: '50 percent off' }, // no percent — must NOT match literal-% search
            { id: 3, name: 'test_data' }, // literal underscore
            { id: 4, name: 'testXdata' }, // no underscore — must NOT match literal-_ search
            { id: 5, name: 'C:\\Users\\docs' }, // literal backslash
            { id: 6, name: 'CXUsersXdocs' }, // no backslash — must NOT match literal-\ search
            { id: 7, name: '%50_C:\\mixed' }, // all three metacharacters
            { id: 8, name: 'hello world' } // plain term, no metacharacters
        ]);
    });

    afterAll(async () => {
        const db = getTestDb();
        await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(LIKE_TEST_TABLE)}`);
        await closeTestPool();
    });

    // -------------------------------------------------------------------------
    // Group 1: escapeLikePattern + raw ilike (manual escape)
    // -------------------------------------------------------------------------
    describe('escapeLikePattern() — manual escape via raw ilike', () => {
        it('should match only the row with literal % when searching for "50%"', async () => {
            const escaped = `%${escapeLikePattern('50%')}%`;
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(ilike(likeTestItems.name, escaped));

            expect(rows.map((r) => r.id)).toContain(1); // '50%off sale'
            expect(rows.map((r) => r.id)).not.toContain(2); // '50 percent off'
        });

        it('should match only the row with literal _ when searching for "test_"', async () => {
            const escaped = `%${escapeLikePattern('test_')}%`;
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(ilike(likeTestItems.name, escaped));

            expect(rows.map((r) => r.id)).toContain(3); // 'test_data'
            expect(rows.map((r) => r.id)).not.toContain(4); // 'testXdata'
        });

        it('should match only the row with literal backslash when searching for "C:\\"', async () => {
            const escaped = `%${escapeLikePattern('C:\\')}%`;
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(ilike(likeTestItems.name, escaped));

            expect(rows.map((r) => r.id)).toContain(5); // 'C:\Users\docs'
            expect(rows.map((r) => r.id)).not.toContain(6); // 'CXUsersXdocs'
        });

        it('without escaping, "%" acts as wildcard and matches everything', async () => {
            // Demonstrates WHY escaping is necessary
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(ilike(likeTestItems.name, '%50%%'));

            // Without escaping, %50%% matches ANY row containing "50" (wildcard before + after)
            // Both row 1 ('50%off sale') and row 2 ('50 percent off') are matched
            expect(rows.length).toBeGreaterThanOrEqual(2);
        });

        it('without escaping, "_" acts as wildcard and matches one-character substitutions', async () => {
            // Demonstrates WHY escaping is necessary for underscore
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(ilike(likeTestItems.name, '%test_data%'));

            // Without escaping, "test_data" matches "testXdata" too (underscore = any char)
            expect(rows.map((r) => r.id)).toContain(3); // 'test_data' (literal match)
            expect(rows.map((r) => r.id)).toContain(4); // 'testXdata' (wildcard match)
        });
    });

    // -------------------------------------------------------------------------
    // Group 2: safeIlike() — the recommended wrapper
    // -------------------------------------------------------------------------
    describe('safeIlike() wrapper', () => {
        it('should match only literal % row when q contains %', async () => {
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(safeIlike(likeTestItems.name, '50%'));

            expect(rows.map((r) => r.id)).toContain(1); // '50%off sale'
            expect(rows.map((r) => r.id)).not.toContain(2); // '50 percent off'
        });

        it('should match only literal _ row when q contains _', async () => {
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(safeIlike(likeTestItems.name, 'test_'));

            expect(rows.map((r) => r.id)).toContain(3); // 'test_data'
            expect(rows.map((r) => r.id)).not.toContain(4); // 'testXdata'
        });

        it('should match only literal backslash row when q contains \\', async () => {
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(safeIlike(likeTestItems.name, 'C:\\'));

            expect(rows.map((r) => r.id)).toContain(5); // 'C:\Users\docs'
            expect(rows.map((r) => r.id)).not.toContain(6); // 'CXUsersXdocs'
        });

        it('should match only the combined-metacharacter row when q contains all three', async () => {
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(safeIlike(likeTestItems.name, '%50_C:\\'));

            expect(rows.map((r) => r.id)).toContain(7); // '%50_C:\mixed'
            // Should NOT widen to other rows via unescaped wildcards
            expect(rows.length).toBe(1);
        });

        it('should match a plain string without metacharacters', async () => {
            const rows = await getTestDb()
                .select()
                .from(likeTestItems)
                .where(safeIlike(likeTestItems.name, 'hello'));

            expect(rows.map((r) => r.id)).toContain(8); // 'hello world'
            expect(rows.length).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    // Group 3: buildSearchCondition() — end-to-end pipeline
    // -------------------------------------------------------------------------
    describe('buildSearchCondition() — full pipeline against real DB', () => {
        it('should return only the literal % row via buildSearchCondition', async () => {
            const condition = buildSearchCondition('50%', ['name'] as const, likeTestItems);
            if (!condition) throw new Error('Expected a SQL condition but got undefined');

            const rows = await getTestDb().select().from(likeTestItems).where(condition);

            expect(rows.map((r) => r.id)).toContain(1); // '50%off sale'
            expect(rows.map((r) => r.id)).not.toContain(2); // '50 percent off'
        });

        it('should return only the literal _ row via buildSearchCondition', async () => {
            const condition = buildSearchCondition('test_', ['name'] as const, likeTestItems);
            if (!condition) throw new Error('Expected a SQL condition but got undefined');

            const rows = await getTestDb().select().from(likeTestItems).where(condition);

            expect(rows.map((r) => r.id)).toContain(3); // 'test_data'
            expect(rows.map((r) => r.id)).not.toContain(4); // 'testXdata'
        });

        it('should return undefined and match nothing for an empty search term', async () => {
            const condition = buildSearchCondition('', ['name'] as const, likeTestItems);
            expect(condition).toBeUndefined();
        });

        it('should return undefined and match nothing for a whitespace-only search term', async () => {
            const condition = buildSearchCondition('   ', ['name'] as const, likeTestItems);
            expect(condition).toBeUndefined();
        });

        it('should trim the search term before matching', async () => {
            const condition = buildSearchCondition('  hello  ', ['name'] as const, likeTestItems);
            if (!condition) throw new Error('Expected a SQL condition for trimmed "hello"');

            const rows = await getTestDb().select().from(likeTestItems).where(condition);

            expect(rows.map((r) => r.id)).toContain(8); // 'hello world'
        });
    });

    // -------------------------------------------------------------------------
    // Group 4: Table name sanity check
    // -------------------------------------------------------------------------
    describe('test table', () => {
        it(`should be named "${LIKE_TEST_TABLE}"`, () => {
            expect(LIKE_TEST_TABLE).toMatch(/^_/); // ephemeral tables are prefixed with _
        });
    });
});
