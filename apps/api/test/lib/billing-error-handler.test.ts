/**
 * Tests for Billing Error Handler
 *
 * Validates error categorization, Sentry integration, and logging
 * for all billing error handler functions.
 *
 * @module test/lib/billing-error-handler
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BillingError,
    BillingErrorType,
    handleAddonError,
    handlePaymentError,
    handlePromoCodeError,
    handleSubscriptionError,
    handleTrialError,
    handleWebhookError,
    trackPaymentFailureRate,
    trackWebhookLatency
} from '../../src/lib/billing-error-handler';

// Mock sentry module
const mockIsSentryEnabled = vi.fn();
const mockCaptureBillingError = vi.fn();
const mockCapturePaymentFailure = vi.fn();
const mockCaptureWebhookError = vi.fn();

vi.mock('../../src/lib/sentry', () => ({
    isSentryEnabled: (...args: unknown[]) => mockIsSentryEnabled(...args),
    captureBillingError: (...args: unknown[]) => mockCaptureBillingError(...args),
    capturePaymentFailure: (...args: unknown[]) => mockCapturePaymentFailure(...args),
    captureWebhookError: (...args: unknown[]) => mockCaptureWebhookError(...args)
}));

// Mock logger
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        error: (...args: unknown[]) => mockLoggerError(...args),
        warn: (...args: unknown[]) => mockLoggerWarn(...args),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

describe('BillingErrorType', () => {
    it('should have all expected error types', () => {
        expect(BillingErrorType.SUBSCRIPTION).toBe('subscription');
        expect(BillingErrorType.PAYMENT).toBe('payment');
        expect(BillingErrorType.WEBHOOK).toBe('webhook');
        expect(BillingErrorType.TRIAL).toBe('trial');
        expect(BillingErrorType.ADDON).toBe('addon');
        expect(BillingErrorType.PROMO_CODE).toBe('promo_code');
        expect(BillingErrorType.ENTITLEMENT).toBe('entitlement');
        expect(BillingErrorType.METRICS).toBe('metrics');
    });
});

describe('BillingError', () => {
    it('should create error with type and context', () => {
        const context = { subscriptionId: 'sub-123' };
        const error = new BillingError('Test error', BillingErrorType.SUBSCRIPTION, context);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(BillingError);
        expect(error.message).toBe('Test error');
        expect(error.name).toBe('BillingError');
        expect(error.type).toBe(BillingErrorType.SUBSCRIPTION);
        expect(error.context).toBe(context);
        expect(error.originalError).toBeUndefined();
    });

    it('should preserve original error', () => {
        const originalError = new Error('Original');
        const error = new BillingError(
            'Wrapped error',
            BillingErrorType.PAYMENT,
            { planId: 'plan-1' },
            originalError
        );

        expect(error.originalError).toBe(originalError);
        expect(error.originalError?.message).toBe('Original');
    });

    it('should have a stack trace', () => {
        const error = new BillingError('Stack trace test', BillingErrorType.WEBHOOK, {});

        expect(error.stack).toBeDefined();
    });
});

describe('handleSubscriptionError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultContext = {
        subscriptionId: 'sub-123',
        planId: 'plan-pro',
        status: 'active' as const,
        customerEmail: 'test@example.com'
    };

    it('should log the error with context', () => {
        const error = new Error('Something went wrong');

        handleSubscriptionError(error, defaultContext);

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Something went wrong',
                subscriptionId: 'sub-123',
                planId: 'plan-pro',
                status: 'active'
            }),
            'Subscription error'
        );
    });

    it('should capture in Sentry when enabled and error is Error instance', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('Sentry test');

        handleSubscriptionError(error, defaultContext);

        expect(mockCaptureBillingError).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                subscriptionId: 'sub-123',
                planId: 'plan-pro',
                customerEmail: 'test@example.com'
            }),
            'error'
        );
    });

    it('should NOT capture in Sentry when disabled', () => {
        mockIsSentryEnabled.mockReturnValue(false);

        handleSubscriptionError(new Error('test'), defaultContext);

        expect(mockCaptureBillingError).not.toHaveBeenCalled();
    });

    it('should NOT capture in Sentry when error is not Error instance', () => {
        mockIsSentryEnabled.mockReturnValue(true);

        handleSubscriptionError('string error', defaultContext);

        expect(mockCaptureBillingError).not.toHaveBeenCalled();
    });

    it('should return NOT_FOUND for "not found" errors', () => {
        const result = handleSubscriptionError(new Error('Subscription not found'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.message).toBe('Subscription not found');
    });

    it('should return ALREADY_EXISTS for "already exists" errors', () => {
        const result = handleSubscriptionError(
            new Error('Subscription already exists'),
            defaultContext
        );

        expect(result.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(result.message).toBe('Subscription already exists for this user');
    });

    it('should return VALIDATION_ERROR for "invalid status" errors', () => {
        const result = handleSubscriptionError(
            new Error('invalid status transition'),
            defaultContext
        );

        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.message).toBe('Invalid subscription status transition');
    });

    it('should return INTERNAL_ERROR for unknown Error messages', () => {
        const result = handleSubscriptionError(new Error('unexpected failure'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Failed to process subscription');
    });

    it('should return INTERNAL_ERROR for non-Error types', () => {
        const result = handleSubscriptionError('string error', defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Failed to process subscription');
    });

    it('should log string errors properly', () => {
        handleSubscriptionError('plain string error', {});

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'plain string error'
            }),
            'Subscription error'
        );
    });
});

describe('handlePaymentError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultContext = {
        subscriptionId: 'sub-456',
        amount: 1999,
        currency: 'ARS',
        paymentProviderId: 'mp-789',
        customerEmail: 'user@test.com'
    };

    it('should log the error with payment context', () => {
        const error = new Error('Payment failed');

        handlePaymentError(error, defaultContext);

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Payment failed',
                subscriptionId: 'sub-456',
                amount: 1999,
                currency: 'ARS'
            }),
            'Payment error'
        );
    });

    it('should capture in Sentry with "insufficient_funds" failure reason', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('insufficient funds on card');

        handlePaymentError(error, defaultContext);

        expect(mockCapturePaymentFailure).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                failureReason: 'insufficient_funds'
            })
        );
    });

    it('should capture in Sentry with "card_declined" failure reason', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('card declined by issuer');

        handlePaymentError(error, defaultContext);

        expect(mockCapturePaymentFailure).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                failureReason: 'card_declined'
            })
        );
    });

    it('should capture in Sentry with "card_expired" failure reason', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('card has expired');

        handlePaymentError(error, defaultContext);

        expect(mockCapturePaymentFailure).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                failureReason: 'card_expired'
            })
        );
    });

    it('should capture in Sentry with "timeout" failure reason', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('request timeout');

        handlePaymentError(error, defaultContext);

        expect(mockCapturePaymentFailure).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                failureReason: 'timeout'
            })
        );
    });

    it('should use "unknown" failure reason for unrecognized errors', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('some other error');

        handlePaymentError(error, defaultContext);

        expect(mockCapturePaymentFailure).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                failureReason: 'unknown'
            })
        );
    });

    it('should NOT capture in Sentry for non-Error types', () => {
        mockIsSentryEnabled.mockReturnValue(true);

        handlePaymentError('string error', defaultContext);

        expect(mockCapturePaymentFailure).not.toHaveBeenCalled();
    });

    it('should always return INTERNAL_ERROR', () => {
        const result = handlePaymentError(new Error('any payment error'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Payment processing failed');
    });
});

describe('handleWebhookError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultContext = {
        provider: 'mercadopago',
        eventType: 'payment.updated',
        eventId: 'evt-123',
        retryCount: 2,
        processingTimeMs: 150
    };

    it('should log the error with webhook context', () => {
        const error = new Error('Webhook failed');

        handleWebhookError(error, defaultContext);

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Webhook failed',
                provider: 'mercadopago',
                eventType: 'payment.updated',
                eventId: 'evt-123',
                retryCount: 2
            }),
            'Webhook processing error'
        );
    });

    it('should capture in Sentry when enabled', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('webhook error');

        handleWebhookError(error, defaultContext);

        expect(mockCaptureWebhookError).toHaveBeenCalledWith(error, defaultContext);
    });

    it('should return UNAUTHORIZED for "signature" errors', () => {
        const result = handleWebhookError(new Error('invalid signature'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.UNAUTHORIZED);
        expect(result.message).toBe('Invalid webhook signature');
    });

    it('should return ALREADY_EXISTS for "duplicate" errors', () => {
        const result = handleWebhookError(new Error('duplicate event received'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(result.message).toBe('Webhook event already processed');
    });

    it('should return INTERNAL_ERROR for unknown errors', () => {
        const result = handleWebhookError(new Error('something broke'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Failed to process webhook');
    });

    it('should return INTERNAL_ERROR for non-Error types', () => {
        const result = handleWebhookError('string error', defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Failed to process webhook');
    });
});

describe('handleTrialError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultContext = {
        subscriptionId: 'sub-trial-1',
        customerEmail: 'trial@test.com',
        planId: 'plan-free'
    };

    it('should log the error with trial context', () => {
        const error = new Error('Trial error');

        handleTrialError(error, defaultContext);

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Trial error',
                subscriptionId: 'sub-trial-1',
                planId: 'plan-free'
            }),
            'Trial error'
        );
    });

    it('should capture in Sentry with warning severity', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('trial issue');

        handleTrialError(error, defaultContext);

        expect(mockCaptureBillingError).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                subscriptionId: 'sub-trial-1',
                planId: 'plan-free',
                customerEmail: 'trial@test.com'
            }),
            'warning'
        );
    });

    it('should return ALREADY_EXISTS for "already used" errors', () => {
        const result = handleTrialError(new Error('trial already used'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(result.message).toBe('Trial already used for this user');
    });

    it('should return VALIDATION_ERROR for "expired" errors', () => {
        const result = handleTrialError(new Error('trial has expired'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.message).toBe('Trial has expired');
    });

    it('should return INTERNAL_ERROR for unknown errors', () => {
        const result = handleTrialError(new Error('unknown trial issue'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Failed to process trial');
    });
});

describe('handleAddonError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultContext = {
        subscriptionId: 'sub-789',
        addonIds: ['addon-1', 'addon-2'],
        customerEmail: 'addon@test.com'
    };

    it('should log the error with addon context', () => {
        const error = new Error('Addon issue');

        handleAddonError(error, defaultContext);

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Addon issue',
                subscriptionId: 'sub-789',
                addonCount: 2
            }),
            'Addon error'
        );
    });

    it('should capture in Sentry with error severity', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('addon failure');

        handleAddonError(error, defaultContext);

        expect(mockCaptureBillingError).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                subscriptionId: 'sub-789',
                addonIds: ['addon-1', 'addon-2'],
                customerEmail: 'addon@test.com'
            }),
            'error'
        );
    });

    it('should return NOT_FOUND for "not found" errors', () => {
        const result = handleAddonError(new Error('addon not found'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.message).toBe('Addon not found');
    });

    it('should return VALIDATION_ERROR for "limit exceeded" errors', () => {
        const result = handleAddonError(new Error('addon limit exceeded'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.message).toBe('Addon limit exceeded');
    });

    it('should return INTERNAL_ERROR for unknown errors', () => {
        const result = handleAddonError(new Error('random addon error'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Failed to process addon');
    });
});

describe('handlePromoCodeError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const defaultContext = {
        promoCode: 'SAVE20',
        customerEmail: 'promo@test.com'
    };

    it('should log the error with promo code context', () => {
        const error = new Error('Promo error');

        handlePromoCodeError(error, defaultContext);

        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Promo error',
                promoCode: 'SAVE20'
            }),
            'Promo code error'
        );
    });

    it('should capture in Sentry with warning severity', () => {
        mockIsSentryEnabled.mockReturnValue(true);
        const error = new Error('promo issue');

        handlePromoCodeError(error, defaultContext);

        expect(mockCaptureBillingError).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                promoCode: 'SAVE20',
                customerEmail: 'promo@test.com'
            }),
            'warning'
        );
    });

    it('should return NOT_FOUND for "not found" errors', () => {
        const result = handlePromoCodeError(new Error('promo code not found'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.message).toBe('Promo code not found or invalid');
    });

    it('should return NOT_FOUND for "invalid" errors', () => {
        const result = handlePromoCodeError(new Error('promo code invalid'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.message).toBe('Promo code not found or invalid');
    });

    it('should return VALIDATION_ERROR for "expired" errors', () => {
        const result = handlePromoCodeError(new Error('promo code has expired'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.message).toBe('Promo code has expired');
    });

    it('should return VALIDATION_ERROR for "limit" errors', () => {
        const result = handlePromoCodeError(new Error('usage limit reached'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.message).toBe('Promo code usage limit reached');
    });

    it('should return INTERNAL_ERROR for unknown errors', () => {
        const result = handlePromoCodeError(new Error('unexpected promo error'), defaultContext);

        expect(result.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.message).toBe('Failed to apply promo code');
    });
});

describe('trackPaymentFailureRate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should warn when failure rate exceeds 5%', () => {
        trackPaymentFailureRate(6, 100, 60);

        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.objectContaining({
                failureCount: 6,
                totalCount: 100,
                failureRate: '6.00%',
                timeWindowMinutes: 60
            }),
            'High payment failure rate detected'
        );
    });

    it('should NOT warn when failure rate is at 5%', () => {
        trackPaymentFailureRate(5, 100, 60);

        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should NOT warn when failure rate is below 5%', () => {
        trackPaymentFailureRate(2, 100, 60);

        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should handle zero total count without error', () => {
        trackPaymentFailureRate(0, 0, 60);

        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should handle 100% failure rate', () => {
        trackPaymentFailureRate(10, 10, 30);

        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.objectContaining({
                failureRate: '100.00%'
            }),
            'High payment failure rate detected'
        );
    });
});

describe('trackWebhookLatency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should warn when latency exceeds 5000ms', () => {
        trackWebhookLatency('mercadopago', 'payment.updated', 5001);

        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: 'mercadopago',
                eventType: 'payment.updated',
                processingTimeMs: 5001
            }),
            'High webhook processing latency'
        );
    });

    it('should NOT warn when latency is exactly 5000ms', () => {
        trackWebhookLatency('mercadopago', 'payment.created', 5000);

        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should NOT warn when latency is below 5000ms', () => {
        trackWebhookLatency('mercadopago', 'payment.created', 150);

        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should handle very high latency', () => {
        trackWebhookLatency('mercadopago', 'subscription.updated', 30000);

        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.objectContaining({
                processingTimeMs: 30000
            }),
            'High webhook processing latency'
        );
    });
});
