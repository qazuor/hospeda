import {
    and,
    eq,
    inArray,
    isNull,
    reconciliationMarks,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { listActionableReconciliationMarks } from '../../../src/services/billing/reconciliation/actionable-marks.js';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service.js';
import { createSuccessionCloser } from '../../../src/services/billing/subscription/succession-closer.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cancelBranch6,
    hungPaymentIds,
    retainingBranch6Predecessor,
    retireBranch6
} from './support/branch6-fixtures.js';
import {
    retireRevocationRows,
    revocationFixture,
    seedCreditedPayment,
    seedRevocationActor,
    seedSiblingPrincipal
} from './support/revocation-fixtures.js';
import { closePorts } from './support/succession-close-fixtures.js';
import {
    openMarksOf,
    refundsOf,
    retainInOwnTransaction,
    retentionsOf
} from './support/succession-retention-fixtures.js';

const revocationIds: string[] = [];
afterEach(async () => {
    await retireBranch6();
    const ids = revocationIds.splice(0);
    if (ids.length) {
        await getServiceTestDb()
            .delete(successionRetainedPayments)
            .where(inArray(successionRetainedPayments.subscriptionId, ids));
        await getServiceTestDb()
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: crypto.randomUUID() })
            .where(
                and(
                    inArray(reconciliationMarks.subscriptionId, ids),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    }
    await retireRevocationRows();
});
afterAll(closeServiceTestPool);

async function listedMark(markId: string) {
    for (let page = 1; page <= 1000; page++) {
        const result = await listActionableReconciliationMarks({ page, pageSize: 100 });
        const found = result.items.find((item) => item.markId === markId);
        if (found) return found;
        if (result.items.length < 100) break;
    }
    throw new Error(`Mark ${markId} did not enter the actionable list`);
}

async function expectClosedBranch6(input: {
    s: Awaited<ReturnType<typeof retainingBranch6Predecessor>>['s'];
    paymentId: string;
    transition: 'S23' | 'S24';
}) {
    const result = await cancelBranch6(input.s);
    expect(result).toMatchObject({
        outcome: 'CANCELLED',
        transition: input.transition,
        successionClosed: true
    });
    const marks = await openMarksOf(input.s.subscriptionId);
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ reason: 'REEMBOLSO_POR_CONFIRMAR' });
    const markId = marks[0]!.id;
    expect(await hungPaymentIds(markId)).toEqual([{ paymentId: input.paymentId }]);
    expect(await listedMark(markId)).toMatchObject({
        markId,
        reason: 'REEMBOLSO_POR_CONFIRMAR',
        reasonNumber: 1,
        refundConfirmation: true,
        defaultProposal: 'REFUND',
        payments: [{ paymentId: input.paymentId }]
    });
    expect(await refundsOf(input.paymentId)).toEqual([]);
    expect(await retentionsOf(input.s.subscriptionId)).toMatchObject([
        {
            paymentId: input.paymentId,
            releasedAt: expect.any(Date),
            releaseReason: 'SUCCESSION_CLOSED'
        }
    ]);
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:20 AC:B8b:20 branch 6 enters actionable listing',
    () => {
        it('(a) S24 closes a grace predecessor with an S19 payment and proposes REFUND', async () => {
            const seeded = await retainingBranch6Predecessor();
            await expectClosedBranch6({ ...seeded, transition: 'S24' });
        });
        it('(b) S23 closes a suspended predecessor with an S19 payment and proposes REFUND', async () => {
            const seeded = await retainingBranch6Predecessor();
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED', graceStartedAt: null, graceEndsAt: null })
                .where(eq(subscriptions.id, seeded.s.subscriptionId));
            await expectClosedBranch6({ ...seeded, transition: 'S23' });
        });
        it('(c) S36 opens RF1 and releases retention before the real S18 closer sees it', async () => {
            const f = await revocationFixture({ origin: 'GRACE_PERIOD' });
            revocationIds.push(f.subscriptionId);
            await seedSiblingPrincipal({
                like: f,
                status: 'PENDING_AUTHORIZATION',
                succeedsId: f.subscriptionId
            });
            const payment = await seedCreditedPayment({
                subscriptionId: f.subscriptionId,
                factAt: f.day(8)
            });
            await retainInOwnTransaction({
                subscriptionId: f.subscriptionId,
                paymentId: payment.id,
                unpaidSince: f.day(2),
                now: f.day(8)
            });
            f.at(f.day(15));
            const before = await openMarksOf(f.subscriptionId);
            const result = await revokeSubscription(
                {
                    actor: await seedRevocationActor(),
                    subscriptionId: f.subscriptionId,
                    expectedPaymentId: payment.id
                },
                { ...f.ports, successionCloser: createSuccessionCloser(closePorts) }
            );
            expect(result).toMatchObject({ payment: { source: 'PAYMENT', id: payment.id } });
            expect(await refundsOf(payment.id)).toMatchObject([
                { id: result.refundId, reason: 'REVOCATION', status: 'REQUESTED' }
            ]);
            expect(await retentionsOf(f.subscriptionId)).toMatchObject([
                {
                    paymentId: payment.id,
                    releasedAt: expect.any(Date),
                    releaseReason: 'REVOCATION_REFUNDED'
                }
            ]);
            expect(await openMarksOf(f.subscriptionId)).toEqual(before);
        });
        it('(d) S24 without a live successor leaves the retention and open marks as they were', async () => {
            const seeded = await retainingBranch6Predecessor();
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ABANDONED' })
                .where(eq(subscriptions.id, seeded.s.successor.id));
            const before = await openMarksOf(seeded.s.subscriptionId);
            const result = await cancelBranch6(seeded.s);
            expect(result).toMatchObject({
                outcome: 'CANCELLED',
                transition: 'S24',
                successionClosed: false
            });
            expect(await retentionsOf(seeded.s.subscriptionId)).toMatchObject([
                { paymentId: seeded.paymentId, releasedAt: null, releaseReason: null }
            ]);
            expect(await openMarksOf(seeded.s.subscriptionId)).toEqual(before);
        });
    }
);
