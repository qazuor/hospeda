import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { RECONCILIATION_MARK_REASONS } from '../../src/schemas/vertical/reconciliation-mark-reasons.ts';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

interface DbError {
    code?: string;
    constraint?: string;
}

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

async function fixture(
    client: PoolClient
): Promise<{ userId: string; subscriptionId: string; instanceId: string }> {
    const userId = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        userId,
        `b34-${userId}`,
        `b34-${userId}@example.test`
    ]);
    const subscription = await client.query<{ id: string }>(
        "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
    );
    const addon = await client.query<{ id: string }>(
        "INSERT INTO addon (slug, name) VALUES ($1, 'B3.4 addon') RETURNING id",
        [`b34-${crypto.randomUUID()}`]
    );
    const version = await client.query<{ id: string }>(
        "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 30, 'USER') RETURNING id",
        [addon.rows[0]?.id]
    );
    const product = await client.query<{ id: string }>(
        "INSERT INTO addon_product (version_id, addon_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, $2, 100, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
        [version.rows[0]?.id, addon.rows[0]?.id]
    );
    const instance = await client.query<{ id: string }>(
        "INSERT INTO addon_instance (product_id, addon_version_id, owner_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
        [product.rows[0]?.id, version.rows[0]?.id, userId]
    );
    return {
        userId,
        subscriptionId: subscription.rows[0]?.id as string,
        instanceId: instance.rows[0]?.id as string
    };
}

const INSERT =
    'INSERT INTO reconciliation_mark (subscription_id, addon_instance_id, reason) VALUES ($1, $2, $3) RETURNING id';

async function checkDef(name: string): Promise<string> {
    const result = await getTestPool().query<{ definition: string }>(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = $1`,
        [name]
    );
    return result.rows[0]?.definition ?? '';
}

describe('TEST:B3:16 — reconciliation mark migration from empty', () => {
    it('a: creates an empty table with the required column nullability', async () => {
        const columns = await getTestPool().query<{ column_name: string; is_nullable: string }>(
            "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'reconciliation_mark' ORDER BY ordinal_position"
        );
        expect(
            Object.fromEntries(columns.rows.map((row) => [row.column_name, row.is_nullable]))
        ).toEqual({
            id: 'NO',
            subscription_id: 'YES',
            addon_instance_id: 'YES',
            reason: 'NO',
            placed_at: 'NO',
            lifted_at: 'YES',
            lifted_by: 'YES',
            version: 'NO',
            deadlines_version: 'YES',
            escalated_at: 'YES'
        });
        const count = await getTestPool().query<{ n: string }>(
            'SELECT count(*)::text AS n FROM reconciliation_mark'
        );
        expect(count.rows[0]?.n).toBe('0');
    });

    it('b: constrains reason to exactly the closed 24 literals', async () => {
        const definition = await checkDef('ck_reconciliation_mark_reason');
        const literals = [...definition.matchAll(/'([^']+)'/g)].map((match) => match[1]);
        expect(literals).toEqual([...RECONCILIATION_MARK_REASONS]);
        expect(definition).not.toContain("COMPLEMENTO_CON_PERIODO_COBRADO'");
        expect(definition).not.toContain('RECONCILIATION_REQUIRED');
    });

    it('c: accepts each reason on its proper subject and rejects undeclared spellings', async () => {
        await withRollback(async (client) => {
            const subject = await fixture(client);
            for (const reason of RECONCILIATION_MARK_REASONS) {
                const isOrder = reason === 'ORDEN_PAGADA_SIN_INSTANCIA';
                await client.query(INSERT, [
                    isOrder ? null : subject.subscriptionId,
                    isOrder ? subject.instanceId : null,
                    reason
                ]);
            }
            const count = await client.query<{ n: string }>(
                'SELECT count(*)::text AS n FROM reconciliation_mark'
            );
            expect(count.rows[0]?.n).toBe('24');
            for (const reason of [
                'UNDECLARED',
                'COMPLEMENTO_CON_PERIODO_COBRADO',
                'COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA'
            ]) {
                expect(
                    (await rejected(client, INSERT, [subject.subscriptionId, null, reason]))?.code
                ).toBe('23514');
            }
        });
    });

    it('d: requires exactly one reference and reserves instances for reason 23', async () => {
        await withRollback(async (client) => {
            const subject = await fixture(client);
            for (const args of [
                [null, null, RECONCILIATION_MARK_REASONS[0]],
                [subject.subscriptionId, subject.instanceId, RECONCILIATION_MARK_REASONS[0]],
                [null, subject.instanceId, RECONCILIATION_MARK_REASONS[0]],
                [subject.subscriptionId, null, 'ORDEN_PAGADA_SIN_INSTANCIA']
            ]) {
                expect((await rejected(client, INSERT, args))?.code).toBe('23514');
            }
        });
    });

    it('e: partial uniqueness is per subject and reason, and permits reopening after lift', async () => {
        await withRollback(async (client) => {
            const subject = await fixture(client);
            const cases = [
                {
                    subscriptionId: subject.subscriptionId,
                    instanceId: null,
                    reason: RECONCILIATION_MARK_REASONS[0],
                    other: RECONCILIATION_MARK_REASONS[1],
                    index: 'uq_reconciliation_mark_open_subscription_reason'
                },
                {
                    subscriptionId: null,
                    instanceId: subject.instanceId,
                    reason: RECONCILIATION_MARK_REASONS[22],
                    other: null,
                    index: 'uq_reconciliation_mark_open_addon_instance_reason'
                }
            ];
            for (const item of cases) {
                const first = await client.query<{ id: string }>(INSERT, [
                    item.subscriptionId,
                    item.instanceId,
                    item.reason
                ]);
                const error = await rejected(client, INSERT, [
                    item.subscriptionId,
                    item.instanceId,
                    item.reason
                ]);
                expect(error?.code).toBe('23505');
                expect(error?.constraint).toBe(item.index);
                if (item.other)
                    await client.query(INSERT, [item.subscriptionId, item.instanceId, item.other]);
                await client.query(
                    'UPDATE reconciliation_mark SET lifted_at = now(), lifted_by = $1 WHERE id = $2',
                    [subject.userId, first.rows[0]?.id]
                );
                await client.query(INSERT, [item.subscriptionId, item.instanceId, item.reason]);
                const count = await client.query<{ n: string }>(
                    'SELECT count(*)::text AS n FROM reconciliation_mark WHERE subscription_id IS NOT DISTINCT FROM $1 AND addon_instance_id IS NOT DISTINCT FROM $2 AND lifted_at IS NULL',
                    [item.subscriptionId, item.instanceId]
                );
                expect(count.rows[0]?.n).toBe(item.other ? '2' : '1');
            }
            const indexes = await client.query<{ indexname: string; indexdef: string }>(
                "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'reconciliation_mark'"
            );
            for (const item of cases)
                expect(
                    indexes.rows.find((row) => row.indexname === item.index)?.indexdef
                ).toContain('lifted_at IS NULL');
        });
    });

    it('f: subscription has neither reconciliation columns nor a reconciliation state', async () => {
        const columns = await getTestPool().query<{ column_name: string }>(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'subscription'"
        );
        expect(columns.rows.filter((row) => row.column_name.includes('reconcil'))).toEqual([]);
        expect(await checkDef('ck_subscription_status')).not.toContain('RECONCILIATION_REQUIRED');
    });

    it('g: domain_event accepts the critical mark event', async () => {
        await withRollback(async (client) => {
            const result = await client.query<{ id: string }>(
                "INSERT INTO domain_event (event_type, entity_type, entity_id, actor_type, correlation_id) VALUES ('reconciliation.mark_opened', 'subscription', $1, 'job', $2) RETURNING id",
                [crypto.randomUUID(), crypto.randomUUID()]
            );
            expect(result.rows[0]?.id).toBeTruthy();
        });
    });
});
