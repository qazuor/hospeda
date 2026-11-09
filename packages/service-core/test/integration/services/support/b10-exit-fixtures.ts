import {
    addonInstances,
    billingOptions,
    eq,
    payments,
    plans,
    planVersions,
    providerLinks
} from '@repo/db';
import { purchaseAddon } from '../../../../src/services/billing/addon/purchase-addon.service';
import { getServiceTestDb } from '../helpers';
import { payingPrincipal } from './addon-a2-fixtures';
import { createA6Fixture, retireA6Fixtures } from './addon-a6-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './addon-purchase-fixtures';

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

/** Retires only committed rows owned by this fixture composition. */
export async function retireExitFixtures(): Promise<void> {
    await retireA6Fixtures();
    await retirePurchaseFixtures();
}
