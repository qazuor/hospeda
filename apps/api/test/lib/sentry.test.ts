/**
 * Sentry Configuration Tests
 *
 * Tests for:
 * - Sentry initialization and error tracking functionality.
 * - `applyBeforeSend` filter (SPEC-180 T-007) — extracted as a pure function
 *   so it can be unit-tested without mocking the full Sentry.init() lifecycle.
 *
 * @module test/lib/sentry
 */

import type { ErrorEvent } from '@sentry/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as envModule from '../../src/utils/env';

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

import { BEFORE_SEND_NOISE_PATTERNS, applyBeforeSend } from '../../src/lib/sentry';
import * as SentryModule from '../../src/lib/sentry';

describe('Sentry Configuration', () => {
    let originalSentryDsn: string | undefined;

    beforeEach(() => {
        // Save and clear Sentry DSN from the validated env object
        originalSentryDsn = envModule.env.HOSPEDA_SENTRY_DSN;
        (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN = undefined;
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
        // Restore original Sentry DSN in validated env object
        (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
            originalSentryDsn;
        vi.restoreAllMocks();
    });

    describe('initializeSentry', () => {
        it('should return false when no DSN is provided', () => {
            const result = SentryModule.initializeSentry();

            expect(result).toBe(false);
            expect(mockInit).not.toHaveBeenCalled();
        });

        it('should initialize with DSN from environment', () => {
            (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
                'https://test@sentry.io/123';

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
            (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
                'https://test@sentry.io/123';

            const result = SentryModule.initializeSentry();

            expect(result).toBe(true);
        });

        it('should return false when init throws', () => {
            (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
                'https://test@sentry.io/123';
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
            (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
                'https://test@sentry.io/123';
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

        it('should forward provider error fields as tags and context when present (SPEC-149)', () => {
            mockIsEnabled.mockReturnValue(true);
            mockCaptureException.mockReturnValue('event-id-provider');
            (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
                'https://test@sentry.io/123';
            SentryModule.initializeSentry();

            const error = new Error('Provider rate limited');
            const context = {
                subscriptionId: 'sub_456',
                planId: 'plan_pro',
                operation: 'checkout_create',
                providerStatus: 429,
                providerCode: 'rate_limit_error'
            };

            SentryModule.captureBillingError(error, context);

            expect(mockCaptureException).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    tags: expect.objectContaining({
                        billing_operation: 'checkout_create',
                        provider_status: '429',
                        provider_code: 'rate_limit_error'
                    }),
                    contexts: expect.objectContaining({
                        billing: expect.objectContaining({
                            providerOperation: 'checkout_create',
                            providerStatus: 429,
                            providerCode: 'rate_limit_error'
                        })
                    })
                })
            );
        });

        it('should NOT include provider tags when provider fields are absent (SPEC-149)', () => {
            mockIsEnabled.mockReturnValue(true);
            mockCaptureException.mockReturnValue('event-id-no-provider');
            (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
                'https://test@sentry.io/123';
            SentryModule.initializeSentry();

            const error = new Error('Subscription creation failed');
            const context = {
                subscriptionId: 'sub_789',
                planId: 'plan_basic'
                // no operation / providerStatus / providerCode
            };

            SentryModule.captureBillingError(error, context);

            const callArg = mockCaptureException.mock.calls.at(-1)?.[1] as Record<string, unknown>;
            const tags = callArg?.tags as Record<string, unknown> | undefined;

            expect(tags).not.toHaveProperty('billing_operation');
            expect(tags).not.toHaveProperty('provider_status');
            expect(tags).not.toHaveProperty('provider_code');
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
            (envModule.env as unknown as Record<string, unknown>).HOSPEDA_SENTRY_DSN =
                'https://test@sentry.io/123';
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

// ---------------------------------------------------------------------------
// applyBeforeSend — pure filter function unit tests (SPEC-180 T-007)
//
// These tests verify the extracted `applyBeforeSend` function without
// initializing Sentry. They are a regression guard for the denylist logic
// and a correctness check for breadcrumb scrubbing.
// ---------------------------------------------------------------------------

/**
 * Helper to build a minimal ErrorEvent with optional overrides.
 *
 * In the Sentry SDK, `ErrorEvent` is a `BaseEvent` with `type` omitted (undefined),
 * distinguishing it from `Transaction` and `Profile` events. We cast through unknown
 * because test-constructed literals won't satisfy all optional SDK fields.
 */
function makeEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
    return {
        event_id: 'test-event-id',
        ...overrides
    } as unknown as ErrorEvent;
}

describe('applyBeforeSend', () => {
    describe('expected_error:true tag — drop', () => {
        it('should drop events tagged expected_error=true', () => {
            // Arrange
            const event = makeEvent({ tags: { expected_error: 'true' } });

            // Act
            const result = applyBeforeSend(event);

            // Assert — regression guard for SPEC-143 T-143-47 convention
            expect(result).toBeNull();
        });

        it('should pass through events tagged expected_error=false', () => {
            // Arrange
            const event = makeEvent({ tags: { expected_error: 'false' } });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).not.toBeNull();
        });
    });

    describe('middleware noise message — drop', () => {
        it('should drop events whose message matches the Sentry middleware noise string', () => {
            // Arrange
            const event = makeEvent({ message: 'Request error caught by Sentry middleware' });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).toBeNull();
        });

        it('should drop events whose exception value contains the middleware noise string', () => {
            // Arrange
            const event = makeEvent({
                exception: {
                    values: [
                        {
                            value: 'Request error caught by Sentry middleware at handleRequest:42'
                        }
                    ]
                }
            });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('BEFORE_SEND_NOISE_PATTERNS denylist — drop', () => {
        it('should export BEFORE_SEND_NOISE_PATTERNS as a readonly array', () => {
            expect(Array.isArray(BEFORE_SEND_NOISE_PATTERNS)).toBe(true);
            expect(BEFORE_SEND_NOISE_PATTERNS.length).toBeGreaterThan(0);
        });

        it('should drop messages matching the 5xx HTTP logger pattern', () => {
            // Arrange
            const event = makeEvent({ message: '[http] GET /api/v1/test responded with 500' });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).toBeNull();
        });

        it('should drop messages matching the transform-pipeline body dump pattern', () => {
            // Arrange
            const event = makeEvent({ message: '[transform] response body: {"foo":"bar"}' });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('responseBody in extra — strip (not drop)', () => {
        it('should strip responseBody from event.extra while keeping the event', () => {
            // Arrange
            const event = makeEvent({
                extra: { responseBody: '{"sensitive":"data"}', requestId: 'req-abc' }
            });

            // Act
            const result = applyBeforeSend(event);

            // Assert — event is kept but responseBody is removed
            expect(result).not.toBeNull();
            expect((result?.extra as Record<string, unknown>).responseBody).toBeUndefined();
            expect((result?.extra as Record<string, unknown>).requestId).toBe('req-abc');
        });

        it('should pass through events whose extra has no responseBody', () => {
            // Arrange
            const event = makeEvent({ extra: { requestId: 'req-xyz' } });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).not.toBeNull();
            expect((result?.extra as Record<string, unknown>).requestId).toBe('req-xyz');
        });
    });

    describe('breadcrumb scrubbing', () => {
        it('should redact breadcrumb data keys that contain token/key/secret/password', () => {
            // Arrange
            const event = makeEvent({
                breadcrumbs: [
                    {
                        category: 'auth',
                        data: {
                            accessToken: 'abc123',
                            apiKey: 'sk-secret',
                            password: 'hunter2',
                            username: 'alice'
                        }
                    }
                ]
            });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).not.toBeNull();
            const crumb = result?.breadcrumbs?.[0];
            expect(crumb?.data?.accessToken).toBe('[REDACTED]');
            expect(crumb?.data?.apiKey).toBe('[REDACTED]');
            expect(crumb?.data?.password).toBe('[REDACTED]');
            // Non-sensitive key preserved
            expect(crumb?.data?.username).toBe('alice');
        });

        it('should leave breadcrumbs without data untouched', () => {
            // Arrange
            const event = makeEvent({
                breadcrumbs: [{ category: 'navigation', message: 'page transition' }]
            });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).not.toBeNull();
            expect(result?.breadcrumbs?.[0]?.message).toBe('page transition');
        });
    });

    describe('actionable events — pass through', () => {
        it('should pass through actionable error events with no matching patterns', () => {
            // Arrange
            const event = makeEvent({
                message: 'cron bootstrap failure: DB_CONNECTION_REFUSED',
                tags: { module: 'cron' },
                exception: {
                    values: [{ type: 'Error', value: 'ECONNREFUSED' }]
                }
            });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).not.toBeNull();
            expect(result?.message).toBe('cron bootstrap failure: DB_CONNECTION_REFUSED');
        });

        it('should pass through events with no message and no matching tags', () => {
            // Arrange — minimal event with only an exception and no noise markers
            const event = makeEvent({
                exception: {
                    values: [{ type: 'TypeError', value: 'Cannot read property x of undefined' }]
                }
            });

            // Act
            const result = applyBeforeSend(event);

            // Assert
            expect(result).not.toBeNull();
        });
    });
});
