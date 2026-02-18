/**
 * MercadoPago Webhook Routes
 *
 * Handles incoming IPN (Instant Payment Notification) webhooks from MercadoPago.
 * Processes payment and subscription events for the billing system.
 *
 * Security:
 * - Webhook signature verification via MercadoPago adapter
 * - No authentication required (public endpoint, verified by signature)
 * - Idempotent processing to prevent duplicate event handling
 *
 * Events Handled:
 * - payment.created - New payment initiated
 * - payment.updated - Payment status changed
 * - subscription_preapproval.updated - Subscription status changed
 *
 * @module routes/webhooks/mercadopago
 */

import { createWebhookRouter } from '@qazuor/qzpay-hono';
import type { QZPayWebhookHandler } from '@qazuor/qzpay-hono';
import { createMercadoPagoAdapter, getAddonBySlug } from '@repo/billing';
import { billingWebhookEvents, eq, getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { captureWebhookError } from '../../lib/sentry';
import { getQZPayBilling } from '../../middlewares/billing';
import { AddonService } from '../../services/addon.service';
import type { AppOpenAPI } from '../../types';
import { apiLogger } from '../../utils/logger';
import { sendNotification } from '../../utils/notification-helper';

/**
 * Storage for webhook event ID during processing
 * Maps request ID to webhook event ID
 *
 * @deprecated Use database-only approach for idempotency
 */
export const webhookEventIds = new Map<string, string>();

/**
 * Sanitize error message for notification to admin
 *
 * Removes potentially sensitive information like:
 * - Stack traces (lines starting with "at ")
 * - File paths (/home/, /app/, node_modules/, etc.)
 * - Connection strings (postgresql://, mysql://, mongodb://, etc.)
 * - Environment variables patterns
 * - IP addresses
 *
 * @param error - Raw error message or string
 * @param maxLength - Maximum length to truncate (default: 500 chars)
 * @returns Sanitized error message safe for notifications
 */
export function sanitizeErrorForNotification(error: string, maxLength = 500): string {
    let sanitized = error;

    // Remove stack traces (lines starting with "at ")
    sanitized = sanitized.replace(/^\s*at\s+.+$/gm, '');

    // Remove file paths
    sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-./]+/g, '[path]');
    sanitized = sanitized.replace(/[A-Z]:\\[a-zA-Z0-9_\-\\]+/g, '[path]');

    // Remove connection strings
    sanitized = sanitized.replace(
        /(postgresql|mysql|mongodb|redis):\/\/[^\s]+/gi,
        '[connection-string]'
    );

    // Remove potential environment variable values (KEY=value patterns)
    sanitized = sanitized.replace(/[A-Z_]+=[^\s]+/g, '[env-var]');

    // Remove IP addresses
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]');

    // Remove multiple consecutive newlines/whitespace
    sanitized = sanitized.replace(/\n\s*\n+/g, '\n').trim();

    // Truncate to max length
    if (sanitized.length > maxLength) {
        sanitized = `${sanitized.substring(0, maxLength)}... [truncated]`;
    }

    return sanitized;
}

/**
 * Mark webhook event as successfully processed
 *
 * Updates the webhook event status to 'processed' in the database.
 * Retries up to 3 times on failure to ensure status is persisted.
 *
 * @param webhookEventId - Webhook event ID to mark as processed
 * @throws Error if all retry attempts fail
 */
export async function markWebhookEventProcessed(webhookEventId: string): Promise<void> {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const db = getDb();

            await db
                .update(billingWebhookEvents)
                .set({
                    status: 'processed',
                    processedAt: new Date()
                })
                .where(eq(billingWebhookEvents.id, webhookEventId));

            apiLogger.debug(
                {
                    webhookEventId,
                    attempt
                },
                'Marked webhook event as processed'
            );

            return; // Success - exit
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            apiLogger.warn(
                {
                    webhookEventId,
                    attempt,
                    maxRetries: MAX_RETRIES,
                    error: lastError.message
                },
                `Failed to update webhook event status (attempt ${attempt}/${MAX_RETRIES})`
            );

            // Wait before retry (exponential backoff: 100ms, 200ms, 400ms)
            if (attempt < MAX_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** (attempt - 1)));
            }
        }
    }

    // All retries failed - propagate error
    apiLogger.error(
        {
            webhookEventId,
            error: lastError?.message,
            retriesAttempted: MAX_RETRIES
        },
        'Failed to update webhook event status after all retries - webhook may be reprocessed'
    );

    throw lastError || new Error('Failed to update webhook event status');
}

/**
 * Get or create billing instance and payment adapter for webhook processing
 *
 * @returns Billing instance and adapter, or null if not configured
 */
export function getWebhookDependencies() {
    const billing = getQZPayBilling();

    if (!billing) {
        return null;
    }

    try {
        const paymentAdapter = createMercadoPagoAdapter();
        return { billing, paymentAdapter };
    } catch (error) {
        apiLogger.error(
            'MercadoPago webhook: Failed to create payment adapter:',
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

/**
 * Handler for payment.created events
 *
 * Logs new payment creation for monitoring.
 * Updates webhook event status after successful processing.
 */
export const handlePaymentCreated: QZPayWebhookHandler = async (c, event) => {
    apiLogger.info(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Payment created'
    );

    // Let qzpay handle the payment processing
    // The createWebhookRouter already processes the event through the billing instance
    // After successful processing, mark webhook event as processed
    const webhookEventId = webhookEventIds.get(String(c.get('requestId') || event.id));
    if (webhookEventId) {
        await markWebhookEventProcessed(webhookEventId);
        webhookEventIds.delete(String(c.get('requestId') || event.id));
    }

    return undefined; // Continue to default processing
};

/**
 * Check if payment metadata contains add-on purchase information
 *
 * @param metadata - Payment metadata object
 * @returns Add-on slug and customer ID if found
 */
export function extractAddonMetadata(metadata: unknown): {
    addonSlug: string;
    customerId: string;
} | null {
    if (!metadata || typeof metadata !== 'object') {
        return null;
    }

    const meta = metadata as Record<string, unknown>;

    // Check for addonSlug and customerId in metadata
    if (
        typeof meta.addonSlug === 'string' &&
        typeof meta.customerId === 'string' &&
        meta.addonSlug.length > 0 &&
        meta.customerId.length > 0
    ) {
        return {
            addonSlug: meta.addonSlug,
            customerId: meta.customerId
        };
    }

    return null;
}

/**
 * Check if external_reference follows add-on pattern (addon_SLUG_TIMESTAMP)
 *
 * @param externalReference - External reference string
 * @returns Add-on slug if pattern matches
 */
export function extractAddonFromReference(externalReference: unknown): string | null {
    if (typeof externalReference !== 'string') {
        return null;
    }

    // Pattern: addon_SLUG_TIMESTAMP
    const match = externalReference.match(/^addon_([a-z0-9-]+)_\d+$/);

    if (match?.[1]) {
        return match[1];
    }

    return null;
}

/**
 * Extract payment information from event data
 *
 * @param data - Payment event data
 * @returns Payment details or null
 */
export function extractPaymentInfo(data: Record<string, unknown>): {
    amount: number;
    currency: string;
    status: string;
    statusDetail: string | null;
    paymentMethod: string | null;
} | null {
    // Extract payment fields
    const amount = typeof data.transaction_amount === 'number' ? data.transaction_amount : null;
    const currency = typeof data.currency_id === 'string' ? data.currency_id : 'ARS';
    const status = typeof data.status === 'string' ? data.status : null;
    const statusDetail = typeof data.status_detail === 'string' ? data.status_detail : null;
    const paymentMethod =
        typeof data.payment_method_id === 'string' ? data.payment_method_id : null;

    if (amount === null || status === null) {
        return null;
    }

    return {
        amount,
        currency,
        status,
        statusDetail,
        paymentMethod
    };
}

/**
 * Send payment success notification (fire-and-forget)
 *
 * @param customerId - Customer ID
 * @param amount - Payment amount
 * @param currency - Payment currency
 * @param paymentMethod - Payment method used
 * @param billing - Billing instance
 */
function sendPaymentSuccessNotification(
    customerId: string,
    amount: number,
    currency: string,
    paymentMethod: string | null,
    billing: ReturnType<typeof getQZPayBilling>
): void {
    if (!billing) return;

    // Fire-and-forget notification
    (async () => {
        try {
            const customer = await billing.customers.get(customerId);
            const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
            const subscription = subscriptions?.[0]; // Get first active subscription

            if (customer) {
                const customerName =
                    typeof customer.metadata?.name === 'string'
                        ? customer.metadata.name
                        : customer.email;
                const userId =
                    typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

                // Get plan name
                let planName = 'Subscription';
                if (subscription?.planId) {
                    try {
                        const plan = await billing.plans.get(subscription.planId);
                        planName = plan?.name || 'Subscription';
                    } catch {
                        // Ignore plan fetch errors
                    }
                }

                sendNotification({
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
    })();
}

/**
 * Send payment failure notifications (fire-and-forget)
 * Sends to both user and admin
 *
 * @param customerId - Customer ID
 * @param amount - Payment amount
 * @param currency - Payment currency
 * @param failureReason - Reason for payment failure
 * @param billing - Billing instance
 */
function sendPaymentFailureNotifications(
    customerId: string,
    amount: number,
    currency: string,
    failureReason: string,
    billing: ReturnType<typeof getQZPayBilling>
): void {
    if (!billing) return;

    // Fire-and-forget notifications
    (async () => {
        try {
            const customer = await billing.customers.get(customerId);
            const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
            const subscription = subscriptions?.[0]; // Get first active subscription

            if (!customer) {
                apiLogger.warn(
                    { customerId },
                    'Customer not found for payment failure notification'
                );
                return;
            }

            // Calculate retry date (e.g., 3 days from now)
            const retryDate = new Date();
            retryDate.setDate(retryDate.getDate() + 3);

            // Extract customer metadata with type safety
            const customerName =
                typeof customer.metadata?.name === 'string'
                    ? customer.metadata.name
                    : customer.email;
            const userId =
                typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

            // Get plan name
            let planName = 'Subscription';
            if (subscription?.planId) {
                try {
                    const plan = await billing.plans.get(subscription.planId);
                    planName = plan?.name || 'Subscription';
                } catch {
                    // Ignore plan fetch errors
                }
            }

            // Sanitize failure reason for user notification
            const sanitizedUserReason = sanitizeErrorForNotification(failureReason, 200);

            // User notification
            sendNotification({
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

            // Sanitize failure reason for admin notification (more permissive than user)
            const sanitizedAdminReason = sanitizeErrorForNotification(failureReason, 500);

            // Admin notification
            const adminEmails =
                process.env.ADMIN_NOTIFICATION_EMAILS?.split(',').map((e) => e.trim()) || [];

            for (const adminEmail of adminEmails) {
                if (adminEmail) {
                    const affectedUserId =
                        typeof customer.metadata?.userId === 'string'
                            ? customer.metadata.userId
                            : undefined;

                    sendNotification({
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
    })();
}

/**
 * Handler for payment.updated events
 *
 * Processes payment status changes, including add-on purchases.
 * If the payment is for an add-on, confirms the purchase and applies entitlements.
 * Sends payment success/failure notifications.
 */
export const handlePaymentUpdated: QZPayWebhookHandler = async (c, event) => {
    apiLogger.info(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Payment updated'
    );

    try {
        // Get billing instance
        const billing = getQZPayBilling();

        if (!billing) {
            apiLogger.warn('Billing not configured, skipping add-on processing');
            return undefined; // Continue to default processing
        }

        // Extract event data
        const eventData = event.data as unknown;

        if (!eventData || typeof eventData !== 'object') {
            return undefined; // Continue to default processing
        }

        const data = eventData as Record<string, unknown>;

        // Extract payment information
        const paymentInfo = extractPaymentInfo(data);

        // Extract customer ID from metadata or subscription
        const metadata = data.metadata as Record<string, unknown> | undefined;
        const customerId = typeof metadata?.customerId === 'string' ? metadata.customerId : null;

        // Handle payment status notifications
        if (paymentInfo && customerId) {
            const { amount, currency, status, statusDetail, paymentMethod } = paymentInfo;

            // Payment approved/accredited - success notification
            if (status === 'approved' || status === 'accredited') {
                apiLogger.debug(
                    { customerId, amount, currency, status },
                    'Payment succeeded - sending success notification'
                );

                sendPaymentSuccessNotification(
                    customerId,
                    amount,
                    currency,
                    paymentMethod,
                    billing
                );
            }

            // Payment rejected/cancelled/refunded - failure notification
            if (status === 'rejected' || status === 'cancelled' || status === 'refunded') {
                const failureReason = statusDetail || status;

                apiLogger.debug(
                    { customerId, amount, currency, status, statusDetail },
                    'Payment failed - sending failure notifications'
                );

                sendPaymentFailureNotifications(
                    customerId,
                    amount,
                    currency,
                    failureReason,
                    billing
                );
            }
        }

        // Try to extract add-on information from metadata first
        const addonInfo = extractAddonMetadata(data.metadata);

        // If not found in metadata, try external_reference as fallback
        if (!addonInfo) {
            const addonSlug = extractAddonFromReference(data.external_reference);

            if (addonSlug) {
                // We have addon slug from reference, but need to find customerId
                // This is a fallback scenario - prefer using metadata
                apiLogger.warn(
                    {
                        addonSlug,
                        eventId: event.id,
                        eventType: event.type,
                        externalReference: data.external_reference,
                        hasMetadata: !!data.metadata,
                        metadataKeys: data.metadata ? Object.keys(data.metadata) : [],
                        paymentId: data.id,
                        paymentStatus: data.status
                    },
                    'Found add-on slug in external_reference but missing customerId - addon purchase may not be confirmed properly. Will rely on QZPay default processing.'
                );

                // Continue to default processing - QZPay will handle it
                return undefined;
            }
        }

        // If we have complete add-on information, process it
        if (addonInfo) {
            const { addonSlug, customerId } = addonInfo;

            apiLogger.info(
                {
                    addonSlug,
                    customerId,
                    eventId: event.id,
                    requestId: c.get('requestId')
                },
                'Processing add-on purchase from webhook'
            );

            // Create addon service instance
            const addonService = new AddonService(billing);

            // Confirm the purchase (applies entitlements)
            const result = await addonService.confirmPurchase({
                customerId,
                addonSlug
            });

            if (result.success) {
                apiLogger.info(
                    {
                        addonSlug,
                        customerId,
                        eventId: event.id
                    },
                    'Add-on purchase confirmed successfully'
                );

                // Send ADDON_PURCHASE notification (fire-and-forget)
                try {
                    // Fetch customer and addon data for notification
                    const customer = await billing.customers.get(customerId);
                    const addon = getAddonBySlug(addonSlug);
                    const payment = data as Record<string, unknown>;

                    if (customer && addon) {
                        const customerName =
                            typeof customer.metadata?.name === 'string'
                                ? customer.metadata.name
                                : customer.email;
                        const userId =
                            typeof customer.metadata?.userId === 'string'
                                ? customer.metadata.userId
                                : null;

                        sendNotification({
                            type: NotificationType.ADDON_PURCHASE,
                            recipientEmail: customer.email,
                            recipientName: customerName,
                            userId,
                            customerId: customer.id,
                            planName: addon.name,
                            amount:
                                typeof payment.transaction_amount === 'number'
                                    ? payment.transaction_amount
                                    : 0,
                            currency:
                                typeof payment.currency_id === 'string'
                                    ? payment.currency_id
                                    : 'ARS',
                            nextBillingDate: new Date().toISOString()
                        }).catch((notifError) => {
                            // Silent catch - notification failures handled by retry service
                            apiLogger.debug(
                                {
                                    customerId,
                                    addonSlug,
                                    error:
                                        notifError instanceof Error
                                            ? notifError.message
                                            : String(notifError)
                                },
                                'Addon purchase notification failed (will retry)'
                            );
                        });
                    }
                } catch (notifError) {
                    // Silent catch - don't fail webhook processing for notification errors
                    apiLogger.debug(
                        {
                            customerId,
                            addonSlug,
                            error:
                                notifError instanceof Error
                                    ? notifError.message
                                    : String(notifError)
                        },
                        'Failed to prepare addon purchase notification'
                    );
                }
            } else {
                apiLogger.error(
                    {
                        addonSlug,
                        customerId,
                        eventId: event.id,
                        error: result.error
                    },
                    'Failed to confirm add-on purchase'
                );
            }
        }
    } catch (error) {
        // Log error but don't fail the webhook
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                eventId: event.id,
                requestId: c.get('requestId')
            },
            'Error processing add-on purchase in webhook'
        );
    }

    // Always continue to default qzpay processing
    // After successful processing, mark webhook event as processed
    const webhookEventId = webhookEventIds.get(String(c.get('requestId') || event.id));
    if (webhookEventId) {
        await markWebhookEventProcessed(webhookEventId);
        webhookEventIds.delete(String(c.get('requestId') || event.id));
    }

    return undefined;
};

/**
 * Handler for subscription_preapproval.updated events
 *
 * Logs subscription status changes for monitoring.
 * Updates webhook event status after successful processing.
 */
export const handleSubscriptionUpdated: QZPayWebhookHandler = async (c, event) => {
    apiLogger.info(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Subscription updated'
    );

    // Let qzpay handle the subscription processing
    // After successful processing, mark webhook event as processed
    const webhookEventId = webhookEventIds.get(String(c.get('requestId') || event.id));
    if (webhookEventId) {
        await markWebhookEventProcessed(webhookEventId);
        webhookEventIds.delete(String(c.get('requestId') || event.id));
    }

    return undefined; // Continue to default processing
};

/**
 * Generic event handler for all webhook events
 *
 * Logs all webhook events for monitoring and debugging.
 * Persists webhook events to database before processing.
 * Implements idempotency to prevent duplicate event processing.
 *
 * Uses optimistic locking approach:
 * 1. Try INSERT first (most common case - new event)
 * 2. On duplicate, SELECT with status check
 * 3. Race condition window is minimized by checking status immediately
 */
export const handleWebhookEvent: QZPayWebhookHandler = async (c, event) => {
    apiLogger.debug(
        {
            eventId: event.id,
            eventType: event.type,
            requestId: c.get('requestId')
        },
        'MercadoPago webhook: Event received'
    );

    // Persist webhook event to database with idempotency check
    try {
        const db = getDb();
        const providerEventId = String(event.id);
        const requestId = String(c.get('requestId') || event.id);

        // Optimistic approach: Try INSERT first (fastest path for new events)
        try {
            const result = await db
                .insert(billingWebhookEvents)
                .values({
                    provider: 'mercadopago',
                    type: event.type,
                    providerEventId,
                    status: 'pending',
                    payload: event
                })
                .returning();

            const webhookEvent = result[0];

            if (webhookEvent) {
                // Store webhook event ID in map using request ID as key
                webhookEventIds.set(requestId, webhookEvent.id);

                apiLogger.debug(
                    {
                        webhookEventId: webhookEvent.id,
                        eventId: event.id,
                        eventType: event.type,
                        requestId
                    },
                    'Webhook event persisted to database'
                );
            }

            return undefined; // Continue to processing
        } catch (insertError) {
            // INSERT failed - likely duplicate providerEventId
            // Check if it's a uniqueness violation (code 23505 in PostgreSQL)
            const errorMessage =
                insertError instanceof Error ? insertError.message : String(insertError);
            const isDuplicateError =
                errorMessage.includes('unique') || errorMessage.includes('duplicate');

            if (!isDuplicateError) {
                // Not a duplicate error - propagate
                throw insertError;
            }

            // Duplicate detected - check existing event status
            // Use a short retry loop to minimize race condition window
            let existingEvent: typeof billingWebhookEvents.$inferSelect | null | undefined = null;
            const MAX_STATUS_CHECK_ATTEMPTS = 3;

            for (let attempt = 1; attempt <= MAX_STATUS_CHECK_ATTEMPTS; attempt++) {
                const result = await db
                    .select()
                    .from(billingWebhookEvents)
                    .where(eq(billingWebhookEvents.providerEventId, providerEventId))
                    .limit(1);

                if (result.length > 0) {
                    existingEvent = result[0];
                    break;
                }

                // Event not found yet (race condition) - wait and retry
                if (attempt < MAX_STATUS_CHECK_ATTEMPTS) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            }

            if (!existingEvent) {
                apiLogger.error(
                    {
                        providerEventId,
                        eventType: event.type
                    },
                    'Duplicate webhook detected but event not found in database - possible race condition'
                );
                throw new Error('Webhook event not found after duplicate detection');
            }

            // If already processed successfully, skip reprocessing
            if (existingEvent.status === 'processed') {
                apiLogger.info(
                    {
                        webhookEventId: existingEvent.id,
                        providerEventId,
                        eventType: event.type
                    },
                    'Duplicate webhook skipped - already processed'
                );

                // Return 200 OK response to skip processing
                return c.json(
                    {
                        success: true,
                        message: 'Webhook already processed'
                    },
                    200
                );
            }

            // If currently being processed (pending), skip to avoid race
            if (existingEvent.status === 'pending') {
                apiLogger.info(
                    {
                        webhookEventId: existingEvent.id,
                        providerEventId,
                        eventType: event.type
                    },
                    'Duplicate webhook skipped - currently being processed'
                );

                return c.json(
                    {
                        success: true,
                        message: 'Webhook currently being processed'
                    },
                    200
                );
            }

            // If failed, allow reprocessing by updating the existing row
            if (existingEvent.status === 'failed') {
                apiLogger.info(
                    {
                        webhookEventId: existingEvent.id,
                        providerEventId,
                        eventType: event.type
                    },
                    'Reprocessing previously failed webhook event'
                );

                // Update existing event to pending status and store new payload
                await db
                    .update(billingWebhookEvents)
                    .set({
                        status: 'pending',
                        payload: event,
                        error: null,
                        processedAt: null
                    })
                    .where(eq(billingWebhookEvents.id, existingEvent.id));

                // Store webhook event ID for later status update
                webhookEventIds.set(requestId, existingEvent.id);

                // Continue to processing
                return undefined;
            }
        }
    } catch (error) {
        // Log error but don't fail webhook processing
        apiLogger.error(
            {
                error: error instanceof Error ? error.message : String(error),
                eventId: event.id,
                eventType: event.type
            },
            'Failed to persist webhook event to database'
        );
    }

    return undefined; // Continue to default processing
};

/**
 * Error handler for webhook processing failures
 *
 * Logs errors but still returns 200 OK to MercadoPago to prevent retries
 * for non-recoverable errors.
 * Updates webhook event status to failed if event was persisted.
 * Captures errors in Sentry for monitoring.
 */
export const handleWebhookError = async (error: Error, c: Parameters<QZPayWebhookHandler>[0]) => {
    const requestId = String(c.get('requestId'));

    apiLogger.error(
        {
            error: error.message,
            stack: error.stack,
            requestId
        },
        'MercadoPago webhook: Processing failed'
    );

    // Capture error in Sentry with webhook context
    captureWebhookError(error, {
        provider: 'mercadopago',
        eventType: 'unknown', // Will be enriched by context if available
        retryCount: 0
    });

    // Update webhook event status to failed if it was persisted
    try {
        const webhookEventId = webhookEventIds.get(requestId);

        if (webhookEventId) {
            const db = getDb();

            await db
                .update(billingWebhookEvents)
                .set({
                    status: 'failed',
                    error: error.message
                })
                .where(eq(billingWebhookEvents.id, webhookEventId));

            apiLogger.debug(
                {
                    webhookEventId,
                    error: error.message
                },
                'Updated webhook event status to failed'
            );

            // Clean up the mapping
            webhookEventIds.delete(requestId);
        }
    } catch (updateError) {
        // Log error but don't fail the webhook response
        apiLogger.error(
            {
                error: updateError instanceof Error ? updateError.message : String(updateError)
            },
            'Failed to update webhook event status to failed'
        );
    }

    // Return 200 OK to prevent MercadoPago from retrying
    // QZPay will handle retry logic internally for recoverable errors
    return undefined; // Use default error response (200 OK)
};

/**
 * Create MercadoPago webhook router
 *
 * Handles IPN notifications from MercadoPago with automatic signature verification,
 * event processing, and idempotency handling.
 *
 * Routes:
 * - POST /api/v1/webhooks/mercadopago - Process MercadoPago IPN notifications
 *
 * @remarks
 * - This is a public endpoint (no authentication required)
 * - Security is handled via webhook signature verification
 * - The MercadoPago adapter automatically verifies the x-signature header
 * - QZPay handles idempotency to prevent duplicate event processing
 * - Returns 200 OK quickly to acknowledge receipt
 *
 * @example
 * MercadoPago will POST to this endpoint with:
 * ```
 * POST /api/v1/webhooks/mercadopago
 * Headers:
 *   x-signature: ts=1234567890,v1=abc123...
 *   x-request-id: unique-request-id
 * Body:
 * {
 *   "id": 12345,
 *   "type": "payment",
 *   "action": "payment.updated",
 *   "data": { "id": "payment-id" }
 * }
 * ```
 *
 * @returns Webhook router or null if billing is not configured
 */
function createMercadoPagoWebhookRouter(): AppOpenAPI | null {
    const dependencies = getWebhookDependencies();

    if (!dependencies) {
        apiLogger.warn('MercadoPago webhook routes not initialized - billing not configured');
        return null;
    }

    try {
        const webhookRouter = createWebhookRouter({
            billing: dependencies.billing,
            paymentAdapter: dependencies.paymentAdapter,
            signatureHeader: 'x-signature', // MercadoPago uses x-signature header
            handlers: {
                'payment.created': handlePaymentCreated,
                'payment.updated': handlePaymentUpdated,
                'subscription_preapproval.updated': handleSubscriptionUpdated
            },
            onEvent: handleWebhookEvent,
            onError: handleWebhookError
        });

        apiLogger.info('✅ MercadoPago webhook router created successfully');

        return webhookRouter as unknown as AppOpenAPI;
    } catch (error) {
        apiLogger.error(
            'Failed to create MercadoPago webhook router:',
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

/**
 * Factory function that creates MercadoPago webhook routes on demand.
 *
 * Defers execution of `createMercadoPagoWebhookRouter()` until call time,
 * ensuring the database and billing subsystem are fully initialized before
 * any attempt to resolve dependencies.
 *
 * @returns Configured Hono router for MercadoPago webhooks, or `null` when
 *   billing is not configured.
 */
export const createMercadoPagoWebhookRoutes = (): AppOpenAPI | null =>
    createMercadoPagoWebhookRouter();
