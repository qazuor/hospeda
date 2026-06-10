import type { Pool } from 'pg';

/**
 * Cleanup helper for E2E tests (SPEC-092).
 *
 * Cascade-deletes test data created by a single E2E test, bypassing the
 * `delete_entity_bookmarks` trigger that has a known enum-vs-text comparison
 * bug in manual migration 0014 (documented in SPEC-061).
 *
 * The bypass uses `SET LOCAL session_replication_role = 'replica'` which
 * disables ALL triggers for the duration of the transaction. Once the tx
 * commits or rolls back, replication role returns to 'origin' automatically
 * (LOCAL scope).
 *
 * Why this is safe: tests own their data end-to-end (created by api-helpers
 * within the test, owned by the run-id). Skipping triggers during teardown
 * does NOT leak through to production code paths because:
 *   1. The replica role is scoped to a single transaction.
 *   2. The triggers would have run earlier when the data was created.
 *   3. We never run cleanup against the dev or prod database.
 *
 * @see packages/db/src/migrations/manual/0019-set-updated-at-trigger.sql
 * @see packages/db/src/migrations/manual/0020-delete-entity-bookmarks-trigger.sql
 */

/**
 * Tables to cascade-delete during test cleanup. Order matters: tables
 * referenced by FKs must be deleted before tables they reference (or the
 * FK cascade does the rest if onDelete='cascade'). All these tables have
 * onDelete='cascade' on user FK in the schema, so deleting from `users`
 * actually cascades to the rest — but we list them explicitly to match
 * what an operator might inspect during a partial-failure cleanup.
 */
const CLEANUP_TABLES = [
    'accommodation_reviews',
    'destination_reviews',
    'messages',
    'conversations',
    'user_bookmarks',
    'billing_addon_purchases',
    'billing_subscriptions',
    'billing_customers',
    'accommodations',
    'users'
] as const;

/**
 * Cascade-deletes all rows linked to the given user IDs, with triggers
 * disabled.
 *
 * Use ONLY in E2E test cleanup. Never call this against production or dev
 * databases — there is no safety check on the connection target.
 *
 * @param pool - Postgres pg.Pool connected to the E2E database
 * @param userIds - Array of user UUIDs to delete (and all their cascades)
 * @returns Promise that resolves when cleanup completes
 *
 * @example
 * ```ts
 * import { cleanupTestUsers } from './support/test-cleanup.ts';
 * await cleanupTestUsers(testPool, [user.id]);
 * ```
 */
export async function cleanupTestUsers(pool: Pool, userIds: ReadonlyArray<string>): Promise<void> {
    if (userIds.length === 0) {
        return;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SET LOCAL session_replication_role = 'replica'");

        // Billing tables use a different FK chain:
        //   users.id → billing_customers.external_id (UUID stored as text)
        //   billing_customers.id → billing_subscriptions.customer_id (CASCADE)
        //   billing_customers.id → billing_addon_purchases.customer_id (CASCADE)
        // Deleting billing_customers cascades subs+addons; explicit deletes for
        // billing_subscriptions / billing_addon_purchases are skipped.
        await client.query('DELETE FROM billing_customers WHERE external_id = ANY($1::text[])', [
            userIds
        ]);

        for (const table of CLEANUP_TABLES) {
            // Determine the correct user-reference column per table.
            // - users: primary key is 'id'
            // - accommodations: FK is 'owner_id'
            // - billing_*: handled above via billing_customers.external_id
            // - all other tables: FK is 'user_id'
            if (
                table === 'billing_customers' ||
                table === 'billing_subscriptions' ||
                table === 'billing_addon_purchases'
            ) {
                // Already handled via billing_customers cascade above.
                continue;
            }
            let column: string;
            if (table === 'users') {
                column = 'id';
            } else if (table === 'accommodations') {
                column = 'owner_id';
            } else {
                column = 'user_id';
            }
            await client.query(`DELETE FROM ${table} WHERE ${column} = ANY($1::uuid[])`, [userIds]);
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {
            /* swallow rollback error to surface original */
        });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Truncate-based clean slate for E2E suite-level reset.
 *
 * Used between full test suite runs (NOT between individual tests).
 * Truncates all user-created tables in a single transaction with triggers
 * disabled. Faster than per-row DELETE for large seeded datasets.
 *
 * Safe ONLY against the E2E database (`hospeda_e2e`). The function checks
 * the database name and refuses to run if the target is `hospeda_dev`,
 * `hospeda`, or anything not matching the expected E2E pattern.
 *
 * @param pool - Postgres pg.Pool connected to the E2E database
 * @throws Error if connected to a non-E2E database
 */
export async function truncateAllForE2E(pool: Pool): Promise<void> {
    const client = await pool.connect();
    try {
        const dbResult = await client.query<{ current_database: string }>(
            'SELECT current_database()'
        );
        const dbName = dbResult.rows[0]?.current_database ?? '';
        if (!dbName.includes('e2e')) {
            throw new Error(
                `Refusing to TRUNCATE: connected database '${dbName}' does not match E2E pattern (must contain 'e2e')`
            );
        }

        await client.query('BEGIN');
        await client.query("SET LOCAL session_replication_role = 'replica'");

        const tablesResult = await client.query<{ tablename: string }>(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%'`
        );
        const tables = tablesResult.rows.map((row) => `"${row.tablename}"`).join(', ');
        if (tables.length > 0) {
            await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {
            /* swallow rollback error */
        });
        throw error;
    } finally {
        client.release();
    }
}
