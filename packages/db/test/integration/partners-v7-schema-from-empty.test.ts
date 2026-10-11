import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

type PgError = { code?: string; constraint?: string };

async function inRollback(
    run: (
        client: PoolClient,
        attempt: (sql: string, params: unknown[]) => Promise<PgError | null>
    ) => Promise<void>
) {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        const attempt = async (statement: string, params: unknown[]) => {
            await client.query('SAVEPOINT attempt');
            try {
                await client.query(statement, params);
                await client.query('RELEASE SAVEPOINT attempt');
                return null;
            } catch (error) {
                await client.query('ROLLBACK TO SAVEPOINT attempt');
                return error as PgError;
            }
        };
        await run(client, attempt);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

const PARTNER_INSERT = `INSERT INTO partners (slug, name, type, owner_user_id)
    VALUES ($1, $2, 'business', $3)`;

describe('TEST:V6:29 — partners V7 schema from empty', () => {
    it('TEST:V6:29 removes legacy columns, indexes and enum while retaining the common owner index', async () => {
        const pool = getTestPool();
        const columns = await pool.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'partners'`
        );
        expect(columns.rows.map(({ column_name }) => column_name)).not.toEqual(
            expect.arrayContaining(['starts_at', 'ends_at', 'tier'])
        );
        const indexes = await pool.query<{ indexname: string; indexdef: string }>(
            `SELECT indexrelid::regclass::text AS indexname, pg_get_indexdef(indexrelid) AS indexdef FROM pg_index JOIN pg_class ON pg_class.oid=indrelid WHERE relname='partners'`
        );
        const byName = Object.fromEntries(indexes.rows.map((row) => [row.indexname, row.indexdef]));
        expect(byName.partners_tier_idx).toBeUndefined();
        expect(byName.partners_startsAt_idx).toBeUndefined();
        expect(byName.partners_lifecycleState_endsAt_idx).toBeUndefined();
        expect(
            indexes.rows.some(
                ({ indexdef }) =>
                    indexdef.includes('CREATE INDEX') && indexdef.includes('owner_user_id')
            )
        ).toBe(true);
        expect(byName.uq_partners_owner_user_id).toContain('CREATE UNIQUE INDEX');
        expect(byName.uq_partners_owner_user_id).toContain('WHERE (owner_user_id IS NOT NULL)');
        const enumType = await pool.query(
            `SELECT 1 FROM pg_type WHERE typname = 'partner_tier_enum'`
        );
        expect(enumType.rowCount).toBe(0);
    });

    it('TEST:V6:29 rejects duplicate non-null owners and permits repeated NULL owners', async () => {
        await inRollback(async (client, attempt) => {
            const user = await client.query<{ id: string }>(
                `INSERT INTO users (slug, display_name, email) VALUES ('v611-owner', 'V611 owner', 'v611-owner@example.test') RETURNING id`
            );
            const ownerId = user.rows[0]!.id;
            expect(await attempt(PARTNER_INSERT, ['v611-first', 'First', ownerId])).toBeNull();
            expect(
                await attempt(PARTNER_INSERT, ['v611-duplicate', 'Duplicate', ownerId])
            ).toMatchObject({
                code: '23505',
                constraint: 'uq_partners_owner_user_id'
            });
            expect(await attempt(PARTNER_INSERT, ['v611-null-a', 'Null A', null])).toBeNull();
            expect(await attempt(PARTNER_INSERT, ['v611-null-b', 'Null B', null])).toBeNull();
            const other = await client.query<{ id: string }>(
                `INSERT INTO users (slug, display_name, email) VALUES ('v611-owner-two', 'V611 owner two', 'v611-owner-two@example.test') RETURNING id`
            );
            expect(
                await attempt(PARTNER_INSERT, ['v611-other', 'Other', other.rows[0]!.id])
            ).toBeNull();
        });
    });
});
