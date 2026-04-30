import { qzpaySchema } from '@qazuor/qzpay-drizzle';
/**
 * Shared helpers for database integration tests (SPEC-061).
 *
 * Provides:
 * - {@link getTestPool}: shared pg.Pool per worker process
 * - {@link getTestDb}: cached Drizzle client connected to the test DB
 * - {@link withTestTransaction}: runs a callback inside a transaction that
 *   ALWAYS rolls back (clean state per test, parallel-safe)
 * - {@link withCleanSlate}: TRUNCATE-based clean slate for tests that need
 *   cross-transaction visibility
 * - {@link closeTestPool}: close the pool in afterAll() to prevent hanging
 *   workers
 * - {@link testData}: minimal factories (user, destination, tag) for tests
 *
 * Connection string is read from `HOSPEDA_TEST_DATABASE_URL`, set by
 * {@link ./global-setup.ts} after creating the ephemeral
 * `hospeda_integration_test` database.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as hospedaSchema from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';

/**
 * Combined schema that mirrors `packages/db/src/client.ts` so model and
 * relational queries used in tests resolve types identically to runtime code.
 */
const schema = { ...hospedaSchema, ...qzpaySchema };

/**
 * Sentinel error used to force a transaction rollback without surfacing as a
 * real failure. Caught only by {@link withTestTransaction}; never exported.
 */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool | null = null;
let cachedDb: DrizzleClient | null = null;

/**
 * Returns the connection string set by global-setup. Throws a clear error if
 * tests are invoked without going through `pnpm test:integration`.
 */
function getTestConnectionString(): string {
    const url = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!url) {
        throw new Error(
            'HOSPEDA_TEST_DATABASE_URL is not set. ' +
                'Run integration tests via "pnpm test:integration", which spawns global-setup.ts to create the test DB.'
        );
    }
    return url;
}

/**
 * Lazy-initialised pg.Pool, one instance per worker process.
 * `max: 5` keeps the total connection count predictable: 3 workers × 5 = 15
 * concurrent connections, well under PostgreSQL's default 100.
 */
export function getTestPool(): Pool {
    if (!pool) {
        pool = new Pool({ connectionString: getTestConnectionString(), max: 5 });
    }
    return pool;
}

/**
 * Returns the cached Drizzle client for the current worker. Created once and
 * reused so all tests in the worker share the same prepared statement cache.
 */
export function getTestDb(): DrizzleClient {
    if (!cachedDb) {
        // Object-form API recommended since drizzle-orm v0.35+. The result is
        // assignable to DrizzleClient (PgDatabase common base).
        cachedDb = drizzle({ client: getTestPool(), schema }) as unknown as DrizzleClient;
    }
    return cachedDb;
}

/**
 * Runs a test callback inside a transaction that is ALWAYS rolled back.
 *
 * Use this for the vast majority of integration tests. Each test gets a clean
 * state without TRUNCATE overhead, and parallel workers cannot interfere with
 * each other thanks to MVCC isolation.
 *
 * NOTE: Tests that need cross-transaction visibility (e.g. concurrent isolation
 * checks) must use {@link withCleanSlate} instead.
 *
 * @example
 * ```ts
 * it('inserts and finds within tx', async () => {
 *   await withTestTransaction(async (tx) => {
 *     await tx.insert(users).values(testData.user());
 *     const found = await tx.query.users.findMany();
 *     expect(found.length).toBeGreaterThan(0);
 *   });
 * });
 * ```
 */
export async function withTestTransaction(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getTestDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

/**
 * Runs a test callback against a clean DB by TRUNCATE-ing all user tables.
 *
 * Slower than {@link withTestTransaction} (TRUNCATE acquires ACCESS EXCLUSIVE
 * locks), so prefer the transaction helper unless the test specifically needs
 * to observe cross-transaction visibility (e.g. snapshot isolation tests).
 */
export async function withCleanSlate(fn: (db: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getTestDb();
    const p = getTestPool();

    const result = await p.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = result.rows.map((r) => `"${r.tablename}"`);
    if (tables.length > 0) {
        await p.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    }

    await fn(db);
}

/**
 * Closes the worker-local pool and clears the cached Drizzle client.
 * Call this from `afterAll()` in every integration test file.
 */
export async function closeTestPool(): Promise<void> {
    cachedDb = null;
    if (pool) {
        await pool.end();
        pool = null;
    }
}

// ---------------------------------------------------------------------------
// Legacy helpers (pre-SPEC-061)
// ---------------------------------------------------------------------------
// These predate the SPEC-061 globalSetup pipeline and are still consumed by
// `test/migrations/*.test.ts` to introspect the dev database via
// `HOSPEDA_DATABASE_URL`. Do NOT use them in new tests — prefer
// `withTestTransaction` + `getTestDb`.

/** Legacy: true when `HOSPEDA_DATABASE_URL` is set (dev DB available). */
export function isDbAvailable(): boolean {
    return Boolean(process.env.HOSPEDA_DATABASE_URL);
}

/** Legacy context returned by {@link getIntegrationContext}. */
export interface IntegrationContext {
    db: ReturnType<typeof drizzle>;
    pool: Pool;
}

/**
 * Legacy: builds a Drizzle client + Pool against `HOSPEDA_DATABASE_URL` for
 * one-off migration introspection tests. Callers must `await ctx.pool.end()`
 * in their `afterAll` hook.
 */
export function getIntegrationContext(): IntegrationContext {
    const connectionString = process.env.HOSPEDA_DATABASE_URL;
    if (!connectionString) {
        throw new Error(
            'Integration tests require HOSPEDA_DATABASE_URL. ' +
                'Run `pnpm db:start` and ensure apps/api/.env.local is populated.'
        );
    }
    const legacyPool = new Pool({ connectionString, max: 3 });
    const db = drizzle(legacyPool);
    return { db, pool: legacyPool };
}

/**
 * Minimal test data factories. Each factory returns the smallest payload that
 * satisfies all NOT NULL constraints for an entity. Tests should override only
 * the fields relevant to the assertion.
 *
 * Column shapes are verified against the actual Drizzle schemas in
 * `packages/db/src/schemas/`. See SPEC-061 review pass 5 for the audit.
 */
export const testData = {
    /**
     * Valid `users` row. Required NOT NULL columns without defaults are
     * `email` (unique) and `displayName`. The Better Auth customisation uses
     * `displayName`/`firstName`/`lastName` instead of a plain `name`.
     */
    user(overrides: Partial<typeof hospedaSchema.users.$inferInsert> = {}) {
        return {
            id: crypto.randomUUID(),
            email: `test-${crypto.randomUUID()}@example.com`,
            displayName: 'Test User',
            emailVerified: true,
            lifecycleState: 'ACTIVE' as const,
            createdById: null,
            ...overrides
        } satisfies typeof hospedaSchema.users.$inferInsert;
    },

    /**
     * Valid `destinations` row. Includes the JSONB `location` and `media`
     * shapes (BaseLocationType + Media) that the schema requires.
     */
    destination(overrides: Partial<typeof hospedaSchema.destinations.$inferInsert> = {}) {
        const uid = crypto.randomUUID().slice(0, 8);
        return {
            id: crypto.randomUUID(),
            slug: `test-dest-${uid}`,
            name: 'Test Destination',
            destinationType: 'CITY' as const,
            level: 4,
            path: `/test/dest-${uid}`,
            summary: 'Test destination summary',
            description: 'Test destination description',
            location: {
                state: 'Entre Rios',
                country: 'Argentina',
                coordinates: { lat: '-32.48', long: '-58.23' }
            },
            media: {
                featuredImage: {
                    moderationState: 'APPROVED',
                    url: 'https://example.com/test-destination.jpg'
                }
            },
            lifecycleState: 'ACTIVE' as const,
            ...overrides
        } satisfies typeof hospedaSchema.destinations.$inferInsert;
    },

    /**
     * Valid `tags` row aligned with the SPEC-086 schema (D-002, D-018).
     *
     * - No `slug` column on user-tags (PostTag has slug, lives in a
     *   separate table).
     * - `type` is required and `NOT NULL` — defaults to `'SYSTEM'` so the
     *   row passes the partial unique index without needing an `ownerId`.
     * - `ownerId` is `null` for INTERNAL/SYSTEM, required for USER (the
     *   caller must provide it via overrides for USER-typed fixtures).
     * - `description` replaces the legacy `notes` column.
     * - `name` includes a per-call random suffix so concurrent integration
     *   tests don't collide on the partial unique index
     *   `tags_system_name_idx` (unique on `name` WHERE type='SYSTEM').
     */
    tag(overrides: Partial<typeof hospedaSchema.tags.$inferInsert> = {}) {
        return {
            id: crypto.randomUUID(),
            name: `Test Tag ${crypto.randomUUID().slice(0, 8)}`,
            type: 'SYSTEM' as const,
            ownerId: null,
            description: null,
            color: 'BLUE' as const,
            lifecycleState: 'ACTIVE' as const,
            ...overrides
        } satisfies typeof hospedaSchema.tags.$inferInsert;
    }
} as const;
