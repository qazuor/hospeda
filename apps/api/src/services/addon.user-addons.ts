/**
 * Add-on User Management Module
 *
 * Handles retrieval and cancellation of user-owned add-ons.
 * Queries billing_addon_purchases table as primary source, with fallback
 * to JSON subscription metadata for backward compatibility.
 *
 * @module services/addon.user-addons
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getAddonBySlug } from '@repo/billing';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { apiLogger } from '../utils/logger';
import type { AddonEntitlementService } from './addon-entitlement.service';
import { recalculateAddonLimitsForCustomer } from './addon-limit-recalculation.service';
import type { CancelAddonInput, ServiceResult, UserAddon } from './addon.types';
import { addonAdjustmentsArraySchema } from './addon.types';

/**
 * Zod schema for a single JSONB limit adjustment entry
 */
const LimitAdjustmentEntrySchema = z.object({
    limitKey: z.string(),
    increase: z.number()
});

/**
 * Get a user's active add-ons.
 *
 * Queries `billing_addon_purchases` as primary source, then merges results
 * from JSON metadata in subscription records for backward compatibility.
 * Table entries take priority over metadata entries for the same slug.
 *
 * @param billing - QZPay billing instance
 * @param userId - The user's external ID
 * @returns List of active user add-ons
 *
 * @example
 * ```ts
 * const result = await getUserAddons(billing, 'user_123');
 * if (result.success) {
 *   for (const addon of result.data) {
 *     console.log(addon.addonSlug, addon.status);
 *   }
 * }
 * ```
 */
export async function getUserAddons(
    billing: QZPayBilling,
    userId: string
): Promise<ServiceResult<UserAddon[]>> {
    try {
        const customer = await billing.customers.getByExternalId(userId);

        if (!customer) {
            return { success: true, data: [] };
        }

        const { getDb } = await import('@repo/db/client');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
        const db = getDb();

        const addonPurchases = await db
            .select()
            .from(billingAddonPurchases)
            .where(
                and(
                    eq(billingAddonPurchases.customerId, customer.id),
                    eq(billingAddonPurchases.status, 'active'),
                    isNull(billingAddonPurchases.deletedAt)
                )
            );

        const userAddonsFromTable: UserAddon[] = addonPurchases.map((purchase) => {
            const addonDef = getAddonBySlug(purchase.addonSlug);

            let affectsLimitKey: string | null = null;
            let limitIncrease: number | null = null;

            if (
                purchase.limitAdjustments &&
                Array.isArray(purchase.limitAdjustments) &&
                purchase.limitAdjustments.length > 0
            ) {
                const firstLimit = purchase.limitAdjustments[0];
                const parsed = LimitAdjustmentEntrySchema.safeParse(firstLimit);
                if (parsed.success) {
                    affectsLimitKey = parsed.data.limitKey;
                    limitIncrease = parsed.data.increase;
                } else {
                    apiLogger.warn(
                        {
                            purchaseId: purchase.id,
                            addonSlug: purchase.addonSlug,
                            raw: firstLimit,
                            zodErrors: parsed.error.flatten()
                        },
                        'Invalid limitAdjustment entry in JSONB, skipping'
                    );
                }
            }

            let grantsEntitlement: string | null = null;
            if (
                purchase.entitlementAdjustments &&
                Array.isArray(purchase.entitlementAdjustments) &&
                purchase.entitlementAdjustments.length > 0
            ) {
                const firstEntitlement = purchase.entitlementAdjustments[0];
                grantsEntitlement = firstEntitlement?.entitlementKey ?? null;
            }

            return {
                id: purchase.id,
                addonSlug: purchase.addonSlug,
                addonName: addonDef?.name || purchase.addonSlug,
                billingType: addonDef?.billingType || 'one_time',
                status: purchase.status as 'active' | 'expired' | 'canceled',
                purchasedAt: purchase.purchasedAt.toISOString(),
                expiresAt: purchase.expiresAt ? purchase.expiresAt.toISOString() : null,
                canceledAt: purchase.canceledAt ? purchase.canceledAt.toISOString() : null,
                priceArs: addonDef?.priceArs || 0,
                affectsLimitKey,
                limitIncrease,
                grantsEntitlement
            };
        });

        // Backward compatibility: merge from JSON metadata
        const userAddonsFromMetadata: UserAddon[] = [];
        const subscriptions = await billing.subscriptions.getByCustomerId(customer.id);

        if (subscriptions && subscriptions.length > 0) {
            const activeSubscription = subscriptions.find(
                (sub: { status: string }) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (activeSubscription) {
                const metadata = activeSubscription.metadata as Record<string, unknown> | undefined;
                const adjustmentsJson = metadata?.addonAdjustments as string | undefined;

                if (adjustmentsJson) {
                    try {
                        const parsed = JSON.parse(adjustmentsJson);
                        const validationResult = addonAdjustmentsArraySchema.safeParse(parsed);

                        if (validationResult.success) {
                            for (const adj of validationResult.data) {
                                const existsInTable = userAddonsFromTable.some(
                                    (addon) => addon.addonSlug === adj.addonSlug
                                );

                                if (!existsInTable) {
                                    const addonDef = getAddonBySlug(adj.addonSlug);
                                    userAddonsFromMetadata.push({
                                        id: `${activeSubscription.id}_${adj.addonSlug}`,
                                        addonSlug: adj.addonSlug,
                                        addonName: addonDef?.name || adj.addonSlug,
                                        billingType: addonDef?.billingType || 'one_time',
                                        status: 'active' as const,
                                        purchasedAt: adj.appliedAt,
                                        expiresAt: null,
                                        canceledAt: null,
                                        priceArs: addonDef?.priceArs || 0,
                                        affectsLimitKey: adj.limitKey || null,
                                        limitIncrease: adj.limitIncrease || null,
                                        grantsEntitlement: adj.entitlement || null
                                    });
                                }
                            }
                        } else {
                            apiLogger.warn(
                                {
                                    userId,
                                    customerId: customer.id,
                                    validationErrors: validationResult.error.flatten()
                                },
                                'Addon adjustments JSON failed schema validation, skipping malformed data'
                            );
                        }
                    } catch (error) {
                        apiLogger.error(
                            {
                                error: error instanceof Error ? error.message : String(error),
                                userId,
                                customerId: customer.id
                            },
                            'Failed to parse addon adjustments JSON from metadata'
                        );
                    }
                }
            }
        }

        const allUserAddons = [...userAddonsFromTable, ...userAddonsFromMetadata];

        apiLogger.debug(
            {
                userId,
                customerId: customer.id,
                addonsCountFromTable: userAddonsFromTable.length,
                addonsCountFromMetadata: userAddonsFromMetadata.length,
                totalAddons: allUserAddons.length
            },
            'Retrieved user add-ons from billing_addon_purchases table and metadata'
        );

        return { success: true, data: allUserAddons };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error({ error: errorMessage, userId }, 'Failed to get user add-ons');

        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve user add-ons' }
        };
    }
}

/**
 * Cancel an active add-on for a customer.
 *
 * Looks up the purchase record by `purchaseId` (primary key) to get the real
 * `addonSlug`, updates its status to 'canceled', then removes entitlements
 * from JSON metadata for backward compatibility.
 *
 * The route handler is responsible for verifying ownership before calling this
 * function. The `purchaseId` must belong to the given `customerId` and have
 * status 'active' — the route already enforces this with an atomic DB query.
 *
 * @param billing - QZPay billing instance. Used for limit recalculation when the
 *   cancelled add-on is a limit-type addon (i.e. `addonDef.affectsLimitKey != null`).
 * @param entitlementService - AddonEntitlementService for removing entitlements
 * @param input - Cancellation details (customerId, purchaseId, optional reason)
 * @returns Success or error result
 *
 * @example
 * ```ts
 * const result = await cancelUserAddon(billing, entitlementService, {
 *   customerId: 'cust_123',
 *   purchaseId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
 *   userId: 'user_456',
 *   reason: 'No longer needed',
 * });
 * ```
 */
export async function cancelUserAddon(
    billing: QZPayBilling,
    entitlementService: AddonEntitlementService,
    input: CancelAddonInput
): Promise<ServiceResult<void>> {
    try {
        const { getDb } = await import('@repo/db/client');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
        const db = getDb();

        // Fetch the purchase record by primary key to get the real addonSlug.
        // This avoids the UUID-as-slug bug: we never trust input to carry the slug.
        const [purchase] = await db
            .select({
                id: billingAddonPurchases.id,
                addonSlug: billingAddonPurchases.addonSlug,
                status: billingAddonPurchases.status,
                customerId: billingAddonPurchases.customerId
            })
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
                error: { code: 'NOT_FOUND', message: 'Add-on purchase record not found' }
            };
        }

        if (purchase.customerId !== input.customerId) {
            return {
                success: false,
                error: {
                    code: 'PERMISSION_DENIED',
                    message: 'Add-on purchase does not belong to this customer'
                }
            };
        }

        if (purchase.status !== 'active') {
            return {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Add-on '${purchase.addonSlug}' is not active for this customer`
                }
            };
        }

        const addonSlug = purchase.addonSlug;

        // Update the purchase record by primary key for a precise, atomic update.
        try {
            const updateResult = await db
                .update(billingAddonPurchases)
                .set({
                    status: 'canceled',
                    canceledAt: new Date(),
                    updatedAt: new Date()
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
                        customerId: input.customerId,
                        addonSlug,
                        purchaseId: input.purchaseId,
                        reason: input.reason
                    },
                    'UPDATE affected 0 rows — record may have been concurrently canceled; continuing with entitlement removal'
                );
            } else {
                apiLogger.info(
                    {
                        customerId: input.customerId,
                        addonSlug,
                        purchaseId: input.purchaseId,
                        reason: input.reason
                    },
                    'Canceled billing_addon_purchase record'
                );
            }
        } catch (dbError) {
            apiLogger.error(
                {
                    error: dbError instanceof Error ? dbError.message : String(dbError),
                    customerId: input.customerId,
                    addonSlug,
                    purchaseId: input.purchaseId
                },
                'Failed to cancel billing_addon_purchase record (continuing with entitlement removal)'
            );
        }

        // Remove entitlements from JSON metadata for backward compatibility.
        // Uses the real addonSlug obtained from the purchase record — never from input.
        const result = await entitlementService.removeAddonEntitlements({
            customerId: input.customerId,
            addonSlug,
            purchaseId: input.purchaseId
        });

        if (!result.success) {
            apiLogger.warn(
                {
                    customerId: input.customerId,
                    addonSlug,
                    purchaseId: input.purchaseId,
                    error: result.error
                },
                'Failed to remove add-on from JSON metadata (backward compat), but table update may have succeeded'
            );
        }

        // For limit-type addons, recalculate the aggregated limit so that other
        // active addons for the same limitKey are still accounted for.
        //
        // Background: after a plan-change recalculation, the QZPay limit row is
        // stored with sourceId = ADDON_RECALC_SOURCE_ID instead of the original
        // purchaseId. This means `removeBySource('addon', purchaseId)` returns 0
        // (no match), and the fallback `remove(customerId, limitKey)` would wipe
        // the entire aggregated limit — losing contributions from other active addons.
        // Calling recalculate here avoids that data loss by recomputing from the
        // current set of active purchases (which no longer includes this one).
        const addonDef = getAddonBySlug(addonSlug);

        if (addonDef?.affectsLimitKey != null) {
            try {
                const recalcResult = await recalculateAddonLimitsForCustomer({
                    customerId: input.customerId,
                    limitKey: addonDef.affectsLimitKey,
                    billing,
                    db
                });

                if (recalcResult.outcome === 'failed') {
                    apiLogger.warn(
                        {
                            customerId: input.customerId,
                            addonSlug,
                            purchaseId: input.purchaseId,
                            limitKey: addonDef.affectsLimitKey,
                            reason: recalcResult.reason
                        },
                        'Limit recalculation failed after addon cancellation (addon is already cancelled in DB)'
                    );
                } else {
                    apiLogger.info(
                        {
                            customerId: input.customerId,
                            addonSlug,
                            purchaseId: input.purchaseId,
                            limitKey: addonDef.affectsLimitKey,
                            outcome: recalcResult.outcome,
                            newMaxValue: recalcResult.newMaxValue,
                            addonCount: recalcResult.addonCount
                        },
                        'Addon limit recalculated after cancellation'
                    );
                }
            } catch (recalcError) {
                // Recalculation errors must not propagate — the addon is already
                // cancelled in the DB at this point. Log and continue.
                apiLogger.error(
                    {
                        error:
                            recalcError instanceof Error
                                ? recalcError.message
                                : String(recalcError),
                        customerId: input.customerId,
                        addonSlug,
                        purchaseId: input.purchaseId,
                        limitKey: addonDef.affectsLimitKey
                    },
                    'Unexpected error during addon limit recalculation after cancellation (addon already cancelled in DB)'
                );
            }
        }

        apiLogger.info(
            {
                customerId: input.customerId,
                addonSlug,
                purchaseId: input.purchaseId,
                reason: input.reason
            },
            'Add-on canceled and entitlements removed'
        );

        return { success: true, data: undefined };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, customerId: input.customerId, purchaseId: input.purchaseId },
            'Failed to cancel add-on'
        );

        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel add-on' }
        };
    }
}

/**
 * Check whether a specific add-on is currently active for a user.
 *
 * @param billing - QZPay billing instance
 * @param userId - User ID to check
 * @param addonSlug - Add-on slug to look for
 * @returns True if the add-on is found with status 'active'
 *
 * @example
 * ```ts
 * const result = await checkAddonActive(billing, 'user_123', 'extra-photos');
 * if (result.success && result.data) {
 *   // user has the add-on active
 * }
 * ```
 */
export async function checkAddonActive(
    billing: QZPayBilling,
    userId: string,
    addonSlug: string
): Promise<ServiceResult<boolean>> {
    try {
        const result = await getUserAddons(billing, userId);

        if (!result.success) {
            return { success: false, error: result.error };
        }

        const hasAddon = result.data.some(
            (addon) => addon.addonSlug === addonSlug && addon.status === 'active'
        );

        return { success: true, data: hasAddon };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, userId, addonSlug },
            'Failed to check if add-on is active'
        );

        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to check add-on status' }
        };
    }
}
