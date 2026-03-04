/**
 * Shared payment processing logic.
 *
 * Extracted from payment-handler.ts and webhook-retry.job.ts to eliminate
 * ~120 lines of duplicated business logic. This module handles:
 * - Payment status notification dispatch (success/failure)
 * - Add-on purchase confirmation and notification
 *
 * @module routes/webhooks/mercadopago/payment-logic
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { getAddonBySlug } from '@repo/billing';
import { NotificationType } from '@repo/notifications';
import { AddonService } from '../../../services/addon.service';
import { apiLogger } from '../../../utils/logger';
import { sendNotification } from '../../../utils/notification-helper';
import { sendPaymentFailureNotifications, sendPaymentSuccessNotification } from './notifications';
import { extractAddonFromReference, extractAddonMetadata, extractPaymentInfo } from './utils';

/** Input for processing a payment.updated event */
interface ProcessPaymentUpdatedInput {
    /** Parsed event data object */
    readonly data: Record<string, unknown>;
    /** QZPay billing instance */
    readonly billing: QZPayBilling;
    /** Caller context label for log messages */
    readonly source?: string;
}

/** Result of processing a payment.updated event */
interface ProcessPaymentUpdatedResult {
    readonly success: boolean;
    readonly addonConfirmed: boolean;
}

/**
 * Process a payment.updated event's business logic.
 *
 * Dispatches payment success/failure notifications and confirms add-on
 * purchases when applicable. This function is context-free and can be
 * called from both the live webhook handler and the dead letter retry job.
 *
 * @param input - Payment event data and billing instance
 * @returns Result indicating success and whether an addon was confirmed
 */
export async function processPaymentUpdated({
    data,
    billing,
    source = 'webhook'
}: ProcessPaymentUpdatedInput): Promise<ProcessPaymentUpdatedResult> {
    const paymentInfo = extractPaymentInfo(data);
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const customerId = typeof metadata?.customerId === 'string' ? metadata.customerId : null;

    // Dispatch payment status notifications
    if (paymentInfo && customerId) {
        const { amount, currency, status, statusDetail, paymentMethod } = paymentInfo;

        if (status === 'approved' || status === 'accredited') {
            apiLogger.debug(
                { customerId, amount, currency, status, source },
                'Payment succeeded - sending success notification'
            );

            await sendPaymentSuccessNotification(
                customerId,
                amount,
                currency,
                paymentMethod,
                billing
            );
        }

        if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
            const failureReason = statusDetail || status;

            apiLogger.debug(
                { customerId, amount, currency, status, statusDetail, source },
                'Payment failed - sending failure notifications'
            );

            await sendPaymentFailureNotifications(
                customerId,
                amount,
                currency,
                failureReason,
                billing
            );
        }
    }

    // Resolve add-on information from metadata or external_reference
    const addonInfo = extractAddonMetadata(data.metadata);

    if (!addonInfo) {
        const addonSlug = extractAddonFromReference(data.external_reference);

        if (addonSlug) {
            apiLogger.warn(
                {
                    addonSlug,
                    externalReference: data.external_reference,
                    hasMetadata: !!data.metadata,
                    metadataKeys: data.metadata ? Object.keys(data.metadata as object) : [],
                    paymentId: data.id,
                    paymentStatus: data.status,
                    source
                },
                'Found add-on slug in external_reference but missing customerId - addon purchase may not be confirmed properly'
            );
        }

        return { success: true, addonConfirmed: false };
    }

    const { addonSlug, customerId: addonCustomerId } = addonInfo;

    apiLogger.info(
        { addonSlug, customerId: addonCustomerId, source },
        'Processing add-on purchase'
    );

    const addonService = new AddonService(billing);
    const result = await addonService.confirmPurchase({
        customerId: addonCustomerId,
        addonSlug
    });

    if (!result.success) {
        apiLogger.error(
            { addonSlug, customerId: addonCustomerId, error: result.error, source },
            'Failed to confirm add-on purchase'
        );
        return { success: false, addonConfirmed: false };
    }

    apiLogger.info(
        { addonSlug, customerId: addonCustomerId, source },
        'Add-on purchase confirmed successfully'
    );

    // Send addon purchase notification
    try {
        const customer = await billing.customers.get(addonCustomerId);
        const addon = getAddonBySlug(addonSlug);

        if (customer && addon) {
            const customerName =
                typeof customer.metadata?.name === 'string'
                    ? customer.metadata.name
                    : customer.email;
            const userId =
                typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

            sendNotification({
                type: NotificationType.ADDON_PURCHASE,
                recipientEmail: customer.email,
                recipientName: customerName,
                userId,
                customerId: customer.id,
                planName: addon.name,
                amount: typeof data.transaction_amount === 'number' ? data.transaction_amount : 0,
                currency: typeof data.currency_id === 'string' ? data.currency_id : 'ARS',
                nextBillingDate: new Date().toISOString()
            }).catch((notifError) => {
                apiLogger.debug(
                    {
                        customerId: addonCustomerId,
                        addonSlug,
                        error:
                            notifError instanceof Error ? notifError.message : String(notifError),
                        source
                    },
                    'Addon purchase notification failed (will retry)'
                );
            });
        }
    } catch (notifError) {
        apiLogger.debug(
            {
                customerId: addonCustomerId,
                addonSlug,
                error: notifError instanceof Error ? notifError.message : String(notifError),
                source
            },
            'Failed to prepare addon purchase notification'
        );
    }

    return { success: true, addonConfirmed: true };
}
