/**
 * Add-on Expiration Service
 *
 * Service for querying expired and expiring add-ons, expiring individual purchases,
 * and orchestrating batch expiry runs (delegated to addon-expiration.batch.ts).
 *
 * Query helpers and JSONB parsers live in addon-expiration.queries.ts.
 * Batch orchestration lives in addon-expiration.batch.ts.
 *
 * Features:
 * - Find expired add-ons (expires_at <= now, status='active')
 * - Find expiring add-ons (within N days, for notifications)
 * - Expire a single add-on purchase with entitlement removal
 * - Batch-process up to BATCH_SIZE expired add-ons per cron run
 * - Handle edge case: null expires_at means no expiration
 *
 * @module services/addon-expiration
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import type { ServiceResult } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../utils/logger.js';
import { AddonEntitlementService } from './addon-entitlement.service.js';
import { processExpiredAddonsBatch } from './addon-expiration.batch.js';
import { findExpiredAddons, findExpiringAddons } from './addon-expiration.queries.js';

// ─── Re-export types for backward compatibility ───────────────────────────────

export type {
    ExpiredAddon,
    ExpiringAddon,
    FindExpiringAddonsInput
} from './addon-expiration.queries.js';

export type { ProcessExpiredAddonsResult } from './addon-expiration.batch.js';

// ─── Local types ──────────────────────────────────────────────────────────────

/**
 * Input for expiring a single add-on.
 */
export interface ExpireAddonInput {
    /** Add-on purchase ID. */
    purchaseId: string;
}

/**
 * Result of expiring a single add-on.
 */
export interface ExpireAddonResult {
    /** Add-on purchase ID. */
    purchaseId: string;
    /** Customer ID. */
    customerId: string;
    /** Add-on slug. */
    addonSlug: string;
    /** Expiration timestamp. */
    expiredAt: Date;
}

// ─── Service class ────────────────────────────────────────────────────────────

/**
 * Service for querying expired and expiring add-ons and managing their lifecycle.
 */
export class AddonExpirationService {
    private readonly entitlementService: AddonEntitlementService;

    constructor(billing: QZPayBilling | null = null) {
        this.entitlementService = new AddonEntitlementService(billing);
    }

    /**
     * Find expired add-ons.
     *
     * Delegates to the standalone {@link findExpiredAddons} query function.
     * Limited to {@link BATCH_SIZE} rows per call (GAP-043-015).
     *
     * @returns List of expired add-ons or error.
     */
    findExpiredAddons() {
        return findExpiredAddons();
    }

    /**
     * Find expiring add-ons.
     *
     * Delegates to the standalone {@link findExpiringAddons} query function.
     * Limited to {@link BATCH_SIZE} rows per call (GAP-043-015).
     *
     * @param input - Configuration with daysAhead.
     * @returns List of expiring add-ons or error.
     */
    findExpiringAddons(input: Parameters<typeof findExpiringAddons>[0]) {
        return findExpiringAddons(input);
    }

    /**
     * Expire a single add-on purchase.
     *
     * This method:
     * 1. Validates the purchase exists and is active.
     * 2. Removes entitlements via AddonEntitlementService.
     * 3. Updates billing_addon_purchases row: status='expired'.
     * 4. Returns the expired add-on info.
     *
     * Idempotent: If the add-on is already expired, returns success with details.
     *
     * @param input - Purchase ID to expire.
     * @returns Expired add-on details or error.
     */
    async expireAddon(input: ExpireAddonInput): Promise<ServiceResult<ExpireAddonResult>> {
        try {
            const db = getDb();

            // Find the add-on purchase
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

            // Idempotent: If already expired, return success with details
            if (purchase.status === 'expired') {
                apiLogger.debug(
                    {
                        purchaseId: input.purchaseId,
                        customerId: purchase.customerId,
                        addonSlug: purchase.addonSlug,
                        status: purchase.status
                    },
                    'Add-on purchase already expired (idempotent)'
                );

                return {
                    success: true,
                    data: {
                        purchaseId: purchase.id,
                        customerId: purchase.customerId,
                        addonSlug: purchase.addonSlug,
                        expiredAt: purchase.expiresAt ?? purchase.updatedAt
                    }
                };
            }

            // Only expire active add-ons
            if (purchase.status !== 'active') {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_STATUS',
                        message: `Cannot expire add-on with status '${purchase.status}'`
                    }
                };
            }

            // Remove entitlements via AddonEntitlementService.
            // Wrapped in try/catch so that a failure here does not prevent the
            // status update below. Entitlements will be reconciled on the next cron run.
            let entitlementRemovalFailed = false;
            try {
                const removeResult = await this.entitlementService.removeAddonEntitlements({
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    purchaseId: purchase.id
                });

                if (!removeResult.success) {
                    entitlementRemovalFailed = true;
                    apiLogger.warn(
                        {
                            purchaseId: input.purchaseId,
                            customerId: purchase.customerId,
                            addonSlug: purchase.addonSlug,
                            error: removeResult.error
                        },
                        'Entitlement removal returned failure during expiry; continuing with status update. Entitlements will be reconciled on next cron run.'
                    );
                }
            } catch (entitlementError) {
                entitlementRemovalFailed = true;
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
                    'Entitlement removal failed during expiry; continuing with status update. Entitlements will be reconciled on next cron run.'
                );
            }

            // TODO(SPEC-038): Add entitlement reconciliation cron to handle drift

            // Update billing_addon_purchases row: status='expired'
            // This ALWAYS runs regardless of whether entitlement removal succeeded.
            const now = new Date();
            const updateResult = await db
                .update(billingAddonPurchases)
                .set({
                    status: 'expired',
                    updatedAt: now,
                    ...(entitlementRemovalFailed
                        ? { metadata: { entitlementRemovalPending: true } }
                        : {})
                })
                .where(
                    and(
                        eq(billingAddonPurchases.id, input.purchaseId),
                        eq(billingAddonPurchases.status, 'active'),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                );

            const rowCount = (updateResult as { rowCount?: number }).rowCount || 0;

            if (rowCount === 0) {
                apiLogger.warn(
                    {
                        purchaseId: input.purchaseId,
                        customerId: purchase.customerId,
                        addonSlug: purchase.addonSlug
                    },
                    'UPDATE affected 0 rows when expiring add-on — purchase was likely already expired/canceled concurrently'
                );

                return {
                    success: true,
                    data: {
                        purchaseId: purchase.id,
                        customerId: purchase.customerId,
                        addonSlug: purchase.addonSlug,
                        expiredAt: now
                    }
                };
            }

            apiLogger.info(
                {
                    purchaseId: input.purchaseId,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    expiredAt: now.toISOString()
                },
                'Successfully expired add-on purchase'
            );

            return {
                success: true,
                data: {
                    purchaseId: purchase.id,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    expiredAt: now
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { error: errorMessage, purchaseId: input.purchaseId },
                'Failed to expire add-on purchase'
            );

            return {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to expire add-on purchase' }
            };
        }
    }

    /**
     * Process all expired add-ons in a batch.
     *
     * Delegates to {@link processExpiredAddonsBatch}, passing `expireAddon` as
     * the per-item processor. Handles up to BATCH_SIZE add-ons per call.
     *
     * @returns Processing summary with counts and errors.
     */
    processExpiredAddons() {
        return processExpiredAddonsBatch((input) => this.expireAddon(input));
    }
}
