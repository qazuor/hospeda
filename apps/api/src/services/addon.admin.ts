/**
 * Admin Add-on Service
 *
 * Service methods for admin-level add-on purchase operations.
 * Extracted from inline Drizzle queries in the customer-addons route
 * for testability and separation of concerns.
 *
 * @module services/addon.admin
 */

import { getAddonBySlug } from '@repo/billing';
import { billingAddonPurchases, billingCustomers, getDb } from '@repo/db';
import { type SQL, and, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import { AddonEntitlementService } from './addon-entitlement.service';
import { AddonExpirationService } from './addon-expiration.service';
import type { ServiceResult } from './addon.types';

/**
 * Input parameters for listing customer add-on purchases
 */
export interface ListCustomerAddonsInput {
    /** Page number (1-based) */
    page: number;
    /** Number of items per page */
    pageSize: number;
    /** Filter by purchase status ('all' to include every status) */
    status: string;
    /** Filter by add-on slug (exact match) */
    addonSlug?: string;
    /** Filter by customer email (case-insensitive partial match) */
    customerEmail?: string;
    /** Include soft-deleted records */
    includeDeleted: boolean;
}

/**
 * Single customer add-on purchase row with joined customer data
 */
export interface CustomerAddonRow {
    id: string;
    customerId: string;
    customerEmail: string;
    customerName: string | null;
    subscriptionId: string | null;
    addonSlug: string;
    addonId: string | null;
    status: string;
    purchasedAt: string;
    expiresAt: string | null;
    canceledAt: string | null;
    deletedAt: string | null;
    paymentId: string | null;
    limitAdjustments: unknown;
    entitlementAdjustments: unknown;
    metadata: unknown;
    createdAt: string;
    updatedAt: string;
}

/**
 * Paginated result for customer add-on purchases
 */
export interface ListCustomerAddonsResult {
    data: CustomerAddonRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Input for activating a single add-on purchase
 */
export interface ActivateAddonInput {
    /** Add-on purchase ID */
    purchaseId: string;
}

/**
 * Result of activating a single add-on purchase
 */
export interface ActivateAddonResult {
    id: string;
    customerId: string;
    addonSlug: string;
    status: string;
    expiresAt: Date | null;
}

/**
 * Admin Add-on Service
 *
 * Provides admin-level operations for managing customer add-on purchases.
 */
export class AdminAddonService {
    /**
     * List customer add-on purchases with filtering and pagination.
     *
     * Joins billingAddonPurchases with billingCustomers to include customer email/name.
     *
     * @param input - Query parameters for filtering and pagination
     * @returns Paginated list of customer add-on purchases
     */
    async listCustomerAddons(
        input: ListCustomerAddonsInput
    ): Promise<ServiceResult<ListCustomerAddonsResult>> {
        const db = getDb();
        const { page, pageSize, status, addonSlug, customerEmail, includeDeleted } = input;
        const offset = (page - 1) * pageSize;

        try {
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

            if (!includeDeleted) {
                conditions.push(isNull(billingAddonPurchases.deletedAt));
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

            // Get total count with join
            const totalResult = await db
                .select({ total: count() })
                .from(billingAddonPurchases)
                .innerJoin(
                    billingCustomers,
                    eq(billingAddonPurchases.customerId, billingCustomers.id)
                )
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
                    deletedAt: billingAddonPurchases.deletedAt,
                    paymentId: billingAddonPurchases.paymentId,
                    limitAdjustments: billingAddonPurchases.limitAdjustments,
                    entitlementAdjustments: billingAddonPurchases.entitlementAdjustments,
                    metadata: billingAddonPurchases.metadata,
                    createdAt: billingAddonPurchases.createdAt,
                    updatedAt: billingAddonPurchases.updatedAt
                })
                .from(billingAddonPurchases)
                .innerJoin(
                    billingCustomers,
                    eq(billingAddonPurchases.customerId, billingCustomers.id)
                )
                .where(whereClause)
                .orderBy(desc(billingAddonPurchases.purchasedAt))
                .limit(pageSize)
                .offset(offset);

            apiLogger.debug(
                {
                    total,
                    returned: results.length,
                    filters: { status, addonSlug, customerEmail, includeDeleted }
                },
                'Admin retrieved customer add-on purchases'
            );

            const data: CustomerAddonRow[] = results.map((row) => ({
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
                deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
                paymentId: row.paymentId ?? null,
                limitAdjustments: row.limitAdjustments ?? null,
                entitlementAdjustments: row.entitlementAdjustments ?? null,
                metadata: row.metadata ?? null,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString()
            }));

            return {
                success: true,
                data: {
                    data,
                    total: Number(total),
                    page,
                    pageSize,
                    totalPages: Math.ceil(Number(total) / pageSize)
                }
            };
        } catch (error) {
            apiLogger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    filters: { status, addonSlug, customerEmail, includeDeleted }
                },
                'Admin failed to retrieve customer add-on purchases'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve customer add-on purchases'
                }
            };
        }
    }

    /**
     * Expire a single add-on purchase by ID.
     *
     * Delegates to AddonExpirationService.expireAddon().
     *
     * @param purchaseId - The add-on purchase UUID
     * @returns The full purchase record after expiration
     */
    async expireAddon(purchaseId: string): Promise<ServiceResult<CustomerAddonRow>> {
        const expirationService = new AddonExpirationService();
        const result = await expirationService.expireAddon({ purchaseId });

        if (!result.success) {
            return {
                success: false,
                error: result.error
            };
        }

        // Fetch the updated record to return full data
        return this.getAddonPurchaseById(purchaseId);
    }

    /**
     * Activate a previously expired or canceled add-on purchase.
     *
     * This method:
     * 1. Validates the purchase exists and status is NOT 'active'
     * 2. Updates status to 'active', clears canceledAt, sets new expiresAt if addon has duration
     * 3. Re-applies entitlements via AddonEntitlementService
     * 4. Returns the updated record
     *
     * @param input - Purchase ID to activate
     * @returns The updated purchase record
     */
    async activateAddon(input: ActivateAddonInput): Promise<ServiceResult<CustomerAddonRow>> {
        try {
            const db = getDb();

            // Find the purchase
            const [purchase] = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.id, input.purchaseId),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                )
                .limit(1);

            if (!purchase) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on purchase '${input.purchaseId}' not found`
                    }
                };
            }

            if (purchase.status === 'active') {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_STATUS',
                        message: 'Add-on purchase is already active'
                    }
                };
            }

            if (purchase.status !== 'expired' && purchase.status !== 'canceled') {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_STATUS',
                        message: `Cannot activate add-on with status '${purchase.status}'. Must be 'expired' or 'canceled'.`
                    }
                };
            }

            // Calculate new expiresAt if the addon has a duration
            const addon = getAddonBySlug(purchase.addonSlug);
            const now = new Date();
            let newExpiresAt: Date | null = null;

            if (
                addon?.durationDays !== null &&
                addon?.durationDays !== undefined &&
                addon.durationDays > 0
            ) {
                newExpiresAt = new Date(now.getTime() + addon.durationDays * 24 * 60 * 60 * 1000);
            }

            // Update the purchase
            await db
                .update(billingAddonPurchases)
                .set({
                    status: 'active',
                    canceledAt: null,
                    expiresAt: newExpiresAt,
                    updatedAt: now
                })
                .where(
                    and(
                        eq(billingAddonPurchases.id, input.purchaseId),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                );

            // Re-apply entitlements
            const entitlementService = new AddonEntitlementService(null);
            try {
                await entitlementService.applyAddonEntitlements({
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    purchaseId: purchase.id
                });
            } catch (entitlementError) {
                apiLogger.warn(
                    {
                        error:
                            entitlementError instanceof Error
                                ? entitlementError.message
                                : String(entitlementError),
                        purchaseId: input.purchaseId,
                        customerId: purchase.customerId,
                        addonSlug: purchase.addonSlug
                    },
                    'Entitlement re-application failed during activation; purchase status updated but entitlements may need manual reconciliation'
                );
            }

            apiLogger.info(
                {
                    purchaseId: input.purchaseId,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    newExpiresAt: newExpiresAt?.toISOString() ?? null
                },
                'Successfully activated add-on purchase'
            );

            // Fetch the updated record
            return this.getAddonPurchaseById(input.purchaseId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    purchaseId: input.purchaseId
                },
                'Failed to activate add-on purchase'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to activate add-on purchase'
                }
            };
        }
    }

    /**
     * Fetch a single add-on purchase by ID with joined customer data.
     *
     * @param purchaseId - The add-on purchase UUID
     * @returns The purchase record with customer info
     */
    private async getAddonPurchaseById(
        purchaseId: string
    ): Promise<ServiceResult<CustomerAddonRow>> {
        try {
            const db = getDb();

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
                    deletedAt: billingAddonPurchases.deletedAt,
                    paymentId: billingAddonPurchases.paymentId,
                    limitAdjustments: billingAddonPurchases.limitAdjustments,
                    entitlementAdjustments: billingAddonPurchases.entitlementAdjustments,
                    metadata: billingAddonPurchases.metadata,
                    createdAt: billingAddonPurchases.createdAt,
                    updatedAt: billingAddonPurchases.updatedAt
                })
                .from(billingAddonPurchases)
                .innerJoin(
                    billingCustomers,
                    eq(billingAddonPurchases.customerId, billingCustomers.id)
                )
                .where(eq(billingAddonPurchases.id, purchaseId))
                .limit(1);

            const row = results[0];

            if (!row) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on purchase '${purchaseId}' not found`
                    }
                };
            }

            return {
                success: true,
                data: {
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
                    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
                    paymentId: row.paymentId ?? null,
                    limitAdjustments: row.limitAdjustments ?? null,
                    entitlementAdjustments: row.entitlementAdjustments ?? null,
                    metadata: row.metadata ?? null,
                    createdAt: row.createdAt.toISOString(),
                    updatedAt: row.updatedAt.toISOString()
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { error: errorMessage, purchaseId },
                'Failed to fetch add-on purchase by ID'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to fetch add-on purchase'
                }
            };
        }
    }
}
