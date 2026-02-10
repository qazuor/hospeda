/**
 * Billing Error Handler
 *
 * Specialized error handling for billing operations with Sentry integration.
 * Enriches errors with billing context and ensures proper tracking.
 *
 * @module lib/billing-error-handler
 */

import type { QZPaySubscriptionStatus } from '@qazuor/qzpay-core';
import { ServiceErrorCode } from '@repo/schemas';
import { apiLogger } from '../utils/logger';
import {
    type BillingContext,
    captureBillingError,
    capturePaymentFailure,
    captureWebhookError,
    isSentryEnabled
} from './sentry';

/**
 * Billing error types for categorization
 */
export enum BillingErrorType {
    /** Subscription-related error */
    SUBSCRIPTION = 'subscription',
    /** Payment processing error */
    PAYMENT = 'payment',
    /** Webhook processing error */
    WEBHOOK = 'webhook',
    /** Trial management error */
    TRIAL = 'trial',
    /** Addon management error */
    ADDON = 'addon',
    /** Promo code error */
    PROMO_CODE = 'promo_code',
    /** Entitlement check error */
    ENTITLEMENT = 'entitlement',
    /** Metrics calculation error */
    METRICS = 'metrics'
}

/**
 * Billing error class with enhanced context
 */
export class BillingError extends Error {
    constructor(
        message: string,
        public readonly type: BillingErrorType,
        public readonly context: BillingContext,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'BillingError';

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BillingError);
        }
    }
}

/**
 * Handle subscription errors
 *
 * @param error - The error that occurred
 * @param context - Subscription context
 * @returns Standardized service error
 */
export function handleSubscriptionError(
    error: unknown,
    context: {
        subscriptionId?: string;
        planId?: string;
        status?: QZPaySubscriptionStatus;
        customerEmail?: string;
    }
): {
    code: ServiceErrorCode;
    message: string;
} {
    const billingContext: BillingContext = {
        subscriptionId: context.subscriptionId,
        planId: context.planId,
        customerEmail: context.customerEmail
    };

    // Log error
    apiLogger.error(
        {
            error: error instanceof Error ? error.message : String(error),
            subscriptionId: context.subscriptionId,
            planId: context.planId,
            status: context.status
        },
        'Subscription error'
    );

    // Capture in Sentry if enabled
    if (isSentryEnabled() && error instanceof Error) {
        captureBillingError(error, billingContext, 'error');
    }

    // Determine error code and message
    if (error instanceof Error) {
        if (error.message.includes('not found')) {
            return {
                code: ServiceErrorCode.NOT_FOUND,
                message: 'Subscription not found'
            };
        }
        if (error.message.includes('already exists')) {
            return {
                code: ServiceErrorCode.ALREADY_EXISTS,
                message: 'Subscription already exists for this user'
            };
        }
        if (error.message.includes('invalid status')) {
            return {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'Invalid subscription status transition'
            };
        }
    }

    return {
        code: ServiceErrorCode.INTERNAL_ERROR,
        message: 'Failed to process subscription'
    };
}

/**
 * Handle payment errors
 *
 * @param error - The error that occurred
 * @param context - Payment context
 * @returns Standardized service error
 */
export function handlePaymentError(
    error: unknown,
    context: {
        subscriptionId?: string;
        amount?: number;
        currency?: string;
        paymentProviderId?: string;
        customerEmail?: string;
    }
): {
    code: ServiceErrorCode;
    message: string;
} {
    // Log error
    apiLogger.error(
        {
            error: error instanceof Error ? error.message : String(error),
            subscriptionId: context.subscriptionId,
            amount: context.amount,
            currency: context.currency
        },
        'Payment error'
    );

    // Determine failure reason
    let failureReason = 'unknown';
    if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
            failureReason = 'insufficient_funds';
        } else if (error.message.includes('card declined')) {
            failureReason = 'card_declined';
        } else if (error.message.includes('expired')) {
            failureReason = 'card_expired';
        } else if (error.message.includes('timeout')) {
            failureReason = 'timeout';
        }
    }

    // Capture in Sentry if enabled
    if (isSentryEnabled() && error instanceof Error) {
        capturePaymentFailure(error, {
            ...context,
            failureReason
        });
    }

    return {
        code: ServiceErrorCode.INTERNAL_ERROR,
        message: 'Payment processing failed'
    };
}

/**
 * Handle webhook errors
 *
 * @param error - The error that occurred
 * @param context - Webhook context
 * @returns Standardized service error
 */
export function handleWebhookError(
    error: unknown,
    context: {
        provider: string;
        eventType: string;
        eventId?: string;
        retryCount?: number;
        processingTimeMs?: number;
    }
): {
    code: ServiceErrorCode;
    message: string;
} {
    // Log error
    apiLogger.error(
        {
            error: error instanceof Error ? error.message : String(error),
            provider: context.provider,
            eventType: context.eventType,
            eventId: context.eventId,
            retryCount: context.retryCount
        },
        'Webhook processing error'
    );

    // Capture in Sentry if enabled
    if (isSentryEnabled() && error instanceof Error) {
        captureWebhookError(error, context);
    }

    // Determine error code
    if (error instanceof Error) {
        if (error.message.includes('signature')) {
            return {
                code: ServiceErrorCode.UNAUTHORIZED,
                message: 'Invalid webhook signature'
            };
        }
        if (error.message.includes('duplicate')) {
            return {
                code: ServiceErrorCode.ALREADY_EXISTS,
                message: 'Webhook event already processed'
            };
        }
    }

    return {
        code: ServiceErrorCode.INTERNAL_ERROR,
        message: 'Failed to process webhook'
    };
}

/**
 * Handle trial errors
 *
 * @param error - The error that occurred
 * @param context - Trial context
 * @returns Standardized service error
 */
export function handleTrialError(
    error: unknown,
    context: {
        subscriptionId?: string;
        customerEmail?: string;
        planId?: string;
    }
): {
    code: ServiceErrorCode;
    message: string;
} {
    const billingContext: BillingContext = {
        subscriptionId: context.subscriptionId,
        planId: context.planId,
        customerEmail: context.customerEmail
    };

    // Log error
    apiLogger.error(
        {
            error: error instanceof Error ? error.message : String(error),
            subscriptionId: context.subscriptionId,
            planId: context.planId
        },
        'Trial error'
    );

    // Capture in Sentry if enabled
    if (isSentryEnabled() && error instanceof Error) {
        captureBillingError(error, billingContext, 'warning');
    }

    // Determine error code
    if (error instanceof Error) {
        if (error.message.includes('already used')) {
            return {
                code: ServiceErrorCode.ALREADY_EXISTS,
                message: 'Trial already used for this user'
            };
        }
        if (error.message.includes('expired')) {
            return {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'Trial has expired'
            };
        }
    }

    return {
        code: ServiceErrorCode.INTERNAL_ERROR,
        message: 'Failed to process trial'
    };
}

/**
 * Handle addon errors
 *
 * @param error - The error that occurred
 * @param context - Addon context
 * @returns Standardized service error
 */
export function handleAddonError(
    error: unknown,
    context: {
        subscriptionId?: string;
        addonIds?: string[];
        customerEmail?: string;
    }
): {
    code: ServiceErrorCode;
    message: string;
} {
    const billingContext: BillingContext = {
        subscriptionId: context.subscriptionId,
        addonIds: context.addonIds,
        customerEmail: context.customerEmail
    };

    // Log error
    apiLogger.error(
        {
            error: error instanceof Error ? error.message : String(error),
            subscriptionId: context.subscriptionId,
            addonCount: context.addonIds?.length
        },
        'Addon error'
    );

    // Capture in Sentry if enabled
    if (isSentryEnabled() && error instanceof Error) {
        captureBillingError(error, billingContext, 'error');
    }

    // Determine error code
    if (error instanceof Error) {
        if (error.message.includes('not found')) {
            return {
                code: ServiceErrorCode.NOT_FOUND,
                message: 'Addon not found'
            };
        }
        if (error.message.includes('limit exceeded')) {
            return {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'Addon limit exceeded'
            };
        }
    }

    return {
        code: ServiceErrorCode.INTERNAL_ERROR,
        message: 'Failed to process addon'
    };
}

/**
 * Handle promo code errors
 *
 * @param error - The error that occurred
 * @param context - Promo code context
 * @returns Standardized service error
 */
export function handlePromoCodeError(
    error: unknown,
    context: {
        promoCode?: string;
        customerEmail?: string;
    }
): {
    code: ServiceErrorCode;
    message: string;
} {
    const billingContext: BillingContext = {
        promoCode: context.promoCode,
        customerEmail: context.customerEmail
    };

    // Log error
    apiLogger.error(
        {
            error: error instanceof Error ? error.message : String(error),
            promoCode: context.promoCode
        },
        'Promo code error'
    );

    // Capture in Sentry if enabled
    if (isSentryEnabled() && error instanceof Error) {
        captureBillingError(error, billingContext, 'warning');
    }

    // Determine error code
    if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('invalid')) {
            return {
                code: ServiceErrorCode.NOT_FOUND,
                message: 'Promo code not found or invalid'
            };
        }
        if (error.message.includes('expired')) {
            return {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'Promo code has expired'
            };
        }
        if (error.message.includes('limit')) {
            return {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'Promo code usage limit reached'
            };
        }
    }

    return {
        code: ServiceErrorCode.INTERNAL_ERROR,
        message: 'Failed to apply promo code'
    };
}

/**
 * Track high payment failure rate (for alerting)
 *
 * @param failureCount - Number of failures
 * @param totalCount - Total attempts
 * @param timeWindowMinutes - Time window for the count
 */
export function trackPaymentFailureRate(
    failureCount: number,
    totalCount: number,
    timeWindowMinutes: number
): void {
    const failureRate = totalCount > 0 ? (failureCount / totalCount) * 100 : 0;

    // Log if rate is concerning
    if (failureRate > 5) {
        apiLogger.warn(
            {
                failureCount,
                totalCount,
                failureRate: `${failureRate.toFixed(2)}%`,
                timeWindowMinutes
            },
            'High payment failure rate detected'
        );
    }
}

/**
 * Track webhook processing latency (for performance monitoring)
 *
 * @param provider - Webhook provider
 * @param eventType - Event type
 * @param processingTimeMs - Processing time in milliseconds
 */
export function trackWebhookLatency(
    provider: string,
    eventType: string,
    processingTimeMs: number
): void {
    // Log if latency is high (> 5 seconds)
    if (processingTimeMs > 5000) {
        apiLogger.warn(
            {
                provider,
                eventType,
                processingTimeMs
            },
            'High webhook processing latency'
        );
    }
}
