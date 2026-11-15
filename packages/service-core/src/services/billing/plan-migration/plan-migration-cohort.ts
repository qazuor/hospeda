import {
    and,
    asc,
    billingOptions,
    type DrizzleClient,
    eq,
    getDb,
    inArray,
    planMigrationSubscriptions,
    planMigrations,
    sql,
    subscriptions,
    users
} from '@repo/db';
import type { BillingCycle } from '@repo/schemas';

/** Exactly the five subscription states reached by action 17. */
export const PLAN_MIGRATION_COHORT_STATUSES = [
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED'
] as const;

/** One principal customer anchored to the source version. */
export interface PlanMigrationCohortRow {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly customerName: string | null;
    readonly customerEmail: string;
    readonly billingOptionId: string;
    readonly cycle: BillingCycle;
    readonly nextChargeAt: Date | null;
    readonly status: (typeof PLAN_MIGRATION_COHORT_STATUSES)[number];
    readonly alreadyInMigration: boolean;
}

/** Read the stable, principal-only cohort and any live migration conflicts. */
export async function readPlanMigrationCohort(args: {
    readonly sourcePlanVersionId: string;
    readonly tx?: DrizzleClient;
}): Promise<readonly PlanMigrationCohortRow[]> {
    const db = args.tx ?? getDb();
    const rows = await db
        .select({
            subscriptionId: subscriptions.id,
            userId: users.id,
            customerName: users.displayName,
            customerEmail: users.email,
            billingOptionId: billingOptions.id,
            cycle: billingOptions.cycle,
            nextChargeAt: subscriptions.nextChargeAt,
            status: subscriptions.status,
            alreadyInMigration: sql<boolean>`EXISTS (
            SELECT 1 FROM ${planMigrationSubscriptions} pms
            JOIN ${planMigrations} pm ON pm.id = pms.plan_migration_id
            WHERE pms.subscription_id = ${subscriptions.id}
              AND pms.status IN ('PENDIENTE', 'PARA_RESOLVER')
              AND pm.cancelled_at IS NULL
        )`
        })
        .from(subscriptions)
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .where(
            and(
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.planVersionId, args.sourcePlanVersionId),
                inArray(subscriptions.status, [...PLAN_MIGRATION_COHORT_STATUSES])
            )
        )
        .orderBy(asc(subscriptions.id));
    return rows.map((row) => ({
        ...row,
        cycle: row.cycle as BillingCycle,
        status: row.status as PlanMigrationCohortRow['status']
    }));
}
