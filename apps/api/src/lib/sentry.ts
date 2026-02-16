/**
 * Sentry Configuration for API
 *
 * Provides error tracking and performance monitoring for the Hospeda API.
 * Includes billing-specific error contexts and custom tags.
 *
 * @module lib/sentry
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Context } from 'hono';
import { apiLogger } from '../utils/logger';

/**
 * Sentry configuration options
 */
interface SentryConfig {
    /** Sentry DSN (Data Source Name) */
    dsn?: string;
    /** Environment name (development, staging, production) */
    environment?: string;
    /** Enable performance monitoring */
    enableTracing?: boolean;
    /** Sample rate for traces (0.0 - 1.0) */
    tracesSampleRate?: number;
    /** Sample rate for profiling (0.0 - 1.0) */
    profilesSampleRate?: number;
    /** Enable debug mode */
    debug?: boolean;
    /** Project name for grouping (e.g., "hospeda", "clientex") */
    project?: string;
    /** App type within the project (e.g., "api", "web", "admin") */
    appType?: string;
}

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Default Sentry configuration
 *
 * In development: profiling disabled, debug off, low trace rate to avoid console spam.
 * In production: 10% sampling for traces and profiling.
 */
const DEFAULT_CONFIG: SentryConfig = {
    environment: process.env.NODE_ENV || 'development',
    enableTracing: true,
    tracesSampleRate: isDev ? 0.0 : 0.1,
    profilesSampleRate: isDev ? 0.0 : 0.1,
    debug: false,
    project: process.env.SENTRY_PROJECT || 'hospeda',
    appType: 'api'
};

/**
 * Initialize Sentry with configuration
 *
 * @param config - Optional configuration overrides
 * @returns True if initialization was successful
 */
export function initializeSentry(config: SentryConfig = {}): boolean {
    const sentryDsn = config.dsn || process.env.SENTRY_DSN;

    // Don't initialize if no DSN is provided
    if (!sentryDsn) {
        apiLogger.warn('Sentry DSN not provided - error tracking disabled');
        return false;
    }

    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    try {
        Sentry.init({
            dsn: sentryDsn,
            environment: finalConfig.environment,
            release:
                process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || 'development',
            debug: finalConfig.debug,

            // Performance monitoring
            tracesSampleRate: finalConfig.tracesSampleRate,
            profilesSampleRate: finalConfig.profilesSampleRate,

            // Project identification tags for multi-project filtering
            initialScope: {
                tags: {
                    project: finalConfig.project || 'hospeda',
                    app_type: finalConfig.appType || 'api'
                }
            },

            // Integrations - skip profiling in development to avoid console noise
            integrations: isDev ? [] : [nodeProfilingIntegration()],

            // Before send hook - filter sensitive data
            beforeSend(event, _hint) {
                // Remove sensitive data from breadcrumbs
                if (event.breadcrumbs) {
                    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
                        if (breadcrumb.data) {
                            // Remove tokens, keys, secrets
                            const sanitized = { ...breadcrumb.data };
                            for (const key of Object.keys(sanitized)) {
                                if (
                                    key.toLowerCase().includes('token') ||
                                    key.toLowerCase().includes('key') ||
                                    key.toLowerCase().includes('secret') ||
                                    key.toLowerCase().includes('password')
                                ) {
                                    sanitized[key] = '[REDACTED]';
                                }
                            }
                            breadcrumb.data = sanitized;
                        }
                        return breadcrumb;
                    });
                }

                return event;
            },

            // Before breadcrumb hook - filter sensitive breadcrumbs
            beforeBreadcrumb(breadcrumb) {
                // Skip console logs in production
                if (process.env.NODE_ENV === 'production' && breadcrumb.category === 'console') {
                    return null;
                }
                return breadcrumb;
            }
        });

        apiLogger.info(
            {
                environment: finalConfig.environment,
                tracesSampleRate: finalConfig.tracesSampleRate,
                project: finalConfig.project,
                appType: finalConfig.appType
            },
            'Sentry initialized successfully'
        );

        return true;
    } catch (error) {
        apiLogger.error({ error }, 'Failed to initialize Sentry');
        return false;
    }
}

/**
 * Billing context for Sentry error tracking
 */
export interface BillingContext {
    /** Subscription ID */
    subscriptionId?: string;
    /** Plan ID */
    planId?: string;
    /** Customer email (anonymized) */
    customerEmail?: string;
    /** Billing cycle */
    billingCycle?: string;
    /** Payment provider ID */
    paymentProviderId?: string;
    /** Transaction ID */
    transactionId?: string;
    /** Amount in cents */
    amount?: number;
    /** Currency code */
    currency?: string;
    /** Promo code applied */
    promoCode?: string;
    /** Add-on IDs */
    addonIds?: string[];
}

/**
 * Capture billing-specific error with enriched context
 *
 * @param error - The error to capture
 * @param context - Billing-specific context
 * @param severity - Error severity level
 * @returns Event ID from Sentry
 */
export function captureBillingError(
    error: Error,
    context: BillingContext,
    severity: 'error' | 'warning' | 'info' = 'error'
): string | undefined {
    return Sentry.captureException(error, {
        level: severity,
        tags: {
            module: 'billing',
            planId: context.planId,
            billingCycle: context.billingCycle
        },
        contexts: {
            billing: {
                subscriptionId: context.subscriptionId,
                planId: context.planId,
                // Anonymize email (keep domain only)
                customerEmail: context.customerEmail
                    ? anonymizeEmail(context.customerEmail)
                    : undefined,
                billingCycle: context.billingCycle,
                paymentProviderId: context.paymentProviderId,
                transactionId: context.transactionId,
                amount: context.amount,
                currency: context.currency,
                promoCode: context.promoCode,
                addonCount: context.addonIds?.length
            }
        }
    });
}

/**
 * Capture payment failure with anonymized data
 *
 * @param error - The error that occurred
 * @param paymentData - Payment-specific data (will be sanitized)
 * @returns Event ID from Sentry
 */
export function capturePaymentFailure(
    error: Error,
    paymentData: {
        subscriptionId?: string;
        amount?: number;
        currency?: string;
        paymentProviderId?: string;
        customerEmail?: string;
        failureReason?: string;
    }
): string | undefined {
    return Sentry.captureException(error, {
        level: 'error',
        tags: {
            module: 'billing',
            event_type: 'payment_failure',
            failure_reason: paymentData.failureReason
        },
        contexts: {
            payment: {
                subscriptionId: paymentData.subscriptionId,
                amount: paymentData.amount,
                currency: paymentData.currency,
                paymentProviderId: paymentData.paymentProviderId,
                customerEmail: paymentData.customerEmail
                    ? anonymizeEmail(paymentData.customerEmail)
                    : undefined
            }
        }
    });
}

/**
 * Capture webhook processing error
 *
 * @param error - The error that occurred
 * @param webhookData - Webhook-specific data
 * @returns Event ID from Sentry
 */
export function captureWebhookError(
    error: Error,
    webhookData: {
        provider: string;
        eventType: string;
        eventId?: string;
        retryCount?: number;
        processingTimeMs?: number;
    }
): string | undefined {
    return Sentry.captureException(error, {
        level: 'error',
        tags: {
            module: 'billing',
            event_type: 'webhook_failure',
            webhook_provider: webhookData.provider,
            webhook_event: webhookData.eventType
        },
        contexts: {
            webhook: {
                provider: webhookData.provider,
                eventType: webhookData.eventType,
                eventId: webhookData.eventId,
                retryCount: webhookData.retryCount,
                processingTimeMs: webhookData.processingTimeMs
            }
        }
    });
}

/**
 * Capture trial expiration event
 *
 * @param data - Trial expiration data
 * @returns Event ID from Sentry
 */
export function captureTrialExpiration(data: {
    subscriptionId: string;
    customerEmail: string;
    planId: string;
    daysInTrial: number;
    converted: boolean;
}): string | undefined {
    return Sentry.captureMessage('Trial expired', {
        level: 'info',
        tags: {
            module: 'billing',
            event_type: 'trial_expiration',
            converted: data.converted ? 'yes' : 'no',
            planId: data.planId
        },
        contexts: {
            trial: {
                subscriptionId: data.subscriptionId,
                customerEmail: anonymizeEmail(data.customerEmail),
                planId: data.planId,
                daysInTrial: data.daysInTrial,
                converted: data.converted
            }
        }
    });
}

/**
 * Start a new span for performance monitoring
 *
 * @param name - Span name
 * @param operation - Operation type (e.g., 'http.server', 'billing.webhook')
 * @returns Span object or undefined
 */
export function startTransaction(
    name: string,
    operation: string
): ReturnType<typeof Sentry.startSpan> | undefined {
    if (!Sentry.isEnabled()) {
        return undefined;
    }

    // In Sentry v8+, use startSpan instead of startTransaction
    return Sentry.startSpan(
        {
            name,
            op: operation
        },
        (span) => span
    );
}

/**
 * Add billing context to Sentry scope for current request
 *
 * @param context - Billing context to add
 */
export function setBillingContext(context: BillingContext): void {
    Sentry.setContext('billing', {
        subscriptionId: context.subscriptionId,
        planId: context.planId,
        customerEmail: context.customerEmail ? anonymizeEmail(context.customerEmail) : undefined,
        billingCycle: context.billingCycle,
        paymentProviderId: context.paymentProviderId
    });

    // Add tags for better filtering
    if (context.planId) {
        Sentry.setTag('plan_id', context.planId);
    }
    if (context.billingCycle) {
        Sentry.setTag('billing_cycle', context.billingCycle);
    }
}

/**
 * Add user context from Hono context
 *
 * @param c - Hono context
 */
export function setUserFromContext(c: Context): void {
    // Extract user info from context (if available)
    const userId = c.get('userId');
    const userEmail = c.get('userEmail');
    const userRole = c.get('userRole');

    if (userId) {
        Sentry.setUser({
            id: userId,
            email: userEmail ? anonymizeEmail(userEmail) : undefined,
            role: userRole
        });
    }
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
    Sentry.setUser(null);
}

/**
 * Anonymize email address (keep domain only)
 *
 * @param email - Email to anonymize
 * @returns Anonymized email (e.g., "***@example.com")
 */
function anonymizeEmail(email: string): string {
    const [, domain] = email.split('@');
    return domain ? `***@${domain}` : '***';
}

/**
 * Check if Sentry is enabled and initialized
 *
 * @returns True if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
    return Sentry.isEnabled();
}

/**
 * Flush all pending events to Sentry
 *
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves when flushed
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
    return Sentry.flush(timeout);
}

/**
 * Close the Sentry client
 *
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves when closed
 */
export async function closeSentry(timeout = 2000): Promise<boolean> {
    return Sentry.close(timeout);
}

/**
 * Export Sentry for direct access if needed
 */
export { Sentry };
