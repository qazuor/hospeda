/**
 * Admin Add-on Definition Routes
 *
 * Read-only admin endpoints for add-on definitions from the billing configuration.
 * These return add-on DEFINITIONS (catalog), not purchases.
 *
 * Routes:
 * - GET /api/v1/admin/billing/addons     - List all add-on definitions
 * - GET /api/v1/admin/billing/addons/:slug - Get add-on details by slug
 *
 * @module routes/billing/admin/addons
 */

import { ALL_ADDONS, getAddonBySlug } from '@repo/billing';
import { AddonResponseSchema, ListAddonsQuerySchema, PermissionEnum } from '@repo/schemas';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

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

        let addons = [...ALL_ADDONS];

        if (query?.billingType) {
            addons = addons.filter((a) => a.billingType === query.billingType);
        }

        if (query?.targetCategory) {
            addons = addons.filter((a) =>
                a.targetCategories.includes(query.targetCategory as 'owner' | 'complex')
            );
        }

        if (query?.active !== undefined && query.active !== false) {
            addons = addons.filter((a) => a.isActive);
        }

        return addons.map((addon) => ({
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

        const addon = getAddonBySlug(slug);

        if (!addon) {
            throw new HTTPException(404, {
                message: `Add-on with slug '${slug}' not found`
            });
        }

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
