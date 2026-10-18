import { and, billingOptions, eq, getDb, planCatalogModel, plans } from '@repo/db';
import type { BillingCycle, PublicPlanCatalogVertical } from '@repo/schemas';

const BILLING_CYCLE_ORDER: Record<BillingCycle, number> = {
    monthly: 0,
    quarterly: 1,
    semiannual: 2,
    annual: 3
};

/** Reads the current sellable plan catalog and the optional current floor. */
export async function readSellablePlanCatalog(args: { vertical: PublicPlanCatalogVertical }) {
    const db = getDb();
    const summaries = await planCatalogModel.findSellableCurrentVersions({
        vertical: args.vertical
    });
    const sellablePlans = await Promise.all(
        summaries.map(async (version) => {
            const [plan] = await db
                .select()
                .from(plans)
                .where(eq(plans.id, version.planId))
                .limit(1);
            if (!plan) throw new Error(`Plan ${version.planId} is missing`);
            const [content, options] = await Promise.all([
                planCatalogModel.findPlanVersion({ id: version.id }),
                db.select().from(billingOptions).where(eq(billingOptions.planVersionId, version.id))
            ]);
            if (!content) throw new Error(`Plan version ${version.id} is missing`);
            const effects = await planCatalogModel.findPlanVersionEffects({ id: version.id });
            return {
                planId: plan.id,
                planVersionId: version.id,
                slug: plan.slug,
                name: plan.name,
                description: plan.description,
                pricingOrder: plan.pricingOrder,
                rank: version.rank,
                trialDays: content.trialDays,
                inheritsTouristVip: content.inheritsTouristVip,
                entitlements: effects.entitlements.map(({ key }) => key),
                limits: Object.fromEntries(effects.limits.map(({ key, value }) => [key, value])),
                billingOptions: options
                    .map(({ id, cycle, amount, currency }) => ({ id, cycle, amount, currency }))
                    .sort(
                        (left, right) =>
                            BILLING_CYCLE_ORDER[left.cycle as BillingCycle] -
                            BILLING_CYCLE_ORDER[right.cycle as BillingCycle]
                    )
            };
        })
    );
    sellablePlans.sort(
        (left, right) => left.pricingOrder - right.pricingOrder || left.rank - right.rank
    );

    const [floorPlan] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.vertical, args.vertical), eq(plans.role, 'floor')))
        .limit(1);
    let floor = null;
    if (floorPlan) {
        const version = await planCatalogModel.findCurrentPlanVersion({ planId: floorPlan.id });
        if (version) {
            const [content, effects] = await Promise.all([
                planCatalogModel.findPlanVersion({ id: version.id }),
                planCatalogModel.findPlanVersionEffects({ id: version.id })
            ]);
            if (!content) throw new Error(`Plan version ${version.id} is missing`);
            floor = {
                planId: floorPlan.id,
                planVersionId: version.id,
                slug: floorPlan.slug,
                name: floorPlan.name,
                description: floorPlan.description,
                pricingOrder: floorPlan.pricingOrder,
                rank: version.rank,
                trialDays: content.trialDays,
                entitlements: effects.entitlements.map(({ key }) => key),
                limits: Object.fromEntries(effects.limits.map(({ key, value }) => [key, value]))
            };
        }
    }
    return { vertical: args.vertical, plans: sellablePlans, floor };
}
