/**
 * Public plans list endpoint
 *
 * Returns active billing plans sourced from the database via PlanService.
 * Response shape is backwards-compatible with the previous ALL_PLANS-based
 * implementation (same fields: slug, name, category, prices, entitlements, limits).
 *
 * @module routes/billing/public/listPlans
 */

import { z } from '@hono/zod-openapi';
import { getDb, sql } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { PlanService } from '../../../services/plan.service';
import { apiLogger } from '../../../utils/logger';
import { createSimpleRoute } from '../../../utils/route-factory.js';

/**
 * Resolve the set of plan slugs that do NOT belong to the accommodation domain
 * (SPEC-239 T-049 isolation). `billing_plans.product_domain` is added via the
 * extras carril and is NOT in the qzpay-drizzle / PlanService projection, so it
 * is queried with raw SQL here (the column is invisible to Drizzle's TS schema).
 * Any slug whose `product_domain` is not `'accommodation'` (e.g. `'commerce'`)
 * is excluded from the public list.
 *
 * Fail-open: on any DB error the set is empty (no plans excluded) so the public
 * pricing list never breaks because of this isolation filter — at worst a
 * commerce plan would briefly leak, never an accommodation plan disappearing.
 */
async function getNonAccommodationPlanSlugs(): Promise<Set<string>> {
    try {
        const db = getDb();
        const result = await db.execute(
            sql`SELECT name FROM billing_plans WHERE product_domain IS DISTINCT FROM ${ProductDomainEnum.ACCOMMODATION}`
        );
        // db.execute returns a driver-shaped result; normalize to a row array.
        const rows = (Array.isArray(result) ? result : (result.rows ?? [])) as Array<{
            name: string;
        }>;
        return new Set(rows.map((r) => r.name));
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Failed to resolve non-accommodation plan slugs for public list — not excluding any (fail-open)'
        );
        return new Set();
    }
}

/**
 * Public response schema for a single plan.
 *
 * Intentionally matches the previous ALL_PLANS shape so existing web client
 * code does not need changes. The `id` field is added for completeness but
 * the web client can ignore it.
 */
const PlanPublicSchema = z.object({
    id: z.string().uuid().openapi({ description: 'Plan UUID' }),
    slug: z.string().openapi({ description: 'Unique plan identifier' }),
    name: z.string().openapi({ description: 'Plan display name' }),
    description: z.string().openapi({ description: 'Plan description' }),
    category: z
        .enum(['owner', 'complex', 'tourist'])
        .openapi({ description: 'Target user category' }),
    monthlyPriceArs: z
        .number()
        .openapi({ description: 'Monthly price in ARS cents (0 for free plans)' }),
    annualPriceArs: z
        .number()
        .nullable()
        .openapi({ description: 'Annual price in ARS cents (null if no annual option)' }),
    monthlyPriceUsdRef: z
        .number()
        .openapi({ description: 'USD reference price for display purposes' }),
    hasTrial: z.boolean().openapi({ description: 'Whether this plan has a trial period' }),
    trialDays: z.number().openapi({ description: 'Trial duration in days (0 if no trial)' }),
    isDefault: z
        .boolean()
        .openapi({ description: 'Whether this is the default plan for its category' }),
    sortOrder: z.number().openapi({ description: 'Sort order for display' }),
    isActive: z
        .boolean()
        .openapi({ description: 'Whether the plan is currently available for purchase' }),
    entitlements: z
        .array(z.string())
        .openapi({ description: 'Entitlement keys included in this plan' }),
    limits: z
        .record(z.string(), z.number())
        .openapi({ description: 'Limits applied to this plan (key → value, -1 means unlimited)' }),
    createdAt: z.string().openapi({ description: 'ISO 8601 creation timestamp' }),
    updatedAt: z.string().openapi({ description: 'ISO 8601 last-update timestamp' })
});

const PlansListResponseSchema = z.array(PlanPublicSchema);

/** Singleton plan service instance */
const planService = new PlanService();

/**
 * GET /api/v1/public/plans
 * List all active billing plans — Public endpoint.
 *
 * Source of truth is now the database (via PlanService). Previously sourced
 * from the ALL_PLANS in-memory config (SPEC-168 T-011).
 *
 * Only plans with isActive=true are returned, sorted by sortOrder ascending.
 */
export const publicListPlansRoute = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'List billing plans',
    description:
        'Returns all active billing plans from the database. Includes pricing in ARS and USD, trial information, entitlements, and limits. Only active plans are returned.',
    tags: ['Plans'],
    responseSchema: PlansListResponseSchema,
    handler: async () => {
        apiLogger.debug('Public listing active billing plans from DB');

        const result = await planService.list({ active: true });

        if (!result.success || !result.data) {
            apiLogger.error(
                { error: result.error },
                'Failed to load active plans from DB for public endpoint'
            );
            // Return empty list on failure rather than crashing; web can fall back gracefully
            return [];
        }

        // SPEC-239 T-049: exclude non-accommodation (e.g. commerce) plans from
        // the public/accommodation plan list. The commerce plan is a billing
        // mechanism for commerce listings, not a tourist/owner pricing tier.
        const excludedSlugs = await getNonAccommodationPlanSlugs();
        if (excludedSlugs.size === 0) {
            return result.data.items;
        }
        return result.data.items.filter((plan) => !excludedSlugs.has(plan.slug));
    },
    options: {
        skipAuth: true,
        cacheTTL: 3600,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
