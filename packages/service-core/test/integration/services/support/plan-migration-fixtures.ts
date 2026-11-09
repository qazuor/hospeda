import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import { billingOptions, eq, planVersions, providerLinks, subscriptions, users } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { setCyclePrice } from '../../../../src/services/billing/pricing/cycle-price.service.js';
import { publishPlanVersion } from '../../../../src/services/plan-catalog/plan-publication.service.js';
import { getServiceTestDb, getServiceTestPool } from '../helpers.js';
import { startCyclePriceCustomer } from './cycle-price-fixtures.js';
import { retirePlanChanges, seedPlanChange } from './plan-change-fixtures.js';

const adminIds: string[] = [];
const extraCustomers: Array<{ subscriptionId: string; userId: string }> = [];
export const migrationClock = { now: () => new Date('2026-10-11T13:00:00.000Z') };

/** Build a live customer with real subscription transitions and retire by action 18. */
export async function createPlanMigrationCase(
    args: {
        readonly sourceCycle?: 'monthly' | 'annual';
        readonly addPendingCustomer?: boolean;
    } = {}
) {
    const client = await getServiceTestPool().connect();
    let locked = false;
    try {
        await client.query('SELECT pg_advisory_lock(1612, 2)');
        locked = true;
        return await createUnlockedPlanMigrationCase(args);
    } finally {
        if (locked) await client.query('SELECT pg_advisory_unlock(1612, 2)');
        client.release();
    }
}

async function createUnlockedPlanMigrationCase(args: {
    readonly sourceCycle?: 'monthly' | 'annual';
    readonly addPendingCustomer?: boolean;
}) {
    const seeded = await seedPlanChange({ sourceCycle: args.sourceCycle });
    const db = getServiceTestDb();
    let pendingCustomer: { subscriptionId: string; userId: string } | null = null;
    if (args.addPendingCustomer) {
        const started = await startCyclePriceCustomer(seeded.predecessorBillingOptionId);
        const [subscription] = await db
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId))
            .limit(1);
        if (!subscription?.userId) throw new Error('Pending migration customer missing');
        pendingCustomer = { subscriptionId: started.subscriptionId, userId: subscription.userId };
        extraCustomers.push(pendingCustomer);
    }
    const [admin] = await db
        .insert(users)
        .values({
            email: `migration-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Migration admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!admin) throw new Error('Migration admin fixture missing');
    adminIds.push(admin.id);
    const actor = {
        id: admin.id,
        roles: [],
        permissions: [
            PermissionEnum.BILLING_MIGRATE_PLAN,
            PermissionEnum.MAINTENANCE_MODE_WRITE,
            PermissionEnum.BILLING_SET_CYCLE_PRICE
        ]
    };
    const [version] = await db
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, seeded.planVersionId));
    if (!version) throw new Error('Migration source version missing');
    const retired = await publishPlanVersion({
        actor,
        planId: seeded.planId,
        content: {
            rank: version.rank,
            sellable: false,
            trialDays: version.trialDays,
            graceDays: version.graceDays,
            allowsPause: version.allowsPause,
            inheritsTouristVip: version.inheritsTouristVip,
            entitlements: [],
            limits: []
        }
    });
    const verticals = new VerticalsForBillingSimulator({ clock: migrationClock });
    verticals.setPlanPolicy({
        planVersionId: retired.id,
        policy: {
            graceDays: retired.graceDays,
            allowsPause: retired.allowsPause,
            current: true,
            sellable: false
        }
    });
    verticals.setPlanPolicy({
        planVersionId: seeded.targetPlanVersionId,
        policy: {
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }
    });
    verticals.setChangeDirection({
        fromPlanVersionId: seeded.planVersionId,
        toPlanVersionId: seeded.targetPlanVersionId,
        direction: 'UP'
    });
    const [targetOption] = await db
        .select()
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, seeded.targetPlanVersionId))
        .limit(1);
    return { ...seeded, actor, verticals, retired, targetOption, pendingCustomer };
}

/** Set a cycle's destination list price through action 19 before it has customers. */
export async function setMigrationTargetCycle(args: {
    readonly actor: Awaited<ReturnType<typeof createPlanMigrationCase>>['actor'];
    readonly planVersionId: string;
    readonly cycle: 'monthly' | 'annual';
    readonly amount: number;
}) {
    return setCyclePrice({
        actor: args.actor,
        input: {
            planVersionId: args.planVersionId,
            cycle: args.cycle,
            amount: args.amount,
            expectedPreviousAmount: null,
            confirmed: true
        },
        correlationId: crypto.randomUUID()
    });
}

/** Remove only mutable fixture rows, leaving immutable catalog versions intact. */
export async function cleanupPlanMigrationCases(): Promise<void> {
    for (const customer of extraCustomers.splice(0)) {
        const db = getServiceTestDb();
        await db
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, customer.subscriptionId));
        await db.delete(subscriptions).where(eq(subscriptions.id, customer.subscriptionId));
        await db.delete(users).where(eq(users.id, customer.userId));
    }
    await retirePlanChanges();
    for (const id of adminIds.splice(0))
        await getServiceTestDb().delete(users).where(eq(users.id, id));
}
