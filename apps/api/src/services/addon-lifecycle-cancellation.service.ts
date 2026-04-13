/**
 * Addon Lifecycle Cancellation Service
 *
 * Handles bulk addon cleanup when a MercadoPago subscription cancellation webhook
 * is received. Processes all active addon purchases for a subscription sequentially,
 * preserving partial progress across retries.
 *
 * This module is re-exported from `addon-lifecycle.service.ts` to keep each file
 * under the 500-line limit.
 *
 * @module services/addon-lifecycle-cancellation
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getAddonBySlug } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { withTransaction } from '@repo/db';
import * as Sentry from '@sentry/node';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';
import type { RevocationResult } from './addon-lifecycle.service';
import { revokeAddonForSubscriptionCancellation } from './addon-lifecycle.service';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Aggregate result of processing all active addon purchases for a cancelled subscription.
 */
export interface CancellationResult {
    /** The QZPay subscription ID that was cancelled. */
    subscriptionId: string;
    /** The QZPay billing customer ID. */
    customerId: string;
    /** Total number of active addon purchases found and processed. */
    totalProcessed: number;
    /** Revocation results for purchases that succeeded. */
    succeeded: RevocationResult[];
    /** Revocation results for purchases that failed. */
    failed: RevocationResult[];
    /** Wall-clock time elapsed for the entire operation in milliseconds. */
    elapsedMs: number;
}

/**
 * Input for `handleSubscriptionCancellationAddons`.
 */
export interface HandleCancellationAddonsInput {
    /** The QZPay subscription ID that was cancelled. */
    subscriptionId: string;
    /** The QZPay billing customer ID. */
    customerId: string;
    /** Initialised QZPay billing instance. */
    billing: QZPayBilling;
    /** Drizzle database instance (from `getDb()`). */
    db: DrizzleClient;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Processes all active addon purchases for a cancelled subscription.
 *
 * This function is intended to be called from the MercadoPago webhook handler
 * when a subscription cancellation event is received. It:
 *
 * 1. Queries `billing_addon_purchases` for all active, non-deleted rows
 *    linked to the given `subscriptionId`.
 * 2. Processes each purchase **sequentially** (not in parallel) to avoid
 *    overwhelming QZPay and to ensure partial progress is preserved atomically
 *    per purchase.
 * 3. For each purchase:
 *    - Resolves the addon definition via `getAddonBySlug` (may be `undefined`
 *      for retired addons — handled gracefully by `revokeAddonForSubscriptionCancellation`).
 *    - Calls `revokeAddonForSubscriptionCancellation` to remove QZPay grants.
 *    - On **success**: updates the purchase row to `status='canceled'` and sets
 *      `canceledAt` to the current timestamp. Adds to `succeeded` list.
 *    - On **failure**: does NOT update the purchase status (remains `'active'`
 *      so the next webhook retry can attempt it again). Increments
 *      `metadata.revocationRetryCount` and sets `metadata.lastRevocationAttempt`.
 *      Reports to Sentry. Adds to `failed` list. Continues to the next purchase.
 * 4. Calls `clearEntitlementCache(customerId)` unconditionally (even on partial failure).
 * 5. Logs a summary audit entry.
 * 6. Warns if total elapsed time exceeds 15 seconds.
 * 7. If ANY purchase failed, **throws** so the webhook handler returns HTTP 500
 *    and MercadoPago retries the event. Successfully revoked purchases are already
 *    persisted as `'canceled'` — partial progress is preserved across retries.
 *
 * ### Spelling note
 * - `billing_addon_purchases.status` uses `'canceled'` (American English, 1 L).
 * - `billing_subscriptions.status` uses `'cancelled'` (British English, 2 L's).
 *
 * @param input - Subscription ID, customer ID, billing instance, and DB handle.
 * @returns {@link CancellationResult} summarising what was processed.
 *
 * @throws If one or more addon revocations fail (to trigger MercadoPago retry).
 *
 * @example
 * ```ts
 * const result = await handleSubscriptionCancellationAddons({
 *   subscriptionId: 'sub_abc123',
 *   customerId: 'cus_xyz456',
 *   billing,
 *   db: getDb(),
 * });
 * // result.succeeded and result.failed contain per-addon outcomes
 * ```
 */
export async function handleSubscriptionCancellationAddons(
    input: HandleCancellationAddonsInput
): Promise<CancellationResult> {
    const { subscriptionId, customerId, billing, db } = input;
    const startMs = Date.now();

    // ── 0. Feature flag guard ─────────────────────────────────────────────────
    const addonLifecycleEnabled = env.HOSPEDA_ADDON_LIFECYCLE_ENABLED;
    if (!addonLifecycleEnabled) {
        apiLogger.info(
            { subscriptionId, customerId },
            'Addon lifecycle processing disabled via HOSPEDA_ADDON_LIFECYCLE_ENABLED'
        );
        return {
            subscriptionId,
            customerId,
            totalProcessed: 0,
            succeeded: [],
            failed: [],
            elapsedMs: Date.now() - startMs
        };
    }

    // ── 1. Load Drizzle schema helpers via dynamic import (matches addon.checkout.ts pattern) ──
    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
    const { eq, and, isNull } = await import('drizzle-orm');

    // ── 2. Query active, non-deleted addon purchases for this subscription ────
    const activePurchases = await db
        .select()
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.subscriptionId, subscriptionId),
                eq(billingAddonPurchases.status, 'active'),
                isNull(billingAddonPurchases.deletedAt)
            )
        );

    // ── 3. Short-circuit if nothing to process ───────────────────────────────
    if (activePurchases.length === 0) {
        apiLogger.debug(
            { subscriptionId, customerId },
            `No active addon purchases for subscription ${subscriptionId}, skipping cleanup`
        );

        return {
            subscriptionId,
            customerId,
            totalProcessed: 0,
            succeeded: [],
            failed: [],
            elapsedMs: Date.now() - startMs
        };
    }

    apiLogger.info(
        { subscriptionId, customerId, count: activePurchases.length },
        `Processing ${activePurchases.length} active addon purchase(s) for cancelled subscription`
    );

    const succeeded: RevocationResult[] = [];
    const failed: RevocationResult[] = [];
    const failedPurchaseIds: string[] = [];

    // ── 4. Sequential processing — NOT Promise.all ───────────────────────────
    for (const purchase of activePurchases) {
        const { id: purchaseId, addonSlug } = purchase;
        const addonDef = getAddonBySlug(addonSlug);

        try {
            // Delegate actual QZPay revocation to the single-purchase helper
            const revocationResult = await revokeAddonForSubscriptionCancellation({
                customerId,
                purchase: { id: purchaseId, addonSlug },
                addonDef,
                billing
            });

            // ── 4c SUCCESS: persist canceled status to DB ────────────────────
            await withTransaction(async (tx) => {
                await tx
                    .update(billingAddonPurchases)
                    .set({
                        status: 'canceled',
                        canceledAt: new Date(),
                        updatedAt: new Date()
                    })
                    .where(
                        and(
                            eq(billingAddonPurchases.id, purchaseId),
                            eq(billingAddonPurchases.status, 'active')
                        )
                    );
            }, db);

            apiLogger.info(
                {
                    subscriptionId,
                    customerId,
                    purchaseId,
                    addonSlug,
                    addonType: revocationResult.addonType
                },
                'Addon purchase revoked and marked canceled in DB'
            );

            succeeded.push(revocationResult);
        } catch (err) {
            // ── 4d FAILURE: track retry metadata, do NOT update status ───────
            const errorMessage = err instanceof Error ? err.message : String(err);
            const existingMetadata = (purchase.metadata ?? {}) as Record<string, unknown>;
            const currentRetryCount = existingMetadata.revocationRetryCount;
            const retryCount = typeof currentRetryCount === 'number' ? currentRetryCount + 1 : 1;

            try {
                await withTransaction(async (tx) => {
                    await tx
                        .update(billingAddonPurchases)
                        .set({
                            metadata: {
                                ...existingMetadata,
                                revocationRetryCount: retryCount,
                                lastRevocationAttempt: new Date().toISOString()
                            },
                            updatedAt: new Date()
                        })
                        .where(eq(billingAddonPurchases.id, purchaseId));
                }, db);
            } catch (metaErr) {
                apiLogger.warn(
                    {
                        purchaseId,
                        addonSlug,
                        error: metaErr instanceof Error ? metaErr.message : String(metaErr)
                    },
                    'Failed to update retry metadata on addon purchase (non-fatal)'
                );
            }

            apiLogger.error(
                {
                    retryNeeded: true,
                    purchaseId,
                    addonSlug,
                    errorMessage,
                    retryCount,
                    subscriptionId,
                    customerId
                },
                `Addon revocation failed for purchase ${purchaseId} (slug: ${addonSlug})`
            );

            failedPurchaseIds.push(purchaseId);

            const failedResult: RevocationResult = {
                purchaseId,
                addonSlug,
                addonType: addonDef?.grantsEntitlement
                    ? 'entitlement'
                    : addonDef?.affectsLimitKey
                      ? 'limit'
                      : 'unknown',
                outcome: 'failed',
                error: errorMessage
            };

            failed.push(failedResult);

            // Continue to next addon — do NOT abort the loop
        }
    }

    // ── 5. Clear entitlement cache unconditionally ───────────────────────────
    clearEntitlementCache(customerId);

    // ── 6. Summary audit log ─────────────────────────────────────────────────
    const elapsedMs = Date.now() - startMs;

    apiLogger.info(
        {
            eventType: 'subscription_canceled',
            subscriptionId,
            customerId,
            totalProcessed: activePurchases.length,
            succeededCount: succeeded.length,
            failedCount: failed.length,
            failedPurchaseIds,
            elapsedMs,
            revokedPurchases: [...succeeded, ...failed].map((r) => ({
                purchaseId: r.purchaseId,
                addonSlug: r.addonSlug,
                type: r.addonType,
                outcome: r.outcome
            }))
        },
        'Subscription cancellation addon cleanup summary'
    );

    // ── 7. Warn on slow processing ───────────────────────────────────────────
    if (elapsedMs > 15_000) {
        apiLogger.warn(
            { subscriptionId, elapsedMs },
            `Webhook processing time exceeded 15s threshold: ${elapsedMs}ms for subscription ${subscriptionId}`
        );
    }

    // ── 8. Throw on any failure so webhook handler returns 500 ───────────────
    if (failed.length > 0) {
        Sentry.captureException(
            new Error(
                `Subscription cancellation addon cleanup failed for ${failed.length}/${activePurchases.length} purchases`
            ),
            {
                tags: {
                    subsystem: 'billing-addon-lifecycle',
                    action: 'subscription_cancelled'
                },
                extra: {
                    customerId,
                    subscriptionId,
                    failedPurchaseIds
                }
            }
        );

        throw new Error(
            `Addon cleanup failed for subscription ${subscriptionId}: ` +
                `${failed.length} of ${activePurchases.length} purchases could not be revoked. ` +
                `Failed IDs: ${failedPurchaseIds.join(', ')}`
        );
    }

    return {
        subscriptionId,
        customerId,
        totalProcessed: activePurchases.length,
        succeeded,
        failed,
        elapsedMs
    };
}
