// HOS-2351: `succeeded_by_id` is written only when S18 closes a succession. Every door that
// kills an open successor (S3, S39, S16) must leave the predecessor free, and an open succession
// is read from its live successor.
import {
    eq,
    findPendingAttemptById,
    getDb,
    providerLinks,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readEligibleSubscription } from '../../../src/services/billing/promo/redeem-discount-eligibility';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service';
import {
    checkLatePaymentConditions,
    isLiveSuccessionPredecessor
} from '../../../src/services/billing/subscription/late-payment-conditions';
import { replacePendingAttempt } from '../../../src/services/billing/subscription/replace-pending-attempt.service';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service';
import { createSuccessionCloser } from '../../../src/services/billing/subscription/succession-closer.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { closePorts } from './support/succession-close-fixtures';
import {
    ensureBillingDeadlineVersion1,
    seedPredecessor,
    seedSuccessionChoice,
    successionClock,
    successionPorts,
    successionReturnUrl
} from './support/succession-fixtures';

afterAll(closeServiceTestPool);
beforeAll(ensureBillingDeadlineVersion1);
afterEach(() => vi.restoreAllMocks());

async function row(id: string) {
    const [found] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!found) throw new Error(`Subscription ${id} is missing`);
    return found;
}

async function successorLink(subscriptionId: string) {
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    if (!link) throw new Error(`Subscription ${subscriptionId} has no provider link`);
    return link;
}

async function openSuccession(input: {
    readonly status: 'ACTIVE' | 'SUSPENDED';
    readonly providerState?: 'cancelled';
}) {
    const choice = await seedSuccessionChoice();
    const seeded = await seedPredecessor({
        userId: choice.user.id,
        planVersionId: choice.planVersionId,
        billingOptionId: choice.predecessorBillingOptionId,
        status: input.status,
        ...(input.providerState ? { providerState: input.providerState } : {}),
        honestAboutM1: true
    });
    const ports = successionPorts(seeded.provider);
    const successor = await startSuccession(
        {
            userId: choice.user.id,
            predecessorSubscriptionId: seeded.predecessor.id,
            billingOptionId: choice.targetBillingOptionId,
            returnUrl: successionReturnUrl,
            payerEmail: 'payer@example.test'
        },
        ports
    );
    return {
        userId: choice.user.id,
        predecessorId: seeded.predecessor.id,
        successorId: successor.subscriptionId,
        fake: seeded.fake,
        ports
    };
}

/** Promo eligibility (redeem-discount) for the predecessor's user and vertical. */
async function promoEligibility(userId: string) {
    return getDb().transaction(async (tx) =>
        readEligibleSubscription({ tx, userId, vertical: 'accommodation' })
    );
}

/** Condition 3 of S5/S6/S7 and manual payment, read from the real predecessor row. */
async function condition3(predecessorId: string) {
    const predecessor = await row(predecessorId);
    const amount = { amountMinor: 1000, currency: 'ARS' } as const;
    return checkLatePaymentConditions({
        source: 'manual',
        subscription: predecessor,
        admittedStatuses: [predecessor.status],
        manualPaymentId: crypto.randomUUID(),
        paymentAmount: amount,
        expectedAmount: amount
    });
}

/** The predecessor is free again: no pointer, no live successor, condition 3 holds. */
async function expectPredecessorFree(predecessorId: string) {
    expect((await row(predecessorId)).succeededById).toBeNull();
    expect(await isLiveSuccessionPredecessor({ subscriptionId: predecessorId })).toBe(false);
    expect(await condition3(predecessorId)).toEqual({ ok: true });
}

describe('HOS-2351: the succession pointer is written only when the succession closes', () => {
    it('S1 opens the succession without writing succeeded_by_id; the live successor marks it in progress', async () => {
        const opened = await openSuccession({ status: 'ACTIVE' });

        expect((await row(opened.predecessorId)).succeededById).toBeNull();
        expect((await row(opened.successorId)).succeedsId).toBe(opened.predecessorId);
        expect(await isLiveSuccessionPredecessor({ subscriptionId: opened.predecessorId })).toBe(
            true
        );
        await expect(promoEligibility(opened.userId)).rejects.toMatchObject({
            reason: 'PROMO_NO_ELIGIBLE_SUBSCRIPTION'
        });
    });

    it('S3 expiring the successor window leaves the predecessor free (promo, condition 3)', async () => {
        const opened = await openSuccession({ status: 'ACTIVE' });

        const abandoned = await subscriptionModel.abandonPendingAuthorization({
            subscriptionId: opened.successorId,
            now: successionClock.now()
        });

        expect(abandoned).toEqual({ wrote: true, closedCourtesyMonths: null });
        expect((await row(opened.successorId)).status).toBe('ABANDONED');
        await expectPredecessorFree(opened.predecessorId);
        expect((await promoEligibility(opened.userId)).id).toBe(opened.predecessorId);
    });

    it('S39 abandoning the successor with no new S1 after it leaves the predecessor free', async () => {
        const opened = await openSuccession({ status: 'ACTIVE' });
        const commitment = await findPendingAttemptById({ subscriptionId: opened.successorId });
        if (!commitment) throw new Error('Open successor commitment missing');

        await replacePendingAttempt(
            { commitment, userId: opened.userId, predecessorId: opened.predecessorId },
            opened.ports
        );

        expect((await row(opened.successorId)).status).toBe('ABANDONED');
        await expectPredecessorFree(opened.predecessorId);
        expect((await promoEligibility(opened.userId)).id).toBe(opened.predecessorId);
    });

    it('S16 declining the first charge of a SUSPENDED predecessor successor leaves the predecessor free', async () => {
        const opened = await openSuccession({ status: 'SUSPENDED', providerState: 'cancelled' });
        const link = await successorLink(opened.successorId);
        // HOS-1731: S16 takes a pending signup only once its authorization reads as cancelled.
        await opened.fake.approve({ authorizationId: link.providerId });
        const charge = await opened.fake.declineCharge({
            authorizationId: link.providerId,
            declineReason: 'issuer_declined'
        });
        await opened.fake.cancel({ authorizationId: link.providerId });

        const result = await declineFirstCharge(
            { chargeId: charge.chargeId },
            {
                provider: opened.ports.provider,
                clock: successionClock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                successionCloser: createSuccessionCloser(closePorts),
                coverageNotices: { emitCoverageChanged: async () => undefined }
            }
        );

        expect(result).toMatchObject({ outcome: 'DECLINED', successionClosed: false });
        expect((await row(opened.successorId)).status).toBe('CHARGE_DECLINED');
        expect((await row(opened.predecessorId)).status).toBe('SUSPENDED');
        await expectPredecessorFree(opened.predecessorId);
    });
});
