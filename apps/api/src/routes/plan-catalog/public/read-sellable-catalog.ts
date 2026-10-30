import {
    and,
    billingOptions,
    eq,
    getDb,
    inArray,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions
} from '@repo/db';
import { type BillingCycle, type PublicPlanCatalogVertical, TRIAL_PLAN_ROLE } from '@repo/schemas';
import { resolveTrialOffer } from './resolve-trial-offer';

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
    const ids = summaries.map(({ id }) => id);
    const planIds = summaries.map(({ planId }) => planId);
    const [planRows, versionRows, entitlementRows, limitRows, optionRows] = ids.length
        ? await Promise.all([
              db.select().from(plans).where(inArray(plans.id, planIds)),
              db.select().from(planVersions).where(inArray(planVersions.id, ids)),
              db
                  .select({
                      planVersionId: planVersionEntitlements.planVersionId,
                      key: planVersionEntitlements.key
                  })
                  .from(planVersionEntitlements)
                  .where(inArray(planVersionEntitlements.planVersionId, ids)),
              db
                  .select({
                      planVersionId: planVersionLimits.planVersionId,
                      key: planVersionLimits.key,
                      value: planVersionLimits.value
                  })
                  .from(planVersionLimits)
                  .where(inArray(planVersionLimits.planVersionId, ids)),
              db.select().from(billingOptions).where(inArray(billingOptions.planVersionId, ids))
          ])
        : [[], [], [], [], []];
    const plansById = new Map(planRows.map((plan) => [plan.id, plan]));
    const versionsById = new Map(versionRows.map((version) => [version.id, version]));
    const sellablePlans = summaries.map((summary) => {
        const plan = plansById.get(summary.planId);
        const content = versionsById.get(summary.id);
        if (!plan) throw new Error(`Plan ${summary.planId} is missing`);
        if (!content) throw new Error(`Plan version ${summary.id} is missing`);
        const billingOptionRows = optionRows.filter(
            (option) => option.planVersionId === summary.id
        );
        return {
            planId: plan.id,
            planVersionId: summary.id,
            slug: plan.slug,
            name: plan.name,
            description: plan.description,
            pricingOrder: plan.pricingOrder,
            rank: summary.rank,
            trialDays: content.trialDays,
            inheritsTouristVip: content.inheritsTouristVip,
            entitlements: entitlementRows
                .filter((effect) => effect.planVersionId === summary.id)
                .map(({ key }) => key)
                .sort(),
            limits: Object.fromEntries(
                limitRows
                    .filter((effect) => effect.planVersionId === summary.id)
                    .map(({ key, value }) => [key, value])
            ),
            billingOptions: billingOptionRows
                .map(({ id, cycle, amount, currency }) => ({ id, cycle, amount, currency }))
                .sort(
                    (left, right) =>
                        BILLING_CYCLE_ORDER[left.cycle as BillingCycle] -
                        BILLING_CYCLE_ORDER[right.cycle as BillingCycle]
                )
        };
    });
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
                entitlements: effects.entitlements.map(({ key }) => key).sort(),
                limits: Object.fromEntries(effects.limits.map(({ key, value }) => [key, value]))
            };
        }
    }
    const { trialOffer } = resolveTrialOffer({
        vertical: args.vertical,
        trialPlanTrialDays: await readCurrentTrialPlanDays({ vertical: args.vertical })
    });
    return { vertical: args.vertical, plans: sellablePlans, floor, trialOffer };
}

/**
 * Reads `trial_days` of the current version of the vertical's `role='trial'`
 * plan — the same row the trial engine reads (`trial-start-reader.ts`
 * `findTrialPlan`). `null` when the plan or its current version is missing.
 */
async function readCurrentTrialPlanDays(args: {
    readonly vertical: PublicPlanCatalogVertical;
}): Promise<number | null> {
    const [trialPlan] = await getDb()
        .select({ id: plans.id })
        .from(plans)
        .where(and(eq(plans.vertical, args.vertical), eq(plans.role, TRIAL_PLAN_ROLE)))
        .limit(1);
    if (!trialPlan) return null;
    const version = await planCatalogModel.findCurrentPlanVersion({ planId: trialPlan.id });
    if (!version) return null;
    const content = await planCatalogModel.findPlanVersion({ id: version.id });
    return content?.trialDays ?? null;
}
