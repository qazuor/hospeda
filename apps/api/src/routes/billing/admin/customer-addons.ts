/**
 * Admin Customer Add-on Purchases API Routes
 *
 * Provides admin endpoints to manage purchased add-ons across all customers.
 *
 * Routes:
 * - GET  /api/v1/admin/billing/customer-addons     - List all customer add-on purchases
 * - POST /api/v1/admin/billing/customer-addons/:id/expire   - Expire an active purchase
 * - POST /api/v1/admin/billing/customer-addons/:id/activate - Activate an expired/canceled purchase
 *
 * @module routes/billing/admin/customer-addons
 */

import {
    CustomerAddonActionResponseSchema,
    CustomerAddonIdParamSchema,
    CustomerAddonsListResponseSchema,
    ListCustomerAddonsQuerySchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { AdminAddonService } from '../../../services/addon.admin';
import { createAdminRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// Service instance
// ---------------------------------------------------------------------------

const adminAddonService = new AdminAddonService();

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handler for listing customer add-on purchases.
 * Delegates all query logic to AdminAddonService.
 */
export const listCustomerAddonsHandler = async (
    _c: unknown,
    _params: unknown,
    _body: unknown,
    query?: Record<string, unknown>
) => {
    const parsed = ListCustomerAddonsQuerySchema.parse({
        page: query?.page,
        pageSize: query?.pageSize,
        status: query?.status,
        addonSlug: query?.addonSlug,
        customerEmail: query?.customerEmail,
        includeDeleted: query?.includeDeleted
    });

    const result = await adminAddonService.listCustomerAddons(parsed);

    if (!result.success) {
        throw new HTTPException(500, {
            message: result.error?.message ?? 'Failed to retrieve customer add-on purchases'
        });
    }

    return result.data;
};

/**
 * Handler for expiring a customer add-on purchase.
 * Validates the purchase exists and is active, then delegates to AddonExpirationService.
 */
export const expireCustomerAddonHandler = async (c: Context, params: Record<string, unknown>) => {
    const { id } = params as { id: string };

    const result = await adminAddonService.expireAddon(id);

    if (!result.success) {
        const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 400
        };

        const status = statusMap[result.error?.code ?? ''] ?? 500;

        return c.json(
            {
                success: false as const,
                error: {
                    code: result.error?.code ?? 'INTERNAL_ERROR',
                    message: result.error?.message ?? 'Failed to expire add-on purchase'
                }
            },
            status as 400 | 404 | 500
        );
    }

    return {
        ...result.data
    };
};

/**
 * Handler for activating a customer add-on purchase.
 * Validates the purchase exists and is not active, then reactivates it.
 */
export const activateCustomerAddonHandler = async (c: Context, params: Record<string, unknown>) => {
    const { id } = params as { id: string };

    const result = await adminAddonService.activateAddon({ purchaseId: id });

    if (!result.success) {
        const statusMap: Record<string, number> = {
            NOT_FOUND: 404,
            INVALID_STATUS: 400
        };

        const status = statusMap[result.error?.code ?? ''] ?? 500;

        return c.json(
            {
                success: false as const,
                error: {
                    code: result.error?.code ?? 'INTERNAL_ERROR',
                    message: result.error?.message ?? 'Failed to activate add-on purchase'
                }
            },
            status as 400 | 404 | 500
        );
    }

    return {
        ...result.data
    };
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/billing/customer-addons
 * List all customer add-on purchases with filtering and pagination (admin only)
 */
export const listCustomerAddonsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List customer add-on purchases',
    description:
        'Returns paginated list of add-on purchases across all customers with optional filtering by status, add-on slug, and customer email',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_READ_ALL],
    requestQuery: ListCustomerAddonsQuerySchema.shape,
    responseSchema: CustomerAddonsListResponseSchema,
    handler: listCustomerAddonsHandler
});

/**
 * POST /api/v1/admin/billing/customer-addons/:id/expire
 * Expire an active add-on purchase (admin only)
 */
export const expireCustomerAddonRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/expire',
    summary: 'Expire an add-on purchase',
    description:
        'Expires an active add-on purchase by ID. Removes entitlements and sets status to expired. Returns 404 if not found, 400 if already expired.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: CustomerAddonIdParamSchema.shape,
    responseSchema: CustomerAddonActionResponseSchema,
    handler: expireCustomerAddonHandler
});

/**
 * POST /api/v1/admin/billing/customer-addons/:id/activate
 * Activate an expired or canceled add-on purchase (admin only)
 */
export const activateCustomerAddonRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/activate',
    summary: 'Activate an add-on purchase',
    description:
        'Activates an expired or canceled add-on purchase by ID. Re-applies entitlements and sets status to active with a new expiration date if applicable. Returns 404 if not found, 400 if already active.',
    tags: ['Billing', 'Add-ons'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE],
    requestParams: CustomerAddonIdParamSchema.shape,
    responseSchema: CustomerAddonActionResponseSchema,
    handler: activateCustomerAddonHandler
});
