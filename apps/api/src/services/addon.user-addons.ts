/**
 * Add-on User Management Module
 *
 * API-layer wrapper that delegates query logic to @repo/service-core
 * and adds infra concerns (logging, Sentry, notifications).
 *
 * @module services/addon.user-addons
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getAddonBySlug } from '@repo/billing';
import { NotificationType } from '@repo/notifications';
import {
    cancelAddonPurchaseRecord,
    queryActiveAddonPurchases,
    queryAddonActive,
    queryUserAddons
} from '@repo/service-core';
import type { RevokeAllAddonsInput, RevokeAllAddonsResult } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';
import type { AddonEntitlementService } from './addon-entitlement.service';
import { recalculateAddonLimitsForCustomer } from './addon-limit-recalculation.service';
import type { CancelAddonInput, ServiceResult, UserAddon } from './addon.types';

// Re-export types from service-core for backward compatibility
export type { RevokeAllAddonsInput, RevokeAllAddonsResult } from '@repo/service-core';

/**
 * Get a user's active add-ons.
 *
 * Delegates to the pure query function in @repo/service-core and adds
 * structured logging for observability.
 *
 * @param billing - QZPay billing instance
 * @param userId - The user's external ID
 * @returns List of active user add-ons
 */
export async function getUserAddons(
    billing: QZPayBilling,
    userId: string
): Promise<ServiceResult<UserAddon[]>> {
    try {
        const result = await queryUserAddons({ billing, userId });

        if (result.success) {
            apiLogger.debug(
                {
                    userId,
                    totalAddons: result.data.length
                },
                'Retrieved user add-ons'
            );
        }

        return result;
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
 * @param billing - QZPay billing instance
 * @param entitlementService - AddonEntitlementService for removing entitlements
 * @param input - Cancellation details (customerId, purchaseId, optional reason)
 * @returns Success or error result
 */
export async function cancelUserAddon(
    billing: QZPayBilling,
    entitlementService: AddonEntitlementService,
    input: CancelAddonInput
): Promise<ServiceResult<void>> {
    try {
        const { getDb } = await import('@repo/db/client');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
        const { and, eq, isNull } = await import('drizzle-orm');
        const db = getDb();

        // Fetch the purchase record by primary key to get the real addonSlug.
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
            // No limit recalculation needed — use service-core helper for the DB update.
            try {
                const rowCount = await cancelAddonPurchaseRecord({
                    purchaseId: input.purchaseId
                });

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
 * Delegates to the pure query function in @repo/service-core.
 *
 * @param billing - QZPay billing instance
 * @param userId - User ID to check
 * @param addonSlug - Add-on slug to look for
 * @returns True if the add-on is found with status 'active'
 */
export async function checkAddonActive(
    billing: QZPayBilling,
    userId: string,
    addonSlug: string
): Promise<ServiceResult<boolean>> {
    try {
        return await queryAddonActive({ billing, userId, addonSlug });
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
 * Revokes ALL active addon purchases for a customer.
 *
 * Uses queryActiveAddonPurchases and cancelAddonPurchaseRecord from
 * @repo/service-core for DB operations. Adds Sentry reporting and
 * structured logging as infra concerns.
 *
 * @param input - Customer ID whose addons should be revoked
 * @returns Count of successfully revoked purchases and IDs of any failures
 */
export async function revokeAllAddonsForCustomer(
    input: RevokeAllAddonsInput
): Promise<RevokeAllAddonsResult> {
    const { customerId } = input;

    const activePurchases = await queryActiveAddonPurchases({ customerId });

    apiLogger.info(
        { customerId, activePurchaseCount: activePurchases.length },
        'Revoking all active addon purchases for customer'
    );

    let revokedCount = 0;
    const failedIds: string[] = [];

    for (const purchase of activePurchases) {
        try {
            await cancelAddonPurchaseRecord({ purchaseId: purchase.id });
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
