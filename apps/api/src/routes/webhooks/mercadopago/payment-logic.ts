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

import type { QZPayBilling, QZPayCurrency, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import { getAddonBySlug } from '@repo/billing';
import { and, billingSubscriptions, eq, getDb, isNull, sql } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { AddonService } from '../../../services/addon.service';
import { apiLogger } from '../../../utils/logger';
import { sendNotification } from '../../../utils/notification-helper';
import { sendPaymentFailureNotifications, sendPaymentSuccessNotification } from './notifications';
import {
    extractAddonFromReference,
    extractAddonMetadata,
    extractAnnualSubscriptionMetadata,
    extractPaymentInfo
} from './utils';

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
    /** True when this event activated an annual subscription (SPEC-141 D1). */
    readonly annualSubscriptionConfirmed?: boolean;
}

/**
 * MP payment statuses that indicate the charge cleared successfully and
 * the linked annual subscription should be activated.
 */
const MP_APPROVED_STATUSES = new Set(['approved', 'accredited']);

/**
 * Activate an annual local subscription after the linked MP one-time
 * payment cleared (SPEC-141 D1).
 *
 * Idempotent: a subsequent webhook for the same payment finds the
 * subscription already in `active` status and returns without
 * re-recording anything. Errors are swallowed (logged) so a single
 * noisy event cannot block the webhook bucket — MP will retry.
 */
async function confirmAnnualSubscription(input: {
    readonly annualSubscriptionId: string;
    readonly providerPaymentId: string;
    readonly amount: number;
    readonly currency: string;
    readonly billing: QZPayBilling;
    readonly source: string;
}): Promise<{ confirmed: boolean }> {
    const { annualSubscriptionId, providerPaymentId, amount, currency, billing, source } = input;

    const db = getDb();
    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.id, annualSubscriptionId),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(1);

    const sub = rows[0];
    if (!sub) {
        apiLogger.warn(
            { annualSubscriptionId, providerPaymentId, source },
            'Annual subscription confirmation: local subscription not found — payment ignored'
        );
        return { confirmed: false };
    }

    if (sub.status === SubscriptionStatusEnum.ACTIVE) {
        apiLogger.info(
            { annualSubscriptionId, providerPaymentId, source },
            'Annual subscription confirmation: subscription already active — idempotent skip'
        );
        return { confirmed: false };
    }

    if (sub.status !== SubscriptionStatusEnum.PENDING_PROVIDER) {
        apiLogger.warn(
            {
                annualSubscriptionId,
                providerPaymentId,
                source,
                currentStatus: sub.status
            },
            'Annual subscription confirmation: subscription is not pending_provider — payment ignored'
        );
        return { confirmed: false };
    }

    // Dedupe at the payment level too: if a row with this MP payment id
    // already exists, skip the record() to avoid double-inserts when MP
    // resends `payment.updated` for the same charge.
    const existingPayment = await db
        .select({ id: billingSubscriptions.id })
        .from(sql`billing_payments`)
        .where(sql`provider_payment_ids->>'mercadopago' = ${providerPaymentId}`)
        .limit(1);

    if (existingPayment.length === 0) {
        const amountInCentavos = Math.round(amount * 100);
        try {
            await billing.payments.record({
                id: crypto.randomUUID(),
                customerId: sub.customerId,
                amount: amountInCentavos,
                currency: currency as QZPayCurrency,
                status: 'succeeded' as QZPayPaymentStatus,
                provider: 'mercadopago',
                providerPaymentId,
                subscriptionId: sub.id,
                metadata: {
                    flow: 'annual-upfront',
                    annualSubscriptionId
                }
            });
        } catch (recordErr) {
            apiLogger.error(
                {
                    annualSubscriptionId,
                    providerPaymentId,
                    source,
                    error: recordErr instanceof Error ? recordErr.message : String(recordErr)
                },
                'Annual subscription confirmation: failed to record billing_payments row — continuing with status flip'
            );
        }
    } else {
        apiLogger.debug(
            { annualSubscriptionId, providerPaymentId, source },
            'Annual subscription confirmation: payment already recorded — skipping record'
        );
    }

    // Flip the local subscription status from pending_provider to active.
    // billing.subscriptions.update() does not accept 'pending_provider' as
    // an input status (qzpay enum is narrower than Hospeda's), so we
    // update the row directly via Drizzle — matches the pattern used
    // by subscription-logic.ts for the monthly preapproval lifecycle.
    await db
        .update(billingSubscriptions)
        .set({ status: SubscriptionStatusEnum.ACTIVE, updatedAt: new Date() })
        .where(eq(billingSubscriptions.id, sub.id));

    apiLogger.info(
        {
            annualSubscriptionId,
            providerPaymentId,
            customerId: sub.customerId,
            amount,
            currency,
            source
        },
        'Annual subscription activated by MP payment confirmation'
    );

    return { confirmed: true };
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

    // SPEC-141 D1: annual subscription confirmation. The metadata
    // carries `annualSubscriptionId` set by initiatePaidAnnualSubscription;
    // we look it up here BEFORE the addon dispatch since both flows go
    // through the same payment.updated event but are mutually exclusive
    // (annual checkout never carries addonSlug metadata and vice versa).
    const annualSubscriptionId = extractAnnualSubscriptionMetadata(data.metadata);

    if (annualSubscriptionId && paymentInfo && MP_APPROVED_STATUSES.has(paymentInfo.status)) {
        const providerPaymentId =
            typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : null;

        if (providerPaymentId) {
            try {
                const result = await confirmAnnualSubscription({
                    annualSubscriptionId,
                    providerPaymentId,
                    amount: paymentInfo.amount,
                    currency: paymentInfo.currency,
                    billing,
                    source
                });
                return {
                    success: true,
                    addonConfirmed: false,
                    annualSubscriptionConfirmed: result.confirmed
                };
            } catch (annualErr) {
                apiLogger.error(
                    {
                        annualSubscriptionId,
                        source,
                        error: annualErr instanceof Error ? annualErr.message : String(annualErr)
                    },
                    'Annual subscription confirmation: unexpected error — event acknowledged'
                );
                return { success: false, addonConfirmed: false };
            }
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

    // ── Idempotency check: skip if this paymentId was already processed ───────
    const paymentId =
        typeof data.id === 'string' || typeof data.id === 'number' ? String(data.id) : null;

    if (paymentId) {
        try {
            const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
            const db = getDb();

            const [existing] = await db
                .select({ id: billingAddonPurchases.id })
                .from(billingAddonPurchases)
                .where(eq(billingAddonPurchases.paymentId, paymentId))
                .limit(1);

            if (existing) {
                apiLogger.info(
                    { addonSlug, customerId: addonCustomerId, paymentId, source },
                    'Add-on purchase already processed for this paymentId — skipping (idempotent)'
                );
                return { success: true, addonConfirmed: false };
            }
        } catch (idempotencyCheckError) {
            apiLogger.warn(
                {
                    addonSlug,
                    customerId: addonCustomerId,
                    paymentId,
                    source,
                    error:
                        idempotencyCheckError instanceof Error
                            ? idempotencyCheckError.message
                            : String(idempotencyCheckError)
                },
                'Idempotency check failed — proceeding with addon confirmation'
            );
        }
    }

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
