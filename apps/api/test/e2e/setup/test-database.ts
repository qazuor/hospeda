import { initializeDb, resetDb, sql } from '@repo/db';
import { Pool } from 'pg';

/**
 * Test database manager for E2E tests
 * Provides transaction-based test isolation and cleanup
 */
export class TestDatabaseManager {
    private pool: Pool | null = null;
    private db: any | null = null;
    private activeTransactions: Set<any> = new Set();

    /**
     * Initialize test database connection.
     *
     * Reads HOSPEDA_DATABASE_URL exclusively (SPEC-035 canonical, SPEC-143 T-143-01).
     * The env file apps/api/.env.test is loaded by setup/env-setup.ts before this runs.
     * Throws if the variable is missing — no fallback by design.
     *
     * SPEC-143 T-143-65: calls `resetDb()` before `initializeDb(this.pool)` so the
     * `@repo/db` module-level singleton is cleared between test files. Without it,
     * the second file in a multi-file run inherits the first file's already-closed
     * client and every query fails. Also verifies the schema is present (via
     * {@link assertSchemaReady}) so the suite fails with a clear, actionable error
     * if the test DB was wiped by an external command instead of mid-test.
     */
    async setup(): Promise<void> {
        const connectionString = process.env.HOSPEDA_DATABASE_URL;
        if (!connectionString) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set. Ensure apps/api/.env.test is loaded by env-setup.ts before the test database connects.'
            );
        }

        this.pool = new Pool({ connectionString });

        try {
            const client = await this.pool.connect();
            client.release();
        } catch (error) {
            throw new Error(
                `Failed to connect to test database: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }

        // Clear any stale singleton from a previous test file in the same Node
        // fork before binding the new pool. See `resetDb` JSDoc for rationale.
        resetDb();
        this.db = initializeDb(this.pool);

        await this.assertSchemaReady(connectionString);
    }

    /**
     * Clean up test database connection.
     *
     * SPEC-143 T-143-65: calls `resetDb()` after closing the pool so the
     * `@repo/db` module-level singleton does not retain a reference to the
     * now-closed client. The next test file's `setup()` will then `initializeDb`
     * against a brand-new pool from scratch.
     */
    async teardown(): Promise<void> {
        // Close all active transactions
        for (const tx of this.activeTransactions) {
            try {
                await tx.rollback();
            } catch {
                // Ignore errors during cleanup
            }
        }
        this.activeTransactions.clear();

        // Close connection pool
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }

        this.db = null;
        resetDb();
    }

    /**
     * Verify the test database schema is present before any test queries run.
     *
     * Probes for `billing_plans` (the most touched billing table). If the
     * relation is missing the suite fails with an actionable instruction
     * naming the exact commands to rebuild the schema, instead of letting
     * tests fail mid-flow on a `Failed query: select id from billing_plans`
     * error that does not point at the cause.
     *
     * The check is deliberately narrow — one table — to keep startup fast.
     * Missing extras (triggers, materialized views, CHECK constraints) are
     * NOT detected here; tests that depend on those fail as usual, but the
     * extras script is mentioned in the failure message so the operator can
     * re-run both steps in one shot.
     */
    private async assertSchemaReady(connectionString: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        try {
            const result = await this.db.execute(sql`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'billing_plans'
                ) AS exists
            `);

            const exists = (result.rows[0] as { exists?: boolean } | undefined)?.exists === true;
            if (!exists) {
                throw new Error(
                    [
                        "Test database schema not initialized — table 'billing_plans' is missing.",
                        '',
                        'Rebuild it with:',
                        `  HOSPEDA_DATABASE_URL='${connectionString}' (cd packages/db && pnpm db:push)`,
                        `  packages/db/scripts/apply-postgres-extras.sh '${connectionString}'`,
                        '',
                        'The extras script is required by ADR-017 to install triggers, materialized',
                        'views, and JSONB CHECK constraints that drizzle-kit push does not see.'
                    ].join('\n')
                );
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes("'billing_plans' is missing")) {
                throw error;
            }
            throw new Error(
                `Failed to verify test database schema: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Begin a new transaction for test isolation
     * Returns a transaction client that can be used for all operations
     *
     * @deprecated SPEC-143: this implementation is structurally broken — Drizzle's
     *   `db.transaction(async tx => {...})` commits implicitly when the callback
     *   returns, leaving the returned `txClient` pointing at an already-closed
     *   transaction. The accompanying {@link rollbackTransaction} is a no-op.
     *   Six pre-existing test files still call this pair so we preserve it
     *   unchanged; new code should use {@link withRollback} instead.
     */
    async beginTransaction(): Promise<any> {
        if (!this.db) throw new Error('Database not initialized');

        // Create transaction
        let txClient: any;

        await this.db.transaction(async (tx: any) => {
            txClient = tx;
            this.activeTransactions.add(tx);
        });

        return txClient;
    }

    /**
     * Rollback a transaction (automatic cleanup after test)
     *
     * @deprecated SPEC-143: paired with {@link beginTransaction} which is broken;
     *   the transaction has already been committed by the time this is called.
     *   Use {@link withRollback} for new code.
     */
    async rollbackTransaction(txClient: any): Promise<void> {
        this.activeTransactions.delete(txClient);
        // Transaction is automatically rolled back when it goes out of scope
    }

    /**
     * Run a test body inside a transaction and ALWAYS roll back (SPEC-143 T-143-07).
     *
     * Correct replacement for the broken {@link beginTransaction} +
     * {@link rollbackTransaction} pair. Writes inside the callback do NOT persist.
     *
     * Usage:
     *
     * ```ts
     * await testDb.withRollback(async (tx) => {
     *     const { planId } = await createTestPlan({}, tx);
     *     // ... factories called with `tx` write inside the transaction ...
     *     // test assertions go here
     * });
     * // After the callback returns, the transaction is rolled back automatically.
     * ```
     *
     * Uses a sentinel error to force Drizzle's `db.transaction` to ROLLBACK; the
     * sentinel is caught and discarded so the caller sees either the callback's
     * return value or any non-sentinel error it threw.
     *
     * @param fn - Test body that receives the transaction client
     * @returns Whatever `fn` returns (after rollback has fired)
     */
    async withRollback<T>(fn: (tx: any) => Promise<T>): Promise<T> {
        if (!this.db) throw new Error('Database not initialized');

        const ROLLBACK_SENTINEL = Symbol('TestDatabaseManager.withRollback rollback');

        let captured: { kind: 'value'; value: T } | { kind: 'error'; error: unknown } | null = null;

        try {
            await this.db.transaction(async (tx: any) => {
                this.activeTransactions.add(tx);
                try {
                    const value = await fn(tx);
                    captured = { kind: 'value', value };
                } catch (error) {
                    captured = { kind: 'error', error };
                } finally {
                    this.activeTransactions.delete(tx);
                }
                // Throwing forces Drizzle to ROLLBACK the transaction.
                throw ROLLBACK_SENTINEL;
            });
        } catch (error) {
            if (error !== ROLLBACK_SENTINEL) {
                throw error;
            }
        }

        if (captured === null) {
            throw new Error(
                'TestDatabaseManager.withRollback: callback did not run (this should not happen)'
            );
        }

        const result = captured as { kind: 'value'; value: T } | { kind: 'error'; error: unknown };
        if (result.kind === 'error') {
            throw result.error;
        }
        return result.value;
    }

    /**
     * Clean all test data (truncate all tables)
     * WARNING: This is destructive, use only in test environment
     */
    async clean(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Safety check - ensure we're in test environment
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('clean() can only be called in test environment');
        }

        // Disable foreign key checks temporarily
        await this.db.execute(sql`SET session_replication_role = 'replica'`);

        try {
            // Get all table names
            const tables = await this.db.execute(sql`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT IN ('drizzle_migrations')
      `);

            // Truncate all tables
            for (const table of tables.rows) {
                await this.db.execute(sql.raw(`TRUNCATE TABLE "${table.tablename}" CASCADE`));
            }
        } finally {
            // Re-enable foreign key checks
            await this.db.execute(sql`SET session_replication_role = 'origin'`);
        }
    }

    /**
     * Get database instance
     */
    getDb() {
        if (!this.db) throw new Error('Database not initialized');
        return this.db;
    }
}

// Singleton instance
export const testDb = new TestDatabaseManager();
