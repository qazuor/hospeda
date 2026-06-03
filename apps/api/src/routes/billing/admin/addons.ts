/**
 * Admin Add-on Definition Routes
 *
 * Read-only admin endpoints for add-on definitions from the `billing_addons` DB
 * table (via {@link AddonCatalogService}). These return add-on DEFINITIONS
 * (catalog), not purchases.
 *
 * Routes:
 * - GET /api/v1/admin/billing/addons       - List all add-on definitions
 * - GET /api/v1/admin/billing/addons/:slug - Get add-on details by slug
 *
 * @module routes/billing/admin/addons
 */

import { AddonResponseSchema, ListAddonsQuerySchema, PermissionEnum } from '@repo/schemas';
import { AddonCatalogService } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// ─── Module-level singleton ────────────────────────────────────────────────────
/** DB-backed catalog service for add-on definition lookups. */
const catalogService = new AddonCatalogService();

/**
 * GET /api/v1/admin/billing/addons
 * List all add-on definitions (admin only)
 */
export const adminListAddonsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List add-on definitions (admin)',
    description:
        'Returns all add-on definitions from the billing configuration. Supports filtering by billing type, target category, and active status.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: ListAddonsQuerySchema.shape,
    responseSchema: z.array(AddonResponseSchema),
    handler: async (_c, _params, _body, query) => {
        apiLogger.debug({ filters: query }, 'Admin listing add-on definitions');

        // Build filter for the DB-backed catalog service
        const filter = {
            ...(query?.billingType !== undefined ? { billingType: query.billingType } : {}),
            ...(query?.targetCategory !== undefined
                ? { targetCategory: query.targetCategory as 'owner' | 'complex' }
                : {}),
            ...(query?.active !== undefined && query.active !== false ? { active: true } : {})
        };

        const result = await catalogService.list(filter);

        if (!result.success) {
            apiLogger.error(
                { error: result.error },
                'Failed to list add-on definitions from DB catalog'
            );
            throw new HTTPException(500, { message: 'Failed to retrieve add-on definitions' });
        }

        return result.data.map((addon) => ({
            slug: addon.slug,
            name: addon.name,
            description: addon.description,
            billingType: addon.billingType,
            priceArs: addon.priceArs,
            durationDays: addon.durationDays,
            affectsLimitKey: addon.affectsLimitKey as string | null,
            limitIncrease: addon.limitIncrease,
            grantsEntitlement: addon.grantsEntitlement as string | null,
            targetCategories: addon.targetCategories,
            isActive: addon.isActive,
            sortOrder: addon.sortOrder
        }));
    }
});

/**
 * GET /api/v1/admin/billing/addons/:slug
 * Get add-on details by slug (admin only)
 */
export const adminGetAddonRoute = createAdminRoute({
    method: 'get',
    path: '/{slug}',
    summary: 'Get add-on details by slug (admin)',
    description: 'Returns details for a specific add-on definition by slug.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestParams: {
        slug: z.string().min(1, 'Add-on slug is required')
    },
    responseSchema: AddonResponseSchema,
    handler: async (_c, params) => {
        const slug = params.slug as string;
        apiLogger.debug({ slug }, 'Admin getting add-on details');

        const result = await catalogService.getBySlug(slug);

        if (!result.success) {
            if (result.error.code === 'NOT_FOUND') {
                throw new HTTPException(404, {
                    message: `Add-on with slug '${slug}' not found`
                });
            }

            apiLogger.error(
                { slug, error: result.error },
                'Failed to retrieve add-on definition from DB catalog'
            );
            throw new HTTPException(500, { message: 'Failed to retrieve add-on definition' });
        }

        const addon = result.data;

        return {
            slug: addon.slug,
            name: addon.name,
            description: addon.description,
            billingType: addon.billingType,
            priceArs: addon.priceArs,
            durationDays: addon.durationDays,
            affectsLimitKey: addon.affectsLimitKey as string | null,
            limitIncrease: addon.limitIncrease,
            grantsEntitlement: addon.grantsEntitlement as string | null,
            targetCategories: addon.targetCategories,
            isActive: addon.isActive,
            sortOrder: addon.sortOrder
        };
    }
});

/**
 * Admin add-ons router
 */
export const adminAddonsRouter = createRouter();
adminAddonsRouter.route('/', adminListAddonsRoute);
adminAddonsRouter.route('/', adminGetAddonRoute);
