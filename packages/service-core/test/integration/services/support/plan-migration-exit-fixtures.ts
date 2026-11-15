import {
    and,
    billingOptions,
    eq,
    planMigrationSubscriptions,
    planMigrations,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { launchPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { getServiceTestDb } from '../helpers.js';
import { startCyclePriceCustomer } from './cycle-price-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './plan-migration-fixtures.js';

const migrationIds: string[] = [];
const pendingCustomers: Array<{ subscriptionId: string; userId: string }> = [];

/** Announce a real migration with pending rows, or unresolved rows when the target lacks the cycle. */
export async function createAnnouncedExitCase(
    args: {
        readonly unresolved?: boolean;
        readonly addPendingCustomer?: boolean;
        readonly additionalPendingCustomers?: number;
        readonly addUnresolvedCustomer?: boolean;
        readonly clock?: { readonly now: () => Date };
    } = {}
) {
    const seeded = await createPlanMigrationCase({
        sourceCycle: args.unresolved ? 'annual' : 'monthly'
    });
    const started = args.addPendingCustomer
        ? await startCyclePriceCustomer(seeded.predecessorBillingOptionId)
        : null;
    const [pendingOwner] = started
        ? await getServiceTestDb()
              .select({ userId: subscriptions.userId })
              .from(subscriptions)
              .where(eq(subscriptions.id, started.subscriptionId))
        : [];
    if (started && !pendingOwner?.userId) throw new Error('Pending migration customer missing');
    const pendingCustomer =
        started && pendingOwner?.userId ? { ...started, userId: pendingOwner.userId } : null;
    if (pendingCustomer) pendingCustomers.push(pendingCustomer);
    let unresolvedCustomer: { subscriptionId: string; userId: string } | null = null;
    if (args.addUnresolvedCustomer) {
        // Seed a second source-cycle option; its subscription still starts through startSubscription.
        const [sourceAnnual] = await getServiceTestDb()
            .insert(billingOptions)
            .values({
                planVersionId: seeded.planVersionId,
                cycle: 'annual',
                amount: 250000,
                currency: 'ARS'
            })
            .returning();
        if (!sourceAnnual) throw new Error('Annual source option seed missing');
        const startedAnnual = await startCyclePriceCustomer(sourceAnnual.id);
        const [owner] = await getServiceTestDb()
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, startedAnnual.subscriptionId));
        if (!owner?.userId) throw new Error('Unresolved customer missing');
        unresolvedCustomer = { subscriptionId: startedAnnual.subscriptionId, userId: owner.userId };
        pendingCustomers.push(unresolvedCustomer);
        // The destination lacks annual: this is catalog fixture setup, not a subscription transition.
        await getServiceTestDb()
            .delete(billingOptions)
            .where(
                and(
                    eq(billingOptions.planVersionId, seeded.targetPlanVersionId),
                    eq(billingOptions.cycle, 'annual')
                )
            );
    }
    const additionalCustomers: Array<{ subscriptionId: string; userId: string }> = [];
    for (let index = 0; index < (args.additionalPendingCustomers ?? 0); index++) {
        const additional = await startCyclePriceCustomer(seeded.predecessorBillingOptionId);
        const [owner] = await getServiceTestDb()
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, additional.subscriptionId));
        if (!owner?.userId) throw new Error('Additional migration customer missing');
        const customer = { subscriptionId: additional.subscriptionId, userId: owner.userId };
        additionalCustomers.push(customer);
        pendingCustomers.push(customer);
    }
    if (!args.unresolved)
        await setMigrationTargetCycle({
            actor: seeded.actor,
            planVersionId: seeded.targetPlanVersionId,
            cycle: 'monthly',
            amount: 300000
        });
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.targetPlanVersionId
    };
    const preview = await previewPlanMigration({
        actor: seeded.actor,
        input,
        verticals: seeded.verticals,
        clock: args.clock ?? migrationClock
    });
    const launched = await launchPlanMigration({
        actor: seeded.actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: args.clock ?? migrationClock
    });
    migrationIds.push(launched.planMigrationId);
    return {
        seeded,
        pendingCustomer,
        additionalCustomers,
        unresolvedCustomer,
        migrationId: launched.planMigrationId
    };
}

/** Remove only this test's migration rows before the shared customer fixture cleanup. */
export async function cleanupAnnouncedExitCases(): Promise<void> {
    const db = getServiceTestDb();
    for (const id of migrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    for (const customer of pendingCustomers.splice(0)) {
        await db
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, customer.subscriptionId));
        await db.delete(subscriptions).where(eq(subscriptions.id, customer.subscriptionId));
        await db.delete(users).where(eq(users.id, customer.userId));
    }
    await cleanupPlanMigrationCases();
}
