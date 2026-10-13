import { type SQL, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

interface PgErrorShape {
    readonly code?: unknown;
    readonly constraint?: unknown;
    readonly cause?: unknown;
}

interface RejectionDetails {
    readonly code: string | null;
    readonly constraint: string | null;
}

/**
 * Walks the `cause` chain of a Drizzle error until it finds the SQLSTATE that
 * Postgres raised (Drizzle wraps the driver error without copying it).
 */
function sqlStateOf(error: unknown): RejectionDetails {
    let current: unknown = error;
    for (let depth = 0; depth < 8 && current; depth++) {
        const candidate = current as PgErrorShape;
        if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
            return {
                code: candidate.code,
                constraint: typeof candidate.constraint === 'string' ? candidate.constraint : null
            };
        }
        current = candidate.cause;
    }
    return { code: null, constraint: null };
}

/**
 * Runs one statement that is expected to fail inside its own SAVEPOINT, so the
 * surrounding test transaction stays usable. Returns null when it succeeded.
 */
async function rejection(tx: DrizzleClient, statement: SQL): Promise<RejectionDetails | null> {
    await tx.execute(sql`SAVEPOINT b53_expected_rejection`);
    try {
        await tx.execute(statement);
        return null;
    } catch (error) {
        return sqlStateOf(error);
    } finally {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT b53_expected_rejection`);
    }
}

/** Seeds a settling user and a SUCCEEDED payment owned by the test alone. */
async function seedPayment(tx: DrizzleClient): Promise<{ userId: string; paymentId: string }> {
    const userId = crypto.randomUUID();
    await tx.execute(
        sql`INSERT INTO users (id, slug, email) VALUES (${userId}, ${`b53-${userId}`}, ${`b53-${userId}@example.test`})`
    );
    const subscription = await tx.execute(
        sql`INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id`
    );
    const subscriptionId = (subscription.rows[0] as { id: string }).id;
    const payment = await tx.execute(
        sql`INSERT INTO payment (subscription_id, amount, currency, status, provider, provider_fact_id, fact_at, refunded_amount)
            VALUES (${subscriptionId}, 1000, 'ARS', 'SUCCEEDED', 'TEST', ${crypto.randomUUID()}, now(), 0) RETURNING id`
    );
    return { userId, paymentId: (payment.rows[0] as { id: string }).id };
}

/** Builds an EXECUTED/EXTERNAL refund insert for the given channel and reference. */
function externalRefund(input: {
    readonly paymentId: string;
    readonly userId: string;
    readonly channel: string;
    readonly reference: string;
}): SQL {
    return sql`INSERT INTO refund (payment_id, amount, reason, status, executed_via, settled_by, external_channel, external_ref)
        VALUES (${input.paymentId}, 100, 'OUT_OF_FLOW_REFUND', 'EXECUTED', 'EXTERNAL', ${input.userId}, ${input.channel}, ${input.reference})`;
}

describe('TEST:B5:6 refund external settlement schema', () => {
    it('a: contains billing.settleExternal in permission_enum', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange + Act
            const result = await tx.execute(
                sql`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'permission_enum' AND e.enumlabel = 'billing.settleExternal'`
            );

            // Assert
            expect(result.rows).toHaveLength(1);
        });
    });

    it('b: accepts an EXECUTED/EXTERNAL refund through a bank transfer and through the provider panel', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { userId, paymentId } = await seedPayment(tx);
            const transferRef = `transfer-${crypto.randomUUID()}`;
            const panelRef = `panel-${crypto.randomUUID()}`;

            // Act
            await tx.execute(
                externalRefund({
                    paymentId,
                    userId,
                    channel: 'BANK_TRANSFER',
                    reference: transferRef
                })
            );
            await tx.execute(
                externalRefund({
                    paymentId,
                    userId,
                    channel: 'PROVIDER_PANEL',
                    reference: panelRef
                })
            );
            const rows = await tx.execute(
                sql`SELECT external_channel, external_ref, settled_by FROM refund WHERE payment_id = ${paymentId} ORDER BY external_channel`
            );

            // Assert
            expect(rows.rows).toEqual([
                {
                    external_channel: 'BANK_TRANSFER',
                    external_ref: transferRef,
                    settled_by: userId
                },
                { external_channel: 'PROVIDER_PANEL', external_ref: panelRef, settled_by: userId }
            ]);
        });
    });

    it('c: rejects an external channel on a REQUESTED refund and on an EXECUTED/PROVIDER refund with 23514', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { paymentId } = await seedPayment(tx);

            // Act
            const onRequested = await rejection(
                tx,
                sql`INSERT INTO refund (payment_id, amount, reason, status, external_channel)
                    VALUES (${paymentId}, 100, 'REVOCATION', 'REQUESTED', 'BANK_TRANSFER')`
            );
            const onProvider = await rejection(
                tx,
                sql`INSERT INTO refund (payment_id, amount, reason, status, executed_via, external_channel)
                    VALUES (${paymentId}, 100, 'REVOCATION', 'EXECUTED', 'PROVIDER', 'PROVIDER_PANEL')`
            );

            // Assert
            expect(onRequested).toEqual({
                code: '23514',
                constraint: 'ck_refund_external_channel'
            });
            expect(onProvider).toEqual({ code: '23514', constraint: 'ck_refund_external_channel' });
        });
    });

    it('d: rejects an external channel outside the list with 23514', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { userId, paymentId } = await seedPayment(tx);

            // Act
            const outside = await rejection(
                tx,
                externalRefund({
                    paymentId,
                    userId,
                    channel: 'CASH',
                    reference: crypto.randomUUID()
                })
            );

            // Assert
            expect(outside).toEqual({ code: '23514', constraint: 'ck_refund_external_channel' });
        });
    });

    it('e: rejects a second provider panel refund with the same reference with 23505', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { userId, paymentId } = await seedPayment(tx);
            const reference = `panel-${crypto.randomUUID()}`;
            await tx.execute(
                externalRefund({ paymentId, userId, channel: 'PROVIDER_PANEL', reference })
            );

            // Act
            const duplicate = await rejection(
                tx,
                externalRefund({ paymentId, userId, channel: 'PROVIDER_PANEL', reference })
            );

            // Assert
            expect(duplicate).toEqual({
                code: '23505',
                constraint: 'uq_refund_provider_panel_reference'
            });
        });
    });

    it('f: accepts two bank transfer refunds with the same reference', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { userId, paymentId } = await seedPayment(tx);
            const reference = `transfer-${crypto.randomUUID()}`;
            await tx.execute(
                externalRefund({ paymentId, userId, channel: 'BANK_TRANSFER', reference })
            );

            // Act
            const second = await rejection(
                tx,
                externalRefund({ paymentId, userId, channel: 'BANK_TRANSFER', reference })
            );
            await tx.execute(
                externalRefund({ paymentId, userId, channel: 'BANK_TRANSFER', reference })
            );
            const rows = await tx.execute(
                sql`SELECT id FROM refund WHERE payment_id = ${paymentId} AND external_ref = ${reference}`
            );

            // Assert
            expect(second).toBeNull();
            expect(rows.rows).toHaveLength(2);
        });
    });
});
