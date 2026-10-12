import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    protectScratchPool,
    waitForNoConnections
} from '../../../db/test/integration/support/scratch-database.ts';

const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const database = `hospeda_seed_scratch_shutdown_${process.pid}`;
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const scratchUrl = new URL(baseUrl);
scratchUrl.pathname = `/${database}`;
const admin = new Pool({ connectionString: adminUrl.toString() });

beforeAll(async () => {
    await waitForNoConnections({ admin, database });
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);
});

afterAll(async () => {
    await waitForNoConnections({ admin, database });
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
});

describe('scratch database forced shutdown protection', () => {
    it('handles the 57P01 sent to an idle pooled backend', async () => {
        const pool = new Pool({ connectionString: scratchUrl.toString(), min: 1 });
        protectScratchPool({ pool });
        let shutdownErrors = 0;
        pool.on('connect', (client) => {
            client.on('error', (error: Error & { code?: string }) => {
                if (error.code === '57P01') shutdownErrors += 1;
                else throw error;
            });
        });
        const client = await pool.connect();
        client.release();

        try {
            await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
            await waitForNoConnections({ admin, database });
            const deadline = Date.now() + 5_000;
            while (shutdownErrors === 0 && Date.now() < deadline) {
                await new Promise((resolveWait) => setTimeout(resolveWait, 25));
            }
            expect(shutdownErrors).toBeGreaterThan(0);
        } finally {
            await pool.end();
        }
    });
});
