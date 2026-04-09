import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
/**
 * Shared helpers for database integration tests.
 *
 * Provides a lightweight test table (created/dropped per suite) and a
 * drizzle client connected to the real PostgreSQL instance.
 *
 * Usage pattern in each test file:
 *   const ctx = await getIntegrationContext();
 *   await createLikeTestTable(ctx.db);
 *   // ... run tests ...
 *   await dropLikeTestTable(ctx.db);
 *   await ctx.pool.end();
 */
import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

/** Name of the ephemeral integration test table. Prefixed with `_` to distinguish from production tables. */
export const LIKE_TEST_TABLE = '_like_integration_test';

/**
 * Drizzle table definition for the ephemeral test table.
 * Matches the CREATE TABLE statement in createLikeTestTable().
 */
export const likeTestItems = pgTable(LIKE_TEST_TABLE, {
    id: integer('id').primaryKey(),
    name: varchar('name', { length: 255 })
});

export type LikeTestDb = ReturnType<typeof drizzle>;

export interface IntegrationContext {
    db: LikeTestDb;
    pool: Pool;
}

/**
 * Returns true when HOSPEDA_DATABASE_URL is available in the environment.
 * Tests call this to decide whether to skip via `it.skipIf(!isDbAvailable())`.
 */
export function isDbAvailable(): boolean {
    return Boolean(process.env.HOSPEDA_DATABASE_URL);
}

/**
 * Creates a Drizzle client connected to the database named in HOSPEDA_DATABASE_URL.
 *
 * @throws {Error} If HOSPEDA_DATABASE_URL is not set.
 */
export function getIntegrationContext(): IntegrationContext {
    const connectionString = process.env.HOSPEDA_DATABASE_URL;
    if (!connectionString) {
        throw new Error(
            'Integration tests require HOSPEDA_DATABASE_URL. ' +
                'Run `pnpm db:start` and ensure apps/api/.env.local is populated.'
        );
    }
    const pool = new Pool({ connectionString, max: 3 });
    const db = drizzle(pool);
    return { db, pool };
}

/**
 * Creates the ephemeral integration test table.
 * Drops it first if it already exists to ensure a clean state.
 */
export async function createLikeTestTable(db: LikeTestDb): Promise<void> {
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(LIKE_TEST_TABLE)}`);
    await db.execute(
        sql`CREATE TABLE ${sql.identifier(LIKE_TEST_TABLE)} (
            id   INTEGER PRIMARY KEY,
            name VARCHAR(255)
        )`
    );
}

/**
 * Drops the ephemeral integration test table.
 * Safe to call even if the table does not exist.
 */
export async function dropLikeTestTable(db: LikeTestDb): Promise<void> {
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(LIKE_TEST_TABLE)}`);
}
