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
    await tx.execute(sql`SAVEPOINT b74b_expected_rejection`);
    try {
        await tx.execute(statement);
        return null;
    } catch (error) {
        return sqlStateOf(error);
    } finally {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT b74b_expected_rejection`);
    }
}

interface Seeded {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly manualPaymentId: string;
}

/** Seeds a predecessor row with one provider payment and one manual payment of its own. */
async function seedPredecessor(tx: DrizzleClient): Promise<Seeded> {
    const subscription = await tx.execute(
        sql`INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id`
    );
    const subscriptionId = (subscription.rows[0] as { id: string }).id;
    const payment = await tx.execute(
        sql`INSERT INTO payment (subscription_id, amount, currency, status, provider, provider_fact_id, fact_at, refunded_amount)
            VALUES (${subscriptionId}, 1000, 'ARS', 'SUCCEEDED', 'TEST', ${crypto.randomUUID()}, now(), 0) RETURNING id`
    );
    const manualPayment = await tx.execute(
        sql`INSERT INTO manual_payment (subscription_id, period_start, status)
            VALUES (${subscriptionId}, now(), 'AWAITING') RETURNING id`
    );
    return {
        subscriptionId,
        paymentId: (payment.rows[0] as { id: string }).id,
        manualPaymentId: (manualPayment.rows[0] as { id: string }).id
    };
}

/** Builds a retention insert; every column is optional so each case breaks one rule. */
function retention(input: {
    readonly subscriptionId: string;
    readonly paymentId?: string | null;
    readonly manualPaymentId?: string | null;
    readonly releasedAt?: Date | null;
    readonly releaseReason?: string | null;
}): SQL {
    return sql`INSERT INTO succession_retained_payment (subscription_id, payment_id, manual_payment_id, unpaid_since, released_at, release_reason)
        VALUES (${input.subscriptionId}, ${input.paymentId ?? null}, ${input.manualPaymentId ?? null}, now(), ${input.releasedAt?.toISOString() ?? null}, ${input.releaseReason ?? null})`;
}

describe('TEST:B7:10 succession_retained_payment schema (AC:B7:16, HOS-1561 H1)', () => {
    it('a: rejects a retention with both payments or with none (23514 one_payment)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedPredecessor(tx);

            // Act
            const both = await rejection(
                tx,
                retention({
                    subscriptionId: seeded.subscriptionId,
                    paymentId: seeded.paymentId,
                    manualPaymentId: seeded.manualPaymentId
                })
            );
            const none = await rejection(tx, retention({ subscriptionId: seeded.subscriptionId }));

            // Assert
            expect(both).toEqual({
                code: '23514',
                constraint: 'ck_succession_retained_payment_one_payment'
            });
            expect(none).toEqual({
                code: '23514',
                constraint: 'ck_succession_retained_payment_one_payment'
            });
        });
    });

    it('b: rejects a release without a reason and a reason without a release (23514 release)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedPredecessor(tx);

            // Act
            const releaseOnly = await rejection(
                tx,
                retention({
                    subscriptionId: seeded.subscriptionId,
                    paymentId: seeded.paymentId,
                    releasedAt: new Date()
                })
            );
            const reasonOnly = await rejection(
                tx,
                retention({
                    subscriptionId: seeded.subscriptionId,
                    paymentId: seeded.paymentId,
                    releaseReason: 'REEVALUATED'
                })
            );

            // Assert
            expect(releaseOnly).toEqual({
                code: '23514',
                constraint: 'ck_succession_retained_payment_release'
            });
            expect(reasonOnly).toEqual({
                code: '23514',
                constraint: 'ck_succession_retained_payment_release'
            });
        });
    });

    it('c: rejects a release reason outside the five (23514 release_reason)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedPredecessor(tx);

            // Act
            const outside = await rejection(
                tx,
                retention({
                    subscriptionId: seeded.subscriptionId,
                    paymentId: seeded.paymentId,
                    releasedAt: new Date(),
                    releaseReason: 'REFUNDED'
                })
            );

            // Assert
            expect(outside).toEqual({
                code: '23514',
                constraint: 'ck_succession_retained_payment_release_reason'
            });
        });
    });

    it('d: accepts each of the five release reasons on a closed retention', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedPredecessor(tx);
            const reasons = [
                'REEVALUATED',
                'SUCCESSION_CLOSED',
                'PERSON_RESOLVED',
                'PERMANENT_GRANT',
                'REVOCATION_REFUNDED'
            ] as const;

            // Act
            const outcomes = [];
            for (const reason of reasons) {
                outcomes.push(
                    await rejection(
                        tx,
                        retention({
                            subscriptionId: seeded.subscriptionId,
                            paymentId: seeded.paymentId,
                            releasedAt: new Date(),
                            releaseReason: reason
                        })
                    )
                );
            }

            // Assert
            expect(outcomes).toEqual([null, null, null, null, null]);
        });
    });

    it('e: rejects a second OPEN retention of the same payment (23505 partial unique index)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedPredecessor(tx);
            await tx.execute(
                retention({ subscriptionId: seeded.subscriptionId, paymentId: seeded.paymentId })
            );
            await tx.execute(
                retention({
                    subscriptionId: seeded.subscriptionId,
                    manualPaymentId: seeded.manualPaymentId
                })
            );

            // Act
            const secondPayment = await rejection(
                tx,
                retention({ subscriptionId: seeded.subscriptionId, paymentId: seeded.paymentId })
            );
            const secondManual = await rejection(
                tx,
                retention({
                    subscriptionId: seeded.subscriptionId,
                    manualPaymentId: seeded.manualPaymentId
                })
            );

            // Assert
            expect(secondPayment).toEqual({
                code: '23505',
                constraint: 'uq_succession_retained_payment_open_payment'
            });
            expect(secondManual).toEqual({
                code: '23505',
                constraint: 'uq_succession_retained_payment_open_manual_payment'
            });
        });
    });

    it('f: accepts a second retention of the same payment once the first one is closed', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seeded = await seedPredecessor(tx);
            await tx.execute(
                retention({
                    subscriptionId: seeded.subscriptionId,
                    paymentId: seeded.paymentId,
                    releasedAt: new Date(),
                    releaseReason: 'REEVALUATED'
                })
            );

            // Act
            const reopened = await rejection(
                tx,
                retention({ subscriptionId: seeded.subscriptionId, paymentId: seeded.paymentId })
            );
            await tx.execute(
                retention({ subscriptionId: seeded.subscriptionId, paymentId: seeded.paymentId })
            );
            const rows = await tx.execute(
                sql`SELECT released_at IS NULL AS open FROM succession_retained_payment
                    WHERE payment_id = ${seeded.paymentId} ORDER BY open`
            );

            // Assert
            expect(reopened).toBeNull();
            expect(rows.rows).toEqual([{ open: false }, { open: true }]);
        });
    });
});
