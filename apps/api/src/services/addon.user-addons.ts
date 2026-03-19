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
import { NotificationType } from '@repo/notifications';
import * as Sentry from '@sentry/node';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';
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
        const addonDef = getAddonBySlug(addonSlug);

        // Atomically cancel the purchase and recalculate limits in a single transaction.
        // If limit recalculation fails the DB update is rolled back, ensuring the
        // user's limits stay consistent with the purchase status visible in the DB.
        if (addonDef?.affectsLimitKey != null) {
            const limitKey = addonDef.affectsLimitKey;

            try {
                await db.transaction(async (tx) => {
                    const updateResult = await tx
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

                    // Recalculate inside the transaction so the new active-purchase
                    // set (excluding this now-canceled record) is consistent.
                    const recalcResult = await recalculateAddonLimitsForCustomer({
                        customerId: input.customerId,
                        limitKey,
                        billing,
                        db: tx as typeof db
                    });

                    if (recalcResult.outcome === 'failed') {
                        const recalcError = new Error(
                            `Limit recalculation failed after addon cancellation: ${recalcResult.reason}`
                        );

                        Sentry.captureException(recalcError, {
                            extra: {
                                customerId: input.customerId,
                                addonSlug,
                                purchaseId: input.purchaseId,
                                limitKey,
                                reason: recalcResult.reason
                            }
                        });

                        // Throw inside the transaction to trigger rollback of the
                        // DB update above, keeping purchase status as 'active'.
                        throw recalcError;
                    }

                    apiLogger.info(
                        {
                            customerId: input.customerId,
                            addonSlug,
                            purchaseId: input.purchaseId,
                            limitKey,
                            outcome: recalcResult.outcome,
                            newMaxValue: recalcResult.newMaxValue,
                            addonCount: recalcResult.addonCount
                        },
                        'Addon limit recalculated after cancellation'
                    );
                });
            } catch (txError) {
                const errorMessage = txError instanceof Error ? txError.message : String(txError);

                apiLogger.error(
                    {
                        error: errorMessage,
                        customerId: input.customerId,
                        addonSlug,
                        purchaseId: input.purchaseId,
                        limitKey
                    },
                    'Transaction rolled back: addon cancellation aborted due to limit recalculation failure'
                );

                return {
                    success: false,
                    error: {
                        code: 'LIMIT_RECALCULATION_FAILED',
                        message:
                            'Add-on cancellation was rolled back because limit recalculation failed. Please try again.'
                    }
                };
            }
        } else {
            // No limit recalculation needed — update the purchase record directly.
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
                    'Failed to cancel billing_addon_purchase record'
                );

                return {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Failed to update addon purchase status'
                    }
                };
            }
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

        apiLogger.info(
            {
                customerId: input.customerId,
                addonSlug,
                purchaseId: input.purchaseId,
                reason: input.reason
            },
            'Add-on canceled and entitlements removed'
        );

        // Fire-and-forget: notify the user about the cancellation.
        // Failure is non-blocking — the cancellation already succeeded.
        try {
            const customer = await billing.customers.get(input.customerId);
            if (customer) {
                const customerName =
                    typeof customer.metadata?.name === 'string'
                        ? customer.metadata.name
                        : (customer.email ?? 'Usuario');
                sendNotification({
                    type: NotificationType.ADDON_CANCELLATION,
                    recipientEmail: customer.email,
                    recipientName: customerName,
                    userId: input.userId,
                    customerId: input.customerId,
                    addonName: addonDef?.name || addonSlug,
                    canceledAt: new Date().toISOString()
                }).catch((notifErr) => {
                    apiLogger.debug(
                        {
                            customerId: input.customerId,
                            addonSlug,
                            error: notifErr instanceof Error ? notifErr.message : String(notifErr)
                        },
                        'ADDON_CANCELLATION notification failed (non-blocking)'
                    );
                });
            }
        } catch (notifLookupErr) {
            apiLogger.debug(
                {
                    customerId: input.customerId,
                    addonSlug,
                    error:
                        notifLookupErr instanceof Error
                            ? notifLookupErr.message
                            : String(notifLookupErr)
                },
                'Could not look up customer for ADDON_CANCELLATION notification, skipping'
            );
        }

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

// ─── Bulk revocation (GAP-043-012) ────────────────────────────────────────────

/**
 * Result of a bulk addon revocation for a customer.
 */
export interface RevokeAllAddonsResult {
    /** Number of purchases successfully revoked. */
    revokedCount: number;
    /** Purchase IDs that failed to be revoked. */
    failedIds: string[];
}

/**
 * Input parameters for {@link revokeAllAddonsForCustomer}.
 */
export interface RevokeAllAddonsInput {
    /** Billing customer UUID whose ALL active addon purchases should be revoked. */
    readonly customerId: string;
}

/**
 * Revokes ALL active addon purchases for a customer, regardless of which
 * subscription they are linked to.
 *
 * Intended for account deletion or suspension flows where every entitlement
 * must be removed — including one-time addons that have no subscription link.
 * Each purchase is cancelled individually; failures are collected and returned
 * rather than aborting the entire batch.
 *
 * @param input - Customer ID whose addons should be revoked
 * @returns Count of successfully revoked purchases and IDs of any failures
 *
 * @example
 * ```ts
 * const result = await revokeAllAddonsForCustomer({ customerId: 'cust-uuid' });
 * if (result.revokedCount > 0) {
 *   logger.info({ revokedCount: result.revokedCount }, 'All customer addons revoked');
 * }
 * if (result.failedIds.length > 0) {
 *   logger.error({ failedIds: result.failedIds }, 'Some addon revocations failed');
 * }
 * ```
 */
export async function revokeAllAddonsForCustomer(
    input: RevokeAllAddonsInput
): Promise<RevokeAllAddonsResult> {
    const { customerId } = input;
    const { getDb } = await import('@repo/db/client');
    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
    const db = getDb();

    const activePurchases = await db
        .select({
            id: billingAddonPurchases.id,
            addonSlug: billingAddonPurchases.addonSlug
        })
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.customerId, customerId),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    apiLogger.info(
        { customerId, activePurchaseCount: activePurchases.length },
        'Revoking all active addon purchases for customer'
    );

    let revokedCount = 0;
    const failedIds: string[] = [];

    for (const purchase of activePurchases) {
        try {
            await db
                .update(billingAddonPurchases)
                .set({
                    status: 'canceled',
                    canceledAt: new Date(),
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(billingAddonPurchases.id, purchase.id),
                        eq(billingAddonPurchases.status, 'active'),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                );

            revokedCount++;

            apiLogger.info(
                { customerId, purchaseId: purchase.id, addonSlug: purchase.addonSlug },
                'Revoked addon purchase for customer account action'
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);

            Sentry.captureException(err, {
                tags: { subsystem: 'billing-addon-lifecycle', action: 'revoke-all-for-customer' },
                extra: { customerId, purchaseId: purchase.id, addonSlug: purchase.addonSlug }
            });

            apiLogger.error(
                {
                    customerId,
                    purchaseId: purchase.id,
                    addonSlug: purchase.addonSlug,
                    error: errorMessage
                },
                'Failed to revoke addon purchase during bulk customer revocation'
            );

            failedIds.push(purchase.id);
        }
    }

    apiLogger.info(
        { customerId, revokedCount, failedCount: failedIds.length },
        'Bulk addon revocation for customer completed'
    );

    return { revokedCount, failedIds };
}
