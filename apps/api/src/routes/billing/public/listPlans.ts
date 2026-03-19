import { z } from '@hono/zod-openapi';
/**
 * Public plans list endpoint
 * Returns the list of available billing plans from the billing configuration
 */
import { ALL_PLANS } from '@repo/billing';
import type { PlanDefinition } from '@repo/billing';
import { createSimpleRoute } from '../../../utils/route-factory.js';

/**
 * Public response schema for a single plan
 */
const PlanPublicSchema = z.object({
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
        .array(
            z.object({
                key: z.string().openapi({ description: 'Limit key identifier' }),
                value: z
                    .number()
                    .openapi({ description: 'Numeric limit value (-1 means unlimited)' }),
                name: z.string().openapi({ description: 'Human-readable name' }),
                description: z.string().openapi({ description: 'Limit description' })
            })
        )
        .openapi({ description: 'Limits applied to this plan' })
});

const PlansListResponseSchema = z.array(PlanPublicSchema);

/**
 * Formats a plan definition for the public API response
 */
function formatPlanForResponse(plan: PlanDefinition): z.infer<typeof PlanPublicSchema> {
    return {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        category: plan.category,
        monthlyPriceArs: plan.monthlyPriceArs,
        annualPriceArs: plan.annualPriceArs,
        monthlyPriceUsdRef: plan.monthlyPriceUsdRef,
        hasTrial: plan.hasTrial,
        trialDays: plan.trialDays,
        isDefault: plan.isDefault,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive,
        entitlements: plan.entitlements as string[],
        limits: plan.limits.map((limit) => ({
            key: limit.key as string,
            value: limit.value,
            name: limit.name,
            description: limit.description
        }))
    };
}

/**
 * GET /api/v1/public/plans
 * List all active billing plans - Public endpoint
 */
export const publicListPlansRoute = createSimpleRoute({
    method: 'get',
    path: '/',
    summary: 'List billing plans',
    description:
        'Returns all available billing plans including pricing in ARS and USD, trial information, entitlements, and limits. Data sourced from billing configuration.',
    tags: ['Plans'],
    responseSchema: PlansListResponseSchema,
    handler: async () => {
        const activePlans = ALL_PLANS.filter((plan) => plan.isActive);
        return activePlans.map(formatPlanForResponse);
    },
    options: {
        skipAuth: true,
        cacheTTL: 3600,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
