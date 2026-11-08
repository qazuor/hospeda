import {
    addonInstances,
    addonProducts,
    addons,
    addonVersions,
    billingOptions,
    eq,
    getDb,
    inArray,
    payments,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import { creditPayment, processProviderNotice, startSubscription } from '@repo/service-core';
import { initApp } from '../../../../src/app';
import { injectAddonPurchaseListingForTests } from '../../../../src/routes/billing-addon/purchase-ports';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';
import { injectPaymentProvider } from '../../../../src/utils/payment-provider';
import { ensureBillingDeadlineVersion1 } from '../../helpers/billing-deadline-version';

export const routeClock = (() => {
    let tick = new Date('2026-10-13T12:00:00.000Z').getTime();
    return { now: () => new Date(tick++) };
})();

const owners: string[] = [];

/** The real API app with an injected fake provider and adjustable request clock. */
export function purchaseApp() {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    validateApiEnv();
    const fake = new FakePaymentProvider({
        clock: routeClock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [{ lie: 'M1', why: 'route purchase fixture needs an applied preapproval' }]
    });
    injectClock({ clock: routeClock });
    injectPaymentProvider({ provider: fake });
    return { app: initApp({ clock: routeClock, paymentProvider: fake }), fake };
}

/** Seeds only catalog and actor rows; subscriptions and addon instances use real services. */
export async function purchaseCatalog(input: {
    readonly scopeType?: 'LISTING' | 'USER';
    readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO';
}) {
    await ensureBillingDeadlineVersion1();
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `addon-route-${crypto.randomUUID()}@example.test`,
            displayName: 'Addon route',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id, email: users.email });
    if (!user) throw new Error('Missing owner');
    owners.push(user.id);
    const [addon] = await db
        .insert(addons)
        .values({
            slug: `addon-route-${crypto.randomUUID()}`,
            name: 'Route addon'
        })
        .returning({ id: addons.id });
    if (!addon) throw new Error('Missing addon');
    const chargeKind = input.chargeKind ?? 'UNA_VEZ';
    const [version] = await db
        .insert(addonVersions)
        .values({
            addonId: addon.id,
            validity: chargeKind === 'UNA_VEZ' ? 'FIXED_DAYS' : 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: chargeKind === 'UNA_VEZ' ? 30 : null,
            scopeType: input.scopeType ?? 'USER'
        })
        .returning({ id: addonVersions.id });
    if (!version) throw new Error('Missing addon version');
    const [product] = await db
        .insert(addonProducts)
        .values({
            addonId: addon.id,
            versionId: version.id,
            price: 5000,
            currency: 'ARS',
            chargeKind,
            cycle: chargeKind === 'PERIODICO' ? 'monthly' : null,
            compatibleVerticals: ['accommodation']
        })
        .returning({ id: addonProducts.id });
    if (!product) throw new Error('Missing addon product');
    return {
        ownerId: user.id,
        payerEmail: user.email,
        productId: product.id,
        versionId: version.id,
        request: (
            targetId: string | null = null,
            orderRequestId: string = crypto.randomUUID()
        ) => ({
            productId: product.id,
            addonVersionId: version.id,
            targetId,
            orderRequestId,
            payerEmail: user.email,
            ...(chargeKind === 'UNA_VEZ'
                ? {
                      payment: {
                          token: `tok-${crypto.randomUUID()}`,
                          brand: 'visa',
                          kind: 'credit'
                      }
                  }
                : {})
        })
    };
}

/** Starts a real principal, activates it through S2, then credits its first payment. */
export async function makePayingPrincipal(input: {
    readonly ownerId: string;
    readonly payerEmail: string;
    readonly fake: FakePaymentProvider;
}): Promise<void> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `addon-route-${crypto.randomUUID()}`,
            name: 'Paying plan'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Missing plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 1_000_000_000),
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Missing plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 250000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Missing option');
    const started = await startSubscription(
        {
            userId: input.ownerId,
            billingOptionId: option.id,
            payerEmail: input.payerEmail,
            returnUrl: 'https://example.test/return'
        },
        {
            provider: input.fake,
            clock: routeClock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            touristVipInheritance: { inherits: async () => false },
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
    await input.fake.approve({ authorizationId: started.authorizationId });
    const notice = encodeFakeNotice({
        notice: {
            resourceKind: 'authorization',
            resourceId: started.authorizationId,
            version: '1'
        },
        format: 'json'
    });
    const applied = await processProviderNotice(
        {
            channel: 'WEBHOOKS',
            delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
        },
        {
            provider: input.fake,
            clock: routeClock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
    if (applied.outcome !== 'APPLIED') throw new Error(`Principal notice: ${applied.outcome}`);
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: started.subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: 'MERCADO_PAGO',
            providerFactId: crypto.randomUUID(),
            factAt: routeClock.now()
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Missing principal payment');
    await creditPayment(
        { paymentId: payment.id, chargeCreatedAt: routeClock.now() },
        { clock: routeClock }
    );
}

/** Retires this file's live fixture rows after every test. */
export async function retirePurchaseRoutes(): Promise<void> {
    injectAddonPurchaseListingForTests({});
    const ids = owners.splice(0);
    if (ids.length === 0) return;
    await getDb()
        .update(addonInstances)
        .set({ status: 'ABANDONED' })
        .where(inArray(addonInstances.ownerId, ids));
    await getDb()
        .update(subscriptions)
        .set({ status: 'CANCELLED' })
        .where(inArray(subscriptions.userId, ids));
}

/** Standard test actor headers for the protected route. */
export function ownerHeaders(ownerId: string) {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': ownerId,
        'x-mock-actor-role': 'USER',
        'x-mock-actor-permissions': '[]'
    };
}

/** Reads only the current fixture owner's addon rows. */
export async function ownerInstances(ownerId: string) {
    return getDb().select().from(addonInstances).where(eq(addonInstances.ownerId, ownerId));
}
