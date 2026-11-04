import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, expect } from 'vitest';

/**
 * Why this exists: parallel workers share one DB and one sweep lease, so a `single` run refused
 * (or a cycle slice skipped) whenever another file held it. Serializing the sweep files removes that.
 *
 * The reconciliation sweep owns one global lease: a `single` run refuses while any cycle slice
 * holds it, and two cycle slices exclude each other. Test files run in parallel workers over one
 * database, so every file that drives the sweep takes this session-level advisory lock for its
 * whole run and the sweep files execute one at a time.
 */
const SWEEP_LOCK_KEY = 1_999_001;
const DRIVES_THE_SWEEP =
    /billing\/reconciliation\/sweep\/|runReconciliationSweep|reconciliation-sweep-fixtures|reconciliation-exit-game-fixtures|(?:paid-order|credited-payments)-fixtures/;
const LOCK_WAIT_MS = 15 * 60_000;

let client: Client | null = null;

beforeAll(async () => {
    const path = expect.getState().testPath;
    if (!path || !DRIVES_THE_SWEEP.test(readFileSync(path, 'utf8'))) return;
    client = new Client({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL });
    await client.connect();
    await client.query('SELECT pg_advisory_lock($1)', [SWEEP_LOCK_KEY]);
}, LOCK_WAIT_MS);

afterAll(async () => {
    if (!client) return;
    await client.query('SELECT pg_advisory_unlock($1)', [SWEEP_LOCK_KEY]);
    await client.end();
    client = null;
});
