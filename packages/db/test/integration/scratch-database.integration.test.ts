import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
    ignoreAdminShutdown,
    protectScratchPool,
    waitForNoConnections
} from './support/scratch-database.ts';

const baseUrl = process.env.HOSPEDA_TEST_DATABASE_URL;
if (!baseUrl) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
const database = `hospeda_scratch_shutdown_${process.pid}`;
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';
const scratchUrl = new URL(baseUrl);
scratchUrl.pathname = `/${database}`;
const admin = new Pool({ connectionString: adminUrl.toString() });

afterAll(async () => {
    await waitForNoConnections({ admin, database });
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
});

describe('scratch database shutdown protection', () => {
    it('swallows the forced shutdown error from a live pooled backend', async () => {
        await waitForNoConnections({ admin, database });
        await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
        await admin.query(`CREATE DATABASE "${database}"`);

        const pool = new Pool({ connectionString: scratchUrl.toString(), min: 1 });
        protectScratchPool({ pool });
        const client = await pool.connect();
        client.release();

        try {
            await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
            await waitForNoConnections({ admin, database });
            const result = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
                database
            ]);
            expect(result.rowCount).toBe(0);
        } finally {
            await pool.end();
        }
    });

    it('ignores admin_shutdown errors', () => {
        const error = Object.assign(new Error('administrator shutdown'), { code: '57P01' });
        expect(() => ignoreAdminShutdown(error)).not.toThrow();
    });

    it('rethrows errors other than admin_shutdown', () => {
        const error = Object.assign(new Error('unexpected'), { code: 'XX000' });
        expect(() => ignoreAdminShutdown(error)).toThrow(error);
    });
});
