/**
 * Add-on Expiration Service
 *
 * Service for querying expired and expiring add-ons.
 * Used by cron jobs and notification systems to handle add-on lifecycle.
 *
 * Features:
 * - Find expired add-ons (expires_at <= now, status='active')
 * - Find expiring add-ons (within N days, for notifications)
 * - Handle edge case: null expires_at means no expiration
 *
 * @module services/addon-expiration
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import { and, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { apiLogger } from '../utils/logger';
import { AddonEntitlementService } from './addon-entitlement.service';
import type { ServiceResult } from './addon.types';

/**
 * Expired add-on purchase
 * Represents an active add-on that has passed its expiration date
 */
export interface ExpiredAddon {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    addonSlug: string;
    purchasedAt: Date;
    expiresAt: Date;
    limitAdjustments: Array<{
        limitKey: string;
        increase: number;
        previousValue: number;
        newValue: number;
    }>;
    entitlementAdjustments: Array<{
        entitlementKey: string;
        granted: boolean;
    }>;
}

/**
 * Expiring add-on purchase
 * Represents an active add-on that will expire within the specified time window
 */
export interface ExpiringAddon {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    addonSlug: string;
    purchasedAt: Date;
    expiresAt: Date;
    daysUntilExpiration: number;
    limitAdjustments: Array<{
        limitKey: string;
        increase: number;
        previousValue: number;
        newValue: number;
    }>;
    entitlementAdjustments: Array<{
        entitlementKey: string;
        granted: boolean;
    }>;
}

/**
 * Zod schema for validating the `daysAhead` parameter.
 * Must be a positive integer no greater than 365.
 */
const daysAheadSchema = z
    .number()
    .int({ message: 'daysAhead must be an integer' })
    .positive({ message: 'daysAhead must be a positive number' })
    .max(365, { message: 'daysAhead must not exceed 365' });

/**
 * Input for finding expiring add-ons
 */
export interface FindExpiringAddonsInput {
    /** Number of days ahead to check for expiration (positive integer, max 365) */
    daysAhead: number;
}

/**
 * Input for expiring a single add-on
 */
export interface ExpireAddonInput {
    /** Add-on purchase ID */
    purchaseId: string;
}

/**
 * Result of expiring a single add-on
 */
export interface ExpireAddonResult {
    /** Add-on purchase ID */
    purchaseId: string;
    /** Customer ID */
    customerId: string;
    /** Add-on slug */
    addonSlug: string;
    /** Expiration timestamp */
    expiredAt: Date;
}

/**
 * Result of processing expired add-ons
 */
export interface ProcessExpiredAddonsResult {
    /** Number of add-ons successfully processed */
    processed: number;
    /** Number of add-ons that failed to process */
    failed: number;
    /** Details of failed add-ons (purchase ID and error) */
    errors: Array<{
        purchaseId: string;
        error: string;
    }>;
}

/**
 * Service for querying expired and expiring add-ons
 */
export class AddonExpirationService {
    private readonly entitlementService: AddonEntitlementService;

    constructor(billing: QZPayBilling | null = null) {
        this.entitlementService = new AddonEntitlementService(billing);
    }
    /**
     * Find expired add-ons
     *
     * Queries billing_addon_purchases for records where:
     * - status = 'active'
     * - expires_at <= now()
     * - expires_at IS NOT NULL
     *
     * Returns array of expired add-ons that need processing.
     *
     * @returns List of expired add-ons or error
     */
    async findExpiredAddons(): Promise<ServiceResult<ExpiredAddon[]>> {
        try {
            // getDb() throws if the database was not initialized before this call.
            // Guard here so the error surfaces as a clear service result rather than
            // an unhandled exception propagating up the cron/expiration stack.
            const db = getDb();
            const now = new Date();

            // Query expired add-ons
            const expiredPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.status, 'active'),
                        isNotNull(billingAddonPurchases.expiresAt),
                        lte(billingAddonPurchases.expiresAt, now),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                );

            // Map to ExpiredAddon format
            const expiredAddons: ExpiredAddon[] = expiredPurchases.map((purchase) => {
                // expiresAt is guaranteed non-null due to isNotNull check in query
                const expiresAt = purchase.expiresAt ?? new Date();

                return {
                    id: purchase.id,
                    customerId: purchase.customerId,
                    subscriptionId: purchase.subscriptionId,
                    addonSlug: purchase.addonSlug,
                    purchasedAt: purchase.purchasedAt,
                    expiresAt,
                    limitAdjustments:
                        (purchase.limitAdjustments as Array<{
                            limitKey: string;
                            increase: number;
                            previousValue: number;
                            newValue: number;
                        }>) || [],
                    entitlementAdjustments:
                        (purchase.entitlementAdjustments as Array<{
                            entitlementKey: string;
                            granted: boolean;
                        }>) || []
                };
            });

            apiLogger.info(
                {
                    count: expiredAddons.length,
                    timestamp: now.toISOString()
                },
                'Found expired add-ons'
            );

            return {
                success: true,
                data: expiredAddons
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage
                },
                'Failed to find expired add-ons'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to find expired add-ons'
                }
            };
        }
    }

    /**
     * Find expiring add-ons
     *
     * Queries billing_addon_purchases for records where:
     * - status = 'active'
     * - expires_at IS NOT NULL
     * - expires_at > now()
     * - expires_at <= now() + N days
     *
     * Useful for sending notification reminders before expiration.
     *
     * @param input - Configuration with daysAhead
     * @returns List of expiring add-ons or error
     */
    async findExpiringAddons(
        input: FindExpiringAddonsInput
    ): Promise<ServiceResult<ExpiringAddon[]>> {
        const validationResult = daysAheadSchema.safeParse(input.daysAhead);

        if (!validationResult.success) {
            const message = validationResult.error.issues[0]?.message ?? 'Invalid daysAhead value';

            apiLogger.warn(
                { daysAhead: input.daysAhead, reason: message },
                'Invalid daysAhead parameter'
            );

            return {
                success: false,
                error: {
                    code: 'INVALID_INPUT',
                    message
                }
            };
        }

        try {
            // getDb() throws if the database was not initialized before this call.
            const db = getDb();
            const now = new Date();
            const futureDate = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000);

            // Query expiring add-ons
            const expiringPurchases = await db
                .select()
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.status, 'active'),
                        isNotNull(billingAddonPurchases.expiresAt),
                        gte(billingAddonPurchases.expiresAt, now),
                        lte(billingAddonPurchases.expiresAt, futureDate),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                );

            // Map to ExpiringAddon format with daysUntilExpiration calculation
            const expiringAddons: ExpiringAddon[] = expiringPurchases.map((purchase) => {
                // expiresAt is guaranteed non-null due to isNotNull check in query
                const expiresAt = purchase.expiresAt ?? new Date();
                const daysUntilExpiration = Math.ceil(
                    (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
                );

                return {
                    id: purchase.id,
                    customerId: purchase.customerId,
                    subscriptionId: purchase.subscriptionId,
                    addonSlug: purchase.addonSlug,
                    purchasedAt: purchase.purchasedAt,
                    expiresAt,
                    daysUntilExpiration,
                    limitAdjustments:
                        (purchase.limitAdjustments as Array<{
                            limitKey: string;
                            increase: number;
                            previousValue: number;
                            newValue: number;
                        }>) || [],
                    entitlementAdjustments:
                        (purchase.entitlementAdjustments as Array<{
                            entitlementKey: string;
                            granted: boolean;
                        }>) || []
                };
            });

            apiLogger.info(
                {
                    count: expiringAddons.length,
                    daysAhead: input.daysAhead,
                    timestamp: now.toISOString()
                },
                'Found expiring add-ons'
            );

            return {
                success: true,
                data: expiringAddons
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    daysAhead: input.daysAhead
                },
                'Failed to find expiring add-ons'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to find expiring add-ons'
                }
            };
        }
    }

    /**
     * Expire a single add-on purchase
     *
     * This method:
     * 1. Validates the purchase exists and is active
     * 2. Removes entitlements via AddonEntitlementService
     * 3. Updates billing_addon_purchases row: status='expired'
     * 4. Returns the expired add-on info
     *
     * Idempotent: If the add-on is already expired, returns success with details.
     *
     * @param input - Purchase ID to expire
     * @returns Expired add-on details or error
     */
    async expireAddon(input: ExpireAddonInput): Promise<ServiceResult<ExpireAddonResult>> {
        try {
            // getDb() throws if the database was not initialized before this call.
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

            // Remove entitlements via AddonEntitlementService
            const removeResult = await this.entitlementService.removeAddonEntitlements({
                customerId: purchase.customerId,
                addonSlug: purchase.addonSlug,
                purchaseId: purchase.id
            });

            if (!removeResult.success) {
                apiLogger.error(
                    {
                        purchaseId: input.purchaseId,
                        customerId: purchase.customerId,
                        addonSlug: purchase.addonSlug,
                        error: removeResult.error
                    },
                    'Failed to remove entitlements when expiring add-on'
                );

                return {
                    success: false,
                    error: {
                        code: 'ENTITLEMENT_REMOVAL_FAILED',
                        message: 'Failed to remove add-on entitlements'
                    }
                };
            }

            // Update billing_addon_purchases row: status='expired'
            const now = new Date();
            await db
                .update(billingAddonPurchases)
                .set({
                    status: 'expired',
                    updatedAt: now
                })
                .where(eq(billingAddonPurchases.id, input.purchaseId));

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
                {
                    error: errorMessage,
                    purchaseId: input.purchaseId
                },
                'Failed to expire add-on purchase'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to expire add-on purchase'
                }
            };
        }
    }

    /**
     * Process all expired add-ons in a batch
     *
     * This method:
     * 1. Calls findExpiredAddons() to get all expired add-ons
     * 2. For each, calls expireAddon() to process it
     * 3. Processes max 100 add-ons per batch
     * 4. Handles errors gracefully (one failure doesn't stop the batch)
     * 5. Returns count of processed and failed add-ons
     *
     * Idempotent: Already expired add-ons are skipped in findExpiredAddons().
     * Safe for concurrent execution: Each add-on is processed individually with idempotent operations.
     *
     * @returns Processing summary with counts and errors
     */
    async processExpiredAddons(): Promise<ServiceResult<ProcessExpiredAddonsResult>> {
        try {
            // Find all expired add-ons (max 100 for batch limit)
            const findResult = await this.findExpiredAddons();

            if (!findResult.success) {
                return {
                    success: false,
                    error: findResult.error
                };
            }

            const expiredAddons = findResult.data || [];

            // Apply batch limit of 100
            const batchSize = 100;
            const toProcess = expiredAddons.slice(0, batchSize);

            if (toProcess.length === 0) {
                apiLogger.info('No expired add-ons to process');

                return {
                    success: true,
                    data: {
                        processed: 0,
                        failed: 0,
                        errors: []
                    }
                };
            }

            // Log batch info
            apiLogger.info(
                {
                    totalExpired: expiredAddons.length,
                    batchSize: toProcess.length,
                    limitReached: expiredAddons.length > batchSize
                },
                'Starting batch processing of expired add-ons'
            );

            // Process each add-on (error isolation - one failure doesn't stop the batch)
            let processed = 0;
            let failed = 0;
            const errors: Array<{ purchaseId: string; error: string }> = [];

            for (const addon of toProcess) {
                try {
                    const expireResult = await this.expireAddon({ purchaseId: addon.id });

                    if (expireResult.success) {
                        processed++;
                    } else {
                        failed++;
                        errors.push({
                            purchaseId: addon.id,
                            error: expireResult.error?.message || 'Unknown error'
                        });

                        apiLogger.warn(
                            {
                                purchaseId: addon.id,
                                customerId: addon.customerId,
                                addonSlug: addon.addonSlug,
                                error: expireResult.error
                            },
                            'Failed to expire add-on in batch'
                        );
                    }
                } catch (error) {
                    failed++;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    errors.push({
                        purchaseId: addon.id,
                        error: errorMessage
                    });

                    apiLogger.error(
                        {
                            error: errorMessage,
                            purchaseId: addon.id,
                            customerId: addon.customerId,
                            addonSlug: addon.addonSlug
                        },
                        'Exception while expiring add-on in batch'
                    );
                }
            }

            // Log batch summary
            apiLogger.info(
                {
                    total: toProcess.length,
                    processed,
                    failed,
                    errorCount: errors.length
                },
                'Completed batch processing of expired add-ons'
            );

            return {
                success: true,
                data: {
                    processed,
                    failed,
                    errors
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage
                },
                'Failed to process expired add-ons batch'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to process expired add-ons'
                }
            };
        }
    }
}
