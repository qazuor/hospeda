/**
 * Sentry Configuration Tests
 *
 * Tests for Sentry initialization and error tracking functionality.
 *
 * @module test/lib/sentry
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mock functions so vi.mock factory can reference them
const {
    mockInit,
    mockIsEnabled,
    mockFlush,
    mockClose,
    mockCaptureException,
    mockCaptureMessage,
    mockSetContext,
    mockSetTag,
    mockSetUser,
    mockStartSpan
} = vi.hoisted(() => ({
    mockInit: vi.fn(),
    mockIsEnabled: vi.fn().mockReturnValue(false),
    mockFlush: vi.fn().mockResolvedValue(true),
    mockClose: vi.fn().mockResolvedValue(true),
    mockCaptureException: vi.fn().mockReturnValue('event-id-123'),
    mockCaptureMessage: vi.fn().mockReturnValue('event-id-456'),
    mockSetContext: vi.fn(),
    mockSetTag: vi.fn(),
    mockSetUser: vi.fn(),
    mockStartSpan: vi.fn()
}));

// Mock @sentry/node to avoid global state leaks between tests
vi.mock('@sentry/node', () => ({
    init: mockInit,
    isEnabled: mockIsEnabled,
    flush: mockFlush,
    close: mockClose,
    captureException: mockCaptureException,
    captureMessage: mockCaptureMessage,
    setContext: mockSetContext,
    setTag: mockSetTag,
    setUser: mockSetUser,
    startSpan: mockStartSpan
}));

vi.mock('@sentry/profiling-node', () => ({
    nodeProfilingIntegration: vi.fn(() => ({}))
}));

import * as SentryModule from '../../src/lib/sentry';

describe('Sentry Configuration', () => {
    beforeEach(() => {
        // Clear environment variables
        Reflect.deleteProperty(process.env, 'SENTRY_DSN');
        // Reset all mocks
        vi.clearAllMocks();
        mockIsEnabled.mockReturnValue(false);
        mockFlush.mockResolvedValue(true);
        mockClose.mockResolvedValue(true);
        // Mock console methods to avoid noise in tests
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initializeSentry', () => {
        it('should return false when no DSN is provided', () => {
            const result = SentryModule.initializeSentry();

            expect(result).toBe(false);
            expect(mockInit).not.toHaveBeenCalled();
        });

        it('should initialize with DSN from environment', () => {
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';

            const result = SentryModule.initializeSentry();

            expect(result).toBe(true);
            expect(mockInit).toHaveBeenCalledWith(
                expect.objectContaining({
                    dsn: 'https://test@sentry.io/123'
                })
            );
        });

        it('should use config override for DSN', () => {
            const result = SentryModule.initializeSentry({
                dsn: 'https://override@sentry.io/456'
            });

            expect(result).toBe(true);
            expect(mockInit).toHaveBeenCalledWith(
                expect.objectContaining({
                    dsn: 'https://override@sentry.io/456'
                })
            );
        });

        it('should respect environment configuration', () => {
            process.env.NODE_ENV = 'production';
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';

            const result = SentryModule.initializeSentry();

            expect(result).toBe(true);
        });

        it('should return false when init throws', () => {
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';
            mockInit.mockImplementationOnce(() => {
                throw new Error('Init failed');
            });

            const result = SentryModule.initializeSentry();

            expect(result).toBe(false);
        });
    });

    describe('isSentryEnabled', () => {
        it('should return false when not initialized', () => {
            mockIsEnabled.mockReturnValue(false);

            const result = SentryModule.isSentryEnabled();

            expect(result).toBe(false);
        });

        it('should return true when initialized', () => {
            mockIsEnabled.mockReturnValue(true);

            const result = SentryModule.isSentryEnabled();

            expect(result).toBe(true);
        });
    });

    describe('captureBillingError', () => {
        it('should not throw when Sentry is not enabled', () => {
            const error = new Error('Test billing error');
            const context = {
                subscriptionId: 'sub_123',
                planId: 'plan_pro',
                customerEmail: 'test@example.com'
            };

            expect(() => {
                SentryModule.captureBillingError(error, context);
            }).not.toThrow();
        });

        it('should handle error capturing with full context', () => {
            mockIsEnabled.mockReturnValue(true);
            mockCaptureException.mockReturnValue('event-id-123');
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';
            SentryModule.initializeSentry();

            const error = new Error('Test billing error');
            const context = {
                subscriptionId: 'sub_123',
                planId: 'plan_pro',
                customerEmail: 'test@example.com',
                billingCycle: 'monthly',
                amount: 9900,
                currency: 'ARS'
            };

            const eventId = SentryModule.captureBillingError(error, context);

            expect(mockCaptureException).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    level: 'error',
                    tags: expect.objectContaining({
                        module: 'billing',
                        planId: 'plan_pro'
                    })
                })
            );
            expect(eventId).toBe('event-id-123');
        });

        it('should anonymize email in context', () => {
            const error = new Error('Test error');
            const context = {
                subscriptionId: 'sub_123',
                customerEmail: 'user@example.com'
            };

            SentryModule.captureBillingError(error, context);

            expect(mockCaptureException).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    contexts: expect.objectContaining({
                        billing: expect.objectContaining({
                            customerEmail: '***@example.com'
                        })
                    })
                })
            );
        });

        it('should handle missing email gracefully', () => {
            const error = new Error('Test error');
            const context = {
                subscriptionId: 'sub_123'
            };

            expect(() => {
                SentryModule.captureBillingError(error, context);
            }).not.toThrow();
        });
    });

    describe('capturePaymentFailure', () => {
        it('should not throw when Sentry is not enabled', () => {
            const error = new Error('Payment declined');
            const paymentData = {
                subscriptionId: 'sub_123',
                amount: 9900,
                currency: 'ARS',
                failureReason: 'card_declined'
            };

            expect(() => {
                SentryModule.capturePaymentFailure(error, paymentData);
            }).not.toThrow();
        });
    });

    describe('captureWebhookError', () => {
        it('should not throw when Sentry is not enabled', () => {
            const error = new Error('Webhook signature invalid');
            const webhookData = {
                provider: 'mercadopago',
                eventType: 'payment.updated',
                eventId: 'evt_123',
                retryCount: 2
            };

            expect(() => {
                SentryModule.captureWebhookError(error, webhookData);
            }).not.toThrow();
        });
    });

    describe('captureTrialExpiration', () => {
        it('should not throw when Sentry is not enabled', () => {
            const data = {
                subscriptionId: 'sub_123',
                customerEmail: 'test@example.com',
                planId: 'plan_pro',
                daysInTrial: 14,
                converted: false
            };

            expect(() => {
                SentryModule.captureTrialExpiration(data);
            }).not.toThrow();
        });
    });

    describe('setBillingContext', () => {
        it('should not throw when Sentry is not enabled', () => {
            const context = {
                subscriptionId: 'sub_123',
                planId: 'plan_pro',
                customerEmail: 'test@example.com'
            };

            expect(() => {
                SentryModule.setBillingContext(context);
            }).not.toThrow();

            expect(mockSetContext).toHaveBeenCalledWith(
                'billing',
                expect.objectContaining({
                    subscriptionId: 'sub_123',
                    planId: 'plan_pro',
                    customerEmail: '***@example.com'
                })
            );
        });
    });

    describe('clearUserContext', () => {
        it('should not throw when Sentry is not enabled', () => {
            expect(() => {
                SentryModule.clearUserContext();
            }).not.toThrow();

            expect(mockSetUser).toHaveBeenCalledWith(null);
        });
    });

    describe('flushSentry', () => {
        it('should resolve when Sentry is not enabled', async () => {
            const result = await SentryModule.flushSentry(100);

            expect(result).toBe(true);
        });
    });

    describe('closeSentry', () => {
        it('should resolve when Sentry is not enabled', async () => {
            const result = await SentryModule.closeSentry(100);

            expect(result).toBe(true);
        });
    });
});

describe('Billing Error Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Error Severity', () => {
        it('should accept different severity levels', () => {
            mockIsEnabled.mockReturnValue(true);
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';
            SentryModule.initializeSentry();

            const error = new Error('Test error');
            const context = {
                subscriptionId: 'sub_123'
            };

            // Should not throw with different severities
            expect(() => {
                SentryModule.captureBillingError(error, context, 'error');
                SentryModule.captureBillingError(error, context, 'warning');
                SentryModule.captureBillingError(error, context, 'info');
            }).not.toThrow();

            expect(mockCaptureException).toHaveBeenCalledTimes(3);
        });
    });
});
