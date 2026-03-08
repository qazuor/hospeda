/**
 * Shared utilities for MercadoPago webhook processing.
 *
 * Contains state management, database helpers, and data extraction
 * functions used across webhook handlers.
 *
 * @module routes/webhooks/mercadopago/utils
 */

import { createMercadoPagoAdapter } from '@repo/billing';
import { and, billingWebhookEvents, eq, getDb, or } from '@repo/db';
import { getQZPayBilling } from '../../../middlewares/billing';
import { apiLogger } from '../../../utils/logger';
import type { AddonMetadata, PaymentInfo } from './types';

/**
 * Sanitize error message for notification to admin.
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
 * Mark webhook event as successfully processed.
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
 * Mark webhook event as processed by provider event ID.
 *
 * Replaces the in-memory Map approach with a direct DB query by providerEventId.
 * This is serverless-safe since it does not rely on process-level state.
 * Only updates events in 'pending' or 'failed' status to avoid overwriting
 * already-processed events.
 *
 * @param params - Object containing the provider event ID
 * @param params.providerEventId - MercadoPago event ID (e.g. the numeric payment ID)
 */
export async function markEventProcessedByProviderId({
    providerEventId
}: {
    readonly providerEventId: string;
}): Promise<void> {
    try {
        const db = getDb();

        await db
            .update(billingWebhookEvents)
            .set({
                status: 'processed',
                processedAt: new Date()
            })
            .where(
                and(
                    eq(billingWebhookEvents.providerEventId, providerEventId),
                    or(
                        eq(billingWebhookEvents.status, 'pending'),
                        eq(billingWebhookEvents.status, 'failed')
                    )
                )
            );

        apiLogger.debug({ providerEventId }, 'Marked webhook event as processed by provider ID');
    } catch (error) {
        apiLogger.warn(
            {
                providerEventId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to mark webhook event as processed by provider ID'
        );
    }
}

/**
 * Mark webhook event as failed by provider event ID.
 *
 * Replaces the in-memory Map approach with a direct DB query by providerEventId.
 * This is serverless-safe since it does not rely on process-level state.
 * Only updates events in 'pending' status.
 *
 * @param params - Object containing the provider event ID and error message
 * @param params.providerEventId - MercadoPago event ID
 * @param params.errorMessage - Error message describing the failure
 */
export async function markEventFailedByProviderId({
    providerEventId,
    errorMessage
}: {
    readonly providerEventId: string;
    readonly errorMessage: string;
}): Promise<void> {
    try {
        const db = getDb();

        await db
            .update(billingWebhookEvents)
            .set({
                status: 'failed',
                error: errorMessage
            })
            .where(
                and(
                    eq(billingWebhookEvents.providerEventId, providerEventId),
                    eq(billingWebhookEvents.status, 'pending')
                )
            );

        apiLogger.debug(
            { providerEventId, errorMessage },
            'Marked webhook event as failed by provider ID'
        );
    } catch (error) {
        apiLogger.warn(
            {
                providerEventId,
                errorMessage,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to mark webhook event as failed by provider ID'
        );
    }
}

/**
 * Get or create billing instance and payment adapter for webhook processing.
 *
 * @returns Billing instance and adapter, or null if not configured
 */
export function getWebhookDependencies(): {
    billing: NonNullable<ReturnType<typeof getQZPayBilling>>;
    paymentAdapter: ReturnType<typeof createMercadoPagoAdapter>;
} | null {
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
 * Check if payment metadata contains add-on purchase information.
 *
 * @param metadata - Payment metadata object
 * @returns Add-on slug and customer ID if found, null otherwise
 */
export function extractAddonMetadata(metadata: unknown): AddonMetadata | null {
    if (!metadata || typeof metadata !== 'object') {
        return null;
    }

    const meta = metadata as Record<string, unknown>;

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
 * Check if external_reference follows add-on pattern (addon_SLUG_TIMESTAMP).
 *
 * @param externalReference - External reference string
 * @returns Add-on slug if pattern matches, null otherwise
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
 * Extract payment information from event data.
 *
 * @param data - Payment event data
 * @returns Payment details or null if required fields are missing
 */
export function extractPaymentInfo(data: Record<string, unknown>): PaymentInfo | null {
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
