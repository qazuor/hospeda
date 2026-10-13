// TEST:B5:12 (AC:B5:23), only the case of this sheet: a predecessor in GRACE_PERIOD that
// retains a payment by S19 is revoked by S36. The retained payment is the last credited one,
// its RF1 is born, the 10 days count from it and its S19 flag goes off in the same act with
// REVOCATION_REFUNDED, so branch 6 of S18 has no retention to mark (DEC-RF-001📌5).
// `succession_retained_payment` is a global population (the B11.8 sweep lists every open
// retention): each test deletes the retentions of its own rows before retiring them.
import {
    eq,
    inArray,
    reconciliationMarkPayments,
    refunds,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { revocationWindowEndsAt } from '../../../src/services/billing/subscription/revocation-payment.js';
import { requestRevocationRefund } from '../../../src/services/billing/subscription/revocation-refund.js';
import {
    previewSubscriptionRevocation,
    revokeSubscription
} from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireRevocationRows,
    revocationFixture,
    seedCreditedPayment,
    seedRevocationActor,
    seedSiblingPrincipal,
    subscriptionRow
} from './support/revocation-fixtures.js';
import {
    openMarksOf,
    refundsOf,
    retainInOwnTransaction,
    retentionsOf
} from './support/succession-retention-fixtures.js';

/** Rows of this file whose retentions must leave the global population after each test. */
const retainingRows: string[] = [];

afterEach(async () => {
    const rows = retainingRows.splice(0);
    if (rows.length > 0)
        await getServiceTestDb()
            .delete(successionRetainedPayments)
            .where(inArray(successionRetainedPayments.subscriptionId, rows));
    await retireRevocationRows();
});
afterAll(closeServiceTestPool);

const live = !isServiceTestDbAvailable();

/**
 * A predecessor in GRACE_PERIOD (P0 of 10 000 on day 0, grace from day 2) with a live
 * successor waiting for authorization, retaining the payments credited on `retainedDays`.
 */
async function retainingPredecessor(retainedDays: readonly number[] = [8]) {
    const f = await revocationFixture({ origin: 'GRACE_PERIOD' });
    retainingRows.push(f.subscriptionId);
    const successor = await seedSiblingPrincipal({
        like: f,
        status: 'PENDING_AUTHORIZATION',
        succeedsId: f.subscriptionId
    });
    const retained = [];
    for (const n of retainedDays) {
        const payment = await seedCreditedPayment({
            subscriptionId: f.subscriptionId,
            factAt: f.day(n)
        });
        await retainInOwnTransaction({
            subscriptionId: f.subscriptionId,
            paymentId: payment.id,
            unpaidSince: f.day(2),
            now: f.day(n)
        });
        retained.push(payment);
    }
    return { f, successor, retained };
}

/** The retentions of one payment (open or closed). */
async function retentionOf(subscriptionId: string, paymentId: string) {
    const rows = await retentionsOf(subscriptionId);
    return rows.filter((row) => row.paymentId === paymentId);
}

/** Seeds a refund already hanging from `paymentId` before the act. */
async function seedRefund(input: {
    readonly paymentId: string;
    readonly amount: number;
    readonly status: 'REQUESTED' | 'FAILED';
}) {
    await getServiceTestDb().insert(refunds).values({
        paymentId: input.paymentId,
        amount: input.amount,
        reason: 'REVOCATION',
        status: input.status
    });
}

describe('HOS-1544 TEST:B5:12 AC:B5:23 a predecessor in GRACE_PERIOD retaining an S19 payment is revoked over that payment', () => {
    it.skipIf(live)(
        '(a) the RF1 returns the retained payment and its S19 flag goes off with REVOCATION_REFUNDED, no branch-6 mark',
        async () => {
            // Arrange: P0's window closed on day 11; R's (day 8) is still open on day 15
            const { f, successor, retained } = await retainingPredecessor();
            const r = retained[0]!;
            f.at(f.day(15));

            // Act
            const result = await revokeSubscription(
                {
                    actor: await seedRevocationActor(),
                    subscriptionId: f.subscriptionId,
                    expectedPaymentId: r.id
                },
                f.ports
            );

            // Assert
            expect(result.payment).toEqual({ source: 'PAYMENT', id: r.id });
            expect(result.refundAmount).toBe(10000);
            const onR = await refundsOf(r.id);
            expect(onR).toHaveLength(1);
            expect(onR[0]).toMatchObject({
                id: result.refundId,
                amount: 10000,
                reason: 'REVOCATION',
                status: 'REQUESTED'
            });
            expect(await refundsOf(f.payment!.id)).toEqual([]);
            expect((await subscriptionRow(f.subscriptionId)).status).toBe('CANCELLED');
            const retention = await retentionOf(f.subscriptionId, r.id);
            expect(retention).toHaveLength(1);
            expect(retention[0]?.releasedAt?.toISOString()).toBe(f.day(15).toISOString());
            expect(retention[0]?.releaseReason).toBe('REVOCATION_REFUNDED');
            expect(await retentionsOf(f.subscriptionId)).toHaveLength(1);
            const marks = await openMarksOf(f.subscriptionId);
            expect(marks.filter((mark) => mark.reason === 'REEMBOLSO_POR_CONFIRMAR')).toEqual([]);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(reconciliationMarkPayments)
                    .where(eq(reconciliationMarkPayments.paymentId, r.id))
            ).toEqual([]);
            expect((await subscriptionRow(successor.id)).status).toBe('PENDING_AUTHORIZATION');
        }
    );

    it.skipIf(live)(
        '(b) the preview shows the retained payment and its window, writing nothing',
        async () => {
            // Arrange
            const { f, retained } = await retainingPredecessor();
            const r = retained[0]!;
            f.at(f.day(15));

            // Act
            const preview = await previewSubscriptionRevocation(
                { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                { clock: f.fixture.clock }
            );

            // Assert
            expect(preview.payment.id).toBe(r.id);
            expect(preview.payment.amount).toBe(10000);
            expect(preview.windowEndsAt.toISOString()).toBe(
                revocationWindowEndsAt({ chargedAt: r.factAt }).toISOString()
            );
            const retention = await retentionOf(f.subscriptionId, r.id);
            expect(retention).toHaveLength(1);
            expect(retention[0]?.releasedAt).toBeNull();
            expect(await refundsOf(r.id)).toEqual([]);
            expect((await subscriptionRow(f.subscriptionId)).status).toBe('GRACE_PERIOD');
        }
    );

    it.skipIf(live)(
        '(c) the 10 days count from the retained payment: past its window S36 rejects and the flag stays on',
        async () => {
            // Arrange: R credited on day 8; its window ended at the start of day 19 (AR)
            const { f, retained } = await retainingPredecessor();
            const r = retained[0]!;
            f.at(f.day(19));

            // Act / Assert
            await expect(
                revokeSubscription(
                    { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                    f.ports
                )
            ).rejects.toMatchObject({ reason: 'REVOCATION_WINDOW_CLOSED' });
            expect((await subscriptionRow(f.subscriptionId)).status).toBe('GRACE_PERIOD');
            const retention = await retentionOf(f.subscriptionId, r.id);
            expect(retention).toHaveLength(1);
            expect(retention[0]?.releasedAt).toBeNull();
            expect(await refundsOf(r.id)).toEqual([]);
        }
    );

    it.skipIf(live)(
        '(d) an open REQUESTED refund of 4 000 on R: the RF1 asks for 6 000 and the flag goes off',
        async () => {
            // Arrange
            const { f, retained } = await retainingPredecessor();
            const r = retained[0]!;
            await seedRefund({ paymentId: r.id, amount: 4000, status: 'REQUESTED' });
            f.at(f.day(15));

            // Act
            const result = await revokeSubscription(
                { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                f.ports
            );

            // Assert
            expect(result.refundAmount).toBe(6000);
            const amounts = (await refundsOf(r.id)).map(({ amount }) => amount).sort();
            expect(amounts).toEqual([4000, 6000]);
            const retention = await retentionOf(f.subscriptionId, r.id);
            expect(retention[0]?.releaseReason).toBe('REVOCATION_REFUNDED');
            expect(retention[0]?.releasedAt?.toISOString()).toBe(f.day(15).toISOString());
        }
    );

    it.skipIf(live)(
        '(e) an open REQUESTED refund for the total blocks the whole act: nothing cancelled, flag still on',
        async () => {
            // Arrange
            const { f, retained } = await retainingPredecessor();
            const r = retained[0]!;
            await seedRefund({ paymentId: r.id, amount: 10000, status: 'REQUESTED' });
            f.at(f.day(15));

            // Act / Assert
            await expect(
                revokeSubscription(
                    { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                    f.ports
                )
            ).rejects.toMatchObject({ reason: 'REFUND_EXCEEDS_BALANCE' });
            expect((await subscriptionRow(f.subscriptionId)).status).toBe('GRACE_PERIOD');
            const onR = await refundsOf(r.id);
            expect(onR).toHaveLength(1);
            expect(onR[0]).toMatchObject({ amount: 10000, status: 'REQUESTED' });
            const retention = await retentionOf(f.subscriptionId, r.id);
            expect(retention).toHaveLength(1);
            expect(retention[0]?.releasedAt).toBeNull();
        }
    );

    it.skipIf(live)(
        '(f) a FAILED refund for the total does not count: the RF1 asks for 10 000 and the flag goes off',
        async () => {
            // Arrange
            const { f, retained } = await retainingPredecessor();
            const r = retained[0]!;
            await seedRefund({ paymentId: r.id, amount: 10000, status: 'FAILED' });
            f.at(f.day(15));

            // Act
            const result = await revokeSubscription(
                { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                f.ports
            );

            // Assert
            expect(result.refundAmount).toBe(10000);
            const requested = (await refundsOf(r.id)).filter(
                ({ status }) => status === 'REQUESTED'
            );
            expect(requested.map(({ amount }) => amount)).toEqual([10000]);
            const retention = await retentionOf(f.subscriptionId, r.id);
            expect(retention[0]?.releaseReason).toBe('REVOCATION_REFUNDED');
        }
    );

    it.skipIf(live)(
        '(g) two open retentions: only the returned payment (R2) goes off; R1 stays for branch 6',
        async () => {
            // Arrange: R1 on day 5, R2 on day 8, both retained by the predecessor
            const { f, retained } = await retainingPredecessor([5, 8]);
            const [r1, r2] = [retained[0]!, retained[1]!];
            f.at(f.day(15));

            // Act
            const result = await revokeSubscription(
                { actor: await seedRevocationActor(), subscriptionId: f.subscriptionId },
                f.ports
            );

            // Assert
            expect(result.payment).toEqual({ source: 'PAYMENT', id: r2.id });
            const second = await retentionOf(f.subscriptionId, r2.id);
            expect(second[0]?.releaseReason).toBe('REVOCATION_REFUNDED');
            const first = await retentionOf(f.subscriptionId, r1.id);
            expect(first).toHaveLength(1);
            expect(first[0]?.releasedAt).toBeNull();
            expect(first[0]?.releaseReason).toBeNull();
            expect(await refundsOf(r1.id)).toEqual([]);
        }
    );

    it.skipIf(live)(
        "(h) the helper runs in the caller's transaction: with the row still live the RF1 is rejected and the flag stays on",
        async () => {
            // Arrange: the predecessor is still GRACE_PERIOD (as if CANCELLED was never written)
            const { f, retained } = await retainingPredecessor();
            const r = retained[0]!;
            f.at(f.day(15));

            // Act / Assert
            await expect(
                getServiceTestDb().transaction((tx) =>
                    requestRevocationRefund({
                        tx,
                        payment: {
                            source: { kind: 'PAYMENT', id: r.id },
                            refundable: true,
                            chargedAt: r.factAt,
                            ownerSubscriptionId: f.subscriptionId,
                            amount: 10000,
                            currency: 'ARS'
                        },
                        now: f.day(15),
                        clock: f.fixture.clock
                    })
                )
            ).rejects.toMatchObject({ reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN' });
            const retention = await retentionOf(f.subscriptionId, r.id);
            expect(retention).toHaveLength(1);
            expect(retention[0]?.releasedAt).toBeNull();
            expect(await refundsOf(r.id)).toEqual([]);
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, f.subscriptionId));
            expect(row?.status).toBe('GRACE_PERIOD');
        }
    );
});
