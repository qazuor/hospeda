import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, expect } from 'vitest';

/**
 * Why this exists: parallel workers share one database, and some services act on EVERY eligible
 * row of it rather than on the rows a case seeded. Two files driving the same global service at
 * once step on each other, so every file that drives one takes that service's session-level
 * advisory lock for its whole run and those files execute one at a time. One lock per resource:
 * files of different groups still run in parallel.
 *
 * - The reconciliation sweep owns one global lease: a `single` run refuses while any cycle slice
 *   holds it, and two cycle slices exclude each other.
 * - The S38 due-change batch (`applyDueScheduledChanges`, HOS-2103) applies every due queue entry
 *   in the database. A batch run by one file applied the rows another file had just seeded, so
 *   that file's own run never saw them: no coverage notice for its user, no FAILED result for its
 *   spied row. The group therefore covers BOTH the files that run the batch and the files that
 *   seed queue rows through `seedScheduledChange`: seeding a row due before the batch clock is
 *   enough to have it stolen, whether or not the file ever names `applyDueScheduledChanges`.
 *   Every file that drives `applyScheduledChangeInTx` also seeds through that fixture, so the
 *   fixture token keeps this set complete without widening it to unrelated suites.
 */
const SERIAL_GROUPS = [
    {
        key: 1_999_001,
        drives: /billing\/reconciliation\/sweep\/|runReconciliationSweep|reconciliation-sweep-fixtures|reconciliation-exit-game-fixtures|(?:paid-order|credited-payments)-fixtures/
    },
    { key: 1_999_002, drives: /\bapplyDueScheduledChanges\b|\bseedScheduledChange\b/ }
] as const;
const LOCK_WAIT_MS = 15 * 60_000;

let client: Client | null = null;
let heldKeys: number[] = [];

beforeAll(async () => {
    const path = expect.getState().testPath;
    if (!path) return;
    const source = readFileSync(path, 'utf8');
    // Ascending key order, so two files that match several groups can never deadlock.
    const keys = SERIAL_GROUPS.filter((group) => group.drives.test(source))
        .map((group) => group.key)
        .sort((a, b) => a - b);
    if (keys.length === 0) return;
    client = new Client({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL });
    await client.connect();
    for (const key of keys) {
        await client.query('SELECT pg_advisory_lock($1)', [key]);
        heldKeys.push(key);
    }
}, LOCK_WAIT_MS);

afterAll(async () => {
    if (!client) return;
    for (const key of heldKeys.reverse())
        await client.query('SELECT pg_advisory_unlock($1)', [key]);
    heldKeys = [];
    await client.end();
    client = null;
});
