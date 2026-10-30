import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PAYMENT_STATUSES } from '../../src/schemas/vertical/payment.dbschema.ts';
import { REFUND_STATUSES } from '../../src/schemas/vertical/refund.dbschema.ts';
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

async function fixture(client: PoolClient) {
    const userId = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        userId,
        `b516-${userId}`,
        `b516-${userId}@example.test`
    ]);
    const subscription = await client.query<{ id: string }>(
        "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
    );
    const addon = await client.query<{ id: string }>(
        "INSERT INTO addon (slug, name) VALUES ($1, 'B5 schema test addon') RETURNING id",
        [`b516-${crypto.randomUUID()}`]
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
    const manual = await client.query<{ id: string }>(
        "INSERT INTO manual_payment (subscription_id, period_start, status) VALUES ($1, now(), 'AWAITING') RETURNING id",
        [subscription.rows[0]?.id]
    );
    const mark = await client.query<{ id: string }>(
        "INSERT INTO reconciliation_mark (subscription_id, reason) VALUES ($1, 'COBRO_DUPLICADO') RETURNING id",
        [subscription.rows[0]?.id]
    );
    return {
        userId,
        subscriptionId: subscription.rows[0]?.id as string,
        instanceId: instance.rows[0]?.id as string,
        manualPaymentId: manual.rows[0]?.id as string,
        markId: mark.rows[0]?.id as string
    };
}

async function insertPayment(
    client: PoolClient,
    subject: { subscriptionId?: string | null; instanceId?: string | null },
    providerFactId = crypto.randomUUID(),
    overrides: { amount?: number; refundedAmount?: number; status?: string } = {}
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO payment (subscription_id, addon_instance_id, amount, currency, status, provider, provider_fact_id, fact_at, refunded_amount)
         VALUES ($1, $2, $3, 'ARS', $4, 'TEST', $5, now(), $6) RETURNING id`,
        [
            subject.subscriptionId ?? null,
            subject.instanceId ?? null,
            overrides.amount ?? 100,
            overrides.status ?? 'SUCCEEDED',
            providerFactId,
            overrides.refundedAmount ?? 0
        ]
    );
    return result.rows[0]?.id as string;
}

async function insertRefund(
    client: PoolClient,
    subject: { paymentId?: string | null; manualPaymentId?: string | null },
    status = 'REQUESTED',
    executedVia: string | null = null
): Promise<string> {
    const result = await client.query<{ id: string }>(
        `INSERT INTO refund (payment_id, manual_payment_id, amount, reason, status, executed_via)
         VALUES ($1, $2, 25, 'CUSTOMER_REQUEST', $3, $4) RETURNING id`,
        [subject.paymentId ?? null, subject.manualPaymentId ?? null, status, executedVia]
    );
    return result.rows[0]?.id as string;
}

async function insertIdempotencyKey(
    client: PoolClient,
    key = crypto.randomUUID()
): Promise<string> {
    await client.query(
        "INSERT INTO idempotency_key (key, operation, subject_id) VALUES ($1, 'REFUND_CREATE', $2)",
        [key, crypto.randomUUID()]
    );
    return key;
}

async function checkDef(name: string): Promise<string> {
    const result = await getTestPool().query<{ definition: string }>(
        'SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = $1',
        [name]
    );
    return result.rows[0]?.definition ?? '';
}

const insertCovered = `INSERT INTO covered_period (subscription_id, period_start, payment_id, manual_payment_id, credited_at)
VALUES ($1, $2, $3, $4, now())`;
const insertMarkPayment = `INSERT INTO reconciliation_mark_payment (mark_id, payment_id, manual_payment_id)
VALUES ($1, $2, $3)`;
const insertReceipt = `INSERT INTO receipt (payment_id, manual_payment_id, receipt_number, payer_name, payer_email)
VALUES ($1, $2, $3, $4, $5)`;

describe('TEST:B5:16 — B5 schema migration from empty', () => {
    it('TEST:B5:16 a: creates six empty tables and preserves B3 tables', async () => {
        const names = [
            'payment',
            'covered_period',
            'refund',
            'refund_call',
            'reconciliation_mark_payment',
            'receipt'
        ];
        const tables = await getTestPool().query<{ tablename: string }>(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
            [[...names, 'manual_payment', 'idempotency_key']]
        );
        expect(tables.rows.map((row) => row.tablename).sort()).toEqual(
            [...names, 'manual_payment', 'idempotency_key'].sort()
        );
        for (const name of names) {
            const count = await getTestPool().query<{ n: string }>(
                `SELECT count(*)::text AS n FROM "${name}"`
            );
            expect(count.rows[0]?.n).toBe('0');
        }
    });

    it('TEST:B5:16 b: payment has nullable addon reference and enforces subject, status, amounts and provider fact uniqueness', async () => {
        const columns = await getTestPool().query<{ is_nullable: string }>(
            "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'payment' AND column_name = 'addon_instance_id'"
        );
        expect(columns.rows[0]?.is_nullable).toBe('YES');
        const statusCheck = await checkDef('ck_payment_status');
        expect([...statusCheck.matchAll(/'([^']+)'/g)].map((match) => match[1])).toEqual([
            ...PAYMENT_STATUSES
        ]);
        await withRollback(async (client) => {
            const subject = await fixture(client);
            for (const values of [
                [null, null],
                [subject.subscriptionId, subject.instanceId]
            ]) {
                const error = await rejected(
                    client,
                    `INSERT INTO payment (subscription_id, addon_instance_id, amount, currency, status, provider, provider_fact_id, fact_at) VALUES ($1, $2, 100, 'ARS', 'SUCCEEDED', 'TEST', $3, now())`,
                    [...values, crypto.randomUUID()]
                );
                expect(error?.code).toBe('23514');
            }
            await insertPayment(client, { subscriptionId: subject.subscriptionId });
            await insertPayment(client, { instanceId: subject.instanceId });
            expect(
                (
                    await rejected(
                        client,
                        `INSERT INTO payment (subscription_id, amount, currency, status, provider, provider_fact_id, fact_at) VALUES ($1, 100, 'ARS', 'INVALID', 'TEST', $2, now())`,
                        [subject.subscriptionId, crypto.randomUUID()]
                    )
                )?.code
            ).toBe('23514');
            expect(
                (
                    await rejected(
                        client,
                        `INSERT INTO payment (subscription_id, amount, currency, status, provider, provider_fact_id, fact_at, refunded_amount) VALUES ($1, 100, 'ARS', 'SUCCEEDED', 'TEST', $2, now(), 101)`,
                        [subject.subscriptionId, crypto.randomUUID()]
                    )
                )?.code
            ).toBe('23514');
            const duplicateFact = crypto.randomUUID();
            await insertPayment(client, { subscriptionId: subject.subscriptionId }, duplicateFact);
            const duplicate = await rejected(
                client,
                `INSERT INTO payment (subscription_id, amount, currency, status, provider, provider_fact_id, fact_at) VALUES ($1, 100, 'ARS', 'SUCCEEDED', 'TEST', $2, now())`,
                [subject.subscriptionId, duplicateFact]
            );
            expect(duplicate?.code).toBe('23505');
            expect(duplicate?.constraint).toBe('uq_payment_provider_fact');
        });
    });

    it('TEST:B5:16 c: covered period uniquely locks only unreleased subscription periods and requires one payment', async () => {
        await withRollback(async (client) => {
            const subject = await fixture(client);
            const paymentId = await insertPayment(client, {
                subscriptionId: subject.subscriptionId
            });
            const start = new Date('2026-01-01T00:00:00Z');
            await client.query(insertCovered, [subject.subscriptionId, start, paymentId, null]);
            const duplicate = await rejected(client, insertCovered, [
                subject.subscriptionId,
                start,
                paymentId,
                null
            ]);
            expect(duplicate?.code).toBe('23505');
            expect(duplicate?.constraint).toBe('uq_covered_period_open_subscription_period');
            await client.query(
                'UPDATE covered_period SET released_at = now() WHERE subscription_id = $1',
                [subject.subscriptionId]
            );
            await client.query(insertCovered, [subject.subscriptionId, start, paymentId, null]);
            const otherSubscription = await client.query<{ id: string }>(
                "INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id"
            );
            await client.query(insertCovered, [
                otherSubscription.rows[0]?.id,
                start,
                paymentId,
                null
            ]);
            for (const refs of [
                [null, null],
                [paymentId, subject.manualPaymentId]
            ]) {
                expect(
                    (
                        await rejected(client, insertCovered, [
                            subject.subscriptionId,
                            new Date(),
                            ...refs
                        ])
                    )?.code
                ).toBe('23514');
            }
            await client.query(insertCovered, [
                subject.subscriptionId,
                new Date('2026-02-01Z'),
                null,
                subject.manualPaymentId
            ]);
            const indexes = await client.query<{ indexdef: string }>(
                "SELECT indexdef FROM pg_indexes WHERE tablename = 'covered_period' AND indexname = 'uq_covered_period_open_subscription_period'"
            );
            expect(indexes.rows[0]?.indexdef).toContain('released_at IS NULL');
        });
    });

    it('TEST:B5:16 d: refund enforces its state machine, one payment and execution fields', async () => {
        const stateCheck = await checkDef('ck_refund_status');
        expect([...stateCheck.matchAll(/'([^']+)'/g)].map((match) => match[1])).toEqual([
            ...REFUND_STATUSES
        ]);
        await withRollback(async (client) => {
            const subject = await fixture(client);
            const paymentId = await insertPayment(client, {
                subscriptionId: subject.subscriptionId
            });
            for (const refs of [
                [null, null],
                [paymentId, subject.manualPaymentId]
            ]) {
                expect(
                    (
                        await rejected(
                            client,
                            "INSERT INTO refund (payment_id, manual_payment_id, amount, reason, status) VALUES ($1, $2, 10, 'R', 'REQUESTED')",
                            refs
                        )
                    )?.code
                ).toBe('23514');
            }
            expect(
                (
                    await rejected(
                        client,
                        "INSERT INTO refund (payment_id, amount, reason, status) VALUES ($1, 10, 'R', 'INVALID')",
                        [paymentId]
                    )
                )?.code
            ).toBe('23514');
            expect(
                (
                    await rejected(
                        client,
                        "INSERT INTO refund (payment_id, amount, reason, status, executed_via) VALUES ($1, 10, 'R', 'REQUESTED', 'PROVIDER')",
                        [paymentId]
                    )
                )?.code
            ).toBe('23514');
            expect(
                (
                    await rejected(
                        client,
                        "INSERT INTO refund (payment_id, amount, reason, status) VALUES ($1, 10, 'R', 'EXECUTED')",
                        [paymentId]
                    )
                )?.code
            ).toBe('23514');
            expect(
                (
                    await rejected(
                        client,
                        "INSERT INTO refund (payment_id, amount, reason, status, executed_via, settled_by) VALUES ($1, 10, 'R', 'REQUESTED', NULL, $2)",
                        [paymentId, subject.userId]
                    )
                )?.code
            ).toBe('23514');
            await insertRefund(client, { paymentId });
            await insertRefund(client, { manualPaymentId: subject.manualPaymentId });
            await insertRefund(client, { paymentId }, 'EXECUTED', 'PROVIDER');
        });
    });

    it('TEST:B5:16 e: refund calls enforce order waiting index, unique provider id and idempotency FK/unique', async () => {
        await withRollback(async (client) => {
            const subject = await fixture(client);
            const paymentId = await insertPayment(client, { instanceId: subject.instanceId });
            const refundId = await insertRefund(client, { paymentId });
            const insertCall = `INSERT INTO refund_call (refund_id, idempotency_key, provider_refund_id, amount, addon_instance_id) VALUES ($1, $2, $3, 10, $4)`;
            const key1 = await insertIdempotencyKey(client);
            await client.query(insertCall, [refundId, key1, null, subject.instanceId]);
            const key2 = await insertIdempotencyKey(client);
            const waiting = await rejected(client, insertCall, [
                refundId,
                key2,
                null,
                subject.instanceId
            ]);
            expect(waiting?.code).toBe('23505');
            expect(waiting?.constraint).toBe('uq_refund_call_order_awaiting_id');
            const providerId = crypto.randomUUID();
            await client.query(
                'UPDATE refund_call SET provider_refund_id = $1 WHERE idempotency_key = $2',
                [providerId, key1]
            );
            await client.query(insertCall, [refundId, key2, null, subject.instanceId]);
            const key3 = await insertIdempotencyKey(client);
            const duplicateProviderId = await rejected(client, insertCall, [
                refundId,
                key3,
                providerId,
                subject.instanceId
            ]);
            expect(duplicateProviderId?.code).toBe('23505');
            expect(duplicateProviderId?.constraint).toBe('uq_refund_call_provider_refund_id');
            const key4 = await insertIdempotencyKey(client);
            await client.query(insertCall, [refundId, key4, null, null]);
            const key5 = await insertIdempotencyKey(client);
            await client.query(insertCall, [refundId, key5, null, null]);
            const absentKey = await rejected(client, insertCall, [
                refundId,
                crypto.randomUUID(),
                null,
                null
            ]);
            expect(absentKey?.code).toBe('23503');
            const repeatedKey = await rejected(client, insertCall, [
                refundId,
                key1,
                crypto.randomUUID(),
                null
            ]);
            expect(repeatedKey?.code).toBe('23505');
            expect(repeatedKey?.constraint).toBe('uq_refund_call_idempotency_key');
        });
    });

    it('TEST:B5:16 f: reconciliation mark payments support both FKs, independent resolution fields and per-source uniqueness', async () => {
        await withRollback(async (client) => {
            const subject = await fixture(client);
            const paymentId = await insertPayment(client, {
                subscriptionId: subject.subscriptionId
            });
            const otherMark = await client.query<{ id: string }>(
                "INSERT INTO reconciliation_mark (subscription_id, reason) VALUES ($1, 'ADDON_SIN_APAGAR') RETURNING id",
                [subject.subscriptionId]
            );
            await client.query(insertMarkPayment, [subject.markId, paymentId, null]);
            await client.query(insertMarkPayment, [subject.markId, null, subject.manualPaymentId]);
            for (const refs of [
                [null, null],
                [paymentId, subject.manualPaymentId]
            ]) {
                expect(
                    (await rejected(client, insertMarkPayment, [subject.markId, ...refs]))?.code
                ).toBe('23514');
            }
            for (const [paymentRef, manualRef] of [
                [paymentId, null],
                [null, subject.manualPaymentId]
            ]) {
                const duplicate = await rejected(client, insertMarkPayment, [
                    subject.markId,
                    paymentRef,
                    manualRef
                ]);
                expect(duplicate?.code).toBe('23505');
            }
            await client.query(insertMarkPayment, [otherMark.rows[0]?.id, paymentId, null]);
            const refundId = await insertRefund(client, { paymentId });
            await client.query(
                'UPDATE reconciliation_mark_payment SET resolved_at = now() WHERE mark_id = $1 AND payment_id = $2',
                [subject.markId, paymentId]
            );
            await client.query(
                'UPDATE reconciliation_mark_payment SET refund_id = $1 WHERE mark_id = $2 AND payment_id = $3',
                [refundId, subject.markId, paymentId]
            );
            await client.query(
                'INSERT INTO reconciliation_mark_payment (mark_id, manual_payment_id, refund_id) VALUES ($1, $2, $3)',
                [otherMark.rows[0]?.id, subject.manualPaymentId, refundId]
            );
            expect(
                (
                    await rejected(
                        client,
                        'INSERT INTO reconciliation_mark_payment (mark_id, manual_payment_id, refund_id) VALUES ($1, $2, $3)',
                        [otherMark.rows[0]?.id, crypto.randomUUID(), refundId]
                    )
                )?.code
            ).toBe('23503');
        });
    });

    it('TEST:B5:16 g: receipt enforces one payment, paired payer identity and unique number', async () => {
        await withRollback(async (client) => {
            const subject = await fixture(client);
            const paymentId = await insertPayment(client, {
                subscriptionId: subject.subscriptionId
            });
            for (const refs of [
                [null, null],
                [paymentId, subject.manualPaymentId]
            ]) {
                expect(
                    (await rejected(client, insertReceipt, [...refs, 1, null, null]))?.code
                ).toBe('23514');
            }
            expect(
                (await rejected(client, insertReceipt, [paymentId, null, 1, 'Name', null]))?.code
            ).toBe('23514');
            expect(
                (
                    await rejected(client, insertReceipt, [
                        paymentId,
                        null,
                        2,
                        null,
                        'a@example.test'
                    ])
                )?.code
            ).toBe('23514');
            await client.query(insertReceipt, [paymentId, null, 1, null, null]);
            await client.query(insertReceipt, [
                null,
                subject.manualPaymentId,
                2,
                'Payer',
                'payer@example.test'
            ]);
            const duplicate = await rejected(client, insertReceipt, [
                paymentId,
                null,
                1,
                null,
                null
            ]);
            expect(duplicate?.code).toBe('23505');
            expect(duplicate?.constraint).toBe('uq_receipt_receipt_number');
        });
    });
});
