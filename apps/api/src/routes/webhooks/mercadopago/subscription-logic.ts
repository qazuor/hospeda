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
import { SubscriptionStatusEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { and, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../../../utils/logger.js';
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
        { mpPreapprovalId, providerEventId, source },
        'Processing subscription_preapproval.updated event'
    );

    // Step 2: Fetch subscription from MercadoPago API
    // If this throws, the error propagates to the caller (dead letter queue)
    const mpSubscription = await paymentAdapter.subscriptions
        .retrieve(mpPreapprovalId)
        .catch((error: unknown) => {
            Sentry.captureException(error, {
                extra: { mpPreapprovalId, providerEventId, source }
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
            { mpPreapprovalId, qzpayStatus, source },
            'Subscription in pending state - no status change applied'
        );
        return { success: true, statusChanged: false };
    }

    if (mappedStatus === undefined) {
        // Unknown status
        apiLogger.warn(
            { mpPreapprovalId, qzpayStatus, source },
            `Unknown QZPay subscription status: ${qzpayStatus}`
        );
        Sentry.captureException(new Error(`Unknown QZPay subscription status: ${qzpayStatus}`), {
            extra: { mpPreapprovalId, providerEventId, source }
        });
        return { success: true, statusChanged: false };
    }

    // Step 5: Query local subscription via direct Drizzle query
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
            { mpPreapprovalId, source },
            `No local subscription found for mp_subscription_id=${mpPreapprovalId}`
        );
        return { success: true, statusChanged: false };
    }

    // Step 6: Compare statuses
    const previousStatus = localSubscription.status;
    if (previousStatus === mappedStatus) {
        apiLogger.debug(
            { subscriptionId: localSubscription.id, status: mappedStatus, source },
            `No status change for subscription ${localSubscription.id}: still ${mappedStatus}`
        );
        return { success: true, statusChanged: false };
    }

    // Step 7: Update billing_subscriptions
    const updateData: Record<string, unknown> = {
        status: mappedStatus,
        updatedAt: new Date()
    };

    // Only set canceled_at if transitioning TO cancelled and not already set
    if (mappedStatus === SubscriptionStatusEnum.CANCELLED && !localSubscription.canceledAt) {
        updateData.canceledAt = new Date();
    }

    // Reset cancel_at_period_end when reactivating
    if (mappedStatus === SubscriptionStatusEnum.ACTIVE && localSubscription.cancelAtPeriodEnd) {
        updateData.cancelAtPeriodEnd = false;
    }

    await db
        .update(billingSubscriptions)
        .set(updateData)
        .where(eq(billingSubscriptions.id, localSubscription.id));

    apiLogger.info(
        {
            subscriptionId: localSubscription.id,
            previousStatus,
            newStatus: mappedStatus,
            mpPreapprovalId,
            source
        },
        `Subscription status updated: ${previousStatus} -> ${mappedStatus}`
    );

    // Step 8: Insert audit log (non-blocking)
    try {
        await db.insert(billingSubscriptionEvents).values({
            subscriptionId: localSubscription.id,
            previousStatus,
            newStatus: mappedStatus,
            triggerSource: source ?? 'webhook',
            providerEventId,
            metadata: {
                qzpayStatus,
                mpPreapprovalId
            }
        });
    } catch (auditError) {
        apiLogger.error(
            { error: auditError, subscriptionId: localSubscription.id },
            'Failed to insert subscription audit log entry'
        );
        // Do NOT throw - audit failure is non-blocking
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
