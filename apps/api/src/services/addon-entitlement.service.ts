/**
 * Add-on Entitlement Service
 *
 * Handles the application and removal of entitlements and limit adjustments
 * when add-ons are purchased or cancelled.
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
import { type EntitlementKey, type LimitKey, getAddonBySlug } from '@repo/billing';
import { getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';

/**
 * Result wrapper for service methods
 */
interface ServiceResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

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
     * 3. Adds the add-on's entitlements/limits to the subscription
     * 4. Creates a row in billing_addon_purchases table
     * 5. Clears the entitlement cache
     *
     * @param input - Customer ID, add-on slug, and optional payment ID
     * @returns Success or error
     */
    async applyAddonEntitlements(input: {
        customerId: string;
        addonSlug: string;
        paymentId?: string;
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

            // Get the current plan
            const plan = await this.billing.plans.get(activeSubscription.planId);

            if (!plan) {
                return {
                    success: false,
                    error: {
                        code: 'PLAN_NOT_FOUND',
                        message: 'Subscription plan not found'
                    }
                };
            }

            // Prepare updated entitlements and limits
            const updatedEntitlements = new Set<EntitlementKey>(
                (plan.entitlements || []) as EntitlementKey[]
            );
            const updatedLimits = { ...plan.limits };

            // Prepare adjustment tracking
            const limitAdjustments: Array<{
                limitKey: string;
                increase: number;
                previousValue: number;
                newValue: number;
            }> = [];
            const entitlementAdjustments: Array<{
                entitlementKey: string;
                granted: boolean;
            }> = [];

            // Apply add-on adjustments
            if (addon.grantsEntitlement) {
                updatedEntitlements.add(addon.grantsEntitlement);
                entitlementAdjustments.push({
                    entitlementKey: addon.grantsEntitlement,
                    granted: true
                });
                apiLogger.debug(
                    {
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        entitlement: addon.grantsEntitlement
                    },
                    'Adding entitlement from add-on'
                );
            }

            if (addon.affectsLimitKey && addon.limitIncrease) {
                const currentLimit = updatedLimits[addon.affectsLimitKey] || 0;
                const newLimit = currentLimit + addon.limitIncrease;
                updatedLimits[addon.affectsLimitKey] = newLimit;

                limitAdjustments.push({
                    limitKey: addon.affectsLimitKey,
                    increase: addon.limitIncrease,
                    previousValue: currentLimit,
                    newValue: newLimit
                });

                apiLogger.debug(
                    {
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        limitKey: addon.affectsLimitKey,
                        currentLimit,
                        increase: addon.limitIncrease,
                        newLimit
                    },
                    'Increasing limit from add-on'
                );
            }

            // Calculate expiration date (if applicable)
            const now = new Date();
            const expiresAt = addon.durationDays
                ? new Date(now.getTime() + addon.durationDays * 24 * 60 * 60 * 1000)
                : null;

            // Create row in billing_addon_purchases table
            try {
                const db = getDb();
                await db.insert(billingAddonPurchases).values({
                    customerId: input.customerId,
                    subscriptionId: activeSubscription.id,
                    addonSlug: input.addonSlug,
                    status: 'active',
                    purchasedAt: now,
                    expiresAt,
                    paymentId: input.paymentId || null,
                    limitAdjustments,
                    entitlementAdjustments,
                    metadata: {}
                });

                apiLogger.info(
                    {
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        subscriptionId: activeSubscription.id,
                        expiresAt: expiresAt?.toISOString()
                    },
                    'Created billing_addon_purchase record'
                );
            } catch (dbError) {
                // Log error but don't fail the entire operation (backward compatibility)
                apiLogger.error(
                    {
                        error: dbError instanceof Error ? dbError.message : String(dbError),
                        customerId: input.customerId,
                        addonSlug: input.addonSlug
                    },
                    'Failed to create billing_addon_purchase record (continuing with metadata write)'
                );
            }

            // Update the plan with new entitlements/limits
            // Note: This modifies the plan for the subscription, not globally
            await this.billing.plans.update(plan.id, {
                entitlements: Array.from(updatedEntitlements),
                limits: updatedLimits
            });

            // Track the adjustment in subscription metadata (backward compatibility)
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
                success: true
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
     * Remove entitlements and limits when an add-on is cancelled
     *
     * This method:
     * 1. Finds the add-on definition
     * 2. Gets the customer's active subscription
     * 3. Updates billing_addon_purchases table (status='cancelled', cancelled_at=now)
     * 4. Removes the add-on's entitlements/limits from the subscription
     * 5. Clears the entitlement cache
     *
     * @param input - Customer ID and add-on slug
     * @returns Success or error
     */
    async removeAddonEntitlements(input: {
        customerId: string;
        addonSlug: string;
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
                    success: true
                };
            }

            const activeSubscription = subscriptions.find(
                (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (!activeSubscription) {
                // No active subscription - nothing to remove
                return {
                    success: true
                };
            }

            // Get the current plan
            const plan = await this.billing.plans.get(activeSubscription.planId);

            if (!plan) {
                return {
                    success: false,
                    error: {
                        code: 'PLAN_NOT_FOUND',
                        message: 'Subscription plan not found'
                    }
                };
            }

            // Update billing_addon_purchases table: set status='cancelled' and cancelled_at=now
            try {
                const db = getDb();
                const { eq, and } = await import('drizzle-orm');

                const updateResult = await db
                    .update(billingAddonPurchases)
                    .set({
                        status: 'cancelled',
                        cancelledAt: new Date(),
                        updatedAt: new Date()
                    })
                    .where(
                        and(
                            eq(billingAddonPurchases.customerId, input.customerId),
                            eq(billingAddonPurchases.addonSlug, input.addonSlug),
                            eq(billingAddonPurchases.status, 'active')
                        )
                    );

                if (!updateResult || (updateResult as { rowCount?: number }).rowCount === 0) {
                    // No active row found in table (might be pre-migration data)
                    apiLogger.warn(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug
                        },
                        'No active billing_addon_purchase record found to cancel (might be pre-migration data, continuing with metadata cleanup)'
                    );
                } else {
                    apiLogger.info(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            subscriptionId: activeSubscription.id
                        },
                        'Cancelled billing_addon_purchase record'
                    );
                }
            } catch (dbError) {
                // Log error but don't fail the entire operation (backward compatibility)
                apiLogger.error(
                    {
                        error: dbError instanceof Error ? dbError.message : String(dbError),
                        customerId: input.customerId,
                        addonSlug: input.addonSlug
                    },
                    'Failed to cancel billing_addon_purchase record (continuing with metadata cleanup)'
                );
            }

            // Prepare updated entitlements and limits
            const updatedEntitlements = new Set<EntitlementKey>(
                (plan.entitlements || []) as EntitlementKey[]
            );
            const updatedLimits = { ...plan.limits };

            // Remove add-on adjustments
            if (addon.grantsEntitlement) {
                updatedEntitlements.delete(addon.grantsEntitlement);
                apiLogger.debug(
                    {
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        entitlement: addon.grantsEntitlement
                    },
                    'Removing entitlement from add-on'
                );
            }

            if (addon.affectsLimitKey && addon.limitIncrease) {
                const currentLimit = updatedLimits[addon.affectsLimitKey] || 0;
                updatedLimits[addon.affectsLimitKey] = Math.max(
                    0,
                    currentLimit - addon.limitIncrease
                );
                apiLogger.debug(
                    {
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        limitKey: addon.affectsLimitKey,
                        currentLimit,
                        decrease: addon.limitIncrease,
                        newLimit: updatedLimits[addon.affectsLimitKey]
                    },
                    'Decreasing limit from add-on cancellation'
                );
            }

            // Update the plan with new entitlements/limits
            await this.billing.plans.update(plan.id, {
                entitlements: Array.from(updatedEntitlements),
                limits: updatedLimits
            });

            // Remove the adjustment from subscription metadata (backward compatibility)
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
                success: true
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
                const { eq, and } = await import('drizzle-orm');

                const addonPurchases = await db
                    .select()
                    .from(billingAddonPurchases)
                    .where(
                        and(
                            eq(billingAddonPurchases.customerId, customerId),
                            eq(billingAddonPurchases.status, 'active')
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
                            .entitlementKey as EntitlementKey;
                    }

                    // Extract limit from limitAdjustments
                    let limitKey: LimitKey | undefined;
                    let limitIncrease: number | undefined;
                    if (
                        purchase.limitAdjustments &&
                        Array.isArray(purchase.limitAdjustments) &&
                        purchase.limitAdjustments.length > 0
                    ) {
                        limitKey = purchase.limitAdjustments[0].limitKey as LimitKey;
                        limitIncrease = purchase.limitAdjustments[0].increase;
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
