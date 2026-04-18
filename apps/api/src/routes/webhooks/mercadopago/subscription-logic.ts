/**
 * Shared subscription processing logic.
 *
 * Contains status mapping and notification helper functions for
 * subscription_preapproval.updated webhook events. Extracted for
 * reuse across the webhook handler and dead letter retry job.
 *
 * @module routes/webhooks/mercadopago/subscription-logic
 */

import type { QZPayBilling, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { extractMPSubscriptionEventData } from '@qazuor/qzpay-mercadopago';
import { billingSubscriptionEvents, billingSubscriptions, getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { withServiceTransaction } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { clearEntitlementCache } from '../../../middlewares/entitlement.js';
import { handleSubscriptionCancellationAddons } from '../../../services/addon-lifecycle.service.js';
import { handlePlanChangeAddonRecalculation } from '../../../services/addon-plan-change.service.js';
import { apiLogger } from '../../../utils/logger.js';
import { sendNotification } from '../../../utils/notification-helper.js';

/**
 * Safety margin timeout before MercadoPago's 22s webhook deadline.
 *
 * MercadoPago times out webhook processing at 22 seconds and retries on
 * non-2xx responses. Addon lifecycle calls (revocation, plan-change
 * recalculation) can take longer than 22s when processing many addons.
 * Using a 20s race timeout gives a 2s margin so the webhook returns 200
 * before MercadoPago retries, preventing double-processing.
 *
 * Any in-flight work continues running after the timeout (intentional).
 * Per-addon DB commits preserve partial progress, and cron Phase 4 picks
 * up any remaining work on the next scheduled run.
 */
const WEBHOOK_TIMEOUT_MS = 20_000;

/**
 * Minimum number of payment failures before sending a PAYMENT_RETRY_WARNING.
 * First failure sends a generic PAYMENT_FAILURE notification (handled elsewhere).
 * From the 2nd failure onward, we send the escalated retry warning.
 */
const PAYMENT_RETRY_WARNING_THRESHOLD = 2;

/**
 * Total maximum retries MercadoPago performs before auto-cancellation.
 * Shown to the user in the retry warning email so they know how many attempts remain.
 */
const PAYMENT_RETRY_MAX_ATTEMPTS = 3;

/** Masks an ID to show only the last 4 characters */
function maskId(id: string): string {
    if (id.length <= 4) return '****';
    return `***...${id.slice(-4)}`;
}
import {
    sendSubscriptionCancelledNotification,
    sendSubscriptionPausedNotification,
    sendSubscriptionReactivatedNotification
} from './notifications.js';

/**
 * Maps QZPay subscription statuses (returned by retrieve()) to internal SubscriptionStatusEnum.
 *
 * - A non-null value means "update the local subscription to this status".
 * - A null value means "no status change, log only".
 * - If the status is not in this map, it is unknown (WARN + Sentry).
 *
 * @remarks
 * QZPay uses "canceled" (1 L) while Hospeda uses "cancelled" (2 L's).
 * The mapStatus() in @qazuor/qzpay-mercadopago passes through unknown statuses,
 * so "finished" arrives as-is.
 */
export const QZPAY_TO_HOSPEDA_STATUS: Record<string, SubscriptionStatusEnum | null> = {
    active: SubscriptionStatusEnum.ACTIVE,
    paused: SubscriptionStatusEnum.PAUSED,
    canceled: SubscriptionStatusEnum.CANCELLED,
    finished: SubscriptionStatusEnum.EXPIRED,
    past_due: SubscriptionStatusEnum.PAST_DUE,
    pending: null
} as const;

/**
 * Determines if a reactivation email should be sent based on a subscription status transition.
 *
 * Only sends when transitioning TO active FROM paused, cancelled, or past_due.
 * The trialing -> active transition is excluded because it is handled by the
 * trial conversion flow, not the reactivation flow.
 *
 * @param previousStatus - The subscription status before the update
 * @param newStatus - The subscription status after the update
 * @returns `true` if a reactivation email should be sent
 *
 * @example
 * ```ts
 * shouldSendReactivationEmail('paused', 'active')    // true
 * shouldSendReactivationEmail('trialing', 'active')  // false
 * shouldSendReactivationEmail('active', 'paused')    // false
 * ```
 */
export function shouldSendReactivationEmail(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.ACTIVE &&
        (previousStatus === SubscriptionStatusEnum.PAUSED ||
            previousStatus === SubscriptionStatusEnum.CANCELLED ||
            previousStatus === SubscriptionStatusEnum.PAST_DUE)
    );
}

/**
 * Determines if a paused/suspension email should be sent based on a subscription status transition.
 *
 * Sends for any transition TO paused, except when the subscription is already paused
 * (to prevent duplicate notifications on redundant updates).
 *
 * @param previousStatus - The subscription status before the update
 * @param newStatus - The subscription status after the update
 * @returns `true` if a paused notification email should be sent
 *
 * @example
 * ```ts
 * shouldSendPausedEmail('active', 'paused')   // true
 * shouldSendPausedEmail('paused', 'paused')   // false (already paused)
 * shouldSendPausedEmail('active', 'cancelled') // false (wrong new status)
 * ```
 */
export function shouldSendPausedEmail(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.PAUSED &&
        previousStatus !== SubscriptionStatusEnum.PAUSED
    );
}

/**
 * Determines if a cancellation email should be sent based on a subscription status transition.
 *
 * Sends for transitions TO cancelled, except when the subscription was already
 * cancelled or expired (both represent ended states where the user has already
 * been notified or the subscription naturally terminated).
 *
 * @param previousStatus - The subscription status before the update
 * @param newStatus - The subscription status after the update
 * @returns `true` if a cancellation notification email should be sent
 *
 * @example
 * ```ts
 * shouldSendCancelledEmail('active', 'cancelled')    // true
 * shouldSendCancelledEmail('cancelled', 'cancelled') // false (already cancelled)
 * shouldSendCancelledEmail('expired', 'cancelled')   // false (already ended)
 * ```
 */
export function shouldSendCancelledEmail(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.EXPIRED
    );
}

/**
 * Determines if an admin alert should be sent for involuntary cancellation.
 *
 * Uses the same logic as {@link shouldSendCancelledEmail}: sends alerts when a
 * subscription transitions to cancelled from any state that is not already
 * cancelled or expired.
 *
 * @param previousStatus - The subscription status before the update
 * @param newStatus - The subscription status after the update
 * @returns `true` if an admin alert should be sent
 *
 * @example
 * ```ts
 * shouldSendAdminAlert('active', 'cancelled')    // true
 * shouldSendAdminAlert('expired', 'cancelled')   // false
 * shouldSendAdminAlert('cancelled', 'cancelled') // false
 * ```
 */
export function shouldSendAdminAlert(previousStatus: string, newStatus: string): boolean {
    return (
        newStatus === SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.CANCELLED &&
        previousStatus !== SubscriptionStatusEnum.EXPIRED
    );
}

/**
 * Input for processing a subscription_preapproval.updated event.
 */
interface ProcessSubscriptionUpdatedInput {
    readonly event: QZPayWebhookEvent;
    readonly billing: QZPayBilling;
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    readonly providerEventId: string;
    readonly source?: string;
}

/** Result of processing a subscription_preapproval.updated event */
interface ProcessSubscriptionUpdatedResult {
    readonly success: boolean;
    readonly statusChanged: boolean;
    readonly newStatus?: string;
    readonly error?: string;
}

/**
 * Process a subscription_preapproval.updated webhook event.
 *
 * Fetches the current subscription state from MercadoPago, maps it to the
 * internal status enum, updates the local database, records an audit log
 * entry, and dispatches notifications as appropriate.
 *
 * @param input - Event data, billing instance, and payment adapter
 * @returns Result indicating success and whether status changed
 */
export async function processSubscriptionUpdated({
    event,
    billing,
    paymentAdapter,
    providerEventId,
    source = 'webhook'
}: ProcessSubscriptionUpdatedInput): Promise<ProcessSubscriptionUpdatedResult> {
    // Step 1: Extract MercadoPago preapproval ID
    const eventData = extractMPSubscriptionEventData(event);
    const mpPreapprovalId = eventData.subscriptionId;

    if (!mpPreapprovalId) {
        apiLogger.error(
            { eventId: event.id, source },
            'No subscription ID found in webhook event data'
        );
        return { success: true, statusChanged: false };
    }

    apiLogger.info(
        { mpPreapprovalId: maskId(mpPreapprovalId), providerEventId, source },
        'Processing subscription_preapproval.updated event'
    );

    // Step 2: Fetch subscription from MercadoPago API
    // If this throws, the error propagates to the caller (dead letter queue)
    const mpSubscription = await paymentAdapter.subscriptions
        .retrieve(mpPreapprovalId)
        .catch((error: unknown) => {
            Sentry.captureException(error, {
                extra: { mpPreapprovalId: maskId(mpPreapprovalId), providerEventId, source }
            });
            throw error;
        });

    // Step 3: Extract QZPay status
    const qzpayStatus = mpSubscription.status;

    // Step 4: Map to internal status
    const mappedStatus = QZPAY_TO_HOSPEDA_STATUS[qzpayStatus];

    if (mappedStatus === null) {
        // pending status - no action needed
        apiLogger.info(
            { mpPreapprovalId: maskId(mpPreapprovalId), qzpayStatus, source },
            'Subscription in pending state - no status change applied'
        );
        return { success: true, statusChanged: false };
    }

    if (mappedStatus === undefined) {
        // Unknown status
        apiLogger.warn(
            { mpPreapprovalId: maskId(mpPreapprovalId), qzpayStatus, source },
            `Unknown QZPay subscription status: ${qzpayStatus}`
        );
        Sentry.captureException(new Error(`Unknown QZPay subscription status: ${qzpayStatus}`), {
            extra: { mpPreapprovalId: maskId(mpPreapprovalId), providerEventId, source }
        });
        return { success: true, statusChanged: false };
    }

    // Step 5: Query local subscription via direct Drizzle query.
    // getDb() is used here for the initial SELECT and for subsequent single-table
    // UPDATEs (planId-only, paymentFailureCount). The multi-table atomic write
    // (status update + audit log insert) uses withServiceTransaction below (Step 7).
    const db = getDb();
    const [localSubscription] = await db
        .select()
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.mpSubscriptionId, mpPreapprovalId),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(1);

    if (!localSubscription) {
        apiLogger.warn(
            { mpPreapprovalId: maskId(mpPreapprovalId), source },
            `No local subscription found for mp_subscription_id=${maskId(mpPreapprovalId)}`
        );
        return { success: true, statusChanged: false };
    }

    // Step 5b: Detect planId change (webhook safety net for AC-3.7)
    //
    // MercadoPago webhooks carry an optional planId in the event payload.
    // The primary trigger for plan-change recalculation is the plan-change
    // route (AC-3.8). This block is a safety net that fires only when the
    // webhook signals a planId that differs from what is stored locally,
    // and only while the subscription is (or is becoming) ACTIVE.
    //
    // Recalculation errors are intentionally non-blocking: the webhook still
    // returns 200 to prevent infinite retries from MercadoPago.
    const fetchedPlanId = eventData.planId;
    const localPlanId = localSubscription.planId;

    if (
        fetchedPlanId != null &&
        localPlanId != null &&
        fetchedPlanId !== localPlanId &&
        [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.TRIALING].includes(mappedStatus)
    ) {
        apiLogger.info(
            {
                subscriptionId: localSubscription.id,
                customerId: localSubscription.customerId,
                oldPlanId: localPlanId,
                newPlanId: fetchedPlanId,
                source
            },
            'Plan change detected via webhook safety net'
        );

        try {
            const planChangeTimeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(
                    () => reject(new Error('Webhook addon lifecycle timeout (20s)')),
                    WEBHOOK_TIMEOUT_MS
                );
            });

            await Promise.race([
                handlePlanChangeAddonRecalculation({
                    customerId: localSubscription.customerId,
                    oldPlanId: localPlanId,
                    newPlanId: fetchedPlanId,
                    billing,
                    db
                }),
                planChangeTimeoutPromise
            ]);
        } catch (recalcError) {
            if (recalcError instanceof Error && recalcError.message.includes('timeout')) {
                apiLogger.warn(
                    {
                        subscriptionId: localSubscription.id,
                        customerId: localSubscription.customerId,
                        elapsedMs: WEBHOOK_TIMEOUT_MS,
                        source
                    },
                    'Addon lifecycle processing timed out — cron Phase 4 will complete remaining work'
                );
                // Non-blocking: return 200 to prevent MercadoPago retry
            } else {
                apiLogger.error(
                    {
                        error: recalcError,
                        subscriptionId: localSubscription.id,
                        customerId: localSubscription.customerId,
                        oldPlanId: localPlanId,
                        newPlanId: fetchedPlanId,
                        source
                    },
                    'Plan-change recalculation failed in webhook safety net; continuing webhook processing'
                );
                Sentry.captureException(recalcError, {
                    extra: {
                        subscriptionId: localSubscription.id,
                        customerId: localSubscription.customerId,
                        oldPlanId: localPlanId,
                        newPlanId: fetchedPlanId,
                        source
                    }
                });
            }
        }
    }

    // Step 6: Compare statuses
    const previousStatus = localSubscription.status;
    if (previousStatus === mappedStatus) {
        // If no status change but planId changed, persist the new planId
        if (fetchedPlanId != null && localPlanId != null && fetchedPlanId !== localPlanId) {
            await db
                .update(billingSubscriptions)
                .set({ planId: fetchedPlanId, updatedAt: new Date() })
                .where(eq(billingSubscriptions.id, localSubscription.id));
        }

        apiLogger.debug(
            { subscriptionId: localSubscription.id, status: mappedStatus, source },
            `No status change for subscription ${localSubscription.id}: still ${mappedStatus}`
        );
        return { success: true, statusChanged: false };
    }

    // Step 7: Update billing_subscriptions and insert audit log in a single transaction.
    // withServiceTransaction is used here instead of db.transaction() to follow the
    // project-wide pattern for atomic multi-write operations (SPEC-059 T-059G-032-C).
    const updateData: Record<string, unknown> = {
        status: mappedStatus,
        updatedAt: new Date()
    };

    // Persist planId update within the same transaction as the status change
    if (fetchedPlanId != null && localPlanId != null && fetchedPlanId !== localPlanId) {
        updateData.planId = fetchedPlanId;
    }

    // Only set canceled_at if transitioning TO cancelled and not already set
    if (mappedStatus === SubscriptionStatusEnum.CANCELLED && !localSubscription.canceledAt) {
        updateData.canceledAt = new Date();
    }

    // Reset cancel_at_period_end when reactivating
    if (mappedStatus === SubscriptionStatusEnum.ACTIVE && localSubscription.cancelAtPeriodEnd) {
        updateData.cancelAtPeriodEnd = false;
    }

    await withServiceTransaction(async (ctx) => {
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const tx = ctx.tx!;

        await tx
            .update(billingSubscriptions)
            .set(updateData)
            .where(eq(billingSubscriptions.id, localSubscription.id));

        // Step 8: Insert audit log within the transaction (non-blocking on failure)
        try {
            // Extract cancellation reason from the MercadoPago payload for audit trail (GAP-043-023)
            let cancellationReason: string | undefined;
            if (mappedStatus === SubscriptionStatusEnum.CANCELLED) {
                const rawPayload = event.data as Record<string, unknown> | undefined;
                const rawReason =
                    typeof rawPayload?.reason === 'string'
                        ? rawPayload.reason
                        : typeof rawPayload?.status_detail === 'string'
                          ? rawPayload.status_detail
                          : 'unknown';
                cancellationReason = rawReason.includes('payment')
                    ? 'auto_payment_failure'
                    : rawReason.includes('user')
                      ? 'user_initiated'
                      : 'unknown';
            }

            await tx.insert(billingSubscriptionEvents).values({
                subscriptionId: localSubscription.id,
                previousStatus,
                newStatus: mappedStatus,
                triggerSource: source ?? 'webhook',
                providerEventId,
                metadata: {
                    qzpayStatus,
                    mpPreapprovalId,
                    ...(cancellationReason !== undefined ? { cancellationReason } : {})
                }
            });
        } catch (auditError) {
            apiLogger.error(
                { error: auditError, subscriptionId: localSubscription.id },
                'Failed to insert subscription audit log entry'
            );
            // Do NOT throw - audit failure is non-blocking; status update must still commit
        }
    });

    // Clear entitlement cache to reflect status change immediately
    clearEntitlementCache(localSubscription.customerId);

    apiLogger.info(
        {
            subscriptionId: localSubscription.id,
            previousStatus,
            newStatus: mappedStatus,
            mpPreapprovalId: maskId(mpPreapprovalId),
            source
        },
        `Subscription status updated: ${previousStatus} -> ${mappedStatus}`
    );

    // Step 8b: Addon cancellation cleanup (CANCELLED transitions only)
    //
    // Runs AFTER the subscription status is committed to the DB and the
    // entitlement cache is cleared. If handleSubscriptionCancellationAddons
    // throws (partial failure), the error propagates to the webhook error
    // handler and MercadoPago will retry. Successfully revoked purchases are
    // already persisted as 'canceled' across retries (partial progress is safe).
    //
    // AC-1.9: if the customer does not exist in the billing system, log a
    // warning and acknowledge the event (return 200) to prevent infinite retries.
    if (mappedStatus === SubscriptionStatusEnum.CANCELLED) {
        let customerExists = true;

        try {
            await billing.customers.get(localSubscription.customerId);
        } catch (customerErr) {
            // Only treat a genuine 404 as "customer not found".
            // Infrastructure errors (timeout, 500, connection failure) must
            // propagate so MercadoPago retries the webhook — skipping addon
            // cleanup due to a transient error would silently leave orphaned
            // purchases in an active state (AC-1.9).
            const isNotFound =
                customerErr instanceof Error &&
                (('statusCode' in customerErr &&
                    (customerErr as { statusCode: number }).statusCode === 404) ||
                    ('status' in customerErr &&
                        (customerErr as { status: number }).status === 404));

            if (isNotFound) {
                customerExists = false;
            } else {
                throw customerErr;
            }
        }

        if (customerExists) {
            // Wrap in a 20s race to prevent MercadoPago double-processing (GAP-043-03).
            // If processing exceeds the deadline the webhook returns 200; cron Phase 4
            // picks up any remaining addon revocations on the next scheduled run.
            // Non-timeout errors propagate: MercadoPago will retry and partial DB
            // progress (per-addon commits) ensures idempotent re-processing.
            const cancellationTimeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(
                    () => reject(new Error('Webhook addon lifecycle timeout (20s)')),
                    WEBHOOK_TIMEOUT_MS
                );
            });

            try {
                await Promise.race([
                    handleSubscriptionCancellationAddons({
                        subscriptionId: localSubscription.id,
                        customerId: localSubscription.customerId,
                        billing,
                        db
                    }),
                    cancellationTimeoutPromise
                ]);
            } catch (err) {
                if (err instanceof Error && err.message.includes('timeout')) {
                    apiLogger.warn(
                        {
                            subscriptionId: localSubscription.id,
                            elapsedMs: WEBHOOK_TIMEOUT_MS,
                            source
                        },
                        'Addon lifecycle processing timed out — cron Phase 4 will complete remaining work'
                    );
                    // Return 200 to prevent MercadoPago retry — cron will handle remaining addons
                } else {
                    throw err; // Re-throw non-timeout errors
                }
            }
        } else {
            apiLogger.warn(
                {
                    subscriptionId: localSubscription.id,
                    customerId: localSubscription.customerId,
                    mpPreapprovalId: maskId(mpPreapprovalId),
                    source
                },
                'Customer not found in billing system during cancellation cleanup; skipping addon revocation (AC-1.9)'
            );
        }
    }

    // Step 8c: Payment failure tracking and retry warning (GAP-043-17)
    //
    // When a subscription transitions to PAST_DUE (payment failure), we increment
    // a failure counter in the subscription metadata. If the count reaches 2 or more,
    // we send a PAYMENT_RETRY_WARNING notification to warn the user before auto-cancel.
    //
    // This is fire-and-forget: errors do not block webhook processing.
    if (mappedStatus === SubscriptionStatusEnum.PAST_DUE) {
        try {
            // Atomic increment via jsonb_set to avoid read-modify-write race conditions.
            // RETURNING gives us the post-update value without a second SELECT.
            const [updatedSub] = await db
                .update(billingSubscriptions)
                .set({
                    metadata: sql`jsonb_set(
                        COALESCE(${billingSubscriptions.metadata}, '{}'::jsonb),
                        '{paymentFailureCount}',
                        to_jsonb(COALESCE((${billingSubscriptions.metadata}->>'paymentFailureCount')::int, 0) + 1)
                    )`,
                    updatedAt: new Date()
                })
                .where(eq(billingSubscriptions.id, localSubscription.id))
                .returning({ metadata: billingSubscriptions.metadata });

            const updatedMeta = (updatedSub?.metadata ?? {}) as Record<string, unknown>;
            const newFailureCount =
                typeof updatedMeta.paymentFailureCount === 'number'
                    ? updatedMeta.paymentFailureCount
                    : 1;

            apiLogger.info(
                {
                    subscriptionId: localSubscription.id,
                    customerId: localSubscription.customerId,
                    paymentFailureCount: newFailureCount
                },
                'Payment failure count incremented on subscription'
            );

            // Dispatch PAYMENT_RETRY_WARNING on 2nd+ failure
            if (newFailureCount >= PAYMENT_RETRY_WARNING_THRESHOLD) {
                const today = new Date().toISOString().split('T')[0] ?? '';
                const idempotencyKey = `payment_retry_warning:${localSubscription.customerId}:${newFailureCount}:${today}`;

                try {
                    const warningCustomer = await billing.customers.get(
                        localSubscription.customerId
                    );
                    if (warningCustomer) {
                        const warningCustomerName =
                            typeof warningCustomer.metadata?.name === 'string'
                                ? warningCustomer.metadata.name
                                : (warningCustomer.email ?? 'Usuario');
                        const warningUserId =
                            typeof warningCustomer.metadata?.userId === 'string'
                                ? warningCustomer.metadata.userId
                                : null;

                        sendNotification({
                            type: NotificationType.PAYMENT_RETRY_WARNING,
                            recipientEmail: warningCustomer.email,
                            recipientName: warningCustomerName,
                            userId: warningUserId,
                            customerId: localSubscription.customerId,
                            failureCount: newFailureCount,
                            maxRetries: PAYMENT_RETRY_MAX_ATTEMPTS,
                            idempotencyKey
                        }).catch((notifErr) => {
                            apiLogger.debug(
                                {
                                    subscriptionId: localSubscription.id,
                                    customerId: localSubscription.customerId,
                                    error:
                                        notifErr instanceof Error
                                            ? notifErr.message
                                            : String(notifErr)
                                },
                                'PAYMENT_RETRY_WARNING notification failed (will retry)'
                            );
                        });

                        apiLogger.info(
                            {
                                subscriptionId: localSubscription.id,
                                customerId: localSubscription.customerId,
                                paymentFailureCount: newFailureCount,
                                idempotencyKey
                            },
                            'Dispatched PAYMENT_RETRY_WARNING notification'
                        );
                    }
                } catch (customerLookupErr) {
                    apiLogger.warn(
                        {
                            subscriptionId: localSubscription.id,
                            customerId: localSubscription.customerId,
                            error:
                                customerLookupErr instanceof Error
                                    ? customerLookupErr.message
                                    : String(customerLookupErr)
                        },
                        'Could not look up customer for PAYMENT_RETRY_WARNING, skipping'
                    );
                }
            }
        } catch (paymentTrackingErr) {
            // Non-blocking: log and continue to avoid blocking webhook processing
            apiLogger.error(
                {
                    subscriptionId: localSubscription.id,
                    customerId: localSubscription.customerId,
                    error:
                        paymentTrackingErr instanceof Error
                            ? paymentTrackingErr.message
                            : String(paymentTrackingErr)
                },
                'Payment failure tracking failed, continuing webhook processing'
            );
        }
    }

    // Reset failure count when subscription becomes active again
    if (
        mappedStatus === SubscriptionStatusEnum.ACTIVE &&
        previousStatus === SubscriptionStatusEnum.PAST_DUE
    ) {
        try {
            // Atomically zero-out paymentFailureCount only if it is currently set.
            // Using jsonb_set avoids a prior read and prevents losing other metadata keys.
            await db
                .update(billingSubscriptions)
                .set({
                    metadata: sql`jsonb_set(
                        COALESCE(${billingSubscriptions.metadata}, '{}'::jsonb),
                        '{paymentFailureCount}',
                        '0'::jsonb
                    )`,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(billingSubscriptions.id, localSubscription.id),
                        sql`(${billingSubscriptions.metadata}->>'paymentFailureCount')::int > 0`
                    )
                );

            apiLogger.info(
                {
                    subscriptionId: localSubscription.id,
                    customerId: localSubscription.customerId
                },
                'Payment failure count reset on subscription reactivation'
            );
        } catch (resetErr) {
            // Non-blocking
            apiLogger.warn(
                {
                    subscriptionId: localSubscription.id,
                    error: resetErr instanceof Error ? resetErr.message : String(resetErr)
                },
                'Failed to reset payment failure count on reactivation'
            );
        }
    }

    // Step 9: Send notifications (fire-and-forget)
    let customer: Awaited<ReturnType<typeof billing.customers.get>> | null = null;
    let plan: Awaited<ReturnType<typeof billing.plans.get>> | null = null;
    try {
        customer = await billing.customers.get(localSubscription.customerId);
        plan = await billing.plans.get(localSubscription.planId);
    } catch (lookupError) {
        apiLogger.warn(
            { error: lookupError, subscriptionId: localSubscription.id },
            'Failed to fetch customer/plan for notification. Status update succeeded, skipping notifications.'
        );
        return { success: true, statusChanged: true, newStatus: mappedStatus };
    }

    const planName = plan?.name ?? 'Plan';
    const customerName =
        typeof customer?.metadata?.name === 'string'
            ? customer.metadata.name
            : (customer?.email ?? 'Usuario');
    const userId = typeof customer?.metadata?.userId === 'string' ? customer.metadata.userId : null;

    // Get period dates from retrieve() response
    const periodEndDate = mpSubscription.currentPeriodEnd;
    const currentPeriodEnd =
        periodEndDate && periodEndDate > new Date() ? periodEndDate.toISOString() : undefined;
    const nextBillingDate = currentPeriodEnd;

    if (shouldSendCancelledEmail(previousStatus, mappedStatus)) {
        await sendSubscriptionCancelledNotification({
            customerId: localSubscription.customerId,
            customerEmail: customer?.email ?? '',
            customerName,
            userId,
            planName,
            currentPeriodEnd,
            mpSubscriptionId: mpPreapprovalId,
            previousStatus
        }).catch((err) => {
            apiLogger.debug({ error: err }, 'Subscription cancelled notification failed');
        });
    }

    if (shouldSendPausedEmail(previousStatus, mappedStatus)) {
        await sendSubscriptionPausedNotification({
            customerId: localSubscription.customerId,
            customerEmail: customer?.email ?? '',
            customerName,
            userId,
            planName
        }).catch((err) => {
            apiLogger.debug({ error: err }, 'Subscription paused notification failed');
        });
    }

    if (shouldSendReactivationEmail(previousStatus, mappedStatus)) {
        await sendSubscriptionReactivatedNotification({
            customerId: localSubscription.customerId,
            customerEmail: customer?.email ?? '',
            customerName,
            userId,
            planName,
            nextBillingDate
        }).catch((err) => {
            apiLogger.debug({ error: err }, 'Subscription reactivated notification failed');
        });
    }

    // Step 10: Return success
    return { success: true, statusChanged: true, newStatus: mappedStatus };
}

// GAP-043-53: ADDON_RENEWAL_CONFIRMATION dispatch is intentionally not implemented here.
//
// MercadoPago handles add-on recurring billing externally and does not emit a
// distinct webhook event per add-on renewal. The `subscription_preapproval.updated`
// event only signals changes to the subscription's overall status (active, paused,
// canceled, etc.) — it carries no per-addon granularity.
//
// To implement ADDON_RENEWAL_CONFIRMATION in the future:
//   1. Create a dedicated webhook handler for add-on payment events (e.g.
//      `payment.approved` with metadata.type === 'addon_renewal').
//   2. Extract the addonSlug from the payment metadata.
//   3. Call sendNotification({ type: NotificationType.ADDON_RENEWAL_CONFIRMATION, ... })
//      after confirming the renewal in billing_addon_purchases.
//
// Until MercadoPago surfaces add-on renewal events separately, this notification
// cannot be reliably dispatched from subscription webhook processing without
// risking false positives or requiring a per-addon payment scan on every event.
