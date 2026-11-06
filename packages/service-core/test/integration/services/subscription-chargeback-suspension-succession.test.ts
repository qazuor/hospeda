import { emailOutbox, eq, idempotencyKeys, providerLinks, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import {
    createChargebackDetection,
    createChargebackSuspension
} from '../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import {
    approvedCharge,
    chargebackFixture,
    paymentOfCharge,
    recordCharge,
    retireChargebackFixtures
} from './support/chargeback-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { successionPorts, successionReturnUrl } from './support/succession-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const successors: {
    readonly id: string;
    readonly predecessorId: string;
    readonly userId: string;
}[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    for (const successor of successors.splice(0)) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, successor.userId));
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, successor.id));
        await db
            .update(subscriptions)
            .set({ succeededById: null })
            .where(eq(subscriptions.id, successor.predecessorId));
        await db.delete(idempotencyKeys).where(eq(idempotencyKeys.subjectId, successor.id));
        await db.delete(subscriptions).where(eq(subscriptions.id, successor.id));
    }
    await retireChargebackFixtures();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B7:16 AC:B7:33 AC:B7:27 S6 calls S31 on a live real successor',
    () => {
        it('suspends the predecessor, abandons the S1 successor, and completes S31 after commit', async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            expect((await recordCharge(fixture, chargeId)).outcome).toBe('CREDITED');
            const [predecessor] = await getServiceTestDb()
                .select({ billingOptionId: subscriptions.billingOptionId })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!predecessor?.billingOptionId)
                throw new Error('Predecessor billing option missing');
            const started = await startSuccession(
                {
                    predecessorSubscriptionId: fixture.started.subscriptionId,
                    userId: fixture.user.id,
                    billingOptionId: predecessor.billingOptionId,
                    returnUrl: successionReturnUrl
                },
                { ...successionPorts(fixture.provider), clock: fixture.clock }
            );
            successors.push({
                id: started.subscriptionId,
                predecessorId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            const realCancel = fixture.provider.cancel.bind(fixture.provider);
            const cancelSuccessor = vi.spyOn(fixture.provider, 'cancel');
            let statusObservedAtCompletion: string | undefined;
            cancelSuccessor.mockImplementation(async (input) => {
                if (input.authorizationId === started.authorizationId) {
                    const [row] = await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, started.subscriptionId));
                    statusObservedAtCompletion = row?.status;
                }
                return realCancel(input);
            });

            await fixture.provider.chargeBack({ chargeId });
            const detection = createChargebackDetection({
                markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
                suspension: createChargebackSuspension({
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: fixture.coverageNotices,
                    orphanhood: orphanPorts(getServiceTestDb()).ports
                })
            });
            const result = await detection.detect({
                payment: await paymentOfCharge(chargeId),
                actor: 'provider',
                correlationId: crypto.randomUUID()
            });

            const [pred] = await getServiceTestDb()
                .select({
                    status: subscriptions.status,
                    succeededById: subscriptions.succeededById
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const [succ] = await getServiceTestDb()
                .select({ status: subscriptions.status, succeedsId: subscriptions.succeedsId })
                .from(subscriptions)
                .where(eq(subscriptions.id, started.subscriptionId));
            expect(result.suspension?.outcome).toBe('SUSPENDED');
            expect(result.suspension?.successorCut?.outcome).toBe('CUT');
            expect(pred).toMatchObject({
                status: 'SUSPENDED',
                succeededById: started.subscriptionId
            });
            expect(succ).toMatchObject({
                status: 'ABANDONED',
                succeedsId: fixture.started.subscriptionId
            });
            expect(statusObservedAtCompletion).toBe('ABANDONED');
            expect(cancelSuccessor).toHaveBeenCalledTimes(2);
        });

        it('cancels an ACTIVE successor produced by S1 and S2 when the predecessor is charged back', async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            expect((await recordCharge(fixture, chargeId)).outcome).toBe('CREDITED');
            const [predecessor] = await getServiceTestDb()
                .select({ billingOptionId: subscriptions.billingOptionId })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!predecessor?.billingOptionId)
                throw new Error('Predecessor billing option missing');
            const started = await startSuccession(
                {
                    predecessorSubscriptionId: fixture.started.subscriptionId,
                    userId: fixture.user.id,
                    billingOptionId: predecessor.billingOptionId,
                    returnUrl: successionReturnUrl
                },
                { ...successionPorts(fixture.provider), clock: fixture.clock }
            );
            successors.push({
                id: started.subscriptionId,
                predecessorId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            await fixture.provider.approve({ authorizationId: started.authorizationId });
            expect(
                await activateSubscription(started.subscriptionId, {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    touristVipInheritance: noTouristVip,
                    coverageNotices: fixture.coverageNotices
                })
            ).toMatchObject({ activated: true });
            const realCancel = fixture.provider.cancel.bind(fixture.provider);
            const cancelSuccessor = vi.spyOn(fixture.provider, 'cancel');
            let statusObservedAtCompletion: string | undefined;
            cancelSuccessor.mockImplementation(async (input) => {
                if (input.authorizationId === started.authorizationId) {
                    const [row] = await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, started.subscriptionId));
                    statusObservedAtCompletion = row?.status;
                }
                return realCancel(input);
            });

            await fixture.provider.chargeBack({ chargeId });
            const result = await createChargebackDetection({
                markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
                suspension: createChargebackSuspension({
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: fixture.coverageNotices,
                    orphanhood: orphanPorts(getServiceTestDb()).ports
                })
            }).detect({
                payment: await paymentOfCharge(chargeId),
                actor: 'provider',
                correlationId: crypto.randomUUID()
            });

            const [succ] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, started.subscriptionId));
            expect(result.suspension?.successorCut).toMatchObject({
                outcome: 'CUT',
                from: 'ACTIVE',
                to: 'CANCELLED'
            });
            expect(succ?.status).toBe('CANCELLED');
            expect(statusObservedAtCompletion).toBe('CANCELLED');
            expect(cancelSuccessor).toHaveBeenCalledTimes(2);
        });
    }
);
