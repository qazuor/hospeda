/**
 * Admin Customer Add-on Purchases API Routes
 *
 * Provides admin endpoints to view purchased add-ons across all customers.
 * These routes require admin permissions with BILLING_READ_ALL.
 *
 * Routes:
 * - GET /api/v1/admin/billing/customer-addons - List all customer add-on purchases
 *
 * @module routes/billing/admin/customer-addons
 */

import { billingAddonPurchases, billingCustomers, getDb } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { type SQL, and, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { CustomerAddonsListResponseSchema, ListCustomerAddonsQuerySchema } from '../../../schemas';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * Handler for listing customer add-on purchases
 * Extracted for testing purposes.
 * Joins billingAddonPurchases with billingCustomers to include customer email/name.
 */
export const listCustomerAddonsHandler = async (
    _c: unknown,
    _params: unknown,
    _body: unknown,
    query?: Record<string, unknown>
) => {
    const db = getDb();

    // Parse and validate query with defaults applied
    const parsed = ListCustomerAddonsQuerySchema.parse({
        page: query?.page,
        limit: query?.limit,
        status: query?.status,
        addonSlug: query?.addonSlug,
        customerEmail: query?.customerEmail
    });

    const { page, limit, status, addonSlug, customerEmail } = parsed;
    const offset = (page - 1) * limit;

    try {
        // Build filter conditions
        const conditions: SQL[] = [];

        if (status !== 'all') {
            conditions.push(eq(billingAddonPurchases.status, status));
        }

        if (addonSlug) {
            conditions.push(eq(billingAddonPurchases.addonSlug, addonSlug));
        }

        if (customerEmail) {
            conditions.push(ilike(billingCustomers.email, `%${customerEmail}%`));
        }

        conditions.push(isNull(billingAddonPurchases.deletedAt));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count with join
        const totalResult = await db
            .select({ total: count() })
            .from(billingAddonPurchases)
            .innerJoin(billingCustomers, eq(billingAddonPurchases.customerId, billingCustomers.id))
            .where(whereClause);

        const total = totalResult[0]?.total ?? 0;

        // Get paginated results with customer info
        const results = await db
            .select({
                id: billingAddonPurchases.id,
                customerId: billingAddonPurchases.customerId,
                customerEmail: billingCustomers.email,
                customerName: billingCustomers.name,
                subscriptionId: billingAddonPurchases.subscriptionId,
                addonSlug: billingAddonPurchases.addonSlug,
                addonId: billingAddonPurchases.addonId,
                status: billingAddonPurchases.status,
                purchasedAt: billingAddonPurchases.purchasedAt,
                expiresAt: billingAddonPurchases.expiresAt,
                canceledAt: billingAddonPurchases.canceledAt,
                paymentId: billingAddonPurchases.paymentId,
                limitAdjustments: billingAddonPurchases.limitAdjustments,
                entitlementAdjustments: billingAddonPurchases.entitlementAdjustments,
                metadata: billingAddonPurchases.metadata,
                createdAt: billingAddonPurchases.createdAt,
                updatedAt: billingAddonPurchases.updatedAt
            })
            .from(billingAddonPurchases)
            .innerJoin(billingCustomers, eq(billingAddonPurchases.customerId, billingCustomers.id))
            .where(whereClause)
            .orderBy(desc(billingAddonPurchases.purchasedAt))
            .limit(limit)
            .offset(offset);

        apiLogger.debug(
            {
                total,
                returned: results.length,
                filters: { status, addonSlug, customerEmail }
            },
            'Admin retrieved customer add-on purchases via API'
        );

        return {
            data: results.map((row) => ({
                id: row.id,
                customerId: row.customerId,
                customerEmail: row.customerEmail,
                customerName: row.customerName ?? null,
                subscriptionId: row.subscriptionId ?? null,
                addonSlug: row.addonSlug,
                addonId: row.addonId ?? null,
                status: row.status,
                purchasedAt: row.purchasedAt.toISOString(),
                expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
                canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
                paymentId: row.paymentId ?? null,
                limitAdjustments: row.limitAdjustments ?? null,
                entitlementAdjustments: row.entitlementAdjustments ?? null,
                metadata: row.metadata ?? null,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString()
            })),
            total: Number(total),
            page,
            limit
        };
    } catch (error) {
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : 'Unknown error',
                filters: { status, addonSlug, customerEmail }
            },
            'Admin failed to retrieve customer add-on purchases via API'
        );

        throw new HTTPException(500, {
            message: 'Failed to retrieve customer add-on purchases'
        });
    }
};

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
