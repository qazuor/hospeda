import { initializeDb, sql } from '@repo/db';
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
     * Initialize test database connection
     */
    async setup(): Promise<void> {
        // Create PostgreSQL connection pool for tests
        this.pool = new Pool({
            connectionString:
                process.env.TEST_DB_URL ||
                `postgresql://${process.env.TEST_DB_USER || 'postgres'}:${process.env.TEST_DB_PASSWORD || 'postgres'}@${process.env.TEST_DB_HOST || 'localhost'}:${process.env.TEST_DB_PORT || 5432}/${process.env.TEST_DB_NAME || 'hospeda_test'}`
        });

        // Verify connection
        try {
            const client = await this.pool.connect();
            client.release();
        } catch (error) {
            throw new Error(
                `Failed to connect to test database: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }

        // Initialize Drizzle with test pool
        this.db = initializeDb(this.pool);
    }

    /**
     * Clean up test database connection
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
    }

    /**
     * Begin a new transaction for test isolation
     * Returns a transaction client that can be used for all operations
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
     */
    async rollbackTransaction(txClient: any): Promise<void> {
        this.activeTransactions.delete(txClient);
        // Transaction is automatically rolled back when it goes out of scope
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
