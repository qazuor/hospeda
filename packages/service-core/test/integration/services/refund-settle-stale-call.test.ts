/**
 * HOS-2538: a `CONFIRMED` refund whose only unanswered provider calls are older than 24 hours had no
 * admin exit («Retry with MP» refuses to post them, `REFUND_CALL_TOO_OLD_TO_RETRY`). Action 14's
 * remainder settlement now closes it from a provider panel refund, answers those calls
 * `SETTLED_EXTERNALLY` (never resent, never bound), and keeps refusing a call inside the 24 hours,
 * a cited panel refund and a charge refund that may be the lost call's.
 */
import { eq, getDb, idempotencyKeys, refundCalls } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import {
    REFUND_CALL_RETRY_LIMIT_MS,
    readCitedProviderRefundIds
} from '../../../src/services/billing/refund/refund-call-tally.js';
import { completeCall } from '../../../src/services/billing/refund/refund-provider-call.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { resendUnansweredRefundCalls } from '../../../src/services/billing/refund/resend-refund-call.service.js';
import { retryRefundProviderCalls } from '../../../src/services/billing/refund/retry-refund-provider-calls.service.js';
import { settleRefundRemainder } from '../../../src/services/billing/refund/settle-refund-remainder.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentRow, refundById, seedAdminActor } from './support/refund-fixtures.js';
import {
    chargedCreditedPayment,
    refundAcceptedAtFake,
    refundAtFake,
    type SeededCall,
    seedProviderCalls
} from './support/refund-remainder-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

/**
 * A credited 10000 payment on a real fake charge with a `CONFIRMED` refund of `amount` whose calls
 * are `calls`; every unanswered call was sent `ageMs` before the clock's now.
 */
async function stuckRefund(input: {
    readonly amount?: number;
    readonly calls?: readonly SeededCall[];
    readonly ageMs: number;
}) {
    const amount = input.amount ?? 6000;
    const credited = await chargedCreditedPayment(10000);
    const confirmer = await seedAdminActor([PermissionEnum.BILLING_REFUND]);
    const { refundId } = await requestRefund(
        { source: { kind: 'PAYMENT', id: credited.payment.id }, amount, reason: 'REVOCATION' },
        { clock: credited.fixture.clock }
    );
    await seedProviderCalls({
        refundId,
        confirmedBy: confirmer.id,
        calls: await refundAcceptedAtFake({
            provider: credited.fixture.provider,
            chargeId: credited.payment.providerFactId,
            calls: input.calls ?? [{ kind: 'UNANSWERED', amount }]
        }),
        at: credited.fixture.clock.now()
    });
    // The calls were persisted `ageMs` ago, on the injected clock (`persistCall` writes `sentAt`).
    await getServiceTestDb()
        .update(refundCalls)
        .set({ createdAt: new Date(credited.fixture.clock.now().getTime() - input.ageMs) })
        .where(eq(refundCalls.refundId, refundId));
    const settler = await seedAdminActor([PermissionEnum.BILLING_SETTLE_EXTERNAL]);
    return { credited, confirmer, settler, refundId, amount };
}

type Stuck = Awaited<ReturnType<typeof stuckRefund>>;

/** A refund made by hand from the provider panel: a real refund at the fake. */
function panelRefund(stuck: Stuck, amount = stuck.amount) {
    return refundAtFake({
        provider: stuck.credited.fixture.provider,
        chargeId: stuck.credited.payment.providerFactId,
        amount
    });
}

function settle(stuck: Stuck, reference: string, amount = stuck.amount) {
    return settleRefundRemainder(
        { actor: stuck.settler, refundId: stuck.refundId, amount, reference },
        { provider: stuck.credited.fixture.provider, clock: stuck.credited.fixture.clock }
    );
}

async function callRows(refundId: string) {
    const db = getServiceTestDb();
    return db
        .select({
            key: refundCalls.idempotencyKey,
            providerRefundId: refundCalls.providerRefundId,
            completedAt: idempotencyKeys.completedAt,
            result: idempotencyKeys.result
        })
        .from(refundCalls)
        .innerJoin(idempotencyKeys, eq(refundCalls.idempotencyKey, idempotencyKeys.key))
        .where(eq(refundCalls.refundId, refundId));
}

async function expectUntouched(stuck: Stuck) {
    expect(await refundById(stuck.refundId)).toMatchObject({
        status: 'CONFIRMED',
        externalRef: null,
        settledBy: null
    });
    expect((await paymentRow(stuck.credited.payment.id))?.refundedAmount).toBe(0);
    for (const call of await callRows(stuck.refundId)) {
        expect(call.providerRefundId).toBeNull();
        if (call.completedAt === null) expect(call.result).toBeNull();
    }
}

const PAST_LIMIT = REFUND_CALL_RETRY_LIMIT_MS + 1;

describe('HOS-2538 action 14 settles a refund stuck on a call older than 24 hours', () => {
    it.skipIf(skip)(
        'closes it EXECUTED, answers the call SETTLED_EXTERNALLY and cites the panel refund',
        async () => {
            // Arrange
            const stuck = await stuckRefund({ ageMs: PAST_LIMIT });
            const reference = await panelRefund(stuck);

            // Act
            const result = await settle(stuck, reference);

            // Assert: the refund closes for its full amount, recorded as a panel refund.
            const [call] = await callRows(stuck.refundId);
            expect(result).toMatchObject({
                acceptedAmount: 0,
                remainderAmount: 6000,
                settledStaleCallKeys: [call?.key]
            });
            expect(await refundById(stuck.refundId)).toMatchObject({
                status: 'EXECUTED',
                executedVia: 'EXTERNAL',
                externalChannel: 'PROVIDER_PANEL',
                externalRef: reference,
                settledBy: stuck.settler.id,
                confirmedBy: stuck.confirmer.id
            });
            expect((await paymentRow(stuck.credited.payment.id))?.refundedAmount).toBe(6000);
            // The call is answered, with no provider id of its own.
            expect(call).toMatchObject({
                providerRefundId: null,
                completedAt: stuck.credited.fixture.clock.now(),
                result: {
                    outcome: 'SETTLED_EXTERNALLY',
                    code: 'SETTLED_EXTERNALLY',
                    panelReference: reference
                }
            });
            // The panel refund counts as cited, so no resend binds it to any call.
            const cited = await readCitedProviderRefundIds({ db: getDb(), ids: [reference] });
            expect(cited.has(reference)).toBe(true);
        }
    );

    it.skipIf(skip)('the settled call is never resent nor bound afterwards', async () => {
        // Arrange
        const stuck = await stuckRefund({ ageMs: PAST_LIMIT });
        const reference = await panelRefund(stuck);
        await settle(stuck, reference);
        const [before] = await callRows(stuck.refundId);
        if (!before) throw new Error('call missing');

        // Act: a retry, a resend and a late answer naming a provider refund.
        const retried = retryRefundProviderCalls(
            { actor: stuck.confirmer, refundId: stuck.refundId },
            { provider: stuck.credited.fixture.provider, clock: stuck.credited.fixture.clock }
        );
        const resent = await resendUnansweredRefundCalls(
            { refundId: stuck.refundId },
            { provider: stuck.credited.fixture.provider, clock: stuck.credited.fixture.clock }
        );
        await completeCall(
            before.key,
            { outcome: 'ACCEPTED', providerRefundId: 'mp-late-answer' },
            stuck.credited.fixture.clock,
            'mp-late-answer'
        );

        // Assert
        await expect(retried).rejects.toMatchObject({ reason: 'REFUND_NOT_CONFIRMED' });
        expect(resent.outcomes).toEqual([]);
        expect(await callRows(stuck.refundId)).toEqual([before]);
    });

    it.skipIf(skip)(
        "a settled call no longer counts as unanswered for the payment's other refunds",
        async () => {
            // Arrange: refund A is settled; then refund B of the same payment gets stuck too.
            const stuck = await stuckRefund({ amount: 4000, ageMs: PAST_LIMIT });
            await settle(stuck, await panelRefund(stuck, 4000));
            const { refundId: other } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: stuck.credited.payment.id },
                    amount: 2000,
                    reason: 'REVOCATION'
                },
                { clock: stuck.credited.fixture.clock }
            );
            await seedProviderCalls({
                refundId: other,
                confirmedBy: stuck.confirmer.id,
                calls: [{ kind: 'UNANSWERED', amount: 2000 }],
                at: stuck.credited.fixture.clock.now()
            });
            await getServiceTestDb()
                .update(refundCalls)
                .set({
                    createdAt: new Date(stuck.credited.fixture.clock.now().getTime() - PAST_LIMIT)
                })
                .where(eq(refundCalls.refundId, other));

            // Act: A's answered call must not block B (OTHER_REFUND_CALL_UNANSWERED).
            const settled = await settle(
                { ...stuck, refundId: other, amount: 2000 },
                await panelRefund(stuck, 2000),
                2000
            );

            // Assert
            expect(settled.remainderAmount).toBe(2000);
            expect((await paymentRow(stuck.credited.payment.id))?.refundedAmount).toBe(6000);
        }
    );

    it.skipIf(skip)('settles several stale calls next to an accepted part', async () => {
        // Arrange: 2500 accepted and credited at the fake, 1500 lost more than 24 hours ago.
        const stuck = await stuckRefund({
            amount: 4000,
            calls: [
                { kind: 'ACCEPTED', amount: 2500 },
                { kind: 'UNANSWERED', amount: 1500 }
            ],
            ageMs: PAST_LIMIT
        });
        const reference = await panelRefund(stuck, 1500);

        // Act
        const result = await settle(stuck, reference, 1500);

        // Assert
        expect(result).toMatchObject({ acceptedAmount: 2500, remainderAmount: 1500 });
        expect(result.settledStaleCallKeys).toHaveLength(1);
        expect((await paymentRow(stuck.credited.payment.id))?.refundedAmount).toBe(4000);
        const calls = await callRows(stuck.refundId);
        expect(calls.filter((call) => call.providerRefundId !== null)).toHaveLength(1);
        expect(calls.filter((call) => call.result !== null)).toHaveLength(2);
    });

    it.skipIf(skip)('the remainder must be the whole uncredited amount', async () => {
        // Arrange
        const stuck = await stuckRefund({ ageMs: PAST_LIMIT });
        const reference = await panelRefund(stuck, 3000);

        // Act
        const settled = settle(stuck, reference, 3000);

        // Assert
        await expect(settled).rejects.toMatchObject({ reason: 'REMAINDER_AMOUNT_MISMATCH' });
        await expectUntouched(stuck);
    });
});

describe('HOS-2538 a call inside the 24 hours still belongs to «Retry with MP»', () => {
    for (const [label, ageMs] of [
        ['exactly 24 hours old', REFUND_CALL_RETRY_LIMIT_MS],
        ['one hour old', 60 * 60 * 1000]
    ] as const) {
        it.skipIf(skip)(`refuses a call ${label}: REFUND_CALL_UNANSWERED`, async () => {
            // Arrange
            const stuck = await stuckRefund({ ageMs });
            const reference = await panelRefund(stuck);

            // Act
            const settled = settle(stuck, reference);

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'REFUND_CALL_UNANSWERED'
            });
            await expectUntouched(stuck);
        });
    }

    it.skipIf(skip)('one fresh call among stale ones refuses the whole settlement', async () => {
        // Arrange
        const stuck = await stuckRefund({
            amount: 4000,
            calls: [
                { kind: 'UNANSWERED', amount: 2000 },
                { kind: 'UNANSWERED', amount: 2000 }
            ],
            ageMs: PAST_LIMIT
        });
        const [, second] = await callRows(stuck.refundId);
        await getServiceTestDb()
            .update(refundCalls)
            .set({ createdAt: stuck.credited.fixture.clock.now() })
            .where(eq(refundCalls.idempotencyKey, second?.key ?? ''));
        const reference = await panelRefund(stuck);

        // Act
        const settled = settle(stuck, reference);

        // Assert
        await expect(settled).rejects.toMatchObject({ reason: 'REFUND_CALL_UNANSWERED' });
        await expectUntouched(stuck);
    });
});

describe('HOS-2538 the cited panel refund must be free and the only candidate', () => {
    it.skipIf(skip)(
        'a panel refund another call already holds: EXTERNAL_REFERENCE_ALREADY_SETTLED',
        async () => {
            // Arrange: another refund of the payment has a call bound to that provider refund.
            const stuck = await stuckRefund({ amount: 4000, ageMs: PAST_LIMIT });
            const held = await panelRefund(stuck, 4000);
            const { refundId: other } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: stuck.credited.payment.id },
                    amount: 4000,
                    reason: 'REVOCATION'
                },
                { clock: stuck.credited.fixture.clock }
            );
            await seedProviderCalls({
                refundId: other,
                confirmedBy: stuck.confirmer.id,
                calls: [{ kind: 'ACCEPTED', amount: 4000, providerRefundId: held }],
                at: stuck.credited.fixture.clock.now()
            });

            // Act
            const settled = settle(stuck, held);

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'EXTERNAL_REFERENCE_ALREADY_SETTLED'
            });
            await expectUntouched(stuck);
        }
    );

    it.skipIf(skip)(
        'a panel refund a call kept after the provider rejected it: EXTERNAL_REFERENCE_ALREADY_SETTLED',
        async () => {
            // Arrange: a call of another refund keeps the id only in its stored result.
            const stuck = await stuckRefund({ amount: 4000, ageMs: PAST_LIMIT });
            const reference = await panelRefund(stuck, 4000);
            const db = getServiceTestDb();
            await db.insert(idempotencyKeys).values({
                key: `refund:${crypto.randomUUID()}:1`,
                operation: 'REFUND_CREATE',
                subjectId: crypto.randomUUID(),
                result: {
                    outcome: 'REJECTED',
                    code: 'REJECTED_AFTER_ACCEPTANCE',
                    providerRefundId: reference
                },
                completedAt: stuck.credited.fixture.clock.now()
            });

            // Act
            const settled = settle(stuck, reference);

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'EXTERNAL_REFERENCE_ALREADY_SETTLED'
            });
            await expectUntouched(stuck);
        }
    );

    it.skipIf(skip)(
        'an uncited charge refund for the call amount: UNCITED_PROVIDER_REFUND_ON_CHARGE',
        async () => {
            // Arrange: the lost call landed after all (its refund is on the charge), and a person
            // also refunded the same amount from the panel.
            const stuck = await stuckRefund({ amount: 4000, ageMs: PAST_LIMIT });
            const landed = await panelRefund(stuck, 4000);
            const reference = await panelRefund(stuck, 4000);

            // Act
            const settled = settle(stuck, reference);

            // Assert
            await expect(settled).rejects.toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'UNCITED_PROVIDER_REFUND_ON_CHARGE',
                message: expect.stringContaining(landed)
            });
            await expectUntouched(stuck);
        }
    );

    it.skipIf(skip)(
        'another refund of the payment with an unanswered call: OTHER_REFUND_CALL_UNANSWERED',
        async () => {
            // Arrange
            const stuck = await stuckRefund({ amount: 4000, ageMs: PAST_LIMIT });
            const { refundId: other } = await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: stuck.credited.payment.id },
                    amount: 2000,
                    reason: 'REVOCATION'
                },
                { clock: stuck.credited.fixture.clock }
            );
            await seedProviderCalls({
                refundId: other,
                confirmedBy: stuck.confirmer.id,
                calls: [{ kind: 'UNANSWERED', amount: 2000 }],
                at: stuck.credited.fixture.clock.now()
            });
            const reference = await panelRefund(stuck, 4000);

            // Act
            const settled = settle(stuck, reference);

            // Assert
            await expect(settled).rejects.toMatchObject({
                reason: 'OTHER_REFUND_CALL_UNANSWERED'
            });
            await expectUntouched(stuck);
        }
    );
});
