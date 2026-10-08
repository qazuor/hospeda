import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

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
): Promise<{ userId: string; versionId: string; productId: string; subscriptionId: string }> {
    const userId = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        userId,
        `b3-${userId}`,
        `b3-${userId}@example.test`
    ]);
    const addon = await client.query<{ id: string }>(
        "INSERT INTO addon (slug, name) VALUES ($1, 'B3 addon') RETURNING id",
        [`b3-${crypto.randomUUID()}`]
    );
    const version = await client.query<{ id: string }>(
        "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 30, 'USER') RETURNING id",
        [addon.rows[0]?.id]
    );
    const versionId = version.rows[0]?.id as string;
    const product = await client.query<{ id: string }>(
        "INSERT INTO addon_product (version_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, 100, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
        [versionId]
    );
    const subscription = await client.query<{ id: string }>(
        "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
    );
    return {
        userId,
        versionId,
        productId: product.rows[0]?.id as string,
        subscriptionId: subscription.rows[0]?.id as string
    };
}

const insertInstance = `INSERT INTO addon_instance (product_id, addon_version_id, owner_id, target_id, status, complement_subscription_id)
VALUES ($1, $2, $3, $4, $5, $6)`;

describe('TEST:B3:31 — B3 schema from empty', () => {
    it('creates every new table empty, succession columns and commitment indexes', async () => {
        const names = [
            'subscription',
            'subscription_scheduled_change',
            'plan_migration',
            'plan_migration_subscription',
            'promo_code',
            'promo_redemption',
            'courtesy_grant',
            'addon_product',
            'addon_instance',
            'manual_payment',
            'idempotency_key'
        ];
        const tables = await getTestPool().query<{ tablename: string }>(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
            [names]
        );
        expect(tables.rows.map((r) => r.tablename).sort()).toEqual([...names].sort());
        for (const name of names) {
            const count = await getTestPool().query<{ n: string }>(
                `SELECT count(*)::text AS n FROM "${name}"`
            );
            expect(count.rows[0]?.n).toBe('0');
        }
        const columns = await getTestPool().query<{
            table_name: string;
            column_name: string;
            is_nullable: string;
        }>(
            'SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_name = ANY($1)',
            [names]
        );
        const has = (table: string, column: string) =>
            columns.rows.find((r) => r.table_name === table && r.column_name === column);
        expect(has('subscription', 'succeeds_id')).toBeDefined();
        expect(has('subscription', 'succeeded_by_id')).toBeDefined();
        expect(has('courtesy_grant', 'scope')).toBeUndefined();
        expect(has('addon_product', 'version_id')?.is_nullable).toBe('NO');
        expect(has('addon_instance', 'addon_version_id')?.is_nullable).toBe('NO');
        const indexes = await getTestPool().query<{ indexname: string; indexdef: string }>(
            "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'subscription'"
        );
        for (const name of [
            'uq_subscription_commitment_origin',
            'uq_subscription_commitment_successor'
        ]) {
            const index = indexes.rows.find((r) => r.indexname === name);
            expect(index?.indexdef).toContain('CREATE UNIQUE INDEX');
            expect(index?.indexdef).toContain('PENDING_AUTHORIZATION');
            expect(index?.indexdef).toContain('CANCEL_SCHEDULED');
        }
    });

    it('enforces courtesy closure and nullable, nonnegative remaining charges', async () => {
        await withRollback(async (client) => {
            const { userId, subscriptionId } = await fixture(client);
            const insertGrant = `INSERT INTO courtesy_grant (beneficiary_user_id, months, starts_at, ends_at, granted_by, reason, subscription_id, balance_months, balance_closed_at, close_reason)
                VALUES ($1, 1, now(), now() + interval '1 month', $1, 'test', $2, 1, now(), $3)`;
            expect(
                (await rejected(client, insertGrant, [userId, subscriptionId, 'INVALID']))
                    ?.constraint
            ).toBe('ck_courtesy_grant_close_reason');
            const promo = await client.query<{ id: string }>(
                `INSERT INTO promo_code (code, discount_kind, value, all_verticals, total_quota, valid_from, valid_until, stackable, usable_with_another_active, duration_kind)
                VALUES ($1, 'FIXED', 1, true, 1, now(), now() + interval '1 day', false, false, 'FOREVER') RETURNING id`,
                [`b3-${crypto.randomUUID()}`]
            );
            const insertRedemption = `INSERT INTO promo_redemption (promo_code_id, user_id, redeemed_at, subscription_id, remaining_charges) VALUES ($1, $2, now(), $3, $4)`;
            await client.query(insertRedemption, [promo.rows[0]?.id, userId, subscriptionId, null]);
            expect(
                (
                    await rejected(client, insertRedemption, [
                        promo.rows[0]?.id,
                        userId,
                        subscriptionId,
                        -1
                    ])
                )?.constraint
            ).toBe('ck_promo_redemption_remaining_charges');
        });
    });

    it('enforces purchase identity, abandoned repurchase and USER target scope', async () => {
        await withRollback(async (client) => {
            const { userId, versionId, productId, subscriptionId } = await fixture(client);
            await client.query(insertInstance, [
                productId,
                versionId,
                userId,
                null,
                'ACTIVE',
                subscriptionId
            ]);
            const secondSubscription = await client.query<{ id: string }>(
                "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
            );
            expect(
                (
                    await rejected(client, insertInstance, [
                        productId,
                        versionId,
                        userId,
                        null,
                        'ACTIVE',
                        secondSubscription.rows[0]?.id
                    ])
                )?.constraint
            ).toBe('uq_addon_instance_purchase_identity');
            await client.query(
                "UPDATE addon_instance SET status = 'ABANDONED' WHERE product_id = $1 AND status = 'ACTIVE'",
                [productId]
            );
            await client.query(insertInstance, [
                productId,
                versionId,
                userId,
                null,
                'PENDING_AUTHORIZATION',
                null
            ]);
            expect(
                (
                    await rejected(client, insertInstance, [
                        productId,
                        versionId,
                        userId,
                        null,
                        'PENDING_AUTHORIZATION',
                        null
                    ])
                )?.constraint
            ).toBe('uq_addon_instance_purchase_identity');
            await client.query(
                "UPDATE addon_instance SET status = 'ABANDONED' WHERE product_id = $1 AND status = 'PENDING_AUTHORIZATION'",
                [productId]
            );
            await client.query(insertInstance, [
                productId,
                versionId,
                userId,
                null,
                'PENDING_AUTHORIZATION',
                null
            ]);
            expect(
                (
                    await rejected(client, insertInstance, [
                        productId,
                        versionId,
                        userId,
                        crypto.randomUUID(),
                        'ABANDONED',
                        null
                    ])
                )?.code
            ).toBe('23514');
        });
    });
});

describe('TEST:B3:40 — early manual payment and idempotency schema', () => {
    it('has manual period and nullable registration fields, no amount, and no reconciliation payment table', async () => {
        const columns = await getTestPool().query<{
            table_name: string;
            column_name: string;
            is_nullable: string;
        }>(
            "SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_name IN ('manual_payment', 'idempotency_key', 'reconciliation_mark_payment')"
        );
        const manual = columns.rows.filter((r) => r.table_name === 'manual_payment');
        const byName = Object.fromEntries(manual.map((r) => [r.column_name, r.is_nullable]));
        expect(byName.period_start).toBe('NO');
        expect(byName.registered_by).toBe('YES');
        expect(byName.registered_at).toBe('YES');
        expect(byName.proof_ref).toBe('YES');
        expect(
            manual.some((r) => r.column_name.includes('amount') || r.column_name.includes('monto'))
        ).toBe(false);
        expect(columns.rows.some((r) => r.table_name === 'reconciliation_mark_payment')).toBe(
            false
        );
    });

    it('rejects duplicate idempotency keys', async () => {
        await withRollback(async (client) => {
            const insert =
                "INSERT INTO idempotency_key (key, operation, subject_id) VALUES ($1, 'ORDER_CREATE', $2)";
            const key = crypto.randomUUID();
            await client.query(insert, [key, crypto.randomUUID()]);
            expect((await rejected(client, insert, [key, crypto.randomUUID()]))?.code).toBe(
                '23505'
            );
        });
    });
});
