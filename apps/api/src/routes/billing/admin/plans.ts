/**
 * Admin Plan Definition Routes
 *
 * Read-only admin endpoints for plan definitions from the billing configuration.
 * These return plan DEFINITIONS (catalog), not subscriptions.
 *
 * Routes:
 * - GET /api/v1/admin/billing/plans     - List all plan definitions
 * - GET /api/v1/admin/billing/plans/:id - Get plan details by slug
 *
 * @module routes/billing/admin/plans
 */

import { ALL_PLANS } from '@repo/billing';
import type { PlanDefinition } from '@repo/billing';
import { PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Zod schema for a plan definition response
 */
const PlanDefinitionResponseSchema = z.object({
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    category: z.enum(['owner', 'complex', 'tourist']),
    monthlyPriceArs: z.number(),
    annualPriceArs: z.number().nullable(),
    monthlyPriceUsdRef: z.number(),
    hasTrial: z.boolean(),
    trialDays: z.number(),
    isDefault: z.boolean(),
    sortOrder: z.number(),
    isActive: z.boolean(),
    entitlements: z.array(z.string()),
    limits: z.array(
        z.object({
            key: z.string(),
            value: z.number(),
            name: z.string(),
            description: z.string()
        })
    )
});

/**
 * Query schema for listing plans (admin)
 */
const AdminListPlansQuerySchema = z.object({
    /** Filter by plan category */
    category: z.enum(['owner', 'complex', 'tourist']).optional(),
    /** Filter by active status */
    active: z
        .string()
        .optional()
        .transform((val) => val === 'true')
});

/**
 * Format a plan definition for the API response
 */
function formatPlanForResponse(plan: PlanDefinition): z.infer<typeof PlanDefinitionResponseSchema> {
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
 * GET /api/v1/admin/billing/plans
 * List all plan definitions (admin only)
 */
export const adminListPlansRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List plan definitions (admin)',
    description:
        'Returns all plan definitions from the billing configuration. Supports filtering by category and active status. Unlike the public endpoint, this returns ALL plans including inactive ones.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: AdminListPlansQuerySchema.shape,
    responseSchema: z.array(PlanDefinitionResponseSchema),
    handler: async (_c, _params, _body, query) => {
        apiLogger.debug({ filters: query }, 'Admin listing plan definitions');

        let plans = [...ALL_PLANS];

        if (query?.category) {
            plans = plans.filter((p) => p.category === query.category);
        }

        if (query?.active !== undefined && query.active !== false) {
            plans = plans.filter((p) => p.isActive);
        }

        return plans.map(formatPlanForResponse);
    }
});

/**
 * GET /api/v1/admin/billing/plans/:id
 * Get plan details by slug (admin only)
 *
 * Uses :id param name for URL consistency but accepts slug values.
 */
export const adminGetPlanRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get plan details (admin)',
    description: 'Returns details for a specific plan definition by slug.',
    tags: ['Billing', 'Plans'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: {
        id: z.string().min(1, 'Plan slug is required')
    },
    responseSchema: PlanDefinitionResponseSchema,
    handler: async (_c, params) => {
        const slug = params.id as string;
        apiLogger.debug({ slug }, 'Admin getting plan details');

        const plan = ALL_PLANS.find((p) => p.slug === slug);

        if (!plan) {
            throw new HTTPException(404, {
                message: `Plan with slug '${slug}' not found`
            });
        }

        return formatPlanForResponse(plan);
    }
});

/**
 * Admin plans router
 */
export const adminPlansRouter = createRouter();
adminPlansRouter.route('/', adminListPlansRoute);
adminPlansRouter.route('/', adminGetPlanRoute);
