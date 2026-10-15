import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

async function rejects(
    client: PoolClient,
    query: string,
    params: unknown[]
): Promise<string | undefined> {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(query, params);
        return undefined;
    } catch (error) {
        return (error as { code?: string }).code;
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}

describe('TEST:1607:3 — reconciliation summary window schema', () => {
    it('creates the empty table with the requested nullability and constraints', async () => {
        const columns = await getTestPool().query<{ column_name: string; is_nullable: string }>(
            "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'reconciliation_summary_window' ORDER BY ordinal_position"
        );
        expect(
            Object.fromEntries(columns.rows.map((row) => [row.column_name, row.is_nullable]))
        ).toEqual({
            id: 'NO',
            covers_from: 'NO',
            opened_at: 'NO',
            closes_at: 'NO',
            window_minutes: 'NO',
            deadlines_version: 'NO',
            sent_at: 'YES',
            event_count: 'YES'
        });
        const count = await getTestPool().query<{ n: string }>(
            'SELECT count(*)::text AS n FROM reconciliation_summary_window'
        );
        expect(count.rows[0]?.n).toBe('0');
        const constraints = await getTestPool().query<{ conname: string }>(
            "SELECT conname FROM pg_constraint WHERE conrelid = 'reconciliation_summary_window'::regclass"
        );
        expect(constraints.rows.map((row) => row.conname)).toEqual(
            expect.arrayContaining([
                'ck_reconciliation_summary_window_minutes_positive',
                'ck_reconciliation_summary_window_closes_after_open',
                'ck_reconciliation_summary_window_sent_pair',
                'reconciliation_summary_window_deadlines_version_billing_deadlin'
            ])
        );
    });

    it('rejects invalid windows, duplicate covers_from values, and unknown deadline versions', async () => {
        const client = await getTestPool().connect();
        try {
            await client.query('BEGIN');
            const valid = [
                new Date('2026-01-01Z'),
                new Date('2026-01-01Z'),
                new Date('2026-01-02Z'),
                60,
                1
            ];
            const insert = `INSERT INTO reconciliation_summary_window (covers_from, opened_at, closes_at, window_minutes, deadlines_version)
                VALUES ($1, $2, $3, $4, $5)`;
            await client.query(insert, valid);
            expect(await rejects(client, insert, [valid[0], valid[1], valid[2], 0, 1])).toBe(
                '23514'
            );
            expect(await rejects(client, insert, [valid[0], valid[2], valid[1], 60, 1])).toBe(
                '23514'
            );
            expect(
                await rejects(client, `${insert} RETURNING id`, [
                    valid[0],
                    valid[1],
                    valid[2],
                    60,
                    1
                ])
            ).toBe('23505');
            expect(
                await rejects(client, insert, [
                    new Date('2026-02-01Z'),
                    valid[1],
                    valid[2],
                    60,
                    999999
                ])
            ).toBe('23503');
            expect(
                await rejects(
                    client,
                    `INSERT INTO reconciliation_summary_window (covers_from, opened_at, closes_at, window_minutes, deadlines_version, sent_at)
                 VALUES ($1, $2, $3, $4, $5, now())`,
                    [new Date('2026-03-01Z'), valid[1], valid[2], 60, 1]
                )
            ).toBe('23514');
        } finally {
            await client.query('ROLLBACK');
            client.release();
        }
    });
});
