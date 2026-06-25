/**
 * Sentry Configuration for API
 *
 * Provides error tracking and performance monitoring for the Hospeda API.
 * Includes billing-specific error contexts and custom tags.
 *
 * @module lib/sentry
 */

import * as Sentry from '@sentry/node';
import type { ErrorEvent, EventHint } from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Context } from 'hono';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

/**
 * Known noise patterns in Sentry event messages that should be dropped
 * before they consume quota or trigger alerts.
 *
 * - Per-request 5xx middleware message: already captured at the route level
 *   with full request context; this re-capture is redundant.
 * - Transform-pipeline body dumps: may contain PII and inflate quota.
 *
 * Exported for testability (SPEC-180 T-007).
 */
export const BEFORE_SEND_NOISE_PATTERNS: readonly RegExp[] = [
    /^\[http\].*responded with 5\d\d/i,
    /^\[transform\].*body:/i
] as const;

/**
 * Sentry `beforeSend` filter extracted as a pure function for testability.
 *
 * Drops known noise events (double-captures, PII dumps) and scrubs sensitive
 * data from breadcrumbs before the event reaches the Sentry quota pipeline.
 *
 * Return `null` to drop the event; return the (mutated) event to keep it.
 *
 * Exported for testing (SPEC-180 T-007).
 *
 * @param event - The Sentry error event being evaluated.
 * @returns The event to send, or `null` to drop it.
 */
export function applyBeforeSend(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
    // Drop events explicitly tagged as expected — these are domain-normal
    // errors that the operator does NOT need in the alert pipeline.
    if (event.tags && event.tags.expected_error === 'true') {
        return null;
    }

    // Drop Sentry-middleware-level double-captures of HTTP errors.
    // These are re-thrown to the route error handler which surfaces
    // the real root cause; the middleware log is enough for diagnostics.
    const middlewareMessage = 'Request error caught by Sentry middleware';
    if (event.message === middlewareMessage) {
        return null;
    }
    // Also match when the middleware error lands as an exception value.
    if (
        event.exception?.values?.some(
            (v) => typeof v.value === 'string' && v.value.includes(middlewareMessage)
        )
    ) {
        return null;
    }

    // Drop events whose message matches known noise patterns.
    const msg = event.message ?? '';
    if (BEFORE_SEND_NOISE_PATTERNS.some((re) => re.test(msg))) {
        return null;
    }

    // Drop (strip) events with a response body dump in extra — these may
    // contain large/PII payloads and inflate the Sentry quota. We strip the
    // key rather than dropping the whole event so the rest of the context
    // (stack trace, tags) is preserved.
    if (event.extra && 'responseBody' in event.extra) {
        const { responseBody: _responseBody, ...safeExtra } = event.extra as Record<
            string,
            unknown
        >;
        event.extra = safeExtra;
    }

    // Remove sensitive data from breadcrumbs.
    if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
            if (breadcrumb.data) {
                // Redact tokens, keys, secrets, and passwords.
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
}

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

/**
 * Default Sentry configuration
 *
 * In development: profiling disabled, debug off, low trace rate to avoid console spam.
 * In production: 10% sampling for traces and profiling.
 */
const DEFAULT_CONFIG: SentryConfig = {
    enableTracing: true,
    debug: false,
    appType: 'api'
};

/**
 * Initialize Sentry with configuration
 *
 * @param config - Optional configuration overrides
 * @returns True if initialization was successful
 */
export function initializeSentry(config: SentryConfig = {}): boolean {
    const sentryDsn = config.dsn || env.HOSPEDA_SENTRY_DSN;

    // Don't initialize if no DSN is provided
    if (!sentryDsn) {
        apiLogger.warn('Sentry DSN not provided - error tracking disabled');
        return false;
    }

    // Compute environment-dependent flags using validated env (called after validateApiEnv())
    const isDev = env.NODE_ENV !== 'production';

    const resolvedDefaults: SentryConfig = {
        ...DEFAULT_CONFIG,
        // SPEC-103 T-076: prefer HOSPEDA_SENTRY_ENVIRONMENT over NODE_ENV.
        // NODE_ENV=production in both prod and staging keeps prod-like
        // behavior (traces, profiles, no debug) but collapses Sentry
        // events under one environment tag. The explicit var lets the
        // operator set environment=staging on the staging container so
        // Sentry separates events in the dashboard.
        environment: env.HOSPEDA_SENTRY_ENVIRONMENT || env.NODE_ENV,
        tracesSampleRate: isDev ? 0.0 : 0.1,
        profilesSampleRate: isDev ? 0.0 : 0.1,
        project: env.HOSPEDA_SENTRY_PROJECT || 'hospeda'
    };

    const finalConfig = { ...resolvedDefaults, ...config };

    try {
        Sentry.init({
            dsn: sentryDsn,
            environment: finalConfig.environment,
            release: env.HOSPEDA_SENTRY_RELEASE || env.HOSPEDA_COMMIT_SHA || 'development',
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

            // Integrations - skip profiling in development (cheap & noisy locally).
            // Cast needed: @sentry/profiling-node pins @sentry/core@10.38, @sentry/node uses 10.40.
            ...(isDev
                ? {}
                : // biome-ignore lint/suspicious/noExplicitAny: Sentry version mismatch between profiling-node and node packages
                  { integrations: [nodeProfilingIntegration()] as any }),

            // Before send hook — delegate to the pure `applyBeforeSend` function
            // so the filter logic is unit-testable independently of Sentry.init().
            // See SPEC-180 T-007 + the exported `applyBeforeSend` above for full
            // drop/scrub rationale and SPEC-143 T-143-47 expected_error convention.
            beforeSend: applyBeforeSend,

            // Before breadcrumb hook - filter sensitive breadcrumbs
            beforeBreadcrumb(breadcrumb) {
                // Skip console logs in production
                if (env.NODE_ENV === 'production' && breadcrumb.category === 'console') {
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
    /**
     * qzpay-core operation string from `QZPayProviderSyncError.operation`
     * (e.g. 'checkout_create', 'subscription_create'). Present only when the
     * error originated from a provider sync call (SPEC-149).
     */
    operation?: string;
    /**
     * Numeric HTTP status extracted from the upstream provider error cause
     * (e.g. 429, 408, 500). Populated by `mapProviderErrorToServiceError` via
     * `ProviderErrorDetails.providerStatus` (SPEC-149).
     */
    providerStatus?: number;
    /**
     * String error code from `QZPayMercadoPagoError.code` if available
     * (e.g. 'rate_limit_error', 'invalid_card'). Used to correlate Sentry
     * events with the upstream error classification (SPEC-149).
     */
    providerCode?: string;
}

/**
 * Capture billing-specific error with enriched context.
 *
 * When the error originates from a provider sync call (SPEC-149), pass the
 * additional fields `operation`, `providerStatus`, and `providerCode` so that
 * Sentry fingerprints the event by provider error class and the Sentry issue
 * title includes the upstream HTTP status.
 *
 * @param error - The error to capture.
 * @param context - Billing-specific context, optionally including
 *   `operation`, `providerStatus`, and `providerCode` for provider errors.
 * @param severity - Error severity level.
 * @returns Event ID from Sentry.
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
            billingCycle: context.billingCycle,
            // Provider error tags — present only for SPEC-149 provider sync errors
            ...(context.operation !== undefined ? { billing_operation: context.operation } : {}),
            ...(context.providerStatus !== undefined
                ? { provider_status: String(context.providerStatus) }
                : {}),
            ...(context.providerCode !== undefined ? { provider_code: context.providerCode } : {})
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
                addonCount: context.addonIds?.length,
                // Provider error context — present only for SPEC-149 provider sync errors
                ...(context.operation !== undefined
                    ? { providerOperation: context.operation }
                    : {}),
                ...(context.providerStatus !== undefined
                    ? { providerStatus: context.providerStatus }
                    : {}),
                ...(context.providerCode !== undefined
                    ? { providerCode: context.providerCode }
                    : {})
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
 * Linkage between a freshly-created trial subscription and the accommodation /
 * owner that triggered it (SPEC-222 Part 1).
 *
 * All ids are internal UUIDs / slugs — no PII. `accommodationId` is referential
 * ("triggered by"): trials are per-owner, so it does NOT imply the subscription
 * belongs to a single accommodation.
 */
export interface PublishLinkageContext {
    /** Trial subscription id returned by QZPay. */
    subscriptionId: string;
    /** Accommodation whose publish triggered the trial (referential). */
    accommodationId: string;
    /** Owner the trial belongs to. */
    ownerId: string;
    /** Billing customer id for the owner, if resolved. */
    customerId?: string;
    /** Plan slug the trial was started on (e.g. `owner-basico`). */
    planSlug?: string;
}

/**
 * Attach the trial↔accommodation↔owner linkage to the current Sentry scope at
 * first-publish (SPEC-222 Part 1).
 *
 * Adds both a breadcrumb (timeline visibility) and a scope context + tags so
 * that any error captured during or after the publish on this request carries
 * the linkage, and the Sentry issue is searchable by subscription, accommodation
 * or owner id. No event is emitted here — this only enriches the scope; it is a
 * no-op when Sentry is disabled.
 *
 * @param context - The publish linkage to attach.
 */
export function addPublishLinkageContext(context: PublishLinkageContext): void {
    if (!Sentry.isEnabled()) {
        return;
    }

    Sentry.addBreadcrumb({
        category: 'billing.publish',
        type: 'info',
        level: 'info',
        message: 'trial subscription linkage',
        data: {
            subscriptionId: context.subscriptionId,
            accommodationId: context.accommodationId,
            ownerId: context.ownerId,
            ...(context.customerId ? { customerId: context.customerId } : {}),
            ...(context.planSlug ? { planSlug: context.planSlug } : {})
        }
    });

    Sentry.setContext('publish_linkage', {
        subscriptionId: context.subscriptionId,
        accommodationId: context.accommodationId,
        ownerId: context.ownerId,
        customerId: context.customerId,
        planSlug: context.planSlug
    });

    Sentry.setTag('subscription_id', context.subscriptionId);
    Sentry.setTag('accommodation_id', context.accommodationId);
    Sentry.setTag('owner_id', context.ownerId);
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
