import {
    addonInstances,
    billingOptions,
    eq,
    payments,
    plans,
    planVersions,
    providerLinks
} from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { applyA2Recurring } from '../../../../src/services/billing/addon/addon-instance-a2';
import { purchaseAddon } from '../../../../src/services/billing/addon/purchase-addon.service';
import { processProviderNotice } from '../../../../src/services/billing/notice/process-provider-notice.service';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service';
import { getServiceTestDb } from '../helpers';
import { payingPrincipal } from './addon-a2-fixtures';
import { createA6Fixture, retireA6Fixtures } from './addon-a6-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './addon-purchase-fixtures';
import { noTouristVip } from './tourist-vip';

/** Creates a recurring LISTING instance through A1 and, when requested, A2. */
export async function listingExitFixture(status: 'ACTIVE' | 'PENDING_AUTHORIZATION') {
    const fixture = await createA6Fixture({ status, chargeKind: 'PERIODICO' });
    return {
        ...fixture,
        retire: retireExitFixtures
    };
}

/** Seeds the higher catalog tier used by a real startSuccession upgrade. */
export async function upgradeOptionFrom(principalOptionId: string): Promise<string> {
    const db = getServiceTestDb();
    const [current] = await db
        .select({ rank: planVersions.rank })
        .from(billingOptions)
        .innerJoin(planVersions, eq(planVersions.id, billingOptions.planVersionId))
        .where(eq(billingOptions.id, principalOptionId));
    if (!current) throw new Error('Principal plan version missing');
    return db.transaction(async (tx) => {
        // Catalog rows have no purchase service; the subscription uses startSuccession.
        const [plan] = await tx
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `b10-exit-upgrade-${crypto.randomUUID()}`,
                name: 'B10 exit upgrade'
            })
            .returning({ id: plans.id });
        if (!plan) throw new Error('Upgrade plan missing');
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'accommodation',
                rank: current.rank + 1,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Upgrade version missing');
        const [option] = await tx
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'monthly',
                amount: 300000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('Upgrade option missing');
        return option.id;
    });
}

/** Creates an A1 recurring purchase whose own preapproval awaits A2. */
export async function pendingRecurringExitFixture() {
    const f = await purchaseFixture({
        scopeType: 'VERTICAL_SUBSCRIPTION',
        chargeKind: 'PERIODICO'
    });
    const principal = await payingPrincipal(f);
    const [principalPayment] = await getServiceTestDb()
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.subscriptionId, principal.subscriptionId));
    if (!principalPayment) throw new Error('Principal payment missing');
    const bought = await purchaseAddon(
        f.input(crypto.randomUUID(), principal.subscriptionId),
        f.ports
    );
    if (bought.outcome !== 'CREATED') throw new Error(`Addon purchase returned ${bought.outcome}`);
    const [instance] = await getServiceTestDb()
        .select({ complementId: addonInstances.complementSubscriptionId })
        .from(addonInstances)
        .where(eq(addonInstances.id, bought.instanceId));
    if (!instance?.complementId) throw new Error('Complement missing');
    const [link] = await getServiceTestDb()
        .select({ authorizationId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, instance.complementId));
    if (!link) throw new Error('Complement preapproval missing');
    return {
        f,
        principalId: principal.subscriptionId,
        principalPaymentId: principalPayment.id,
        instanceId: bought.instanceId,
        complementId: instance.complementId,
        authorizationId: link.authorizationId,
        retire: retireExitFixtures
    };
}

/** Creates an active recurring addon through A1 and the fake-approved A2 path. */
export async function activeRecurringExitFixture(
    scopeType: 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL',
    verticals: readonly string[] = ['accommodation']
) {
    const f = await purchaseFixture({ scopeType, chargeKind: 'PERIODICO', verticals });
    const principal = await payingPrincipal(f);
    const bought = await purchaseAddon(
        f.input(
            crypto.randomUUID(),
            scopeType === 'VERTICAL_SUBSCRIPTION' ? principal.subscriptionId : null
        ),
        f.ports
    );
    if (bought.outcome !== 'CREATED') throw new Error(`Addon purchase returned ${bought.outcome}`);
    const [instance] = await getServiceTestDb()
        .select({ complementId: addonInstances.complementSubscriptionId })
        .from(addonInstances)
        .where(eq(addonInstances.id, bought.instanceId));
    if (!instance?.complementId) throw new Error('Complement missing');
    const [link] = await getServiceTestDb()
        .select({ authorizationId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, instance.complementId));
    if (!link) throw new Error('Complement preapproval missing');
    await f.fake.approve({ authorizationId: link.authorizationId });
    const activated = await getServiceTestDb().transaction((tx) =>
        applyA2Recurring(
            {
                tx,
                complementSubscriptionId: instance.complementId as string,
                now: f.ports.clock.now()
            },
            f.ports
        )
    );
    if (activated.outcome !== 'ACTIVATED') throw new Error('A2 did not activate addon');
    return {
        f,
        principalId: principal.subscriptionId,
        instanceId: bought.instanceId,
        complementId: instance.complementId,
        authorizationId: link.authorizationId,
        retire: retireExitFixtures
    };
}

/** Starts and authorizes a second vertical principal without crediting a charge. */
export async function authorizedUnpaidExitPrincipal(
    f: Awaited<ReturnType<typeof purchaseFixture>>
): Promise<string> {
    const db = getServiceTestDb();
    const optionId = await db.transaction(async (tx) => {
        // The plan catalog has no purchase service.
        const [plan] = await tx
            .insert(plans)
            .values({
                vertical: 'venue',
                slug: `b10-unpaid-${crypto.randomUUID()}`,
                name: 'B10 unpaid plan'
            })
            .returning({ id: plans.id });
        if (!plan) throw new Error('Unpaid plan missing');
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'venue',
                rank: Math.floor(Math.random() * 1_000_000_000),
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Unpaid plan version missing');
        const [option] = await tx
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'monthly',
                amount: 250000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('Unpaid option missing');
        return option.id;
    });
    const started = await startSubscription(
        {
            userId: f.ownerId,
            billingOptionId: optionId,
            payerEmail: 'payer@example.test',
            returnUrl: 'https://example.test/return'
        },
        {
            provider: f.fake,
            clock: f.ports.clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            touristVipInheritance: noTouristVip,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
    await f.fake.approve({ authorizationId: started.authorizationId });
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
            provider: f.fake,
            clock: f.ports.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
    if (applied.outcome !== 'APPLIED') throw new Error(`Unpaid S2 returned ${applied.outcome}`);
    return started.subscriptionId;
}

/** Retires only committed rows owned by this fixture composition. */
export async function retireExitFixtures(): Promise<void> {
    await retireA6Fixtures();
    await retirePurchaseFixtures();
}
