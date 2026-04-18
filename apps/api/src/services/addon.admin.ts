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
import {
    type DrizzleClient,
    billingAddonPurchases,
    billingCustomers,
    getDb,
    safeIlike,
    withTransaction
} from '@repo/db';
import type { ServiceResult } from '@repo/service-core';
import { type SQL, and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import { AddonEntitlementService } from './addon-entitlement.service';
import { AddonExpirationService } from './addon-expiration.service';

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
        input: ListCustomerAddonsInput & { tx?: DrizzleClient }
    ): Promise<ServiceResult<ListCustomerAddonsResult>> {
        const db = input.tx ?? getDb();
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
                conditions.push(safeIlike(billingCustomers.email, customerEmail));
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
     * 2. Wraps DB writes in a transaction: updates status to 'active', clears
     *    canceledAt, resets needsEntitlementSync, sets new expiresAt if the
     *    addon has a defined duration
     * 3. Outside the transaction, attempts to re-apply entitlements in QZPay
     * 4. If QZPay throws, marks the purchase with `needsEntitlementSync=true`
     *    (best-effort UPDATE, does not roll back the activation)
     * 5. Returns the updated record
     *
     * @param input - Purchase ID to activate, plus an optional outer transaction client
     * @returns The updated purchase record
     */
    async activateAddon(
        input: ActivateAddonInput & { tx?: DrizzleClient }
    ): Promise<ServiceResult<CustomerAddonRow>> {
        try {
            // ── 1–3. Read (FOR UPDATE) + validate + write inside a single tx ───
            // The SELECT ... FOR UPDATE locks the row so no concurrent activation
            // can race between the read and the update (TOCTOU prevention).
            // If an outer tx is passed in, withTransaction reuses it transparently.
            type PurchaseRow = {
                id: string;
                customerId: string;
                addonSlug: string;
                status: string;
            };

            let lockedPurchase: PurchaseRow | undefined;
            let newExpiresAt: Date | null = null;
            let validationError: { code: string; message: string } | undefined;

            await withTransaction(async (tx) => {
                // ── 1. SELECT FOR UPDATE — locks the row for the duration of tx ──
                const result = await tx.execute<PurchaseRow>(
                    sql`SELECT id,
                               customer_id    AS "customerId",
                               addon_slug     AS "addonSlug",
                               status
                        FROM   billing_addon_purchases
                        WHERE  id         = ${input.purchaseId}
                          AND  deleted_at IS NULL
                        LIMIT  1
                        FOR UPDATE`
                );

                const row = result.rows[0];

                if (!row) {
                    validationError = {
                        code: 'NOT_FOUND',
                        message: `Add-on purchase '${input.purchaseId}' not found`
                    };
                    return;
                }

                if (row.status === 'active') {
                    validationError = {
                        code: 'INVALID_STATUS',
                        message: 'Add-on purchase is already active'
                    };
                    return;
                }

                if (row.status !== 'expired' && row.status !== 'canceled') {
                    validationError = {
                        code: 'INVALID_STATUS',
                        message: `Cannot activate add-on with status '${row.status}'. Must be 'expired' or 'canceled'.`
                    };
                    return;
                }

                lockedPurchase = row;

                // ── 2. Calculate new expiresAt ────────────────────────────────
                const addon = getAddonBySlug(row.addonSlug);
                const now = new Date();

                if (
                    addon?.durationDays !== null &&
                    addon?.durationDays !== undefined &&
                    addon.durationDays > 0
                ) {
                    newExpiresAt = new Date(
                        now.getTime() + addon.durationDays * 24 * 60 * 60 * 1000
                    );
                }

                // ── 3. Transactional DB write ─────────────────────────────────
                await tx
                    .update(billingAddonPurchases)
                    .set({
                        status: 'active',
                        canceledAt: null,
                        expiresAt: newExpiresAt,
                        needsEntitlementSync: false,
                        updatedAt: now
                    })
                    .where(
                        and(
                            eq(billingAddonPurchases.id, input.purchaseId),
                            isNull(billingAddonPurchases.deletedAt)
                        )
                    );
            }, input.tx);

            if (validationError) {
                return { success: false, error: validationError };
            }

            if (!lockedPurchase) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on purchase '${input.purchaseId}' not found`
                    }
                };
            }

            const purchase = lockedPurchase;

            // ── 4. Re-apply entitlements via QZPay (outside the transaction) ──
            // Intentionally runs after commit so a QZPay failure does not roll
            // back the activation. On failure we mark the row for async
            // reconciliation instead.
            const entitlementService = new AddonEntitlementService(null);
            try {
                await entitlementService.applyAddonEntitlements({
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    purchaseId: purchase.id
                });
            } catch (entitlementError) {
                const entitlementMessage =
                    entitlementError instanceof Error
                        ? entitlementError.message
                        : String(entitlementError);

                apiLogger.warn(
                    {
                        error: entitlementMessage,
                        purchaseId: input.purchaseId,
                        customerId: purchase.customerId,
                        addonSlug: purchase.addonSlug
                    },
                    'Entitlement re-application failed during activation; flagging purchase for async reconciliation'
                );

                // ── 5. Best-effort flag for reconciliation ────────────────────
                // This UPDATE runs outside the already-committed transaction so
                // it cannot roll back the activation. A failure here is logged
                // but does not propagate — the reconciliation cron will retry
                // based on the needsEntitlementSync flag.
                try {
                    await getDb()
                        .update(billingAddonPurchases)
                        .set({ needsEntitlementSync: true, updatedAt: new Date() })
                        .where(eq(billingAddonPurchases.id, input.purchaseId));
                } catch (flagError) {
                    apiLogger.error(
                        {
                            error:
                                flagError instanceof Error ? flagError.message : String(flagError),
                            purchaseId: input.purchaseId
                        },
                        'Failed to set needsEntitlementSync flag; manual reconciliation required'
                    );
                }
            }

            // newExpiresAt is assigned inside withTransaction — cast via unknown to inform TS
            const expiresAtResolved = newExpiresAt as unknown as Date | null;
            const expiresAtIso: string | null = expiresAtResolved?.toISOString() ?? null;

            apiLogger.info(
                {
                    purchaseId: input.purchaseId,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    newExpiresAt: expiresAtIso
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
        purchaseId: string,
        tx?: DrizzleClient
    ): Promise<ServiceResult<CustomerAddonRow>> {
        try {
            const db = tx ?? getDb();

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
