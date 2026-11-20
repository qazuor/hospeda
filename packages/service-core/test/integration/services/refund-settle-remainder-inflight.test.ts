/**
 * HOS-2517: while another refund of the same payment has a provider call the provider has not
 * answered, its provider refund may already be credited on the charge with no id written on our
 * side. Citing it as this refund's remainder would count the same money twice once `completeCall`
 * or a resend writes the id, so the settlement refuses with OTHER_REFUND_CALL_UNANSWERED. Also:
 * 404 and 403 answer before the provider is read.
 */
import { eq, idempotencyKeys, payments, refundCalls, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleRefundRemainder } from '../../../src/services/billing/refund/settle-refund-remainder.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentRow, refundById, seedAdminActor } from './support/refund-fixtures.js';
import {
    panelRefund,
    partiallyAcceptedRefund,
    type SeededCall,
    seedProviderCalls,
    settleRemainder
} from './support/refund-remainder-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

type Arranged = Awaited<ReturnType<typeof partiallyAcceptedRefund>>;

/** A second 2000 refund on the same payment, `CONFIRMED` with the given calls. */
async function otherRefund(arranged: Arranged, calls: readonly SeededCall[] = []) {
    const { refundId } = await requestRefund(
        {
            source: { kind: 'PAYMENT', id: arranged.credited.payment.id },
            amount: 2000,
            reason: 'REVOCATION'
        },
        { clock: arranged.credited.fixture.clock }
    );
    await seedProviderCalls({
        refundId,
        confirmedBy: arranged.confirmer.id,
        calls,
        at: arranged.credited.fixture.clock.now()
    });
    return refundId;
}

async function expectUntouched(arranged: Arranged) {
    expect(await refundById(arranged.refundId)).toMatchObject({
        status: 'CONFIRMED',
        externalRef: null,
        settledBy: null
    });
    expect((await paymentRow(arranged.credited.payment.id))?.refundedAmount).toBe(0);
}

/** The arranged provider, counting its charge reads. */
function countingReads(arranged: Arranged) {
    const counter = { reads: 0 };
    const target = arranged.credited.fixture.provider;
    const provider: PaymentProvider = new Proxy(target, {
        get(object, property, receiver) {
            if (property === 'readCharge')
                return (input: Parameters<typeof target.readCharge>[0]) => {
                    counter.reads++;
                    return target.readCharge(input);
                };
            return Reflect.get(object, property, receiver);
        }
    });
    return { provider, counter };
}

describe('HOS-2517 another refund of the payment with an unanswered call', () => {
    it.skipIf(skip)(
        "refuses to cite the other refund's in-flight provider refund as the remainder",
        async () => {
            // Arrange: the other refund's call reached the provider (credited 2000) with no id yet.
            const arranged = await partiallyAcceptedRefund();
            await otherRefund(arranged, [{ kind: 'UNANSWERED', amount: 2000 }]);
            const inFlight = await panelRefund(arranged, 2000);

            // Act
            const settled = settleRemainder(arranged.settler, arranged, { reference: inFlight });

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'OTHER_REFUND_CALL_UNANSWERED'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'refuses while the other call completed without an id (provider unavailable)',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            await otherRefund(arranged, [{ kind: 'UNAVAILABLE', amount: 2000 }]);

            // Act
            const settled = settleRemainder(arranged.settler, arranged);

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'OTHER_REFUND_CALL_UNANSWERED'
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'sees a call another transaction persists while holding the payment lock',
        async () => {
            // Arrange: a confirmation holds the payment lock and is persisting its call.
            const arranged = await partiallyAcceptedRefund();
            const other = await otherRefund(arranged);
            const inFlight = await panelRefund(arranged, 2000);
            let settled: Promise<unknown> | undefined;
            const db = getServiceTestDb();

            // Act
            await db.transaction(async (tx) => {
                await tx
                    .select({ id: payments.id })
                    .from(payments)
                    .where(eq(payments.id, arranged.credited.payment.id))
                    .for('update');
                const key = `refund:${other}:1`;
                await tx.insert(idempotencyKeys).values({
                    key,
                    operation: 'REFUND_CREATE',
                    subjectId: other,
                    result: null,
                    completedAt: null
                });
                await tx.insert(refundCalls).values({
                    refundId: other,
                    idempotencyKey: key,
                    amount: 2000,
                    providerRefundId: null
                });
                settled = settleRemainder(arranged.settler, arranged, {
                    reference: inFlight
                }).catch((error: unknown) => error);
                // The settlement is now waiting on the payment lock this transaction holds.
                await new Promise((resolve) => setTimeout(resolve, 300));
            });

            // Assert
            expect(await settled).toMatchObject({ reason: 'OTHER_REFUND_CALL_UNANSWERED' });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'settles when the other refund calls are all answered (accepted or rejected)',
        async () => {
            // Arrange
            const arranged = await partiallyAcceptedRefund();
            const other = await otherRefund(arranged, [{ kind: 'REJECTED', amount: 2000 }]);

            // Act
            const result = await settleRemainder(arranged.settler, arranged);

            // Assert
            expect(result).toMatchObject({ acceptedAmount: 4000, remainderAmount: 2000 });
            expect((await refundById(other))?.status).toBe('CONFIRMED');
        }
    );
});

describe('HOS-2517 404 and 403 answer before the provider is read', () => {
    it.skipIf(skip)('an unknown refund and an outsider never reach the provider', async () => {
        // Arrange
        const arranged = await partiallyAcceptedRefund();
        const reference = await panelRefund(arranged);
        const { provider, counter } = countingReads(arranged);
        const outsider = await seedAdminActor([]);
        const settle = (actor: typeof outsider, refundId: string) =>
            settleRefundRemainder(
                { actor, refundId, amount: 2000, reference },
                { provider, clock: arranged.credited.fixture.clock }
            );

        // Act
        const unknown = settle(arranged.settler, crypto.randomUUID());
        await expect(unknown).rejects.toMatchObject({ reason: 'REFUND_NOT_FOUND' });
        const forbidden = settle(outsider, arranged.refundId);
        await expect(forbidden).rejects.toMatchObject({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        const readsBeforeAllowed = counter.reads;
        await settle(arranged.settler, arranged.refundId);

        // Assert
        expect(readsBeforeAllowed).toBe(0);
        expect(counter.reads).toBe(1);
        const [row] = await getServiceTestDb()
            .select({ status: refunds.status })
            .from(refunds)
            .where(eq(refunds.id, arranged.refundId));
        expect(row?.status).toBe('EXECUTED');
    });
});
