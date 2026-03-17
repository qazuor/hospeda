/**
 * Add-on Entitlement Service
 *
 * Handles the application and removal of entitlements and limit adjustments
 * when add-ons are purchased or canceled.
 *
 * Features:
 * - Apply add-on entitlements/limits after purchase
 * - Remove add-on entitlements/limits on cancellation
 * - Track add-on adjustments for proper cleanup
 * - Clear entitlement cache after adjustments
 *
 * @module services/addon-entitlement
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ALL_PLANS, type EntitlementKey, type LimitKey, getAddonBySlug } from '@repo/billing';
import { getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';
import type { ServiceResult } from './addon.types';

/**
 * Add-on entitlement adjustment tracking
 * Stores what entitlements/limits were added by each add-on purchase
 */
interface AddonAdjustment {
    addonSlug: string;
    entitlement?: EntitlementKey;
    limitKey?: LimitKey;
    limitIncrease?: number;
    appliedAt: string;
}

/**
 * Service for managing add-on entitlements and limits
 */
export class AddonEntitlementService {
    constructor(private readonly billing: QZPayBilling | null) {}

    /**
     * Apply entitlements and limits from an add-on purchase
     *
     * This method:
     * 1. Finds the add-on definition
     * 2. Gets the customer's active subscription
     * 3. For entitlement add-ons: calls `billing.entitlements.grant()` with source='addon' and
     *    optional `expiresAt` derived from `addon.durationDays`
     * 4. For limit add-ons: reads the base plan limit from canonical config (`ALL_PLANS`),
     *    computes `newMaxValue = basePlanLimit + addon.limitIncrease`, then calls
     *    `billing.limits.set()`. Skips the call if the base plan limit is -1 (unlimited).
     * 5. Writes add-on adjustment to subscription metadata (backward compat, deprecated)
     * 6. Clears the entitlement cache
     *
     * Note: The billing_addon_purchases INSERT is owned by the checkout flow (caller).
     *
     * **KNOWN LIMITATION — metadata race condition**: Step 5 performs a read-modify-write on
     * `subscription.metadata.addonAdjustments` without any distributed lock. Concurrent addon
     * purchases for the same customer can cause one write to silently overwrite the other,
     * resulting in a lost entry in the JSON array. This is a known, accepted limitation because
     * this metadata path is **deprecated** — the authoritative record of active add-ons is stored
     * in the `billing_addon_purchases` table (one row per purchase, no race). The metadata is
     * retained only for backward compatibility with legacy readers. No fix is required unless
     * the metadata path is reinstated as a primary source of truth.
     *
     * @param input - Customer ID, add-on slug, and purchase ID
     * @returns Success or error
     */
    async applyAddonEntitlements(input: {
        customerId: string;
        addonSlug: string;
        purchaseId: string;
    }): Promise<ServiceResult<void>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            // Get add-on definition
            const addon = getAddonBySlug(input.addonSlug);

            if (!addon) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on '${input.addonSlug}' not found`
                    }
                };
            }

            // Get customer's active subscription
            const subscriptions = await this.billing.subscriptions.getByCustomerId(
                input.customerId
            );

            if (!subscriptions || subscriptions.length === 0) {
                return {
                    success: false,
                    error: {
                        code: 'NO_SUBSCRIPTION',
                        message: 'Customer has no active subscription'
                    }
                };
            }

            const activeSubscription = subscriptions.find(
                (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (!activeSubscription) {
                return {
                    success: false,
                    error: {
                        code: 'NO_ACTIVE_SUBSCRIPTION',
                        message: 'Customer has no active subscription'
                    }
                };
            }

            const now = new Date();

            // Grant entitlement or set limit via QZPay based on add-on type
            if (addon.grantsEntitlement) {
                // Compute optional expiry for one-time add-ons with a duration
                let expiresAt: Date | undefined;

                if (addon.durationDays !== null && addon.durationDays > 0) {
                    expiresAt = new Date(now.getTime() + addon.durationDays * 24 * 60 * 60 * 1000);
                }

                await this.billing.entitlements.grant({
                    customerId: input.customerId,
                    entitlementKey: addon.grantsEntitlement,
                    source: 'addon',
                    sourceId: input.purchaseId,
                    expiresAt
                });

                apiLogger.debug(
                    {
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        entitlement: addon.grantsEntitlement,
                        purchaseId: input.purchaseId,
                        expiresAt
                    },
                    'Granted add-on entitlement via QZPay'
                );
            } else if (addon.affectsLimitKey !== null && addon.limitIncrease !== null) {
                // Resolve base plan limit from canonical config
                const canonicalPlan = ALL_PLANS.find(
                    (plan) => plan.slug === activeSubscription.planId
                );

                const baseLimitDef = canonicalPlan?.limits.find(
                    (lim) => lim.key === addon.affectsLimitKey
                );

                const basePlanLimit = baseLimitDef?.value ?? 0;

                if (basePlanLimit === -1) {
                    // Base plan already has unlimited for this limit; adding more is a no-op
                    apiLogger.warn(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            limitKey: addon.affectsLimitKey,
                            planId: activeSubscription.planId
                        },
                        'Skipping limits.set() for add-on: base plan limit is already unlimited (-1)'
                    );
                } else {
                    const newMaxValue = basePlanLimit + addon.limitIncrease;

                    await this.billing.limits.set({
                        customerId: input.customerId,
                        limitKey: addon.affectsLimitKey,
                        maxValue: newMaxValue,
                        source: 'addon',
                        sourceId: input.purchaseId
                    });

                    apiLogger.debug(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            limitKey: addon.affectsLimitKey,
                            basePlanLimit,
                            limitIncrease: addon.limitIncrease,
                            newMaxValue,
                            purchaseId: input.purchaseId
                        },
                        'Set add-on limit via QZPay'
                    );
                }
            }

            // Track the adjustment in subscription metadata (backward compatibility, deprecated)
            const adjustments = this.getAddonAdjustments(activeSubscription);
            adjustments.push({
                addonSlug: input.addonSlug,
                entitlement: addon.grantsEntitlement || undefined,
                limitKey: addon.affectsLimitKey || undefined,
                limitIncrease: addon.limitIncrease || undefined,
                appliedAt: now.toISOString()
            });

            await this.billing.subscriptions.update(activeSubscription.id, {
                metadata: {
                    ...activeSubscription.metadata,
                    addonAdjustments: JSON.stringify(adjustments)
                }
            });

            // Clear entitlement cache to force refresh
            clearEntitlementCache(input.customerId);

            apiLogger.info(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    subscriptionId: activeSubscription.id
                },
                'Successfully applied add-on entitlements'
            );

            return {
                success: true,
                data: undefined
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    customerId: input.customerId,
                    addonSlug: input.addonSlug
                },
                'Failed to apply add-on entitlements'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to apply add-on entitlements'
                }
            };
        }
    }

    /**
     * Remove entitlements and limits when an add-on is canceled
     *
     * This method:
     * 1. Finds the add-on definition
     * 2. Gets the customer's active subscription
     * 3. Revokes QZPay entitlement or limit for the add-on (with source-based fallback for backward compat)
     * 4. Removes the add-on adjustment from subscription metadata (deprecated, kept for backward compat)
     * 5. Clears the entitlement cache
     *
     * For entitlement add-ons: tries `revokeBySource('addon', purchaseId)` first, falls back to
     * `revoke(customerId, entitlementKey)` for pre-migration data without a sourceId.
     * For limit add-ons: tries `removeBySource('addon', purchaseId)` first, falls back to
     * `remove(customerId, limitKey)` for pre-migration data without a sourceId.
     *
     * QZPay revocation errors are logged as warnings but do not fail the operation, making
     * add-on cancellation resilient to billing service transient failures.
     *
     * Note: The billing_addon_purchases status update is owned by the caller.
     *
     * **KNOWN LIMITATION — metadata race condition**: The metadata cleanup step performs a
     * read-modify-write on `subscription.metadata.addonAdjustments` without any distributed lock.
     * Concurrent cancellations for the same customer can cause one write to overwrite the other.
     * This is accepted because this metadata path is **deprecated** — see `applyAddonEntitlements`
     * for the full explanation.
     *
     * @param input - Customer ID, add-on slug, and purchase ID
     * @returns Success or error
     */
    async removeAddonEntitlements(input: {
        customerId: string;
        addonSlug: string;
        purchaseId: string;
    }): Promise<ServiceResult<void>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            // Get add-on definition
            const addon = getAddonBySlug(input.addonSlug);

            if (!addon) {
                return {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: `Add-on '${input.addonSlug}' not found`
                    }
                };
            }

            // Get customer's active subscription
            const subscriptions = await this.billing.subscriptions.getByCustomerId(
                input.customerId
            );

            if (!subscriptions || subscriptions.length === 0) {
                // No subscription - nothing to remove
                return {
                    success: true,
                    data: undefined
                };
            }

            const activeSubscription = subscriptions.find(
                (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (!activeSubscription) {
                // No active subscription - nothing to remove
                return {
                    success: true,
                    data: undefined
                };
            }

            // Revoke QZPay entitlement or limit for the add-on (resilient: errors are warned, not fatal)
            if (addon.grantsEntitlement) {
                // Entitlement add-on: try source-based revocation first (post-migration data)
                try {
                    const revokedCount = await this.billing.entitlements.revokeBySource(
                        'addon',
                        input.purchaseId
                    );

                    if (revokedCount === 0) {
                        // Fallback for pre-migration data that doesn't have sourceId
                        await this.billing.entitlements.revoke(
                            input.customerId,
                            addon.grantsEntitlement
                        );
                    }

                    apiLogger.debug(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            purchaseId: input.purchaseId,
                            entitlement: addon.grantsEntitlement,
                            revokedCount
                        },
                        'Revoked add-on entitlement'
                    );
                } catch (revokeError) {
                    apiLogger.warn(
                        {
                            error:
                                revokeError instanceof Error
                                    ? revokeError.message
                                    : String(revokeError),
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            purchaseId: input.purchaseId,
                            entitlement: addon.grantsEntitlement
                        },
                        'Failed to revoke add-on entitlement from QZPay (continuing with metadata cleanup)'
                    );
                }
            } else if (addon.affectsLimitKey) {
                // Limit add-on: try source-based removal first (post-migration data)
                try {
                    const removedCount = await this.billing.limits.removeBySource(
                        'addon',
                        input.purchaseId
                    );

                    if (removedCount === 0) {
                        // Fallback for pre-migration data that doesn't have sourceId
                        await this.billing.limits.remove(input.customerId, addon.affectsLimitKey);
                    }

                    apiLogger.debug(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            purchaseId: input.purchaseId,
                            limitKey: addon.affectsLimitKey,
                            removedCount
                        },
                        'Removed add-on limit from QZPay'
                    );
                } catch (removeError) {
                    apiLogger.warn(
                        {
                            error:
                                removeError instanceof Error
                                    ? removeError.message
                                    : String(removeError),
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            purchaseId: input.purchaseId,
                            limitKey: addon.affectsLimitKey
                        },
                        'Failed to remove add-on limit from QZPay (continuing with metadata cleanup)'
                    );
                }
            }

            // Remove the adjustment from subscription metadata (backward compatibility, deprecated)
            const adjustments = this.getAddonAdjustments(activeSubscription).filter(
                (adj) => adj.addonSlug !== input.addonSlug
            );

            await this.billing.subscriptions.update(activeSubscription.id, {
                metadata: {
                    ...activeSubscription.metadata,
                    addonAdjustments: JSON.stringify(adjustments)
                }
            });

            // Clear entitlement cache to force refresh
            clearEntitlementCache(input.customerId);

            apiLogger.info(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    subscriptionId: activeSubscription.id
                },
                'Successfully removed add-on entitlements'
            );

            return {
                success: true,
                data: undefined
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    customerId: input.customerId,
                    addonSlug: input.addonSlug
                },
                'Failed to remove add-on entitlements'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to remove add-on entitlements'
                }
            };
        }
    }

    /**
     * Get add-on adjustments from subscription metadata
     *
     * @param subscription - The subscription object
     * @returns Array of add-on adjustments
     */
    private getAddonAdjustments(subscription: {
        metadata?: Record<string, unknown>;
    }): AddonAdjustment[] {
        if (!subscription.metadata?.addonAdjustments) {
            return [];
        }

        try {
            const adjustments = JSON.parse(subscription.metadata.addonAdjustments as string);
            return Array.isArray(adjustments) ? adjustments : [];
        } catch {
            return [];
        }
    }

    /**
     * Get all add-on adjustments for a customer
     *
     * Queries billing_addon_purchases table first, with fallback to JSON metadata
     * for backward compatibility.
     *
     * Useful for debugging or displaying what add-ons are active.
     *
     * @param customerId - The billing customer ID
     * @returns List of add-on adjustments or error
     */
    async getCustomerAddonAdjustments(
        customerId: string
    ): Promise<ServiceResult<AddonAdjustment[]>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            const adjustmentsFromTable: AddonAdjustment[] = [];

            // Query billing_addon_purchases table for active add-ons
            try {
                const db = getDb();

                const addonPurchases = await db
                    .select()
                    .from(billingAddonPurchases)
                    .where(
                        and(
                            eq(billingAddonPurchases.customerId, customerId),
                            eq(billingAddonPurchases.status, 'active'),
                            isNull(billingAddonPurchases.deletedAt)
                        )
                    );

                // Map table results to AddonAdjustment format
                for (const purchase of addonPurchases) {
                    // Extract entitlement from entitlementAdjustments
                    let entitlement: EntitlementKey | undefined;
                    if (
                        purchase.entitlementAdjustments &&
                        Array.isArray(purchase.entitlementAdjustments) &&
                        purchase.entitlementAdjustments.length > 0
                    ) {
                        entitlement = purchase.entitlementAdjustments[0]
                            ?.entitlementKey as EntitlementKey;
                    }

                    // Extract limit from limitAdjustments
                    let limitKey: LimitKey | undefined;
                    let limitIncrease: number | undefined;
                    if (
                        purchase.limitAdjustments &&
                        Array.isArray(purchase.limitAdjustments) &&
                        purchase.limitAdjustments.length > 0
                    ) {
                        limitKey = purchase.limitAdjustments[0]?.limitKey as LimitKey;
                        limitIncrease = purchase.limitAdjustments[0]?.increase;
                    }

                    adjustmentsFromTable.push({
                        addonSlug: purchase.addonSlug,
                        entitlement,
                        limitKey,
                        limitIncrease,
                        appliedAt: purchase.purchasedAt.toISOString()
                    });
                }

                apiLogger.debug(
                    {
                        customerId,
                        adjustmentsCountFromTable: adjustmentsFromTable.length
                    },
                    'Retrieved add-on adjustments from billing_addon_purchases table'
                );
            } catch (dbError) {
                apiLogger.error(
                    {
                        error: dbError instanceof Error ? dbError.message : String(dbError),
                        customerId
                    },
                    'Failed to query billing_addon_purchases table (continuing with metadata fallback)'
                );
            }

            // Backward compatibility: Also read from JSON metadata as secondary source
            const adjustmentsFromMetadata: AddonAdjustment[] = [];
            const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (subscriptions && subscriptions.length > 0) {
                const activeSubscription = subscriptions.find(
                    (sub: { status: string }) =>
                        sub.status === 'active' || sub.status === 'trialing'
                );

                if (activeSubscription) {
                    const metadataAdjustments = this.getAddonAdjustments(activeSubscription);

                    // Only include adjustments not already in table results
                    for (const adj of metadataAdjustments) {
                        const existsInTable = adjustmentsFromTable.some(
                            (tableAdj) => tableAdj.addonSlug === adj.addonSlug
                        );

                        if (!existsInTable) {
                            adjustmentsFromMetadata.push(adj);
                        }
                    }

                    apiLogger.debug(
                        {
                            customerId,
                            adjustmentsCountFromMetadata: adjustmentsFromMetadata.length
                        },
                        'Retrieved add-on adjustments from subscription metadata'
                    );
                }
            }

            // Merge results (table takes priority)
            const allAdjustments = [...adjustmentsFromTable, ...adjustmentsFromMetadata];

            apiLogger.debug(
                {
                    customerId,
                    totalAdjustments: allAdjustments.length,
                    fromTable: adjustmentsFromTable.length,
                    fromMetadata: adjustmentsFromMetadata.length
                },
                'Retrieved customer add-on adjustments'
            );

            return {
                success: true,
                data: allAdjustments
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage,
                    customerId
                },
                'Failed to get customer add-on adjustments'
            );

            return {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to get add-on adjustments'
                }
            };
        }
    }
}
