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
            process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) || [];

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
