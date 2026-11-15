import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

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

async function insertKey(client: PoolClient): Promise<string> {
    const key = crypto.randomUUID();
    await client.query(
        "INSERT INTO idempotency_key (key, operation, subject_id) VALUES ($1, 'REFUND_CREATE', $2)",
        [key, crypto.randomUUID()]
    );
    return key;
}

/** TEST:B6:11 HOS-1553: the migrated database serializes unanswered order calls. */
describe('TEST:B6:11 HOS-1553 order refund index', () => {
    it('defines the unique partial index with both predicates', async () => {
        const result = await getTestPool().query<{ indexdef: string }>(
            "SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_refund_call_order_awaiting_id'"
        );
        expect(result.rows).toHaveLength(1);
        const definition = result.rows[0]!.indexdef.toLowerCase()
            .replaceAll('"', '')
            .replace(/\s+/g, ' ');
        expect(
            definition.includes(
                'create unique index uq_refund_call_order_awaiting_id on public.refund_call'
            )
        ).toBe(true);
        expect(definition.includes('using btree (addon_instance_id)')).toBe(true);
        expect(definition.includes('addon_instance_id is not null')).toBe(true);
        expect(definition.includes('provider_refund_id is null')).toBe(true);
    });

    it('rejects a second waiting order call and accepts answered and payment calls', async () => {
        await withRollback(async (client) => {
            const userId = crypto.randomUUID();
            await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
                userId,
                `b611-${userId}`,
                `b611-${userId}@example.test`
            ]);
            const addon = await client.query<{ id: string }>(
                "INSERT INTO addon (slug, name) VALUES ($1, 'B6 index addon') RETURNING id",
                [`b611-${crypto.randomUUID()}`]
            );
            const version = await client.query<{ id: string }>(
                "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 30, 'USER') RETURNING id",
                [addon.rows[0]!.id]
            );
            const product = await client.query<{ id: string }>(
                "INSERT INTO addon_product (version_id, addon_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, $2, 100, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
                [version.rows[0]!.id, addon.rows[0]!.id]
            );
            const instance = await client.query<{ id: string }>(
                "INSERT INTO addon_instance (product_id, addon_version_id, owner_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
                [product.rows[0]!.id, version.rows[0]!.id, userId]
            );
            const payment = await client.query<{ id: string }>(
                "INSERT INTO payment (addon_instance_id, amount, currency, status, provider, provider_fact_id, fact_at) VALUES ($1, 100, 'ARS', 'SUCCEEDED', 'TEST', $2, now()) RETURNING id",
                [instance.rows[0]!.id, crypto.randomUUID()]
            );
            const refund = await client.query<{ id: string }>(
                "INSERT INTO refund (payment_id, amount, reason, status) VALUES ($1, 25, 'CUSTOMER_REQUEST', 'REQUESTED') RETURNING id",
                [payment.rows[0]!.id]
            );
            const insert =
                'INSERT INTO refund_call (refund_id, idempotency_key, provider_refund_id, amount, addon_instance_id) VALUES ($1, $2, $3, 10, $4)';
            const first = await insertKey(client);
            await client.query(insert, [refund.rows[0]!.id, first, null, instance.rows[0]!.id]);
            const second = await insertKey(client);
            await client.query('SAVEPOINT expected_rejection');
            let rejected: { code?: string; constraint?: string } | null = null;
            try {
                await client.query(insert, [
                    refund.rows[0]!.id,
                    second,
                    null,
                    instance.rows[0]!.id
                ]);
            } catch (error) {
                rejected = error as { code?: string; constraint?: string };
            } finally {
                await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
            }
            expect(rejected?.code).toBe('23505');
            expect(rejected?.constraint).toBe('uq_refund_call_order_awaiting_id');
            await client.query(
                'UPDATE refund_call SET provider_refund_id = $1 WHERE idempotency_key = $2',
                [crypto.randomUUID(), first]
            );
            await client.query(insert, [refund.rows[0]!.id, second, null, instance.rows[0]!.id]);
            const third = await insertKey(client);
            const fourth = await insertKey(client);
            await client.query(insert, [refund.rows[0]!.id, third, null, null]);
            await client.query(insert, [refund.rows[0]!.id, fourth, null, null]);
            const rows = await client.query<{ count: string }>(
                'SELECT count(*) FROM refund_call WHERE refund_id = $1',
                [refund.rows[0]!.id]
            );
            expect(Number(rows.rows[0]!.count)).toBe(4);
        });
    });
});
