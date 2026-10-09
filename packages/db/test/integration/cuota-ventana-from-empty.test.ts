import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

type DbError = { code?: string; constraint?: string };
const KEY = 'max_ai_chat_per_month';
const VERTICAL = 'accommodation';
const INSERT = `INSERT INTO cuota_ventana (user_id, vertical, key, opens_at, closes_at, consumed)
    VALUES ($1, $2, $3, $4, $5, $6)`;

async function inRollback(
    run: (
        client: PoolClient,
        attempt: (params: unknown[]) => Promise<DbError | null>
    ) => Promise<void>
) {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        const attempt = async (params: unknown[]) => {
            await client.query('SAVEPOINT attempt');
            try {
                await client.query(INSERT, params);
                await client.query('RELEASE SAVEPOINT attempt');
                return null;
            } catch (error) {
                await client.query('ROLLBACK TO SAVEPOINT attempt');
                return error as DbError;
            }
        };
        await run(client, attempt);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

describe('TEST:V3:11 — db:migrate and extras from empty create cuota_ventana', () => {
    it('has exactly the columns, three FKs, UNIQUE, two CHECKs and enabled overlap trigger', async () => {
        const pool = getTestPool();
        const { rows: columns } = await pool.query<{ column_name: string }>(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'cuota_ventana' ORDER BY column_name`
        );
        expect(columns.map((row) => row.column_name)).toEqual([
            'closes_at',
            'consumed',
            'id',
            'key',
            'opens_at',
            'user_id',
            'vertical'
        ]);
        const { rows } = await pool.query<{ conname: string; def: string }>(
            `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'cuota_ventana'::regclass`
        );
        const constraints = Object.fromEntries(rows.map((row) => [row.conname, row.def]));
        expect(constraints.uq_cuota_ventana_user_vertical_key_opens).toBe(
            'UNIQUE (user_id, vertical, key, opens_at)'
        );
        expect(constraints.ck_cuota_ventana_closes_after_opens).toContain('closes_at > opens_at');
        expect(constraints.ck_cuota_ventana_consumed_nonnegative).toContain('consumed >= 0');
        expect(constraints.cuota_ventana_user_id_users_id_fk).toContain(
            'REFERENCES users(id) ON DELETE RESTRICT'
        );
        expect(constraints.cuota_ventana_vertical_vertical_id_fk).toContain(
            'REFERENCES vertical(id)'
        );
        expect(constraints.cuota_ventana_key_catalog_key_key_fk).toContain(
            'REFERENCES catalog_key(key)'
        );
        const { rows: triggers } = await pool.query<{
            tgname: string;
            tgenabled: string;
            def: string;
        }>(
            `SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid = 'cuota_ventana'::regclass AND NOT tgisinternal`
        );
        expect(triggers).toHaveLength(1);
        expect(triggers[0]).toMatchObject({ tgname: 'trg_cuota_ventana_one_open', tgenabled: 'O' });
        expect(triggers[0]?.def).toContain('BEFORE INSERT OR UPDATE OF opens_at, closes_at');
    });

    it('rejects overlap with 23P01, allows adjacent windows, and enforces nonnegative and valid range', async () => {
        await inRollback(async (client, attempt) => {
            const { rows } = await client.query<{ id: string }>(
                `INSERT INTO users (slug, display_name, email) VALUES ('quota-test', 'Quota test', 'quota-test@local.test') RETURNING id`
            );
            const userId = rows[0]!.id;
            const row = (opens: string, closes: string, consumed = 0) => [
                userId,
                VERTICAL,
                KEY,
                opens,
                closes,
                consumed
            ];
            const first = row('2026-01-01T03:00:00Z', '2026-02-01T03:00:00Z');
            expect(await attempt(first)).toBeNull();
            expect(
                await attempt(row('2026-01-15T03:00:00Z', '2026-02-15T03:00:00Z'))
            ).toMatchObject({ code: '23P01', constraint: 'ck_cuota_ventana_one_open' });
            expect(await attempt(row('2026-02-01T03:00:00Z', '2026-03-01T03:00:00Z'))).toBeNull();
            expect(
                await attempt(row('2026-03-01T03:00:00Z', '2026-04-01T03:00:00Z', -1))
            ).toMatchObject({ code: '23514', constraint: 'ck_cuota_ventana_consumed_nonnegative' });
            expect(
                await attempt(row('2026-03-01T03:00:00Z', '2026-03-01T03:00:00Z'))
            ).toMatchObject({ code: '23514', constraint: 'ck_cuota_ventana_closes_after_opens' });
            expect(await attempt(first)).toMatchObject({
                code: '23505',
                constraint: 'uq_cuota_ventana_user_vertical_key_opens'
            });
        });
    });
});
