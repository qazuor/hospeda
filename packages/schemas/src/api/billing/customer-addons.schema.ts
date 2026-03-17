/**
 * Customer Add-on Purchases Request/Response Schemas
 *
 * Zod schemas for validating customer add-on purchase API requests and responses.
 * These schemas define the structure for querying and displaying purchased add-ons
 * across all customers (admin view).
 *
 * @module schemas/api/billing/customer-addons
 */

import { z } from 'zod';

// ─── Status Constants ───────────────────────────────────────────────────────

/** Valid status values for add-on purchase responses (excludes 'all' which is query-only) */
export const ADDON_PURCHASE_RESPONSE_STATUSES = [
    'active',
    'expired',
    'canceled',
    'pending'
] as const;

/** Valid status values for add-on purchases (includes 'all' for query filtering) */
export const ADDON_PURCHASE_STATUSES = ['all', ...ADDON_PURCHASE_RESPONSE_STATUSES] as const;

// ─── Query Schema ───────────────────────────────────────────────────────────

/** Query parameters for listing customer add-on purchases (admin) */
export const ListCustomerAddonsQuerySchema = z.object({
    /** Page number (1-based) */
    page: z.coerce.number().int().positive().default(1),
    /** Number of items per page (1-100) */
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    /** Filter by purchase status (use 'all' to include every status) */
    status: z.enum(ADDON_PURCHASE_STATUSES).default('all'),
    /** Filter by add-on slug (exact match) */
    addonSlug: z.string().optional(),
    /** Filter by customer email (case-insensitive partial match) */
    customerEmail: z.string().optional(),
    /** Include soft-deleted records */
    includeDeleted: z.coerce.boolean().optional().default(false)
});

export type ListCustomerAddonsQuery = z.infer<typeof ListCustomerAddonsQuerySchema>;

// ─── Adjustment Schemas ─────────────────────────────────────────────────────

/** Limit adjustment detail within an add-on purchase */
export const LimitAdjustmentSchema = z.object({
    limitKey: z.string(),
    increase: z.number(),
    previousValue: z.number(),
    newValue: z.number()
});

/** Entitlement adjustment detail within an add-on purchase */
export const EntitlementAdjustmentSchema = z.object({
    entitlementKey: z.string(),
    granted: z.boolean()
});

// ─── Response Schemas ───────────────────────────────────────────────────────

/** Individual customer add-on purchase response item */
export const CustomerAddonResponseSchema = z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    customerEmail: z.string(),
    customerName: z.string().nullable(),
    subscriptionId: z.string().uuid().nullable(),
    addonSlug: z.string(),
    addonId: z.string().uuid().nullable(),
    status: z.enum(ADDON_PURCHASE_RESPONSE_STATUSES),
    purchasedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    canceledAt: z.string().datetime().nullable(),
    deletedAt: z.string().datetime().nullable().optional(),
    paymentId: z.string().nullable(),
    limitAdjustments: z.array(LimitAdjustmentSchema).nullable(),
    entitlementAdjustments: z.array(EntitlementAdjustmentSchema).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

export type CustomerAddonResponse = z.infer<typeof CustomerAddonResponseSchema>;

/** Paginated list of customer add-on purchases */
export const CustomerAddonsListResponseSchema = z.object({
    data: z.array(CustomerAddonResponseSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalPages: z.number().int()
});

export type CustomerAddonsListResponse = z.infer<typeof CustomerAddonsListResponseSchema>;

/** Response schema for single add-on purchase admin action (expire/activate) */
export const CustomerAddonActionResponseSchema = z.object({
    success: z.literal(true),
    data: CustomerAddonResponseSchema
});

export type CustomerAddonActionResponse = z.infer<typeof CustomerAddonActionResponseSchema>;

/** Path parameter schema for add-on purchase ID */
export const CustomerAddonIdParamSchema = z.object({
    id: z.string().uuid()
});

export type CustomerAddonIdParam = z.infer<typeof CustomerAddonIdParamSchema>;
