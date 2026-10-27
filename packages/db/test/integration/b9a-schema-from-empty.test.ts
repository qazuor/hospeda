import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);
type DbError = { code?: string; constraint?: string };
async function withRollback(body: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await body(client);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}
async function rejected(
    client: PoolClient,
    statement: string,
    params: unknown[]
): Promise<DbError | null> {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(statement, params);
        return null;
    } catch (error) {
        return error as DbError;
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}
async function user(client: PoolClient): Promise<string> {
    const id = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        id,
        `b9a-${id}`,
        `b9a-${id}@example.test`
    ]);
    return id;
}
async function plan(client: PoolClient, vertical: string) {
    const result = await client.query<{ id: string }>(
        "INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, 'B9a plan') RETURNING id",
        [vertical, `b9a-${crypto.randomUUID()}`]
    );
    const planId = result.rows[0]!.id;
    const version = await client.query<{ id: string }>(
        'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, false, true, 0, false) RETURNING id',
        [planId, vertical, Math.floor(Math.random() * 1_000_000_000) + 1]
    );
    return { planId, floorId: version.rows[0]!.id };
}
async function grant(
    client: PoolClient,
    beneficiary: string,
    signer: string,
    revoked = false
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO permanent_grant (beneficiary_user_id, includes_addons, granted_by, reason${revoked ? ', revoked_at, revoked_by, revocation_reason' : ''}) VALUES ($1, false, $2, 'schema test'${revoked ? ", now(), $2, 'revoked by test'" : ''}) RETURNING id`,
        [beneficiary, signer]
    );
    return result.rows[0]!.id;
}
async function anchor(
    client: PoolClient,
    grantId: string,
    vertical: string,
    p: { planId: string; floorId: string }
) {
    await client.query(
        'INSERT INTO permanent_grant_vertical (permanent_grant_id, vertical, plan_id, floor_plan_version_id) VALUES ($1, $2, $3, $4)',
        [grantId, vertical, p.planId, p.floorId]
    );
}

describe('TEST:B9a:8 — the permanent grant schema from empty (AC:B9a:8)', () => {
    it('creates both tables with their columns', async () => {
        const columns = await getTestPool().query<{
            table_name: string;
            column_name: string;
            is_nullable: string;
        }>(
            "SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1)",
            [['permanent_grant', 'permanent_grant_vertical']]
        );
        const expected: Record<string, string[]> = {
            permanent_grant: [
                'id',
                'beneficiary_user_id',
                'includes_addons',
                'granted_by',
                'reason',
                'affected_subscription_ids',
                'revoked_at',
                'revoked_by',
                'revocation_reason',
                'created_at',
                'updated_at'
            ],
            permanent_grant_vertical: [
                'id',
                'permanent_grant_id',
                'vertical',
                'plan_id',
                'floor_plan_version_id',
                'created_at'
            ]
        };
        for (const [table, names] of Object.entries(expected))
            expect(
                columns.rows
                    .filter((r) => r.table_name === table)
                    .map((r) => r.column_name)
                    .sort()
            ).toEqual([...names].sort());
        for (const name of ['revoked_at', 'revoked_by', 'revocation_reason'])
            expect(
                columns.rows.find(
                    (r) => r.table_name === 'permanent_grant' && r.column_name === name
                )?.is_nullable
            ).toBe('YES');
    });
    it('declares the UNIQUE, the composite foreign keys and the CHECK by name', async () => {
        const constraints = await getTestPool().query<{
            conname: string;
            contype: string;
            columns: number;
        }>(
            'SELECT conname, contype, cardinality(conkey) AS columns FROM pg_constraint WHERE conname = ANY($1)',
            [
                [
                    'uq_permanent_grant_vertical_grant_vertical',
                    'fk_permanent_grant_vertical_plan',
                    'fk_permanent_grant_vertical_floor',
                    'ck_permanent_grant_revocation_together'
                ]
            ]
        );
        const get = (name: string) => constraints.rows.find((r) => r.conname === name);
        expect(get('uq_permanent_grant_vertical_grant_vertical')).toMatchObject({
            contype: 'u',
            columns: 2
        });
        expect(get('fk_permanent_grant_vertical_plan')).toMatchObject({ contype: 'f', columns: 2 });
        expect(get('fk_permanent_grant_vertical_floor')).toMatchObject({
            contype: 'f',
            columns: 2
        });
        expect(get('ck_permanent_grant_revocation_together')?.contype).toBe('c');
        const index = await getTestPool().query<{ indisunique: boolean; indpred: string | null }>(
            "SELECT i.indisunique, pg_get_expr(i.indpred, i.indrelid) AS indpred FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = 'uq_permanent_grant_live_beneficiary'"
        );
        expect(index.rows[0]?.indisunique).toBe(true);
        expect(index.rows[0]?.indpred).toContain('revoked_at IS NULL');
    });
    it('addon_instance carries the nullable title anchor with its foreign key', async () => {
        const col = await getTestPool().query<{ data_type: string; is_nullable: string }>(
            "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'addon_instance' AND column_name = 'title_anchor_id'"
        );
        expect(col.rows[0]).toEqual({ data_type: 'uuid', is_nullable: 'YES' });
        const fk = await getTestPool().query<{ referenced: string }>(
            "SELECT confrelid::regclass::text AS referenced FROM pg_constraint WHERE conname = 'addon_instance_title_anchor_id_permanent_grant_vertical_id_fk'"
        );
        expect(fk.rows[0]?.referenced).toBe('permanent_grant_vertical');
    });
    it('rejects a second live grant for the same beneficiary and ignores the revoked ones', async () => {
        await withRollback(async (client) => {
            const beneficiary = await user(client);
            const signer = await user(client);
            await grant(client, beneficiary, signer, true);
            await grant(client, beneficiary, signer, true);
            const live = await grant(client, beneficiary, signer);
            const insert =
                "INSERT INTO permanent_grant (beneficiary_user_id, includes_addons, granted_by, reason) VALUES ($1, false, $2, 'schema test')";
            expect(await rejected(client, insert, [beneficiary, signer])).toMatchObject({
                code: '23505',
                constraint: 'uq_permanent_grant_live_beneficiary'
            });
            await grant(client, beneficiary, signer, true);
            await client.query(
                "UPDATE permanent_grant SET revoked_at = now(), revoked_by = $2, revocation_reason = 'revoked now' WHERE id = $1",
                [live, signer]
            );
            await grant(client, beneficiary, signer);
        });
    });
    it('writes the revocation columns together or not at all', async () => {
        await withRollback(async (client) => {
            const beneficiary = await user(client);
            const signer = await user(client);
            const id = await grant(client, beneficiary, signer);
            expect(
                await rejected(
                    client,
                    'UPDATE permanent_grant SET revoked_at = now() WHERE id = $1',
                    [id]
                )
            ).toMatchObject({
                code: '23514',
                constraint: 'ck_permanent_grant_revocation_together'
            });
            expect(
                await rejected(
                    client,
                    "UPDATE permanent_grant SET revoked_at = now(), revoked_by = $2, revocation_reason = '   ' WHERE id = $1",
                    [id, signer]
                )
            ).toMatchObject({
                code: '23514',
                constraint: 'ck_permanent_grant_revocation_together'
            });
            await client.query(
                "UPDATE permanent_grant SET revoked_at = now(), revoked_by = $2, revocation_reason = 'valid reason' WHERE id = $1",
                [id, signer]
            );
        });
    });
    it('anchors: one per vertical, plan of that vertical, floor of that plan', async () => {
        await withRollback(async (client) => {
            const beneficiary = await user(client);
            const signer = await user(client);
            const grantId = await grant(client, beneficiary, signer);
            const a = await plan(client, 'accommodation');
            const g = await plan(client, 'venue');
            const otherFloor = await plan(client, 'accommodation');
            await anchor(client, grantId, 'accommodation', a);
            expect(
                await rejected(
                    client,
                    'INSERT INTO permanent_grant_vertical (permanent_grant_id, vertical, plan_id, floor_plan_version_id) VALUES ($1, $2, $3, $4)',
                    [grantId, 'accommodation', a.planId, a.floorId]
                )
            ).toMatchObject({
                code: '23505',
                constraint: 'uq_permanent_grant_vertical_grant_vertical'
            });
            expect(
                await rejected(
                    client,
                    'INSERT INTO permanent_grant_vertical (permanent_grant_id, vertical, plan_id, floor_plan_version_id) VALUES ($1, $2, $3, $4)',
                    [grantId, 'venue', a.planId, a.floorId]
                )
            ).toMatchObject({ code: '23503', constraint: 'fk_permanent_grant_vertical_plan' });
            expect(
                await rejected(
                    client,
                    'INSERT INTO permanent_grant_vertical (permanent_grant_id, vertical, plan_id, floor_plan_version_id) VALUES ($1, $2, $3, $4)',
                    [grantId, 'venue', g.planId, otherFloor.floorId]
                )
            ).toMatchObject({ code: '23503', constraint: 'fk_permanent_grant_vertical_floor' });
        });
    });
});
