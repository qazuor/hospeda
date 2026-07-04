import { z } from '@hono/zod-openapi';
import { and, billingPlans, billingPrices, eq, getDb, inArray } from '@repo/db';
import { PermissionEnum, ProductDomainEnum } from '@repo/schemas';
import { createAdminRoute } from '../../../utils/route-factory';

const PartnerAdminPlanSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    monthlyPriceArs: z.number().nullable()
});

/**
 * Handler for listing active partner-domain billing plans (admin).
 * Extracted for testing purposes (HOS-75 T-007).
 *
 * Loads all active plans in the partner product domain, then bulk-loads the
 * current active monthly ARS price for those plans and picks, per plan, the
 * most recently created matching price — mirroring the original correlated
 * subquery's `ORDER BY created_at DESC LIMIT 1`.
 */
export async function listPartnerPlansHandler() {
    const db = getDb();

    const planRows = await db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            description: billingPlans.description,
            metadata: billingPlans.metadata
        })
        .from(billingPlans)
        .where(
            and(
                eq(billingPlans.active, true),
                eq(billingPlans.productDomain, ProductDomainEnum.PARTNER)
            )
        )
        .orderBy(billingPlans.createdAt);

    if (planRows.length === 0) {
        return [];
    }

    const planIds = planRows.map((plan) => plan.id);

    const priceRows = await db
        .select({
            planId: billingPrices.planId,
            unitAmount: billingPrices.unitAmount,
            createdAt: billingPrices.createdAt
        })
        .from(billingPrices)
        .where(
            and(
                inArray(billingPrices.planId, planIds),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'month'),
                eq(billingPrices.intervalCount, 1),
                eq(billingPrices.active, true)
            )
        );

    const latestPriceByPlanId = new Map<string, { unitAmount: number; createdAt: Date }>();
    for (const price of priceRows) {
        const existing = latestPriceByPlanId.get(price.planId);
        if (!existing || price.createdAt > existing.createdAt) {
            latestPriceByPlanId.set(price.planId, {
                unitAmount: price.unitAmount,
                createdAt: price.createdAt
            });
        }
    }

    return planRows.map((plan) => {
        const metadata = plan.metadata as Record<string, unknown> | null;
        const displayName =
            typeof metadata?.displayName === 'string' ? metadata.displayName : plan.name;
        return {
            id: plan.id,
            slug: plan.name,
            name: displayName,
            description: plan.description,
            monthlyPriceArs: latestPriceByPlanId.get(plan.id)?.unitAmount ?? null
        };
    });
}

export const adminListPartnerPlansRoute = createAdminRoute({
    method: 'get',
    path: '/plans',
    summary: 'List partner billing plans (admin)',
    description: 'Returns active billing plans in the partner product domain.',
    tags: ['Partners', 'Billing'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    responseSchema: z.array(PartnerAdminPlanSchema),
    handler: listPartnerPlansHandler
});
