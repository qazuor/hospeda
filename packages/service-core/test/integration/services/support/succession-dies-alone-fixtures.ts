import {
    emailOutbox,
    eq,
    inArray,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { startSuccession } from '../../../../src/services/billing/subscription/start-succession.service.js';
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
    const fake = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'verify S16 succession against the real S1 writer' }]
    });
    let authorizationCreations = 0;
    const provider = new Proxy(fake as PaymentProvider, {
        get(target, property, receiver) {
            if (property === 'authorize')
                return async (input: Parameters<PaymentProvider['authorize']>[0]) => {
                    authorizationCreations++;
                    return fake.authorize(input);
                };
            const value: unknown = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as PaymentProvider;
    const ports = {
        provider,
        clock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        touristVipInheritance: noTouristVip
    };
    const started = await startSubscription(
        {
            userId: user.userId,
            billingOptionId: plan.billingOptionId,
            returnUrl: 'https://example.test/return'
        },
        ports
    );
    await fake.approve({ authorizationId: started.authorizationId });
    if (
        !(await subscriptionModel.activatePendingAuthorization({
            subscriptionId: started.subscriptionId,
            now
        }))
    )
        throw new Error('Could not activate S16 predecessor fixture');
    const successor = await startSuccession(
        {
            userId: user.userId,
            billingOptionId: plan.billingOptionId,
            predecessorSubscriptionId: started.subscriptionId,
            returnUrl: 'https://example.test/return'
        },
        ports
    );
    await fake.approve({ authorizationId: successor.authorizationId });
    const charge = await fake.declineCharge({
        authorizationId: started.authorizationId,
        declineReason: 'issuer_declined'
    });
    const [predecessor] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (!predecessor) throw new Error('S16 predecessor missing');
    return {
        userId: user.userId,
        predecessorId: predecessor.id,
        successorId: successor.subscriptionId,
        successorAuthorizationId: successor.authorizationId,
        chargeId: charge.chargeId,
        provider,
        clock,
        billingOptionId: plan.billingOptionId,
        authorizationCreations: () => authorizationCreations
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
    await db
        .delete(providerLinks)
        .where(inArray(providerLinks.subscriptionId, [ids.predecessorId, ids.successorId]));
    await db.delete(subscriptions).where(eq(subscriptions.id, ids.successorId));
    await db.delete(subscriptions).where(eq(subscriptions.id, ids.predecessorId));
    await db.delete(users).where(eq(users.id, ids.userId));
}
