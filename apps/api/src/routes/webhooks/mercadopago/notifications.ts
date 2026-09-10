/**
 * Notification helpers for MercadoPago webhook payment events.
 *
 * All notification sends are best-effort: failures are logged but
 * do not interrupt webhook processing.
 *
 * @module routes/webhooks/mercadopago/notifications
 */

import type { Major } from '@repo/billing';
import { NotificationType } from '@repo/notifications';
import type { getQZPayBilling } from '../../../middlewares/billing';
import { resolvePlanDisplayName } from '../../../services/billing/plan-change-reason';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import {
    type NotificationSendOutcome,
    sendNotification,
    trySendNotification
} from '../../../utils/notification-helper';
import { sanitizeErrorForNotification } from './utils';

/**
 * Send payment success notification (best-effort, awaitable) and REPORT whether
 * it was delivered.
 *
 * Looks up customer and plan data, then sends a PAYMENT_SUCCESS notification.
 * Never throws.
 *
 * This is the single producer of `PAYMENT_SUCCESS` — every docblock in
 * `@repo/notifications` that calls it "the only producer" of a {@link Major}
 * amount depends on that staying true, which is why HOS-1238 added a second
 * CALL SITE here rather than a second producer.
 *
 * HOS-1238 made it return a {@link NotificationSendOutcome} instead of `void`.
 * It previously reported a failure at `debug`, which production never emits
 * (`LOG_LEVEL` defaults to `info`), so a receipt that never went out left no
 * trace anywhere — and a caller had no way to notice either. The outcome is what
 * lets {@link dispatchSubscriptionChargeReceipt} escalate that silence.
 *
 * @param customerId - Billing customer ID
 * @param amount - Payment amount in MAJOR units (ARS pesos) — the unit the
 *   customer-facing email renders verbatim. HOS-720 put that in the type:
 *   `billing_payments` stores CENTAVOS, and HOS-713 reached this exact
 *   parameter with an unconverted centavo figure, mailing a real $150.00
 *   charge as $15.000,00.
 * @param currency - Payment currency code
 * @param paymentMethod - Payment method used, if available
 * @param billing - QZPay billing instance
 * @param idempotencyKey - Optional key identifying THIS payment's receipt.
 *   Stored by the notification service in
 *   `billing_notification_log.metadata->>'idempotencyKey'`, which is what the
 *   caller reads back to decide whether the receipt already went out (HOS-757).
 *   Passing it does NOT itself prevent a second delivery — it only records the
 *   key; the caller's pre-send lookup is the gate, exactly as in
 *   `addon-expiry.job.ts`.
 * @param planId - Optional `billing_plans.id` of the subscription this payment
 *   actually belongs to (HOS-1238). When given, the plan label is resolved from
 *   IT; otherwise the customer's first subscription supplies it. That fallback is
 *   a guess: an account legitimately holds several subscriptions at once across
 *   the five product domains, so on a gastronomy or partner charge
 *   `getByCustomerId()[0]` names a plan the customer was not charged for. Any
 *   caller that knows which subscription was charged must pass this.
 * @returns `{ delivered: true }` only when the notification service reported a
 *   successful send; `{ delivered: false }` when the customer could not be
 *   resolved, the send was not delivered, or anything threw.
 */
export async function sendPaymentSuccessNotification(
    customerId: string,
    amount: Major,
    currency: string,
    paymentMethod: string | null,
    billing: ReturnType<typeof getQZPayBilling>,
    idempotencyKey?: string,
    planId?: string | null
): Promise<NotificationSendOutcome> {
    if (!billing) return { delivered: false };

    try {
        const customer = await billing.customers.get(customerId);

        if (!customer) {
            // Previously returned in total silence. A customer that cannot be
            // resolved is a receipt nobody will ever send, so it is reported at a
            // level production emits — matching the failure sibling below, which
            // has always warned on this exact case.
            apiLogger.warn(
                { customerId },
                'Customer not found for payment success notification — no receipt sent'
            );
            return { delivered: false };
        }

        const customerName =
            typeof customer.metadata?.name === 'string' ? customer.metadata.name : customer.email;
        const userId =
            typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

        // HOS-1238: prefer the plan of the subscription that was actually
        // charged. Only fall back to the customer's first subscription when the
        // caller could not say — see the `planId` parameter docs.
        let resolvedPlanId: string | null = planId ?? null;
        if (resolvedPlanId === null) {
            const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
            resolvedPlanId = subscriptions?.[0]?.planId ?? null;
        }

        // HOS-231: `plan.name` is the SLUG; resolve the display name so the
        // payment-success email shows a human label (falls back to generic).
        let planName = 'Subscription';
        if (resolvedPlanId) {
            planName = (await resolvePlanDisplayName({ planId: resolvedPlanId })) ?? planName;
        }

        return await trySendNotification({
            type: NotificationType.PAYMENT_SUCCESS,
            recipientEmail: customer.email,
            recipientName: customerName,
            userId,
            customerId: customer.id,
            planName,
            amount,
            currency,
            paymentMethod: paymentMethod || undefined,
            ...(idempotencyKey === undefined ? {} : { idempotencyKey })
        });
    } catch (error) {
        // Raised at `error` from `debug` (HOS-1238): a paying customer left
        // without a receipt is not a diagnostic detail, and at `debug` it was
        // never emitted in production at all.
        apiLogger.error(
            {
                customerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to prepare payment success notification — no receipt sent',
            { capture: true }
        );
        return { delivered: false };
    }
}

/*
 * REMOVED, HOS-1012 T-027: `sendTrialNotGrantedAdminAlert`.
 *
 * It told a human that MercadoPago had charged somebody instead of honouring
 * the free trial we advertised (H-137). Hospeda no longer asks MercadoPago for
 * a trial (guard G-1), so a preapproval carries no promise for a charge to
 * break, and the Hospeda-owned trial has no preapproval behind it at all.
 */

/**
 * Send payment failure notifications (best-effort, awaitable).
 *
 * Sends two notifications:
 * 1. A user-facing PAYMENT_FAILURE notification with sanitized error details.
 * 2. An ADMIN_PAYMENT_FAILURE notification to all configured admin emails.
 *
 * Failures are logged at debug level and do not propagate.
 *
 * @param customerId - Billing customer ID
 * @param amount - Payment amount in MAJOR units (ARS pesos) — see the note on
 *   {@link sendPaymentSuccessNotification}'s `amount` (HOS-720).
 * @param currency - Payment currency code
 * @param failureReason - Raw failure reason string (will be sanitized before sending)
 * @param billing - QZPay billing instance
 */
export async function sendPaymentFailureNotifications(
    customerId: string,
    amount: Major,
    currency: string,
    failureReason: string,
    billing: ReturnType<typeof getQZPayBilling>
): Promise<void> {
    if (!billing) return;

    try {
        const customer = await billing.customers.get(customerId);
        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
        const subscription = subscriptions?.[0];

        if (!customer) {
            apiLogger.warn({ customerId }, 'Customer not found for payment failure notification');
            return;
        }

        const customerName =
            typeof customer.metadata?.name === 'string' ? customer.metadata.name : customer.email;
        const userId =
            typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

        // HOS-231: the qzpay adapter's `plan.name` is the SLUG (`owner-basico`);
        // resolve the display name (`Basic`) so the payment email shows a human
        // label. Falls back to the generic 'Subscription' when unresolved.
        let planName = 'Subscription';
        if (subscription?.planId) {
            planName = (await resolvePlanDisplayName({ planId: subscription.planId })) ?? planName;
        }

        const sanitizedUserReason = sanitizeErrorForNotification(failureReason, 200);

        await sendNotification({
            type: NotificationType.PAYMENT_FAILURE,
            recipientEmail: customer.email,
            recipientName: customerName,
            userId,
            customerId: customer.id,
            planName,
            amount,
            currency,
            failureReason: sanitizedUserReason
        }).catch((error) => {
            apiLogger.debug(
                {
                    customerId,
                    error: error instanceof Error ? error.message : String(error)
                },
                'User payment failure notification failed (will retry)'
            );
        });

        const sanitizedAdminReason = sanitizeErrorForNotification(failureReason, 500);
        const adminEmails =
            env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) ?? [];

        for (const adminEmail of adminEmails) {
            if (adminEmail) {
                const affectedUserId =
                    typeof customer.metadata?.userId === 'string'
                        ? customer.metadata.userId
                        : undefined;

                await sendNotification({
                    type: NotificationType.ADMIN_PAYMENT_FAILURE,
                    recipientEmail: adminEmail,
                    recipientName: 'Admin',
                    userId: null,
                    customerId: customer.id,
                    affectedUserEmail: customer.email,
                    affectedUserId,
                    eventDetails: {
                        amount,
                        currency,
                        failureReason: sanitizedAdminReason,
                        planName
                    },
                    severity: 'warning'
                }).catch((error) => {
                    apiLogger.debug(
                        {
                            customerId,
                            adminEmail,
                            error: error instanceof Error ? error.message : String(error)
                        },
                        'Admin payment failure notification failed (will retry)'
                    );
                });
            }
        }
    } catch (error) {
        apiLogger.debug(
            {
                customerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to prepare payment failure notifications'
        );
    }
}

/**
 * Sends a cancellation notification to the user AND an admin alert.
 *
 * The user receives a SUBSCRIPTION_CANCELLED notification. Admins receive an
 * ADMIN_SYSTEM_EVENT alert with mpSubscriptionId and previousStatus for
 * investigation of involuntary cancellations.
 *
 * @param params.customerId - Billing customer ID
 * @param params.customerEmail - Customer email address
 * @param params.customerName - Customer display name
 * @param params.userId - Associated user ID, or null if not linked
 * @param params.planName - Name of the cancelled subscription plan
 * @param params.currentPeriodEnd - ISO date string of the current period end, if available
 * @param params.mpSubscriptionId - MercadoPago subscription ID for admin reference
 * @param params.previousStatus - Status before cancellation for admin investigation
 */
export async function sendSubscriptionCancelledNotification(params: {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly userId: string | null;
    readonly planName: string;
    readonly currentPeriodEnd?: string;
    readonly mpSubscriptionId: string;
    readonly previousStatus: string;
}): Promise<void> {
    try {
        // User notification
        if (params.customerEmail) {
            await sendNotification({
                type: NotificationType.SUBSCRIPTION_CANCELLED,
                recipientEmail: params.customerEmail,
                recipientName: params.customerName,
                userId: params.userId,
                customerId: params.customerId,
                planName: params.planName,
                currentPeriodEnd: params.currentPeriodEnd
            }).catch((err) => {
                apiLogger.debug(
                    {
                        error: err instanceof Error ? err.message : String(err),
                        customerId: params.customerId
                    },
                    'Subscription cancelled user notification failed (will retry)'
                );
            });
        }

        // Admin alert for involuntary cancellation
        const adminEmails =
            env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) ?? [];
        for (const adminEmail of adminEmails) {
            if (adminEmail) {
                await sendNotification({
                    type: NotificationType.ADMIN_SYSTEM_EVENT,
                    recipientEmail: adminEmail,
                    recipientName: 'Admin',
                    userId: null,
                    severity: 'warning' as const,
                    eventDetails: {
                        eventType: 'subscription_involuntary_cancellation',
                        customerEmail: params.customerEmail,
                        planName: params.planName,
                        mpSubscriptionId: params.mpSubscriptionId,
                        previousStatus: params.previousStatus
                    }
                }).catch((err) => {
                    apiLogger.debug(
                        {
                            error: err instanceof Error ? err.message : String(err),
                            adminEmail
                        },
                        'Admin cancellation alert failed (will retry)'
                    );
                });
            }
        }
    } catch (error) {
        apiLogger.debug(
            {
                error: error instanceof Error ? error.message : String(error),
                customerId: params.customerId
            },
            'sendSubscriptionCancelledNotification failed'
        );
    }
}

/**
 * Sends a pause/suspension notification to the user.
 *
 * Fires a SUBSCRIPTION_PAUSED notification to the customer email. If the
 * email is empty the function returns early without sending. Failures are
 * logged at debug level and do not propagate.
 *
 * @param params.customerId - Billing customer ID
 * @param params.customerEmail - Customer email address
 * @param params.customerName - Customer display name
 * @param params.userId - Associated user ID, or null if not linked
 * @param params.planName - Name of the paused subscription plan
 */
export async function sendSubscriptionPausedNotification(params: {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly userId: string | null;
    readonly planName: string;
}): Promise<void> {
    try {
        if (!params.customerEmail) return;

        await sendNotification({
            type: NotificationType.SUBSCRIPTION_PAUSED,
            recipientEmail: params.customerEmail,
            recipientName: params.customerName,
            userId: params.userId,
            customerId: params.customerId,
            planName: params.planName
        }).catch((err) => {
            apiLogger.debug(
                {
                    error: err instanceof Error ? err.message : String(err),
                    customerId: params.customerId
                },
                'Subscription paused notification failed (will retry)'
            );
        });
    } catch (error) {
        apiLogger.debug(
            {
                error: error instanceof Error ? error.message : String(error),
                customerId: params.customerId
            },
            'sendSubscriptionPausedNotification failed'
        );
    }
}

/**
 * Sends a reactivation confirmation to the user.
 *
 * Fires a SUBSCRIPTION_REACTIVATED notification to the customer email. If the
 * email is empty the function returns early without sending. Failures are
 * logged at debug level and do not propagate.
 *
 * @param params.customerId - Billing customer ID
 * @param params.customerEmail - Customer email address
 * @param params.customerName - Customer display name
 * @param params.userId - Associated user ID, or null if not linked
 * @param params.planName - Name of the reactivated subscription plan
 * @param params.nextBillingDate - ISO date string of the next billing date, if available
 */
export async function sendSubscriptionReactivatedNotification(params: {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly customerName: string;
    readonly userId: string | null;
    readonly planName: string;
    readonly nextBillingDate?: string;
}): Promise<void> {
    try {
        if (!params.customerEmail) return;

        await sendNotification({
            type: NotificationType.SUBSCRIPTION_REACTIVATED,
            recipientEmail: params.customerEmail,
            recipientName: params.customerName,
            userId: params.userId,
            customerId: params.customerId,
            planName: params.planName,
            nextBillingDate: params.nextBillingDate
        }).catch((err) => {
            apiLogger.debug(
                {
                    error: err instanceof Error ? err.message : String(err),
                    customerId: params.customerId
                },
                'Subscription reactivated notification failed (will retry)'
            );
        });
    } catch (error) {
        apiLogger.debug(
            {
                error: error instanceof Error ? error.message : String(error),
                customerId: params.customerId
            },
            'sendSubscriptionReactivatedNotification failed'
        );
    }
}
