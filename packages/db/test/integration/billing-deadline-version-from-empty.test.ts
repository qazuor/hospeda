import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { billingDeadlineVersions } from '../../src/schemas/vertical/billing-deadline-version.dbschema.ts';
import { closeTestPool, getTestDb } from './helpers.ts';

const migration = readFileSync(
    resolve(import.meta.dirname, '../../src/migrations/0136_messy_captain_flint.sql'),
    'utf8'
);

afterAll(async () => closeTestPool());

describe('TEST:B2:8 structural migration from zero', () => {
    it('creates version 1 with exactly keys 10 through 19 and the owner-approved values', async () => {
        const rows = await getTestDb().select().from(billingDeadlineVersions);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.version).toBe(1);
        expect(Object.keys(rows[0]?.values ?? {}).sort()).toEqual([
            '10',
            '11',
            '12',
            '13',
            '14',
            '15',
            '16',
            '17',
            '18',
            '19'
        ]);
        expect(rows[0]?.values).toMatchObject({
            '10': { cardHours: 72, manualDays: 7 },
            '11': { noticeDays: 60, contactDays: [30, 7] },
            '12': { noticeDays: 60, contactDays: [30, 7] },
            '13': { daysBefore: [5, 1] },
            '14': { daysBefore: 7 },
            '15': { hoursRemaining: 24 },
            '16': { days: 7 },
            '17': { days: 7 },
            '18': { days: 180 },
            '19': { minutes: 60 }
        });
        expect(rows[0]?.changedKey).toBeNull();
    });

    it.each(
        Array.from({ length: 10 }, (_, index) => index + 10)
    )('rejects version 1 when key %i is empty', async (key) => {
        const url = process.env.HOSPEDA_TEST_DATABASE_URL;
        if (!url) throw new Error('HOSPEDA_TEST_DATABASE_URL is required');
        const pool = new Pool({ connectionString: url, max: 1 });
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('CREATE SCHEMA deadline_migration_probe');
            await client.query('SET LOCAL search_path TO deadline_migration_probe');
            const mutated = migration.replace(
                new RegExp(`"${key}": \\{[^\\n]+\\}`),
                `"${key}": null`
            );
            expect(mutated).not.toBe(migration);
            const statements = mutated
                .split('--> statement-breakpoint')
                .map((part) => part.trim())
                .filter(Boolean);
            await client.query(statements[0] ?? '');
            await expect(client.query(statements[1] ?? '')).rejects.toThrow(
                'Billing deadline version 1 is incomplete'
            );
        } finally {
            await client.query('ROLLBACK');
            client.release();
            await pool.end();
        }
    });
});
