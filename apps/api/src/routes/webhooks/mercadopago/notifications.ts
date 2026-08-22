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
import { sendNotification } from '../../../utils/notification-helper';
import { sanitizeErrorForNotification } from './utils';

/**
 * Send payment success notification (best-effort, awaitable).
 *
 * Looks up customer and plan data, then sends a PAYMENT_SUCCESS notification.
 * Failures are logged at debug level and do not propagate.
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
 */
export async function sendPaymentSuccessNotification(
    customerId: string,
    amount: Major,
    currency: string,
    paymentMethod: string | null,
    billing: ReturnType<typeof getQZPayBilling>,
    idempotencyKey?: string
): Promise<void> {
    if (!billing) return;

    try {
        const customer = await billing.customers.get(customerId);
        const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
        const subscription = subscriptions?.[0];

        if (customer) {
            const customerName =
                typeof customer.metadata?.name === 'string'
                    ? customer.metadata.name
                    : customer.email;
            const userId =
                typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

            // HOS-231: `plan.name` is the SLUG; resolve the display name so the
            // payment-success email shows a human label (falls back to generic).
            let planName = 'Subscription';
            if (subscription?.planId) {
                planName =
                    (await resolvePlanDisplayName({ planId: subscription.planId })) ?? planName;
            }

            await sendNotification({
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
            }).catch((error) => {
                apiLogger.debug(
                    {
                        customerId,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'Payment success notification failed (will retry)'
                );
            });
        }
    } catch (error) {
        apiLogger.debug(
            {
                customerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to prepare payment success notification'
        );
    }
}

/**
 * Alert admins that a customer was charged instead of receiving the free trial
 * they were promised (H-137).
 *
 * There is deliberately NO customer-facing message here. Telling somebody "the
 * free period we advertised did not apply and you have been billed" is
 * commercial copy with a remedy attached (refund? honour the trial anyway?
 * apologise and continue?), and that remedy is an owner decision, not a default
 * this function gets to invent. What it does guarantee is that the situation
 * reaches a human the moment it happens, with the customer's email in hand —
 * instead of the current state, where the only party informed is MercadoPago.
 *
 * Best-effort and never throws: the charge already settled and is recorded.
 *
 * @param params.customerId - Billing customer id.
 * @param params.customerEmail - Who was charged. The point of the alert.
 * @param params.planName - Human plan label, already resolved.
 * @param params.promisedTrialEnd - When the trial was supposed to end, ISO.
 * @param params.chargedAt - When MercadoPago actually took the money, ISO.
 * @param params.mpSubscriptionId - Preapproval id, for lookup in MercadoPago.
 */
export async function sendTrialNotGrantedAdminAlert(params: {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly planName: string;
    readonly promisedTrialEnd: string | null;
    readonly chargedAt: string;
    readonly mpSubscriptionId: string | null;
}): Promise<void> {
    try {
        const adminEmails =
            env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) ?? [];

        for (const adminEmail of adminEmails) {
            if (!adminEmail) continue;

            await sendNotification({
                type: NotificationType.ADMIN_SYSTEM_EVENT,
                recipientEmail: adminEmail,
                recipientName: 'Admin',
                userId: null,
                severity: 'warning' as const,
                eventDetails: {
                    eventType: 'trial_not_granted_by_provider',
                    customerEmail: params.customerEmail,
                    customerId: params.customerId,
                    planName: params.planName,
                    promisedTrialEnd: params.promisedTrialEnd,
                    chargedAt: params.chargedAt,
                    mpSubscriptionId: params.mpSubscriptionId
                }
            }).catch((err) => {
                apiLogger.debug(
                    {
                        error: err instanceof Error ? err.message : String(err),
                        adminEmail
                    },
                    'Trial-not-granted admin alert failed (will retry)'
                );
            });
        }
    } catch (error) {
        apiLogger.debug(
            {
                error: error instanceof Error ? error.message : String(error),
                customerId: params.customerId
            },
            'sendTrialNotGrantedAdminAlert failed'
        );
    }
}

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
