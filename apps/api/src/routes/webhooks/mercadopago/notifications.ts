/**
 * Notification helpers for MercadoPago webhook payment events.
 *
 * All notification sends are best-effort: failures are logged but
 * do not interrupt webhook processing. Functions are async so they
 * can be properly awaited in serverless environments (Vercel).
 *
 * @module routes/webhooks/mercadopago/notifications
 */

import { NotificationType } from '@repo/notifications';
import type { getQZPayBilling } from '../../../middlewares/billing';
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
 * @param amount - Payment amount
 * @param currency - Payment currency code
 * @param paymentMethod - Payment method used, if available
 * @param billing - QZPay billing instance
 */
export async function sendPaymentSuccessNotification(
    customerId: string,
    amount: number,
    currency: string,
    paymentMethod: string | null,
    billing: ReturnType<typeof getQZPayBilling>
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

            let planName = 'Subscription';
            if (subscription?.planId) {
                try {
                    const plan = await billing.plans.get(subscription.planId);
                    planName = plan?.name || 'Subscription';
                } catch {
                    // Ignore plan fetch errors
                }
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
                paymentMethod: paymentMethod || undefined
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
 * Send payment failure notifications (best-effort, awaitable).
 *
 * Sends two notifications:
 * 1. A user-facing PAYMENT_FAILURE notification with sanitized error details.
 * 2. An ADMIN_PAYMENT_FAILURE notification to all configured admin emails.
 *
 * Failures are logged at debug level and do not propagate.
 *
 * @param customerId - Billing customer ID
 * @param amount - Payment amount
 * @param currency - Payment currency code
 * @param failureReason - Raw failure reason string (will be sanitized before sending)
 * @param billing - QZPay billing instance
 */
export async function sendPaymentFailureNotifications(
    customerId: string,
    amount: number,
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

        const retryDate = new Date();
        retryDate.setDate(retryDate.getDate() + 3);

        const customerName =
            typeof customer.metadata?.name === 'string' ? customer.metadata.name : customer.email;
        const userId =
            typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

        let planName = 'Subscription';
        if (subscription?.planId) {
            try {
                const plan = await billing.plans.get(subscription.planId);
                planName = plan?.name || 'Subscription';
            } catch {
                // Ignore plan fetch errors
            }
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
            failureReason: sanitizedUserReason,
            retryDate: retryDate.toISOString()
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
                        planName,
                        retryDate: retryDate.toISOString()
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
