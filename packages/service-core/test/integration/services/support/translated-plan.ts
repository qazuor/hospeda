import type { DrizzleClient } from '@repo/db';
import { eq, plans, planVersions, subscriptions } from '@repo/db';

/**
 * Re-labels the plan behind a subscription with a real catalog slug and a different stored
 * name, so a producer that forwards `plan.name` instead of the display name is caught (HOS-1993).
 * Run inside a rollback transaction or revert afterwards: `(vertical, slug)` is unique.
 */
export async function translatePlanOf(
    tx: DrizzleClient,
    subscriptionId: string,
    plan: { readonly slug: string; readonly name: string }
): Promise<void> {
    const [row] = await tx
        .select({ planId: planVersions.planId })
        .from(subscriptions)
        .innerJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error('translatePlanOf: subscription has no plan version');
    await tx.update(plans).set(plan).where(eq(plans.id, row.planId));
}
