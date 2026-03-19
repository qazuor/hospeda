/**
 * Admin API route for cancelling a billing subscription.
 *
 * Implements a two-phase cancellation approach:
 *
 * Phase 1 (QZPay revocations, no DB transaction):
 *   - Queries active addon purchases for the subscription.
 *   - Revokes each addon's QZPay entitlements/limits in parallel.
 *   - If ANY revocation fails, returns 500 immediately. Phase 2 is skipped.
 *
 * Phase 2 (DB transaction + QZPay cancel, only if Phase 1 succeeded):
 *   - Race-condition guard: re-checks subscription status inside transaction.
 *   - DB transaction: marks addon purchases as `canceled`, subscription as `cancelled`.
 *   - After transaction: cancels the subscription in QZPay.
 *   - Clears entitlement cache.
 *   - Returns 200 with summary of cancelled addons.
 *
 * Routes:
 * - POST /api/v1/admin/billing/subscriptions/:id/cancel
 *
 * @module routes/billing/admin/subscription-cancel
 */

import { billingSubscriptionEvents, billingSubscriptions, getDb } from '@repo/db';
import { PermissionEnum, SubscriptionStatusEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { and, eq, isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../middlewares/actor';
import { getQZPayBilling } from '../../../middlewares/billing';
import { clearEntitlementCache } from '../../../middlewares/entitlement';
import { revokeAddonForSubscriptionCancellation } from '../../../services/addon-lifecycle.service';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Path parameter schema - subscription UUID */
const SubscriptionCancelParamSchema = z.object({
    id: z.string().uuid()
});

/** Request body schema - optional cancellation reason */
const SubscriptionCancelBodySchema = z.object({
    reason: z.string().max(500).optional()
});

/** Successful cancellation response schema */
const SubscriptionCancelSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        subscriptionId: z.string(),
        canceledAddons: z.array(
            z.object({
                purchaseId: z.string(),
                addonSlug: z.string()
            })
        )
    })
});

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Represents a minimal active addon purchase row from the DB,
 * containing only the fields needed for the cancellation flow.
 */
interface ActiveAddonPurchase {
    id: string;
    addonSlug: string;
}

/**
 * Per-addon result collected during Phase 1 revocation.
 */
interface AddonRevocationSummary {
    purchaseId: string;
    addonSlug: string;
    outcome: 'success' | 'failed';
    error?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handler for admin subscription cancellation.
 *
 * Implements a two-phase approach:
 * 1. Phase 1: revoke QZPay entitlements/limits in parallel (no DB writes).
 *    Aborts with 500 if any revocation fails.
 * 2. Phase 2: atomic DB transaction to mark purchases and subscription as
 *    cancelled, then cancel in QZPay and clear entitlement cache.
 *
 * Guard checks performed before phases:
 * - Subscription must exist (404 otherwise).
 * - Subscription must not already be cancelled (400 otherwise).
 *
 * @param c - Hono context (used to return error Responses directly)
 * @param params - Validated path parameters containing the subscription UUID
 * @param body - Validated request body (optional reason)
 * @returns A Response or a plain object consumed by the route factory
 */
export const cancelSubscriptionHandler = async (
    c: Context,
    params: Record<string, unknown>,
    body: Record<string, unknown>
) => {
    const { id } = params as z.infer<typeof SubscriptionCancelParamSchema>;
    const { reason } = body as z.infer<typeof SubscriptionCancelBodySchema>;

    const actor = getActorFromContext(c);
    const adminUserId = actor.id;

    const db = getDb();

    // ── Guard 1: subscription must exist ──────────────────────────────────────
    const rows = await db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, id))
        .limit(1);

    const subscription = rows[0];

    if (!subscription) {
        apiLogger.warn({ subscriptionId: id }, 'Admin cancel: subscription not found');

        return c.json(
            {
                success: false as const,
                error: {
                    code: 'SUBSCRIPTION_NOT_FOUND',
                    message: 'Subscription not found.'
                }
            },
            404
        );
    }

    // ── Guard 2: must not already be cancelled (British spelling, 2 L's) ──────
    if (subscription.status === SubscriptionStatusEnum.CANCELLED) {
        apiLogger.warn({ subscriptionId: id }, 'Admin cancel: subscription already cancelled');

        return c.json(
            {
                success: false as const,
                error: {
                    code: 'SUBSCRIPTION_ALREADY_CANCELLED',
                    message: `Subscription ${id} is already cancelled.`
                }
            },
            400
        );
    }

    // The QZPay customer ID is stored in the local subscription record.
    const customerId = subscription.customerId;

    const billing = getQZPayBilling();

    if (!billing) {
        apiLogger.error({ subscriptionId: id }, 'Admin cancel: billing service unavailable');

        return c.json(
            {
                success: false as const,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not configured. Please contact support.'
                }
            },
            503
        );
    }

    // ── Phase 1: QZPay revocations (parallel, no DB writes) ──────────────────

    // Lazy-import to match the pattern in addon-lifecycle.service.ts
    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

    const activePurchases: ActiveAddonPurchase[] = await db
        .select({
            id: billingAddonPurchases.id,
            addonSlug: billingAddonPurchases.addonSlug
        })
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.subscriptionId, id),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    apiLogger.info(
        { subscriptionId: id, customerId, count: activePurchases.length },
        'Admin cancel Phase 1: revoking addon purchases in parallel'
    );

    const { getAddonBySlug } = await import('@repo/billing');

    // Run all QZPay revocations in parallel — no DB writes happen here.
    // Promise.allSettled ensures one rejection does not cancel sibling operations.
    const phase1Settled = await Promise.allSettled(
        activePurchases.map(async (purchase): Promise<AddonRevocationSummary> => {
            const addonDef = getAddonBySlug(purchase.addonSlug);

            try {
                await revokeAddonForSubscriptionCancellation({
                    customerId,
                    purchase,
                    addonDef,
                    billing
                });

                return {
                    purchaseId: purchase.id,
                    addonSlug: purchase.addonSlug,
                    outcome: 'success'
                };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);

                apiLogger.error(
                    {
                        subscriptionId: id,
                        customerId,
                        purchaseId: purchase.id,
                        addonSlug: purchase.addonSlug,
                        errorMessage
                    },
                    'Admin cancel Phase 1: addon revocation failed'
                );

                return {
                    purchaseId: purchase.id,
                    addonSlug: purchase.addonSlug,
                    outcome: 'failed',
                    error: errorMessage
                };
            }
        })
    );

    const phase1Results: AddonRevocationSummary[] = phase1Settled.map((result, idx) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        const purchase = activePurchases[idx];
        apiLogger.error(
            { purchaseId: purchase?.id, error: result.reason },
            'Phase 1: addon revocation promise rejected unexpectedly'
        );
        return {
            purchaseId: purchase?.id ?? 'unknown',
            addonSlug: purchase?.addonSlug ?? 'unknown',
            outcome: 'failed' as const,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        };
    });

    const failedRevocations = phase1Results.filter((r) => r.outcome === 'failed');
    const succeededRevocations = phase1Results.filter((r) => r.outcome === 'success');

    if (failedRevocations.length > 0) {
        const failedSlugs = failedRevocations.map((r) => r.addonSlug).join(', ');

        apiLogger.error(
            {
                subscriptionId: id,
                customerId,
                failedCount: failedRevocations.length,
                succeededCount: succeededRevocations.length,
                failedSlugs
            },
            'Admin cancel Phase 1: one or more addon revocations failed — aborting cancellation'
        );

        Sentry.captureException(
            new Error(
                `Admin subscription cancel: addon revocation failed for ${failedRevocations.length} purchase(s). Failed slugs: ${failedSlugs}`
            ),
            {
                tags: {
                    subsystem: 'billing-addon-lifecycle',
                    action: 'admin_subscription_cancel'
                },
                extra: {
                    subscriptionId: id,
                    customerId,
                    adminUserId,
                    failedPurchases: failedRevocations,
                    succeededPurchases: succeededRevocations
                }
            }
        );

        return c.json(
            {
                success: false as const,
                error: {
                    code: 'ADDON_REVOCATION_FAILED',
                    message: `Subscription cancellation could not complete because addon entitlement cleanup failed. Failed addons: [${failedSlugs}]. Please retry or contact engineering.`,
                    details: {
                        failedPurchases: failedRevocations,
                        succeededPurchases: succeededRevocations
                    }
                }
            },
            500
        );
    }

    apiLogger.info(
        { subscriptionId: id, customerId, revokedCount: succeededRevocations.length },
        'Admin cancel Phase 1: all addon revocations succeeded — proceeding to Phase 2'
    );

    // ── Phase 2: DB transaction + QZPay cancel ────────────────────────────────

    // Wrap only local DB writes in the transaction.
    // QZPay calls happen OUTSIDE to avoid holding the connection open during network I/O.
    let alreadyCancelledConcurrently = false;

    await db.transaction(async (trx) => {
        // Race-condition guard: another process (e.g. webhook) may have already cancelled.
        const freshRows = await trx
            .select({ status: billingSubscriptions.status })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, id))
            .limit(1);

        const freshStatus = freshRows[0]?.status;

        if (freshStatus === SubscriptionStatusEnum.CANCELLED) {
            // Already cancelled by a concurrent process — nothing to do.
            apiLogger.warn(
                { subscriptionId: id },
                'Admin cancel Phase 2: subscription already cancelled by concurrent process — skipping DB writes'
            );
            alreadyCancelledConcurrently = true;
            return;
        }

        // Mark each addon purchase as canceled (American spelling, 1 L).
        if (activePurchases.length > 0) {
            const purchaseIds = activePurchases.map((p) => p.id);

            await trx
                .update(billingAddonPurchases)
                .set({
                    status: 'canceled',
                    canceledAt: new Date(),
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(billingAddonPurchases.subscriptionId, id),
                        eq(billingAddonPurchases.status, 'active'),
                        isNull(billingAddonPurchases.deletedAt)
                    )
                );

            apiLogger.debug(
                { subscriptionId: id, purchaseIds },
                'Admin cancel Phase 2: marked addon purchases as canceled'
            );
        }

        // Mark local subscription as cancelled (British spelling, 2 L's).
        await trx
            .update(billingSubscriptions)
            .set({
                status: SubscriptionStatusEnum.CANCELLED,
                updatedAt: new Date()
            })
            .where(eq(billingSubscriptions.id, id));

        apiLogger.debug(
            { subscriptionId: id },
            'Admin cancel Phase 2: marked subscription as cancelled in DB'
        );

        // Audit log: record the admin cancellation action
        await trx.insert(billingSubscriptionEvents).values({
            subscriptionId: id,
            previousStatus: subscription.status,
            newStatus: SubscriptionStatusEnum.CANCELLED,
            triggerSource: 'admin-cancel',
            metadata: {
                adminUserId,
                ...(reason !== undefined ? { reason } : {})
            }
        });

        apiLogger.debug(
            { subscriptionId: id, adminUserId },
            'Admin cancel Phase 2: audit log event inserted'
        );
    });

    // ── Race-condition guard: return 409 when concurrent process already cancelled ──
    if (alreadyCancelledConcurrently) {
        return c.json(
            {
                success: false as const,
                error: {
                    code: 'SUBSCRIPTION_ALREADY_CANCELLED',
                    message: `Subscription ${id} was cancelled by a concurrent process.`
                }
            },
            409
        );
    }

    // ── Post-transaction: cancel in QZPay (OUTSIDE the DB transaction) ────────
    try {
        await billing.subscriptions.cancel(id, {
            cancelAtPeriodEnd: false,
            reason
        });

        apiLogger.info(
            { subscriptionId: id, customerId },
            'Admin cancel Phase 2: subscription cancelled in QZPay'
        );
    } catch (qzpayErr) {
        const errorMessage = qzpayErr instanceof Error ? qzpayErr.message : String(qzpayErr);

        apiLogger.error(
            { subscriptionId: id, customerId, errorMessage },
            'Admin cancel Phase 2: QZPay subscription cancel failed after DB transaction committed'
        );

        Sentry.captureException(qzpayErr, {
            tags: {
                subsystem: 'billing-addon-lifecycle',
                action: 'admin_subscription_cancel'
            },
            extra: {
                subscriptionId: id,
                customerId,
                adminUserId,
                message:
                    'DB transaction already committed — subscription marked cancelled locally but QZPay cancel failed'
            }
        });

        clearEntitlementCache(customerId);

        return c.json(
            {
                success: false as const,
                error: {
                    code: 'SUBSCRIPTION_CANCEL_FAILED',
                    message:
                        'Subscription was cancelled locally but the payment provider could not be updated. Please contact engineering.',
                    details: { errorMessage }
                }
            },
            500
        );
    }

    // ── Clear entitlement cache ───────────────────────────────────────────────
    clearEntitlementCache(customerId);

    apiLogger.info(
        { subscriptionId: id, customerId, canceledAddonsCount: succeededRevocations.length },
        'Admin cancel: subscription cancellation completed successfully'
    );

    // Return plain object — the route factory wraps it with createResponse (status 200).
    return {
        subscriptionId: id,
        canceledAddons: succeededRevocations.map((r) => ({
            purchaseId: r.purchaseId,
            addonSlug: r.addonSlug
        }))
    };
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/billing/subscriptions/:id/cancel
 *
 * Cancel a billing subscription (admin only).
 * Requires MANAGE_SUBSCRIPTIONS permission.
 *
 * Phase 1: revoke all active addon QZPay entitlements/limits in parallel.
 *   If any revocation fails, return 500 and skip Phase 2.
 * Phase 2: DB transaction to mark purchases and subscription as cancelled,
 *   then cancel in QZPay and clear entitlement cache.
 */
export const subscriptionCancelRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/cancel',
    summary: 'Cancel a subscription',
    description:
        'Cancels an active subscription using a two-phase approach: first revokes all addon QZPay grants (Phase 1), then commits DB state and cancels with the payment provider (Phase 2). Returns 404 if not found, 400 if already cancelled, 500 if any revocation or provider call fails.',
    tags: ['Billing', 'Subscriptions'],
    requiredPermissions: [PermissionEnum.MANAGE_SUBSCRIPTIONS],
    requestParams: SubscriptionCancelParamSchema.shape,
    requestBody: SubscriptionCancelBodySchema,
    responseSchema: SubscriptionCancelSuccessResponseSchema,
    handler: cancelSubscriptionHandler
});
