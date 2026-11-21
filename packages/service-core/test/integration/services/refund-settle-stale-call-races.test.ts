/**
 * HOS-2538 review: the panel settlement of a refund stuck on stale calls and «Retry with MP» share
 * one claim (a retry POST in flight must never race a panel settlement into a double refund); a
 * call answered between the tally and the mark rolls the settlement back; and a provider refund
 * the provider rejected is not a suspect for the lost call.
 */
import { getDb } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { readRefundCallTally } from '../../../src/services/billing/refund/refund-call-tally.js';
import { completeCall } from '../../../src/services/billing/refund/refund-provider-call.js';
import { withRefundCallClaim } from '../../../src/services/billing/refund/refund-retry-claim.js';
import { markStaleCallsSettledExternally } from '../../../src/services/billing/refund/refund-stale-calls.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { refundById } from './support/refund-fixtures.js';
import {
    callRows,
    expectUntouched,
    PAST_LIMIT,
    panelRefund,
    settle,
    stuckRefund
} from './support/refund-stale-call-fixtures.js';

afterAll(closeServiceTestPool);

const skip = !isServiceTestDbAvailable();

describe('HOS-2538 the panel settlement and «Retry with MP» share one claim', () => {
    it.skipIf(skip)('while a retry of the refund runs: REFUND_RETRY_IN_PROGRESS', async () => {
        // Arrange
        const stuck = await stuckRefund({ ageMs: PAST_LIMIT });
        const reference = await panelRefund(stuck);

        // Act: the settlement arrives while a retry (holding the claim) is in flight.
        const settled = await withRefundCallClaim(stuck.refundId, () =>
            settle(stuck, reference).catch((error: unknown) => error)
        );

        // Assert
        expect(settled).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_RETRY_IN_PROGRESS'
        });
        await expectUntouched(stuck);
    });

    it.skipIf(skip)('settles once the retry has released the claim', async () => {
        // Arrange
        const stuck = await stuckRefund({ ageMs: PAST_LIMIT });
        const reference = await panelRefund(stuck);
        await withRefundCallClaim(stuck.refundId, async () => undefined);

        // Act
        const settled = await settle(stuck, reference);

        // Assert
        expect(settled.remainderAmount).toBe(stuck.amount);
    });
});

describe('HOS-2538 a call answered between the tally and the mark', () => {
    it.skipIf(skip)('rolls everything back: REFUND_STATE_CHANGED', async () => {
        // Arrange: the tally saw the call unanswered; then the provider's answer is written.
        const stuck = await stuckRefund({ ageMs: PAST_LIMIT });
        const tally = await readRefundCallTally({ db: getDb(), refundId: stuck.refundId });
        const [call] = tally.unanswered;
        if (!call) throw new Error('stale call missing');
        await completeCall(
            call.idempotencyKey,
            { outcome: 'ACCEPTED', providerRefundId: 'mp-answered-meanwhile' },
            stuck.credited.fixture.clock,
            'mp-answered-meanwhile'
        );
        const before = await callRows(stuck.refundId);

        // Act
        const marked = getDb().transaction((tx) =>
            markStaleCallsSettledExternally({
                tx,
                refundId: stuck.refundId,
                stale: tally.unanswered,
                reference: 'mp-panel',
                now: stuck.credited.fixture.clock.now()
            })
        );

        // Assert: the answer stands, nothing is marked.
        await expect(marked).rejects.toMatchObject({ reason: 'REFUND_STATE_CHANGED' });
        expect(await callRows(stuck.refundId)).toEqual(before);
        expect(before[0]).toMatchObject({
            providerRefundId: 'mp-answered-meanwhile',
            result: { outcome: 'ACCEPTED' }
        });
    });

    it.skipIf(skip)('also when the answer is a rejection without an id', async () => {
        // Arrange
        const stuck = await stuckRefund({ ageMs: PAST_LIMIT });
        const tally = await readRefundCallTally({ db: getDb(), refundId: stuck.refundId });
        const [call] = tally.unanswered;
        if (!call) throw new Error('stale call missing');
        await completeCall(
            call.idempotencyKey,
            { outcome: 'REJECTED', code: 'REJECTED' },
            stuck.credited.fixture.clock
        );

        // Act
        const marked = getDb().transaction((tx) =>
            markStaleCallsSettledExternally({
                tx,
                refundId: stuck.refundId,
                stale: tally.unanswered,
                reference: 'mp-panel',
                now: stuck.credited.fixture.clock.now()
            })
        );

        // Assert
        await expect(marked).rejects.toMatchObject({ reason: 'REFUND_STATE_CHANGED' });
        expect((await callRows(stuck.refundId))[0]?.result).toMatchObject({
            outcome: 'REJECTED'
        });
    });
});

describe('HOS-2538 a provider refund the provider rejected is not the lost call', () => {
    it.skipIf(skip)(
        'lets the settlement through despite a rejected refund for the amount',
        async () => {
            // Arrange: a refund for the stale call's amount exists on the charge, but MP rejected it.
            const stuck = await stuckRefund({ amount: 4000, ageMs: PAST_LIMIT });
            const rejected = await panelRefund(stuck, 4000);
            await stuck.credited.fixture.provider.rejectRefund({
                chargeId: stuck.credited.payment.providerFactId,
                refundId: rejected
            });
            const reference = await panelRefund(stuck, 4000);

            // Act
            const settled = await settle(stuck, reference);

            // Assert
            expect(settled.remainderAmount).toBe(4000);
            expect(await refundById(stuck.refundId)).toMatchObject({
                status: 'EXECUTED',
                externalRef: reference
            });
        }
    );
});
