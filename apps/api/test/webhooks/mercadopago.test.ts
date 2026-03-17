/**
 * MercadoPago Webhook Handler Tests
 *
 * Comprehensive test suite for webhook processing including:
 * - Pure function utilities (sanitize, extract)
 * - Payment notification handlers
 * - Error handling
 *
 * Mocking strategy: mocks service-layer dependencies (billing, notifications,
 * AddonService) and webhook utility functions instead of raw DB access.
 * The DB-level tests for event persistence (handleWebhookEvent,
 * markWebhookEventProcessed) are tested in webhook-idempotency-db.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock state for env module (must be hoisted so vi.mock factories can reference it)
const mockEnv = vi.hoisted(() => {
    const env: Record<string, string | undefined> = {};
    return env;
});

// Mock modules BEFORE imports
vi.mock('@qazuor/qzpay-hono', () => ({
    createWebhookRouter: vi.fn().mockReturnValue({})
}));

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: vi.fn(),
    getAddonBySlug: vi.fn()
}));

// Mock @repo/db with minimal stubs -- only needed because some modules
// import table schemas at load time. No query chain mocking needed.
vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingWebhookEvents: {
        id: 'id',
        providerEventId: 'providerEventId',
        status: 'status',
        provider: 'provider',
        type: 'type',
        payload: 'payload',
        error: 'error',
        processedAt: 'processedAt',
        createdAt: 'createdAt'
    },
    eq: vi.fn((field: unknown, value: unknown) => ({ field, value }))
}));

vi.mock('@repo/notifications', () => ({
    NotificationType: {
        PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
        PAYMENT_FAILURE: 'PAYMENT_FAILURE',
        ADMIN_PAYMENT_FAILURE: 'ADMIN_PAYMENT_FAILURE',
        ADDON_PURCHASE: 'ADDON_PURCHASE'
    }
}));

vi.mock('../../src/lib/sentry', () => ({
    captureWebhookError: vi.fn()
}));

// Mock env module so notifications.ts can read admin email addresses.
// The production code uses `env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS`, not
// `process.env`, so we must mock the validated env object.
vi.mock('../../src/utils/env', () => ({
    env: new Proxy(mockEnv, {
        get: (_target, prop) => mockEnv[prop as string]
    })
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Service layer mock: AddonService
vi.mock('../../src/services/addon.service', () => ({
    AddonService: vi.fn().mockImplementation(() => ({
        confirmPurchase: vi.fn()
    }))
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// Service layer mock: notification helper
vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn()
}));

import { getDb } from '@repo/db';
// Import after mocks
import type { Context } from 'hono';
import { captureWebhookError } from '../../src/lib/sentry';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    extractAddonFromReference,
    extractAddonMetadata,
    extractPaymentInfo,
    handlePaymentUpdated,
    handleWebhookError,
    handleWebhookEvent,
    markWebhookEventProcessed,
    sanitizeErrorForNotification
} from '../../src/routes/webhooks/mercadopago';
import { AddonService } from '../../src/services/addon.service';
import { sendNotification } from '../../src/utils/notification-helper';

/**
 * Helper to create mock Hono context
 */
function createMockContext(
    overrides: { requestId?: string; store?: Record<string, unknown> } = {}
): Context {
    const store: Record<string, unknown> = {
        requestId: overrides.requestId ?? 'req-123',
        ...overrides.store
    };
    return {
        get: (key: string) => store[key],
        set: (key: string, value: unknown) => {
            store[key] = value;
        },
        json: vi
            .fn()
            .mockReturnValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    } as unknown as Context;
}

/**
 * Helper to create mock webhook event with required fields
 */
function createMockEvent(partial: { id: string; type: string; data: unknown }) {
    return {
        ...partial,
        created: new Date()
    };
}

describe('MercadoPago Webhook Handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mockEnv between tests
        for (const key of Object.keys(mockEnv)) {
            delete mockEnv[key];
        }
    });

    // =======================================================================
    // Pure function tests (no DB, no services)
    // =======================================================================

    describe('sanitizeErrorForNotification', () => {
        it('should remove stack traces', () => {
            const error = `Error: Something failed
    at Object.handler (/home/user/app/index.ts:42:15)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

            const result = sanitizeErrorForNotification(error);

            expect(result).not.toContain('at Object.handler');
            expect(result).not.toContain('at processTicksAndRejections');
        });

        it('should remove file paths', () => {
            const error = 'Error in /home/user/app/file.ts at line 42';

            const result = sanitizeErrorForNotification(error);

            expect(result).toContain('[path]');
            expect(result).not.toContain('/home/user/app/file.ts');
        });

        it('should remove connection strings', () => {
            const error = 'Failed to connect to postgresql://user:pass@localhost:5432/db';

            const result = sanitizeErrorForNotification(error);

            expect(result).not.toContain('//user');
            expect(result).not.toContain('/db');
            expect(result).toContain('[path]');
        });

        it('should remove environment variable patterns', () => {
            const error =
                'Missing DATABASE_URL=postgresql://localhost:5432/db or API_KEY=secret123';

            const result = sanitizeErrorForNotification(error);

            expect(result).toContain('[env-var]');
            expect(result).not.toContain('DATABASE_URL=');
            expect(result).not.toContain('API_KEY=secret123');
        });

        it('should remove IP addresses', () => {
            const error = 'Connection failed to 192.168.1.1 and 10.0.0.5';

            const result = sanitizeErrorForNotification(error);

            expect(result).toContain('[ip]');
            expect(result).not.toContain('192.168.1.1');
            expect(result).not.toContain('10.0.0.5');
        });

        it('should truncate to maxLength and add truncation notice', () => {
            const error = 'a'.repeat(600);

            const result = sanitizeErrorForNotification(error, 100);

            expect(result.length).toBeLessThanOrEqual(120);
            expect(result).toContain('... [truncated]');
        });

        it('should handle empty string', () => {
            const result = sanitizeErrorForNotification('');

            expect(result).toBe('');
        });

        it('should use default maxLength of 500', () => {
            const error = 'x'.repeat(600);

            const result = sanitizeErrorForNotification(error);

            expect(result.length).toBeLessThanOrEqual(520);
        });
    });

    describe('extractAddonMetadata', () => {
        it('should extract addonSlug and customerId from valid metadata', () => {
            const metadata = {
                addonSlug: 'premium-photos',
                customerId: 'cust_123'
            };

            const result = extractAddonMetadata(metadata);

            expect(result).toEqual({
                addonSlug: 'premium-photos',
                customerId: 'cust_123'
            });
        });

        it('should return null for null input', () => {
            const result = extractAddonMetadata(null);
            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = extractAddonMetadata(undefined);
            expect(result).toBeNull();
        });

        it('should return null for non-object input', () => {
            const result = extractAddonMetadata('not an object');
            expect(result).toBeNull();
        });

        it('should return null when addonSlug is missing', () => {
            const metadata = { customerId: 'cust_123' };
            const result = extractAddonMetadata(metadata);
            expect(result).toBeNull();
        });

        it('should return null when customerId is empty string', () => {
            const metadata = { addonSlug: 'premium-photos', customerId: '' };
            const result = extractAddonMetadata(metadata);
            expect(result).toBeNull();
        });

        it('should return null when values are not strings', () => {
            const metadata = { addonSlug: 123, customerId: true };
            const result = extractAddonMetadata(metadata);
            expect(result).toBeNull();
        });
    });

    describe('extractAddonFromReference', () => {
        it('should extract slug from valid addon reference pattern', () => {
            const reference = 'addon_premium-photos_1234567890';
            const result = extractAddonFromReference(reference);
            expect(result).toBe('premium-photos');
        });

        it('should return null for non-matching pattern', () => {
            const result = extractAddonFromReference('invalid-pattern');
            expect(result).toBeNull();
        });

        it('should return null for non-string input', () => {
            const result = extractAddonFromReference(123);
            expect(result).toBeNull();
        });

        it('should return null for empty string', () => {
            const result = extractAddonFromReference('');
            expect(result).toBeNull();
        });

        it('should return null for addon prefix without full match', () => {
            const result = extractAddonFromReference('addon_');
            expect(result).toBeNull();
        });
    });

    describe('extractPaymentInfo', () => {
        it('should extract all payment fields correctly', () => {
            const data = {
                transaction_amount: 99.99,
                currency_id: 'ARS',
                status: 'approved',
                status_detail: 'accredited',
                payment_method_id: 'credit_card'
            };

            const result = extractPaymentInfo(data);

            expect(result).toEqual({
                amount: 99.99,
                currency: 'ARS',
                status: 'approved',
                statusDetail: 'accredited',
                paymentMethod: 'credit_card'
            });
        });

        it('should default currency to ARS when not provided', () => {
            const data = { transaction_amount: 99.99, status: 'approved' };
            const result = extractPaymentInfo(data);
            expect(result?.currency).toBe('ARS');
        });

        it('should return null when amount is missing', () => {
            const data = { status: 'approved' };
            const result = extractPaymentInfo(data);
            expect(result).toBeNull();
        });

        it('should return null when status is missing', () => {
            const data = { transaction_amount: 99.99 };
            const result = extractPaymentInfo(data);
            expect(result).toBeNull();
        });

        it('should handle null statusDetail and paymentMethod', () => {
            const data = { transaction_amount: 99.99, status: 'approved' };
            const result = extractPaymentInfo(data);
            expect(result?.statusDetail).toBeNull();
            expect(result?.paymentMethod).toBeNull();
        });
    });

    // =======================================================================
    // DB-dependent event persistence tests (minimal DB mocking)
    // =======================================================================

    describe('markWebhookEventProcessed', () => {
        it('should update webhook event status on first try', async () => {
            const mockWhere = vi.fn().mockResolvedValue(undefined);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<
                typeof getDb
            >);

            await markWebhookEventProcessed('webhook_123');

            expect(mockUpdate).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith({
                status: 'processed',
                processedAt: expect.any(Date)
            });
            expect(mockWhere).toHaveBeenCalled();
        });

        it('should retry on failure and succeed', async () => {
            const mockWhere = vi
                .fn()
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce(undefined);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<
                typeof getDb
            >);

            vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
                cb();
                return 0 as unknown as NodeJS.Timeout;
            }) as typeof setTimeout);

            await markWebhookEventProcessed('webhook_123');

            expect(mockWhere).toHaveBeenCalledTimes(2);
        });

        it('should throw after MAX_RETRIES failures', async () => {
            const mockWhere = vi.fn().mockRejectedValue(new Error('DB error'));
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<
                typeof getDb
            >);

            vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
                cb();
                return 0 as unknown as NodeJS.Timeout;
            }) as typeof setTimeout);

            await expect(markWebhookEventProcessed('webhook_123')).rejects.toThrow('DB error');

            expect(mockWhere).toHaveBeenCalledTimes(3);
        });

        it('should use exponential backoff on retries', async () => {
            const mockWhere = vi
                .fn()
                .mockRejectedValueOnce(new Error('DB error'))
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce(undefined);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<
                typeof getDb
            >);

            const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(((
                cb: () => void
            ) => {
                cb();
                return 0 as unknown as NodeJS.Timeout;
            }) as typeof setTimeout);

            await markWebhookEventProcessed('webhook_123');

            expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 100);
            expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 200);
        });
    });

    describe('handleWebhookEvent - idempotency', () => {
        it('should INSERT new event and persist to database', async () => {
            const mockReturning = vi.fn().mockResolvedValue([{ id: 'webhook_new_123' }]);
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            vi.mocked(getDb).mockReturnValue({ insert: mockInsert } as unknown as ReturnType<
                typeof getDb
            >);

            const context = createMockContext({ requestId: 'req_new' });
            const event = createMockEvent({ id: 'evt_123', type: 'payment.created', data: {} });

            const result = await handleWebhookEvent(context, event);

            expect(mockInsert).toHaveBeenCalled();
            expect(mockValues).toHaveBeenCalledWith({
                provider: 'mercadopago',
                type: 'payment.created',
                providerEventId: 'evt_123',
                status: 'pending',
                payload: event
            });
            expect(result).toBeUndefined();
        });

        it('should skip already-processed duplicate events', async () => {
            const mockReturning = vi
                .fn()
                .mockRejectedValue(new Error('duplicate key value violates unique constraint'));
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            const mockLimit = vi
                .fn()
                .mockResolvedValue([{ id: 'webhook_123', status: 'processed' }]);
            const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
            const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

            vi.mocked(getDb).mockReturnValue({
                insert: mockInsert,
                select: mockSelect
            } as unknown as ReturnType<typeof getDb>);

            const context = createMockContext({ requestId: 'req_dup' });
            const event = createMockEvent({ id: 'evt_123', type: 'payment.created', data: {} });

            const result = await handleWebhookEvent(context, event);

            expect(context.json).toHaveBeenCalledWith(
                { success: true, message: 'Webhook already processed' },
                200
            );
            expect(result).toBeDefined();
        });

        it('should skip currently-pending duplicate events', async () => {
            const mockReturning = vi.fn().mockRejectedValue(new Error('duplicate key'));
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            const mockLimit = vi.fn().mockResolvedValue([{ id: 'webhook_123', status: 'pending' }]);
            const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
            const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

            vi.mocked(getDb).mockReturnValue({
                insert: mockInsert,
                select: mockSelect
            } as unknown as ReturnType<typeof getDb>);

            const context = createMockContext({ requestId: 'req_dup' });
            const event = createMockEvent({ id: 'evt_123', type: 'payment.created', data: {} });

            const result = await handleWebhookEvent(context, event);

            expect(context.json).toHaveBeenCalledWith(
                { success: true, message: 'Webhook currently being processed' },
                200
            );
            expect(result).toBeDefined();
        });

        it('should allow reprocessing of failed events', async () => {
            const mockReturning = vi.fn().mockRejectedValue(new Error('duplicate'));
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            const mockLimit = vi
                .fn()
                .mockResolvedValue([{ id: 'webhook_failed_123', status: 'failed' }]);
            const mockWhereSelect = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockFrom = vi.fn().mockReturnValue({ where: mockWhereSelect });
            const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

            const mockWhereUpdate = vi.fn().mockResolvedValue(undefined);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({
                insert: mockInsert,
                select: mockSelect,
                update: mockUpdate
            } as unknown as ReturnType<typeof getDb>);

            const context = createMockContext({ requestId: 'req_retry' });
            const event = createMockEvent({ id: 'evt_123', type: 'payment.created', data: {} });

            const result = await handleWebhookEvent(context, event);

            expect(mockUpdate).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith({
                status: 'pending',
                payload: event,
                error: null,
                processedAt: null
            });
            expect(result).toBeUndefined();
        });

        it('should handle non-duplicate INSERT errors', async () => {
            const mockReturning = vi.fn().mockRejectedValue(new Error('Connection timeout'));
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            vi.mocked(getDb).mockReturnValue({ insert: mockInsert } as unknown as ReturnType<
                typeof getDb
            >);

            const context = createMockContext({ requestId: 'req_error' });
            const event = createMockEvent({ id: 'evt_123', type: 'payment.created', data: {} });

            const result = await handleWebhookEvent(context, event);

            expect(result).toBeUndefined();
        });
    });

    // =======================================================================
    // Service-layer tests (mock services, not DB)
    // =======================================================================

    describe('handlePaymentUpdated - payment notifications', () => {
        it('should send success notification on approved payment', async () => {
            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue({
                        id: 'cust_123',
                        email: 'user@example.com',
                        metadata: { name: 'John Doe', userId: 'user_123' }
                    })
                },
                subscriptions: {
                    getByCustomerId: vi.fn().mockResolvedValue([{ planId: 'plan_123' }])
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Pro Plan' })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(sendNotification).mockResolvedValue({ success: true, data: {} } as never);

            const context = createMockContext({ requestId: 'req_approved' });
            const event = createMockEvent({
                id: 'evt_123',
                type: 'payment.updated',
                data: {
                    transaction_amount: 99.99,
                    currency_id: 'ARS',
                    status: 'approved',
                    payment_method_id: 'credit_card',
                    metadata: { customerId: 'cust_123' }
                }
            });

            await handlePaymentUpdated(context, event);

            // Flush fire-and-forget IIFE async notification by waiting for microtasks
            await vi.waitFor(() => {
                expect(sendNotification).toHaveBeenCalled();
            });

            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'PAYMENT_SUCCESS',
                    recipientEmail: 'user@example.com',
                    amount: 99.99,
                    currency: 'ARS'
                })
            );
        });

        it('should send failure notifications on rejected payment', async () => {
            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue({
                        id: 'cust_123',
                        email: 'user@example.com',
                        metadata: { name: 'John Doe', userId: 'user_123' }
                    })
                },
                subscriptions: {
                    getByCustomerId: vi.fn().mockResolvedValue([{ planId: 'plan_123' }])
                },
                plans: {
                    get: vi.fn().mockResolvedValue({ name: 'Pro Plan' })
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(sendNotification).mockResolvedValue({ success: true, data: {} } as never);

            const context = createMockContext({ requestId: 'req_rejected' });
            const event = createMockEvent({
                id: 'evt_123',
                type: 'payment.updated',
                data: {
                    transaction_amount: 99.99,
                    currency_id: 'ARS',
                    status: 'rejected',
                    status_detail: 'cc_rejected_insufficient_amount',
                    metadata: { customerId: 'cust_123' }
                }
            });

            mockEnv.HOSPEDA_ADMIN_NOTIFICATION_EMAILS = 'admin@example.com';

            await handlePaymentUpdated(context, event);

            // Flush fire-and-forget IIFE async notification by waiting for microtasks
            await vi.waitFor(() => {
                expect(sendNotification).toHaveBeenCalled();
            });

            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'PAYMENT_FAILURE',
                    recipientEmail: 'user@example.com'
                })
            );

            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'ADMIN_PAYMENT_FAILURE',
                    recipientEmail: 'admin@example.com'
                })
            );
        });

        it('should process addon purchase when metadata has addonSlug and customerId', async () => {
            const mockBilling = {
                customers: {
                    get: vi.fn().mockResolvedValue({
                        id: 'cust_123',
                        email: 'user@example.com',
                        metadata: { name: 'John Doe', userId: 'user_123' }
                    })
                }
            };

            const mockConfirmPurchase = vi
                .fn()
                .mockResolvedValue({ success: true, data: undefined });

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );
            vi.mocked(AddonService).mockImplementation(
                () =>
                    ({
                        confirmPurchase: mockConfirmPurchase
                    }) as never
            );

            const context = createMockContext({ requestId: 'req_addon' });
            const event = createMockEvent({
                id: 'evt_123',
                type: 'payment.updated',
                data: {
                    metadata: {
                        addonSlug: 'premium-photos',
                        customerId: 'cust_123'
                    }
                }
            });

            await handlePaymentUpdated(context, event);

            expect(mockConfirmPurchase).toHaveBeenCalledWith({
                customerId: 'cust_123',
                addonSlug: 'premium-photos'
            });
        });

        it('should skip addon processing when billing not configured', async () => {
            vi.mocked(getQZPayBilling).mockReturnValue(null);

            const context = createMockContext({ requestId: 'req_no_billing' });
            const event = createMockEvent({
                id: 'evt_123',
                type: 'payment.updated',
                data: {
                    metadata: {
                        addonSlug: 'premium-photos',
                        customerId: 'cust_123'
                    }
                }
            });

            const result = await handlePaymentUpdated(context, event);

            expect(result).toBeUndefined();
        });

        it('should handle errors gracefully without failing webhook', async () => {
            const mockBilling = {
                customers: {
                    get: vi.fn().mockRejectedValue(new Error('Customer fetch failed'))
                }
            };

            vi.mocked(getQZPayBilling).mockReturnValue(
                mockBilling as unknown as ReturnType<typeof getQZPayBilling>
            );

            const context = createMockContext({ requestId: 'req_error' });
            const event = createMockEvent({
                id: 'evt_123',
                type: 'payment.updated',
                data: {
                    metadata: {
                        addonSlug: 'premium-photos',
                        customerId: 'cust_123'
                    }
                }
            });

            const result = await handlePaymentUpdated(context, event);

            expect(result).toBeUndefined();
        });
    });

    describe('handleWebhookError', () => {
        it('should capture error in Sentry', async () => {
            const error = new Error('Webhook processing failed');
            const context = createMockContext({ requestId: 'req_error' });

            await handleWebhookError(error, context);

            expect(captureWebhookError).toHaveBeenCalledWith(error, {
                provider: 'mercadopago',
                eventType: 'unknown',
                retryCount: 0
            });
        });

        it('should update webhook event status to failed in DB when event was persisted', async () => {
            // First, populate the internal requestProviderEventIds by running handleWebhookEvent
            const mockReturning = vi.fn().mockResolvedValue([{ id: 'webhook_fail_123' }]);
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            vi.mocked(getDb).mockReturnValue({ insert: mockInsert } as unknown as ReturnType<
                typeof getDb
            >);

            const context = createMockContext({ requestId: 'req_fail' });
            const event = createMockEvent({ id: 'evt_fail', type: 'payment.created', data: {} });
            await handleWebhookEvent(context, event);

            // Now set up DB mock for the error handler's markEventFailedByProviderId call
            const mockWhere = vi.fn().mockResolvedValue(undefined);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<
                typeof getDb
            >);

            const error = new Error('Processing failed');

            await handleWebhookError(error, context);

            expect(mockUpdate).toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith({
                status: 'failed',
                error: 'Processing failed'
            });
        });

        it('should clean up internal event tracking after error handling', async () => {
            // First, populate the internal requestProviderEventIds
            const mockReturning = vi.fn().mockResolvedValue([{ id: 'webhook_cleanup_123' }]);
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            vi.mocked(getDb).mockReturnValue({ insert: mockInsert } as unknown as ReturnType<
                typeof getDb
            >);

            const context = createMockContext({ requestId: 'req_cleanup' });
            const event = createMockEvent({
                id: 'evt_cleanup',
                type: 'payment.created',
                data: {}
            });
            await handleWebhookEvent(context, event);

            // Set up DB mock for error handler
            const mockWhere = vi.fn().mockResolvedValue(undefined);
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<
                typeof getDb
            >);

            const error = new Error('Processing failed');
            await handleWebhookError(error, context);

            // Calling handleWebhookError again with same requestId should NOT call update
            // because the internal map entry was cleaned up
            const mockUpdate2 = vi.fn();
            vi.mocked(getDb).mockReturnValue({ update: mockUpdate2 } as unknown as ReturnType<
                typeof getDb
            >);

            await handleWebhookError(new Error('Second error'), context);

            expect(mockUpdate2).not.toHaveBeenCalled();
        });

        it('should handle DB update failure gracefully', async () => {
            // First, populate the internal requestProviderEventIds
            const mockReturning = vi.fn().mockResolvedValue([{ id: 'webhook_db_fail' }]);
            const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

            vi.mocked(getDb).mockReturnValue({ insert: mockInsert } as unknown as ReturnType<
                typeof getDb
            >);

            const context = createMockContext({ requestId: 'req_db_fail' });
            const event = createMockEvent({
                id: 'evt_db_fail',
                type: 'payment.created',
                data: {}
            });
            await handleWebhookEvent(context, event);

            // Now set up DB mock to fail on update
            const mockWhere = vi.fn().mockRejectedValue(new Error('DB connection lost'));
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

            vi.mocked(getDb).mockReturnValue({ update: mockUpdate } as unknown as ReturnType<
                typeof getDb
            >);

            const error = new Error('Processing failed');

            await expect(handleWebhookError(error, context)).resolves.toBeUndefined();
        });
    });
});
