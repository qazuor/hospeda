/**
 * Customer Add-on Purchases Request/Response Schemas
 *
 * Zod schemas for validating customer add-on purchase API requests and responses.
 * These schemas define the structure for querying and displaying purchased add-ons
 * across all customers (admin view).
 *
 * @module schemas/customer-addons
 */

import { z } from 'zod';

/**
 * Valid status values for add-on purchases
 */
export const ADDON_PURCHASE_STATUSES = ['all', 'active', 'expired', 'canceled', 'pending'] as const;

/**
 * Query parameters for listing customer add-on purchases (admin)
 */
export const ListCustomerAddonsQuerySchema = z.object({
    /** Page number (1-based) */
    page: z.coerce.number().int().positive().default(1),
    /** Number of items per page (1-100) */
    limit: z.coerce.number().int().min(1).max(100).default(20),
    /** Filter by purchase status (use 'all' to include every status) */
    status: z.enum(ADDON_PURCHASE_STATUSES).default('all'),
    /** Filter by add-on slug (exact match) */
    addonSlug: z.string().optional(),
    /** Filter by customer email (case-insensitive partial match) */
    customerEmail: z.string().optional()
});

export type ListCustomerAddonsQuery = z.infer<typeof ListCustomerAddonsQuerySchema>;

/**
 * Limit adjustment detail within an add-on purchase
 */
export const LimitAdjustmentSchema = z.object({
    limitKey: z.string(),
    increase: z.number(),
    previousValue: z.number(),
    newValue: z.number()
});

/**
 * Entitlement adjustment detail within an add-on purchase
 */
export const EntitlementAdjustmentSchema = z.object({
    entitlementKey: z.string(),
    granted: z.boolean()
});

/**
 * Individual customer add-on purchase response item
 */
export const CustomerAddonResponseSchema = z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    customerEmail: z.string(),
    customerName: z.string().nullable(),
    subscriptionId: z.string().uuid().nullable(),
    addonSlug: z.string(),
    addonId: z.string().uuid().nullable(),
    status: z.string(),
    purchasedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    canceledAt: z.string().datetime().nullable(),
    paymentId: z.string().nullable(),
    limitAdjustments: z.array(LimitAdjustmentSchema).nullable(),
    entitlementAdjustments: z.array(EntitlementAdjustmentSchema).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

export type CustomerAddonResponse = z.infer<typeof CustomerAddonResponseSchema>;

/**
 * Paginated list of customer add-on purchases
 */
export const CustomerAddonsListResponseSchema = z.object({
    data: z.array(CustomerAddonResponseSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int()
});

export type CustomerAddonsListResponse = z.infer<typeof CustomerAddonsListResponseSchema>;
