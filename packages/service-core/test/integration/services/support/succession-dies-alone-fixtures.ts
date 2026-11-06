import { emailOutbox, eq, providerLinks, subscriptionModel, subscriptions, users } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb } from '../helpers.js';
import { frozenClock, seedCoveragePlanVersion, seedCoverageUser } from './coverage-fixtures.js';
import { noTouristVip } from './tourist-vip.js';

/** Seeds a real signup whose first fake-provider charge can be rejected by S16. */
export async function seedDiesAloneCase() {
    const now = new Date('2026-11-12T12:00:00.000Z');
    const clock = frozenClock(now);
    const db = getServiceTestDb();
    const user = await seedCoverageUser(db);
    const plan = await seedCoveragePlanVersion(db, 'accommodation');
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const started = await startSubscription(
        {
            userId: user.userId,
            billingOptionId: plan.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        {
            provider,
            clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip
        }
    );
    await provider.approve({ authorizationId: started.authorizationId });
    if (
        !(await subscriptionModel.activatePendingAuthorization({
            subscriptionId: started.subscriptionId,
            now
        }))
    )
        throw new Error('Could not activate S16 predecessor fixture');
    const charge = await provider.declineCharge({
        authorizationId: started.authorizationId,
        declineReason: 'issuer_declined'
    });
    const [predecessor] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (!predecessor) throw new Error('S16 predecessor missing');
    const [successor] = await db
        .insert(subscriptions)
        .values({
            userId: user.userId,
            vertical: 'accommodation',
            planVersionId: predecessor.planVersionId,
            billingOptionId: predecessor.billingOptionId,
            paymentMethod: 'CARD',
            class: 'PRINCIPAL',
            status: 'PENDING_AUTHORIZATION',
            succeedsId: predecessor.id
        })
        .returning();
    if (!successor) throw new Error('S16 successor missing');
    return {
        userId: user.userId,
        predecessorId: predecessor.id,
        successorId: successor.id,
        chargeId: charge.chargeId,
        provider,
        clock
    };
}

/** Removes only the rows created by a dies-alone case. */
export async function retireDiesAloneCase(
    ids: Awaited<ReturnType<typeof seedDiesAloneCase>>
): Promise<void> {
    const db = getServiceTestDb();
    await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, ids.userId));
    await db
        .update(subscriptions)
        .set({ succeededById: null })
        .where(eq(subscriptions.id, ids.predecessorId));
    await db.delete(subscriptions).where(eq(subscriptions.id, ids.successorId));
    await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, ids.predecessorId));
    await db.delete(subscriptions).where(eq(subscriptions.id, ids.predecessorId));
    await db.delete(users).where(eq(users.id, ids.userId));
}
