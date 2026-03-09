/**
 * Usage Tracking Service
 *
 * Tracks resource usage against plan limits for the Hospeda billing system.
 * Combines plan limits with add-on adjustments and provides usage statistics
 * with threshold warnings (ok, warning, critical, exceeded).
 *
 * Features:
 * - Get complete usage summary for a customer
 * - Check threshold for specific limits (80%, 90%, 100%)
 * - Get detailed usage for individual limits
 * - Combine plan base limits with add-on bonuses
 *
 * @module services/usage-tracking
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { LIMIT_METADATA, LimitKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import {
    AccommodationService,
    OwnerPromotionService,
    UserBookmarkService
} from '@repo/service-core';
import { createSystemActor } from '../utils/actor';
import { lookupCustomerDetails } from '../utils/customer-lookup';
import { apiLogger } from '../utils/logger';

/**
 * Service result pattern
 */
export interface ServiceResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Threshold status levels based on usage percentage
 */
export type UsageThreshold = 'ok' | 'warning' | 'critical' | 'exceeded';

/**
 * Usage information for a single limit
 */
export interface LimitUsage {
    /** The limit key identifier */
    limitKey: string;
    /** Human-readable name in Spanish */
    displayName: string;
    /** Current usage count */
    currentUsage: number;
    /** Maximum allowed by plan + add-ons */
    maxAllowed: number;
    /** Usage percentage (0-100) */
    usagePercentage: number;
    /** Threshold status based on usage percentage */
    threshold: UsageThreshold;
    /** Base limit from plan (before add-ons) */
    planBaseLimit: number;
    /** Additional limit from add-ons */
    addonBonusLimit: number;
}

/**
 * Complete usage summary for a customer
 */
export interface UsageSummary {
    /** Billing customer ID */
    customerId: string;
    /** Usage details for each limit */
    limits: LimitUsage[];
    /** Worst threshold across all limits */
    overallThreshold: UsageThreshold;
    /** URL to upgrade plan */
    upgradeUrl: string;
}

/**
 * Calculate threshold based on current usage and max allowed
 *
 * @param current - Current usage count
 * @param max - Maximum allowed count
 * @returns Threshold status
 */
function calculateThreshold(current: number, max: number): UsageThreshold {
    // Unlimited or disabled (max = 0 or -1)
    if (max <= 0) {
        return 'ok';
    }

    const percentage = (current / max) * 100;

    if (percentage >= 100) {
        return 'exceeded';
    }
    if (percentage >= 90) {
        return 'critical';
    }
    if (percentage >= 80) {
        return 'warning';
    }

    return 'ok';
}

/**
 * Usage Tracking Service
 *
 * Provides comprehensive usage tracking and limit enforcement analytics.
 */
export class UsageTrackingService {
    constructor(private readonly billing: QZPayBilling | null) {}

    /**
     * Get complete usage summary for a customer
     *
     * Combines plan limits with add-on adjustments and counts current usage
     * for all resources tracked by the billing system.
     *
     * @param customerId - The billing customer ID
     * @returns Usage summary with all limits and thresholds
     */
    async getUsageSummary(customerId: string): Promise<ServiceResult<UsageSummary>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.SERVICE_UNAVAILABLE,
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            // Get customer's active subscription
            const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (!subscriptions || subscriptions.length === 0) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Customer has no subscription'
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
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Customer has no active subscription'
                    }
                };
            }

            // Get the plan
            const plan = await this.billing.plans.get(activeSubscription.planId);

            if (!plan) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Subscription plan not found'
                    }
                };
            }

            // Extract base limits from plan
            const planLimits = plan.limits || {};

            // Get add-on adjustments from subscription metadata
            const addonAdjustments = this.getAddonAdjustments(activeSubscription);

            // Build limit usage list
            const limitUsageList: LimitUsage[] = [];

            // Process each limit key
            for (const limitKey of Object.values(LimitKey)) {
                const planBaseLimit = planLimits[limitKey] || 0;

                // Calculate add-on bonus
                const addonBonusLimit = addonAdjustments
                    .filter((adj) => adj.limitKey === limitKey)
                    .reduce((sum, adj) => sum + (adj.limitIncrease || 0), 0);

                const maxAllowed = planBaseLimit + addonBonusLimit;

                // Get current usage for this limit
                const currentUsage = await this.getCurrentUsage(limitKey, customerId);

                // Calculate usage percentage
                const usagePercentage = maxAllowed > 0 ? (currentUsage / maxAllowed) * 100 : 0;

                // Get display name from metadata
                const displayName = LIMIT_METADATA[limitKey]?.name || limitKey;

                // Calculate threshold
                const threshold = calculateThreshold(currentUsage, maxAllowed);

                limitUsageList.push({
                    limitKey,
                    displayName,
                    currentUsage,
                    maxAllowed,
                    usagePercentage: Math.round(usagePercentage * 100) / 100,
                    threshold,
                    planBaseLimit,
                    addonBonusLimit
                });
            }

            // Determine overall threshold (worst case)
            const overallThreshold = this.determineOverallThreshold(
                limitUsageList.map((l) => l.threshold)
            );

            const summary: UsageSummary = {
                customerId,
                limits: limitUsageList,
                overallThreshold,
                upgradeUrl: '/billing/plans'
            };

            apiLogger.debug(
                'Usage summary generated',
                JSON.stringify({
                    customerId,
                    overallThreshold,
                    limitCount: limitUsageList.length
                })
            );

            return {
                success: true,
                data: summary
            };
        } catch (error) {
            apiLogger.error(
                'Failed to get usage summary',
                error instanceof Error ? error.message : String(error)
            );
            const errorMessage =
                process.env.HOSPEDA_API_DEBUG_ERRORS === 'true'
                    ? `Failed to get usage summary: ${error instanceof Error ? error.message : 'Unknown error'}`
                    : 'Failed to get usage summary';
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: errorMessage
                }
            };
        }
    }

    /**
     * Check usage threshold for a specific limit
     *
     * Returns the threshold status (ok, warning, critical, exceeded) for a single limit.
     *
     * @param customerId - The billing customer ID
     * @param limitKey - The limit key to check
     * @returns Threshold status
     */
    async checkUsageThreshold(
        customerId: string,
        limitKey: string
    ): Promise<ServiceResult<UsageThreshold>> {
        try {
            const usageResult = await this.getUsageForLimit(customerId, limitKey);

            if (!usageResult.success || !usageResult.data) {
                return {
                    success: false,
                    error: usageResult.error || {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: 'Limit usage not found'
                    }
                };
            }

            return {
                success: true,
                data: usageResult.data.threshold
            };
        } catch (error) {
            apiLogger.error(
                'Failed to check usage threshold',
                error instanceof Error ? error.message : String(error)
            );
            const errorMessage =
                process.env.HOSPEDA_API_DEBUG_ERRORS === 'true'
                    ? `Failed to check usage threshold: ${error instanceof Error ? error.message : 'Unknown error'}`
                    : 'Failed to check usage threshold';
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: errorMessage
                }
            };
        }
    }

    /**
     * Get detailed usage for one specific limit
     *
     * Includes breakdown of plan base vs add-on bonus limits.
     *
     * @param customerId - The billing customer ID
     * @param limitKey - The limit key to check
     * @returns Detailed limit usage or null if not found
     */
    async getUsageForLimit(
        customerId: string,
        limitKey: string
    ): Promise<ServiceResult<LimitUsage | null>> {
        if (!this.billing) {
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.SERVICE_UNAVAILABLE,
                    message: 'Billing service is not configured'
                }
            };
        }

        try {
            // Get customer's active subscription
            const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (!subscriptions || subscriptions.length === 0) {
                return {
                    success: true,
                    data: null
                };
            }

            const activeSubscription = subscriptions.find(
                (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (!activeSubscription) {
                return {
                    success: true,
                    data: null
                };
            }

            // Get the plan
            const plan = await this.billing.plans.get(activeSubscription.planId);

            if (!plan) {
                return {
                    success: true,
                    data: null
                };
            }

            // Get base limit from plan
            const planLimits = plan.limits || {};
            const planBaseLimit = planLimits[limitKey] || 0;

            // Get add-on adjustments
            const addonAdjustments = this.getAddonAdjustments(activeSubscription);
            const addonBonusLimit = addonAdjustments
                .filter((adj) => adj.limitKey === limitKey)
                .reduce((sum, adj) => sum + (adj.limitIncrease || 0), 0);

            const maxAllowed = planBaseLimit + addonBonusLimit;

            // Get current usage
            const currentUsage = await this.getCurrentUsage(limitKey, customerId);

            // Calculate usage percentage
            const usagePercentage = maxAllowed > 0 ? (currentUsage / maxAllowed) * 100 : 0;

            // Get display name
            const displayName = LIMIT_METADATA[limitKey as LimitKey]?.name || limitKey;

            // Calculate threshold
            const threshold = calculateThreshold(currentUsage, maxAllowed);

            const limitUsage: LimitUsage = {
                limitKey,
                displayName,
                currentUsage,
                maxAllowed,
                usagePercentage: Math.round(usagePercentage * 100) / 100,
                threshold,
                planBaseLimit,
                addonBonusLimit
            };

            apiLogger.debug(
                'Limit usage retrieved',
                JSON.stringify({ customerId, limitKey, threshold })
            );

            return {
                success: true,
                data: limitUsage
            };
        } catch (error) {
            apiLogger.error(
                'Failed to get usage for limit',
                error instanceof Error ? error.message : String(error)
            );
            const errorMessage =
                process.env.HOSPEDA_API_DEBUG_ERRORS === 'true'
                    ? `Failed to get limit usage: ${error instanceof Error ? error.message : 'Unknown error'}`
                    : 'Failed to get limit usage';
            return {
                success: false,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: errorMessage
                }
            };
        }
    }

    /**
     * Get current usage count for a specific limit
     *
     * Queries the database to count actual resource usage.
     * Maps billing customerId to userId via customer metadata.
     *
     * @param limitKey - The limit key to count
     * @param customerId - The billing customer ID
     * @returns Current usage count
     */
    private async getCurrentUsage(limitKey: string, customerId: string): Promise<number> {
        try {
            // Resolve userId from billing customerId
            const userId = await this.resolveUserId(customerId);

            if (!userId) {
                apiLogger.warn(
                    'Cannot resolve userId for usage counting',
                    JSON.stringify({ customerId, limitKey })
                );
                return 0;
            }

            const systemActor = createSystemActor();
            // Override actor.id with the real userId for ownership queries
            const actor = { ...systemActor, id: userId };

            switch (limitKey) {
                case LimitKey.MAX_ACCOMMODATIONS: {
                    const accommodationService = new AccommodationService({ logger: apiLogger });
                    const result = await accommodationService.count(actor, {
                        ownerId: userId
                    } as never);
                    return result.data?.count || 0;
                }

                case LimitKey.MAX_PHOTOS_PER_ACCOMMODATION: {
                    // Per-accommodation limit, checked in middleware per request
                    return 0;
                }

                case LimitKey.MAX_ACTIVE_PROMOTIONS: {
                    const promotionService = new OwnerPromotionService({ logger: apiLogger });
                    const result = await promotionService.count(actor, {
                        isActive: true,
                        ownerId: userId
                    } as never);
                    return result.data?.count || 0;
                }

                case LimitKey.MAX_FAVORITES: {
                    const bookmarkService = new UserBookmarkService({ logger: apiLogger });
                    const result = await bookmarkService.countBookmarksForUser(actor, {
                        userId
                    });
                    return result.data?.count || 0;
                }

                case LimitKey.MAX_PROPERTIES: {
                    // Blocked: complex/property table not yet created
                    return 0;
                }

                case LimitKey.MAX_STAFF_ACCOUNTS: {
                    // Blocked: staff management table not yet created
                    return 0;
                }

                default:
                    return 0;
            }
        } catch (error) {
            apiLogger.error(
                'Failed to get current usage',
                JSON.stringify({
                    limitKey,
                    customerId,
                    error: error instanceof Error ? error.message : String(error)
                })
            );
            return 0;
        }
    }

    /**
     * Resolve billing customerId to application userId
     *
     * Uses customer metadata from QZPay billing to find the associated userId.
     * Results are cached per-instance to avoid repeated lookups within a single
     * usage summary request.
     *
     * @param customerId - The billing customer ID
     * @returns The application userId or null if not found
     */
    private userIdCache = new Map<string, string | null>();

    private async resolveUserId(customerId: string): Promise<string | null> {
        if (this.userIdCache.has(customerId)) {
            return this.userIdCache.get(customerId) || null;
        }

        if (!this.billing) {
            return null;
        }

        const details = await lookupCustomerDetails(this.billing, customerId);
        const userId = details?.userId || null;

        this.userIdCache.set(customerId, userId);
        return userId;
    }

    /**
     * Get add-on adjustments from subscription metadata
     *
     * @param subscription - The subscription object
     * @returns Array of add-on adjustments
     */
    private getAddonAdjustments(subscription: {
        metadata?: Record<string, unknown>;
    }): Array<{
        addonSlug: string;
        entitlement?: string;
        limitKey?: string;
        limitIncrease?: number;
        appliedAt: string;
    }> {
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
     * Determine overall threshold from list of thresholds
     *
     * Returns the worst threshold (highest severity).
     *
     * @param thresholds - List of threshold statuses
     * @returns Overall threshold (worst case)
     */
    private determineOverallThreshold(thresholds: UsageThreshold[]): UsageThreshold {
        // Priority: exceeded > critical > warning > ok
        if (thresholds.includes('exceeded')) {
            return 'exceeded';
        }
        if (thresholds.includes('critical')) {
            return 'critical';
        }
        if (thresholds.includes('warning')) {
            return 'warning';
        }
        return 'ok';
    }
}
