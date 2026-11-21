/**
 * HOS-2517: while another refund of the same payment has a provider call the provider has not
 * answered, its provider refund may already be credited on the charge with no id written on our
 * side. Citing it as this refund's remainder would count the same money twice once `completeCall`
 * or a resend writes the id, so the settlement refuses with OTHER_REFUND_CALL_UNANSWERED. Also:
 * 404 and 403 answer before the provider is read.
 */
import { eq, idempotencyKeys, refundCalls, refunds } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, describe, expect, it } from 'vitest';
import { failRefund } from '../../../src/services/billing/refund/refund-fail.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import {
    type SettleRefundRemainderInput,
    settleRefundRemainder
} from '../../../src/services/billing/refund/settle-refund-remainder.service.js';
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

/**
 * A provider whose FIRST charge read runs the other refund's confirmation in the middle: the call
 * is persisted and committed (as `persistCall` does, before its provider I/O) and the provider
 * credits it, either before the read takes its snapshot or after. That provider refund id does not
 * exist until the read runs, so the input's `reference` is a getter: the length check before the read
 * sees a placeholder, and every later use sees the raced refund's id, the one a person would cite.
 */
async function duringFirstChargeRead(
    arranged: Arranged,
    otherRefundId: string,
    when: 'BEFORE_SNAPSHOT' | 'AFTER_SNAPSHOT'
) {
    const target = arranged.credited.fixture.provider;
    const state = { fired: false, cited: '' };
    const confirmOther = async () => {
        const key = `refund:${otherRefundId}:1`;
        const db = getServiceTestDb();
        await db.insert(idempotencyKeys).values({
            key,
            operation: 'REFUND_CREATE',
            subjectId: otherRefundId,
            result: null,
            completedAt: null
        });
        await db.insert(refundCalls).values({
            refundId: otherRefundId,
            idempotencyKey: key,
            amount: 2000,
            providerRefundId: null
        });
        state.cited = await panelRefund(arranged, 2000);
    };
    const provider: PaymentProvider = new Proxy(target, {
        get(object, property, receiver) {
            if (property === 'readCharge')
                return async (input: Parameters<typeof target.readCharge>[0]) => {
                    const first = !state.fired;
                    state.fired = true;
                    if (first && when === 'BEFORE_SNAPSHOT') await confirmOther();
                    const read = await target.readCharge(input);
                    if (first && when === 'AFTER_SNAPSHOT') await confirmOther();
                    return read;
                };
            return Reflect.get(object, property, receiver);
        }
    });
    const input: SettleRefundRemainderInput = {
        actor: arranged.settler,
        refundId: arranged.refundId,
        amount: 2000,
        get reference() {
            return state.cited || 'mp-panel-not-yet-refunded';
        }
    };
    return { provider, input, citedId: () => state.cited };
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
        'a call persisted and credited while the charge is read is never closed as the remainder',
        async () => {
            // Arrange: during the settlement's charge read, a confirmation of the other refund
            // persists its call (committed, as persistCall does before its provider I/O) and the
            // provider credits it, then the read takes its snapshot.
            const arranged = await partiallyAcceptedRefund();
            const other = await otherRefund(arranged);
            const raced = await duringFirstChargeRead(arranged, other, 'BEFORE_SNAPSHOT');

            // Act
            const settled = await settleRefundRemainder(raced.input, {
                provider: raced.provider,
                clock: arranged.credited.fixture.clock
            }).catch((error: unknown) => error);

            // Assert: never settled; the call is committed before the transaction, so it is seen.
            expect(raced.citedId()).toMatch(/refund/);
            expect(settled).toMatchObject({ reason: 'OTHER_REFUND_CALL_UNANSWERED' });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'a call persisted and credited after the charge read cannot be cited as the remainder',
        async () => {
            // Arrange: the same race, landing after the read returned its snapshot.
            const arranged = await partiallyAcceptedRefund();
            const other = await otherRefund(arranged);
            const raced = await duringFirstChargeRead(arranged, other, 'AFTER_SNAPSHOT');

            // Act
            const settled = await settleRefundRemainder(raced.input, {
                provider: raced.provider,
                clock: arranged.credited.fixture.clock
            }).catch((error: unknown) => error);

            // Assert
            expect(settled).toMatchObject({
                reason: expect.stringMatching(
                    /^(OTHER_REFUND_CALL_UNANSWERED|REMAINDER_NOT_FOUND_AT_PROVIDER)$/
                )
            });
            await expectUntouched(arranged);
        }
    );

    it.skipIf(skip)(
        'refuses while a FAILED refund of the payment holds an unanswered call',
        async () => {
            // Arrange: a chargeback failed the other refund with its call still unanswered.
            const arranged = await partiallyAcceptedRefund();
            const other = await otherRefund(arranged, [{ kind: 'UNANSWERED', amount: 2000 }]);
            const db = getServiceTestDb();
            await db.transaction(async (tx) => {
                const [row] = await tx.select().from(refunds).where(eq(refunds.id, other));
                if (!row) throw new Error('other refund missing');
                const { failed } = await failRefund({
                    tx,
                    refund: row,
                    at: arranged.credited.fixture.clock.now(),
                    correlationId: crypto.randomUUID()
                });
                expect(failed).toBe(true);
            });

            // Act
            const settled = settleRemainder(arranged.settler, arranged);

            // Assert
            await expect(settled).rejects.toMatchObject({ reason: 'OTHER_REFUND_CALL_UNANSWERED' });
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
