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
import { and, eq } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import type { AddonEntitlementService } from './addon-entitlement.service';
import type { CancelAddonInput, ServiceResult, UserAddon } from './addon.types';
import { addonAdjustmentsArraySchema } from './addon.types';

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
                    eq(billingAddonPurchases.status, 'active')
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
                if (
                    firstLimit &&
                    typeof firstLimit === 'object' &&
                    'limitKey' in firstLimit &&
                    'increase' in firstLimit
                ) {
                    affectsLimitKey = firstLimit.limitKey as string;
                    limitIncrease = firstLimit.increase as number;
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
                canceledAt: purchase.cancelledAt ? purchase.cancelledAt.toISOString() : null,
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
 * Updates `billing_addon_purchases` to set status='cancelled', then removes
 * entitlements from JSON metadata for backward compatibility. If the DB
 * update affects 0 rows (pre-migration data), the operation continues with
 * entitlement removal.
 *
 * @param billing - QZPay billing instance
 * @param entitlementService - AddonEntitlementService for removing entitlements
 * @param input - Cancellation details (customerId, addonId/slug, optional reason)
 * @returns Success or error result
 *
 * @example
 * ```ts
 * const result = await cancelUserAddon(billing, entitlementService, {
 *   customerId: 'cust_123',
 *   addonId: 'extra-photos',
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
        const addonSlug = input.addonId;

        const customer = await billing.customers.get(input.customerId);

        if (!customer) {
            return {
                success: false,
                error: { code: 'CUSTOMER_NOT_FOUND', message: 'Billing customer not found' }
            };
        }

        const userId = customer.externalId || customer.id;

        const userAddonsResult = await getUserAddons(billing, userId);

        if (!userAddonsResult.success) {
            return {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve user add-ons' }
            };
        }

        const userAddons = userAddonsResult.data || [];
        const hasAddon = userAddons.some(
            (addon) => addon.addonSlug === addonSlug && addon.status === 'active'
        );

        if (!hasAddon) {
            return {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Add-on '${addonSlug}' is not active for this customer`
                }
            };
        }

        // Update billing_addon_purchases table
        try {
            const { getDb } = await import('@repo/db/client');
            const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
            const db = getDb();

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
                        eq(billingAddonPurchases.addonSlug, addonSlug),
                        eq(billingAddonPurchases.status, 'active')
                    )
                );

            const rowCount = (updateResult as { rowCount?: number }).rowCount || 0;

            if (rowCount === 0) {
                apiLogger.warn(
                    { customerId: input.customerId, addonSlug, reason: input.reason },
                    'No active billing_addon_purchase record found to cancel (might be pre-migration data or already cancelled, continuing with entitlement removal)'
                );
            } else if (rowCount === 1) {
                apiLogger.info(
                    { customerId: input.customerId, addonSlug, reason: input.reason },
                    'Cancelled billing_addon_purchase record'
                );
            } else {
                apiLogger.error(
                    {
                        customerId: input.customerId,
                        addonSlug,
                        reason: input.reason,
                        rowsUpdated: rowCount
                    },
                    'WARNING: Multiple billing_addon_purchase records were cancelled - possible data integrity issue or race condition'
                );
            }
        } catch (dbError) {
            apiLogger.error(
                {
                    error: dbError instanceof Error ? dbError.message : String(dbError),
                    customerId: input.customerId,
                    addonSlug
                },
                'Failed to cancel billing_addon_purchase record (continuing with entitlement removal)'
            );
        }

        // Remove entitlements from JSON metadata for backward compatibility
        const result = await entitlementService.removeAddonEntitlements({
            customerId: input.customerId,
            addonSlug
        });

        if (!result.success) {
            apiLogger.warn(
                {
                    customerId: input.customerId,
                    addonSlug,
                    error: result.error
                },
                'Failed to remove add-on from JSON metadata (backward compat), but table update may have succeeded'
            );
        }

        apiLogger.info(
            { customerId: input.customerId, addonSlug, reason: input.reason },
            'Add-on cancelled and entitlements removed'
        );

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, customerId: input.customerId, addonId: input.addonId },
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

        if (!result.success || !result.data) {
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
