import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { afterAll, beforeAll, expect } from 'vitest';

import { planSerialLocks } from './sweep-serial-groups.js';

const LOCK_WAIT_MS = 15 * 60_000;

let client: Client | null = null;
let heldLocks: Array<{ key: number; mode: 'exclusive' | 'shared' }> = [];

beforeAll(async () => {
    const path = expect.getState().testPath;
    if (!path) return;
    const source = readFileSync(path, 'utf8');
    const locks = planSerialLocks({ source });
    if (locks.length === 0) return;
    client = new Client({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL });
    await client.connect();
    for (const lock of locks) {
        const fn = lock.mode === 'exclusive' ? 'pg_advisory_lock' : 'pg_advisory_lock_shared';
        await client.query(`SELECT ${fn}($1)`, [lock.key]);
        heldLocks.push(lock);
    }
}, LOCK_WAIT_MS);

afterAll(async () => {
    if (!client) return;
    for (const lock of heldLocks.reverse()) {
        const fn = lock.mode === 'exclusive' ? 'pg_advisory_unlock' : 'pg_advisory_unlock_shared';
        await client.query(`SELECT ${fn}($1)`, [lock.key]);
    }
    heldLocks = [];
    await client.end();
    client = null;
});
