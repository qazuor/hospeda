import { Client } from 'pg';
import { afterAll, beforeAll } from 'vitest';

/**
 * Why this exists: `sendPlanMigrationNotices` is a GLOBAL batch. It walks every
 * `PENDIENTE` row of the shared integration database instead of only the rows a
 * single file seeded, and each file drives it with its own clock. When two files
 * run in parallel, the first batch recalculates the other file's row with a
 * different clock, so by the time the second file runs there is nothing left to
 * recalculate and `recalculated` comes back `false`.
 *
 * The sweep files hit the same class of problem in HOS-2103. Here the fix is a
 * session-level advisory lock held for the whole file: the notice-driving files
 * take it in `beforeAll` on a dedicated connection and release it in `afterAll`,
 * so they execute one at a time.
 *
 * The key is intentionally distinct from `1999001` (the reconciliation sweep in
 * `sweep-serial-setup.ts`) and from the deadline lock `(1613, 5)`.
 */
const PLAN_MIGRATION_NOTICE_LOCK_KEY = 1_999_003;
const LOCK_WAIT_MS = 15 * 60_000;

let client: Client | null = null;

/**
 * Registers a file-scoped setup that serializes every file driving the global
 * plan-migration notice batch. Call it once at the top of a test module.
 */
export function registerPlanMigrationNoticeSerial(): void {
    beforeAll(async () => {
        const connectionString = process.env.HOSPEDA_TEST_DATABASE_URL;
        if (!connectionString) return;
        client = new Client({ connectionString });
        await client.connect();
        await client.query('SELECT pg_advisory_lock($1)', [PLAN_MIGRATION_NOTICE_LOCK_KEY]);
    }, LOCK_WAIT_MS);

    afterAll(async () => {
        if (!client) return;
        await client.query('SELECT pg_advisory_unlock($1)', [PLAN_MIGRATION_NOTICE_LOCK_KEY]);
        await client.end();
        client = null;
    }, LOCK_WAIT_MS);
}
