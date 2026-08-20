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
import { getMonthlyCallCount } from '@repo/ai-core';
import { isLimitKey, LIMIT_METADATA, LimitKey } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { accommodationMediaModel, accommodationModel, getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import { LifecycleStatusEnum, ServiceErrorCode } from '@repo/schemas';
import type { AccommodationPhotoUsage } from '@repo/service-core';
import {
    AccommodationService,
    AlertSubscriptionService,
    calculateThreshold,
    determineOverallThreshold,
    type LimitUsage,
    OwnerPromotionService,
    SearchHistoryService,
    type ServiceResult,
    subscriptionMatchesDomain,
    type UsageSummary,
    type UsageThreshold,
    UserBookmarkCollectionService,
    UserBookmarkService
} from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import type { ProductDomainScope } from '../schemas/product-domain-query.schema';
import { createSystemActor } from '../utils/actor';
import { lookupCustomerDetails } from '../utils/customer-lookup';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

export type { LimitUsage, ServiceResult, UsageSummary, UsageThreshold };

/**
 * How many of an owner's accommodations the photo breakdown covers.
 *
 * `BaseModelImpl` caps a page at 200 rows, and no owner plan (or stack of
 * add-ons) comes close to that many accommodations — an owner beyond it gets
 * the first page, which is still every listing that matters for "which one is
 * nearly full".
 */
const ACCOMMODATION_BREAKDOWN_PAGE_SIZE = 200;

/**
 * Maps a `LimitKey` to the `ai_usage.feature` its consumption is recorded
 * under, so the monthly AI meters can be counted with the very same helper the
 * quota middleware enforces with (`getMonthlyCallCount`).
 *
 * Mirrors `AI_LIMIT_BY_FEATURE` (`middlewares/ai-quota.ts`) inverted, plus the
 * consumer-side chat limit that has no entry there.
 *
 * **Known limitation carried from the enforcement side** (SPEC-283, documented
 * in `routes/ai/protected/chat.ts`): owner-side and consumer-side chat both
 * meter under `feature='chat'`, so both limits report the same number for a
 * user who is on both sides of a conversation. Reporting inherits the quirk
 * rather than inventing a different one — the figure shown is exactly the
 * figure enforced.
 */
const AI_FEATURE_BY_LIMIT_KEY: Readonly<Record<string, string | undefined>> = {
    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: 'text_improve',
    [LimitKey.MAX_AI_CHAT_PER_MONTH]: 'chat',
    [LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH]: 'chat',
    [LimitKey.MAX_AI_SEARCH_PER_MONTH]: 'search',
    [LimitKey.MAX_AI_SUPPORT_PER_MONTH]: 'support',
    [LimitKey.MAX_AI_TRANSLATE_PER_MONTH]: 'translate',
    [LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH]: 'accommodation_import'
};

/**
 * How a limit's consumption behaves, which decides whether `currentUsage`
 * means anything and how a consumer should present it.
 *
 * - `stock` — a quantity the account currently holds (accommodations,
 *   collections, active alerts). Counted, cumulative, no reset.
 * - `monthly` — calls consumed this UTC calendar month (the AI meters).
 *   Counted, resets on the 1st.
 * - `per_accommodation` — a cap applied to each accommodation separately
 *   (photos). There is no single account-wide figure; `currentUsage` stays 0
 *   and the real numbers travel in `perAccommodation`.
 * - `per_operation` — a cap on ONE request rather than a stored quantity
 *   (compare items: the endpoint bounds an `ids[]` array). Nothing is
 *   persisted, so no consumption exists to report.
 * - `unbuilt` — the plan grants it but the feature does not exist yet
 *   (properties, staff accounts: no table, no UI). Not countable, and not
 *   something to advertise.
 */
export const UsageKind = {
    STOCK: 'stock',
    MONTHLY: 'monthly',
    PER_ACCOMMODATION: 'per_accommodation',
    PER_OPERATION: 'per_operation',
    UNBUILT: 'unbuilt'
} as const;

export type UsageKindValue = (typeof UsageKind)[keyof typeof UsageKind];

/**
 * The nature of every `LimitKey`.
 *
 * Exhaustive by construction: `usageKindForLimit` falls back to `MONTHLY` only
 * for keys present in {@link AI_FEATURE_BY_LIMIT_KEY}, and the guard test
 * cross-checks this table against the `switch` in `getCurrentUsage` so a new
 * key cannot be added on one side alone.
 */
const USAGE_KIND_BY_LIMIT_KEY: Readonly<Record<string, UsageKindValue>> = {
    [LimitKey.MAX_ACCOMMODATIONS]: UsageKind.STOCK,
    [LimitKey.MAX_ACTIVE_PROMOTIONS]: UsageKind.STOCK,
    [LimitKey.MAX_FAVORITES]: UsageKind.STOCK,
    [LimitKey.MAX_ACTIVE_ALERTS]: UsageKind.STOCK,
    [LimitKey.MAX_COLLECTIONS]: UsageKind.STOCK,
    [LimitKey.MAX_SEARCH_HISTORY_ENTRIES]: UsageKind.STOCK,
    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: UsageKind.PER_ACCOMMODATION,
    [LimitKey.MAX_COMPARE_ITEMS]: UsageKind.PER_OPERATION,
    [LimitKey.MAX_PROPERTIES]: UsageKind.UNBUILT,
    [LimitKey.MAX_STAFF_ACCOUNTS]: UsageKind.UNBUILT,
    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: UsageKind.MONTHLY,
    [LimitKey.MAX_AI_CHAT_PER_MONTH]: UsageKind.MONTHLY,
    [LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH]: UsageKind.MONTHLY,
    [LimitKey.MAX_AI_SEARCH_PER_MONTH]: UsageKind.MONTHLY,
    [LimitKey.MAX_AI_SUPPORT_PER_MONTH]: UsageKind.MONTHLY,
    [LimitKey.MAX_AI_TRANSLATE_PER_MONTH]: UsageKind.MONTHLY,
    [LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH]: UsageKind.MONTHLY
};

/**
 * Resolves a limit's {@link UsageKind}.
 *
 * Unknown keys fall back to `UNBUILT` rather than to a counted kind: a limit
 * nobody classified has no counter either, and treating it as measured would
 * publish a placeholder zero as fact.
 *
 * @param limitKey - The limit key to classify.
 * @returns Its usage kind.
 */
function usageKindForLimit(limitKey: string): UsageKindValue {
    return USAGE_KIND_BY_LIMIT_KEY[limitKey] ?? UsageKind.UNBUILT;
}

/**
 * Whether `currentUsage` is a genuine measurement for this limit.
 *
 * Only `stock` and `monthly` kinds are counted account-wide. The others report
 * a structural `0` that must never be displayed as consumption — see
 * {@link UsageKind}.
 *
 * @param limitKey - The limit key to check.
 * @returns `true` when the reported `currentUsage` is real.
 */
function isMeasuredLimit(limitKey: string): boolean {
    const kind = usageKindForLimit(limitKey);
    return kind === UsageKind.STOCK || kind === UsageKind.MONTHLY;
}

/**
 * Picks the subscription whose usage should be reported, scoped to one
 * product domain.
 *
 * A billing customer can hold BOTH an accommodation subscription and a
 * commerce one (SPEC-239 / HOS-259). Before this scoping, both usage methods
 * took the first `active`/`trialing` row `getByCustomerId()` returned, so a
 * dual-role owner asking for their commerce usage could be shown the limits
 * of their accommodation plan — wrong numbers, with no signal that they were
 * wrong.
 *
 * `subscriptionMatchesDomain` comes from `@repo/service-core` and carries the
 * asymmetry each domain needs: accommodation fails OPEN (a `null`/absent
 * `productDomain` is a legacy row and counts as accommodation), every other
 * domain fails CLOSED. Since HOS-685 a commerce-scoped read matches any
 * commerce vertical, while a vertical-scoped read matches only itself.
 *
 * @param input.subscriptions - Rows as returned by `subscriptions.getByCustomerId()`.
 * @param input.productDomain - Domain to scope to; defaults to `'accommodation'`.
 * @returns The matching subscription, or `undefined` when the customer has none in that domain.
 */
function findActiveSubscriptionForDomain<T extends { status: string }>(input: {
    subscriptions: readonly T[];
    productDomain: ProductDomainScope;
}): T | undefined {
    return input.subscriptions.find(
        (sub) =>
            (sub.status === 'active' || sub.status === 'trialing') &&
            subscriptionMatchesDomain(sub, input.productDomain)
    );
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
     * @param productDomain - Which domain's subscription to report on (defaults to `'accommodation'`)
     * @returns Usage summary with all limits and thresholds
     */
    async getUsageSummary(
        customerId: string,
        productDomain: ProductDomainScope = 'accommodation'
    ): Promise<ServiceResult<UsageSummary>> {
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

            const activeSubscription = findActiveSubscriptionForDomain({
                subscriptions,
                productDomain
            });

            if (!activeSubscription) {
                return {
                    success: false,
                    error: {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: `Customer has no active ${productDomain} subscription`
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

            // Get add-on adjustments from billing_addon_purchases table (or metadata fallback)
            const addonAdjustments = await this.getAddonAdjustments(activeSubscription);

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
                const threshold = calculateThreshold({ current: currentUsage, max: maxAllowed });

                const usageKind = usageKindForLimit(limitKey);

                limitUsageList.push({
                    limitKey,
                    displayName,
                    currentUsage,
                    maxAllowed,
                    usagePercentage: Math.round(usagePercentage * 100) / 100,
                    threshold,
                    planBaseLimit,
                    addonBonusLimit,
                    isMeasured: isMeasuredLimit(limitKey),
                    usageKind,
                    // Per-accommodation caps have no single account-wide figure;
                    // the real numbers are one per accommodation.
                    perAccommodation:
                        usageKind === UsageKind.PER_ACCOMMODATION
                            ? await this.getPerAccommodationUsage(customerId)
                            : undefined
                });
            }

            // Determine overall threshold (worst case)
            const overallThreshold = determineOverallThreshold({
                thresholds: limitUsageList.map((l) => l.threshold)
            });

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
            const errorMessage = env.HOSPEDA_API_DEBUG_ERRORS
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
     * @param productDomain - Which domain's subscription to report on (defaults to `'accommodation'`)
     * @returns Threshold status
     */
    async checkUsageThreshold(
        customerId: string,
        limitKey: string,
        productDomain: ProductDomainScope = 'accommodation'
    ): Promise<ServiceResult<UsageThreshold>> {
        try {
            const usageResult = await this.getUsageForLimit(customerId, limitKey, productDomain);

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
            const errorMessage = env.HOSPEDA_API_DEBUG_ERRORS
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
     * @param productDomain - Which domain's subscription to report on (defaults to `'accommodation'`)
     * @returns Detailed limit usage or null if not found
     */
    async getUsageForLimit(
        customerId: string,
        limitKey: string,
        productDomain: ProductDomainScope = 'accommodation'
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

            const activeSubscription = findActiveSubscriptionForDomain({
                subscriptions,
                productDomain
            });

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

            // Get add-on adjustments from billing_addon_purchases table (or metadata fallback)
            const addonAdjustments = await this.getAddonAdjustments(activeSubscription);
            const addonBonusLimit = addonAdjustments
                .filter((adj) => adj.limitKey === limitKey)
                .reduce((sum, adj) => sum + (adj.limitIncrease || 0), 0);

            const maxAllowed = planBaseLimit + addonBonusLimit;

            // Get current usage
            const currentUsage = await this.getCurrentUsage(limitKey, customerId);

            // Calculate usage percentage
            const usagePercentage = maxAllowed > 0 ? (currentUsage / maxAllowed) * 100 : 0;

            // Get display name. limitKey is typed as string (public API accepts any key);
            // guard before indexing LIMIT_METADATA so unknown keys fall back to the raw string.
            const displayName = isLimitKey(limitKey) ? LIMIT_METADATA[limitKey].name : limitKey;

            // Calculate threshold
            const threshold = calculateThreshold({ current: currentUsage, max: maxAllowed });

            const usageKind = usageKindForLimit(limitKey);

            const limitUsage: LimitUsage = {
                limitKey,
                displayName,
                currentUsage,
                maxAllowed,
                usagePercentage: Math.round(usagePercentage * 100) / 100,
                threshold,
                planBaseLimit,
                addonBonusLimit,
                isMeasured: isMeasuredLimit(limitKey),
                usageKind,
                perAccommodation:
                    usageKind === UsageKind.PER_ACCOMMODATION
                        ? await this.getPerAccommodationUsage(customerId)
                        : undefined
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
            const errorMessage = env.HOSPEDA_API_DEBUG_ERRORS
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
     * Per-request memo for the photo breakdown.
     *
     * `getUsageSummary` iterates every `LimitKey`, so without this the
     * breakdown would be rebuilt for each per-accommodation limit. Scoped to
     * the service instance, which the routes create per request — same
     * lifetime as {@link userIdCache}.
     */
    private perAccommodationCache = new Map<
        string,
        readonly AccommodationPhotoUsage[] | undefined
    >();

    /**
     * Builds the per-accommodation photo counts for an owner.
     *
     * `MAX_PHOTOS_PER_ACCOMMODATION` caps each accommodation separately, so
     * there is no account-wide total to report — the honest answer is one
     * figure per accommodation, which is also what the owner needs in order to
     * know WHICH listing is close to full.
     *
     * Media is read with the batched `findByAccommodations` (a single grouped
     * query) rather than one call per accommodation.
     *
     * @param customerId - The billing customer ID.
     * @returns One entry per accommodation the owner holds; empty when they have none.
     */
    private async getPerAccommodationUsage(
        customerId: string
    ): Promise<readonly AccommodationPhotoUsage[] | undefined> {
        if (this.perAccommodationCache.has(customerId)) {
            return this.perAccommodationCache.get(customerId);
        }

        try {
            const userId = await this.resolveUserId(customerId);

            if (!userId) {
                this.perAccommodationCache.set(customerId, []);
                return [];
            }

            // Read the owner's accommodations straight from the model rather
            // than through `AccommodationService.search`: the standard search
            // schema has NO `ownerId` filter, so passing one is silently
            // dropped and the query answers for the whole catalogue.
            const { items } = await accommodationModel.findAll(
                { ownerId: userId },
                { page: 1, pageSize: ACCOMMODATION_BREAKDOWN_PAGE_SIZE }
            );

            if (items.length === 0) {
                this.perAccommodationCache.set(customerId, []);
                return [];
            }

            const mediaByAccommodation = await accommodationMediaModel.findByAccommodations({
                accommodationIds: items.map((item) => item.id),
                state: 'visible'
            });

            const breakdown: AccommodationPhotoUsage[] = items.map((item) => ({
                accommodationId: item.id,
                name: item.name ?? item.slug ?? item.id,
                slug: item.slug ?? null,
                currentUsage: mediaByAccommodation.get(item.id)?.length ?? 0
            }));

            // Fullest first — the one at risk of rejecting the next upload is
            // the only actionable row.
            breakdown.sort((a, b) => b.currentUsage - a.currentUsage);

            this.perAccommodationCache.set(customerId, breakdown);
            return breakdown;
        } catch (error) {
            apiLogger.error(
                'Failed to build per-accommodation photo usage',
                JSON.stringify({
                    customerId,
                    error: error instanceof Error ? error.message : String(error)
                })
            );
            // `undefined`, NOT `[]`: an empty array is a claim ("you have no
            // accommodations") and a failed read is not entitled to make it.
            // The consumer shows the cap alone when the breakdown is absent.
            this.perAccommodationCache.set(customerId, undefined);
            return undefined;
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
                        lifecycleState: LifecycleStatusEnum.ACTIVE,
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

                case LimitKey.MAX_ACTIVE_ALERTS: {
                    const alertService = new AlertSubscriptionService({ logger: apiLogger });
                    const result = await alertService.countActive(actor);
                    return result.data?.count || 0;
                }

                case LimitKey.MAX_COLLECTIONS: {
                    const collectionService = new UserBookmarkCollectionService({
                        logger: apiLogger
                    });
                    const result = await collectionService.countActiveCollections(actor);
                    return result.data?.count || 0;
                }

                case LimitKey.MAX_SEARCH_HISTORY_ENTRIES: {
                    const searchHistoryService = new SearchHistoryService({ logger: apiLogger });
                    const result = await searchHistoryService.countForActor(actor);
                    return result.data?.count || 0;
                }

                case LimitKey.MAX_COMPARE_ITEMS: {
                    // Per-REQUEST cap, not a stored quantity: the comparison
                    // endpoint takes an `ids[]` body and the limit bounds that
                    // array. Nothing is persisted, so there is no consumption
                    // to report — `usageKindForLimit` marks it PER_OPERATION so
                    // consumers show the cap alone.
                    return 0;
                }

                default: {
                    // The AI meters are the only remaining measured keys: each
                    // maps to an `ai_usage` feature counted per calendar month
                    // by the same helper the quota middleware enforces with.
                    const aiFeature = AI_FEATURE_BY_LIMIT_KEY[limitKey];

                    if (aiFeature) {
                        return await getMonthlyCallCount({
                            userId,
                            feature: aiFeature,
                            now: new Date()
                        });
                    }

                    return 0;
                }
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
     * Get add-on adjustments from the billing_addon_purchases table.
     *
     * Queries active, non-deleted addon purchases for the given customer.
     * Falls back to legacy JSON metadata path when the table query returns
     * no results (for subscriptions not yet migrated).
     *
     * @param subscription - The subscription object (must include customerId)
     * @param tx - Optional transaction client; falls back to getDb() if not provided
     * @returns Array of add-on adjustments
     */
    private async getAddonAdjustments(
        subscription: {
            customerId: string;
            metadata?: Record<string, unknown>;
        },
        tx?: DrizzleClient
    ): Promise<
        Array<{
            addonSlug: string;
            entitlement?: string;
            limitKey?: string;
            limitIncrease?: number;
            appliedAt: string;
        }>
    > {
        // Primary path: query billing_addon_purchases table
        try {
            const db = tx ?? getDb();
            const purchases = await db
                .select({
                    addonSlug: billingAddonPurchases.addonSlug,
                    limitAdjustments: billingAddonPurchases.limitAdjustments,
                    entitlementAdjustments: billingAddonPurchases.entitlementAdjustments,
                    purchasedAt: billingAddonPurchases.purchasedAt
                })
                .from(billingAddonPurchases)
                .where(
                    and(
                        eq(billingAddonPurchases.customerId, subscription.customerId),
                        eq(billingAddonPurchases.status, 'active'),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                );

            if (purchases.length > 0) {
                return purchases.flatMap((purchase) => {
                    const results: Array<{
                        addonSlug: string;
                        entitlement?: string;
                        limitKey?: string;
                        limitIncrease?: number;
                        appliedAt: string;
                    }> = [];

                    const appliedAt = purchase.purchasedAt.toISOString();

                    // Map limit adjustments
                    if (Array.isArray(purchase.limitAdjustments)) {
                        for (const adj of purchase.limitAdjustments) {
                            results.push({
                                addonSlug: purchase.addonSlug,
                                limitKey: adj.limitKey,
                                limitIncrease: adj.increase,
                                appliedAt
                            });
                        }
                    }

                    // Map entitlement adjustments
                    if (Array.isArray(purchase.entitlementAdjustments)) {
                        for (const ent of purchase.entitlementAdjustments) {
                            if (ent.granted) {
                                results.push({
                                    addonSlug: purchase.addonSlug,
                                    entitlement: ent.entitlementKey,
                                    appliedAt
                                });
                            }
                        }
                    }

                    // If no specific adjustments, still include the addon entry
                    if (results.length === 0) {
                        results.push({
                            addonSlug: purchase.addonSlug,
                            appliedAt
                        });
                    }

                    return results;
                });
            }
        } catch (error) {
            apiLogger.warn(
                'Failed to query billing_addon_purchases, falling back to metadata',
                error instanceof Error ? error.message : String(error)
            );
        }

        // DEPRECATED: Fallback to JSON metadata path. Remove once all subscriptions
        // have been migrated to use billing_addon_purchases table as source of truth.
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
}
