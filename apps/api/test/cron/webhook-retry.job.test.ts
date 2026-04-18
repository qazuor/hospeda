/**
 * Unit tests for the Webhook Retry Cron Job
 *
 * Tests cover:
 * - retryWebhookEvent() routing, idempotency checks, and error handling
 * - retryMercadoPagoPaymentUpdated() payment processing and addon confirmation
 * - The cron job handler: batch processing, markAsResolved, and incrementAttempts
 *
 * @module test/cron/webhook-retry.job
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared before any imports that use them)
// ---------------------------------------------------------------------------

// withTransaction mock: calls the callback with the same db object returned by getDb.
// This mirrors the actual behavior where tx is the Drizzle transaction client.
// Must be defined before vi.mock so it is accessible via vi.hoisted pattern.
const { mockGetDb, mockWithTransactionWebhook } = vi.hoisted(() => {
    const getDbFn = vi.fn();
    // withTransaction passes the db returned by getDb as the tx to the callback.
    // This allows tests that configure getDb to also drive the tx queries.
    const withTx = vi.fn(async <T>(callback: (tx: ReturnType<typeof getDbFn>) => Promise<T>) =>
        callback(getDbFn())
    );
    return { mockGetDb: getDbFn, mockWithTransactionWebhook: withTx };
});

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    withTransaction: mockWithTransactionWebhook,
    billingWebhookEvents: { providerEventId: 'providerEventId', status: 'status' },
    billingWebhookDeadLetter: { id: 'id', resolvedAt: 'resolvedAt', attempts: 'attempts' },
    eq: vi.fn((_col: unknown, _val: unknown) => ({ __eq: true })),
    isNull: vi.fn((_col: unknown) => ({ __isNull: true })),
    and: vi.fn((...conditions: unknown[]) => ({ __and: true, conditions })),
    lt: vi.fn((_col: unknown, _val: unknown) => ({ __lt: true })),
    // sql is required for pg_try_advisory_xact_lock (concurrency guard added in GAP-009)
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        __sql: true,
        strings,
        values
    }))
}));

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn(),
    createMercadoPagoAdapter: vi.fn()
}));

vi.mock('@repo/notifications', () => ({
    NotificationType: {
        ADDON_PURCHASE: 'ADDON_PURCHASE',
        PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
        PAYMENT_FAILURE: 'PAYMENT_FAILURE'
    }
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/services/addon.service', () => ({
    AddonService: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendPaymentSuccessNotification: vi.fn(),
    sendPaymentFailureNotifications: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/utils', () => ({
    extractPaymentInfo: vi.fn(),
    extractAddonMetadata: vi.fn(),
    extractAddonFromReference: vi.fn()
}));

vi.mock('../../src/routes/webhooks/mercadopago/subscription-logic', () => ({
    processSubscriptionUpdated: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (vi.mock calls above are hoisted by Vitest, so these are safe)
// ---------------------------------------------------------------------------

import { createMercadoPagoAdapter, getAddonBySlug } from '@repo/billing';
import { getDb } from '@repo/db';
import { webhookRetryJob } from '../../src/cron/jobs/webhook-retry.job';
import type { CronJobContext } from '../../src/cron/types';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    sendPaymentFailureNotifications,
    sendPaymentSuccessNotification
} from '../../src/routes/webhooks/mercadopago/notifications';
import { processSubscriptionUpdated } from '../../src/routes/webhooks/mercadopago/subscription-logic';
import {
    extractAddonFromReference,
    extractAddonMetadata,
    extractPaymentInfo
} from '../../src/routes/webhooks/mercadopago/utils';
import { AddonService } from '../../src/services/addon.service';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal CronJobContext for handler invocations.
 */
function makeCronContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date(),
        dryRun: false,
        ...overrides
    };
}

/**
 * Build a dead-letter event row with sensible defaults.
 */
function makeDeadLetterEvent(
    overrides: Partial<{
        id: string;
        providerEventId: string;
        provider: string;
        type: string;
        payload: unknown;
        attempts: number;
        resolvedAt: Date | null;
    }> = {}
) {
    return {
        id: 'dead-letter-event-1',
        providerEventId: 'mp-event-123',
        provider: 'mercadopago',
        type: 'payment.updated',
        payload: {
            data: {
                transaction_amount: 1500,
                currency_id: 'ARS',
                status: 'approved',
                payment_method_id: 'credit_card',
                metadata: { customerId: 'cust-1', addonSlug: 'extra-photos' }
            }
        },
        attempts: 0,
        resolvedAt: null,
        ...overrides
    };
}

/**
 * Build a billing mock with a customers.get stub.
 */
function makeBillingMock(customerData: unknown = null) {
    return {
        customers: {
            get: vi.fn().mockResolvedValue(customerData)
        }
    };
}

// ---------------------------------------------------------------------------
// Shared setup/teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ===========================================================================
// retryWebhookEvent (tested indirectly via the cron job handler)
// ===========================================================================

describe('webhookRetryJob.handler — retryWebhookEvent routing', () => {
    /**
     * Common arrangement: single dead-letter event in the queue plus a db mock
     * that reflects the event is NOT already processed in billingWebhookEvents.
     * execute() is required for the pg_try_advisory_lock concurrency guard (GAP-009).
     */
    function arrangeDb(
        deadLetterRows: unknown[],
        webhookEventRows: unknown[] = [{ status: 'pending' }]
    ) {
        const updateChain = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(undefined)
        };

        // Shared limit mock so that sequential select() calls share the same
        // mockResolvedValueOnce queue (each select() creates a new chain but
        // the terminal limit fn is the same reference).
        const limitMock = vi
            .fn()
            // First call: unresolved dead-letter events (batch query)
            .mockResolvedValueOnce(deadLetterRows)
            // Second call: idempotency check in billingWebhookEvents
            .mockResolvedValueOnce(webhookEventRows);

        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: limitMock
                    }))
                }))
            })),
            ...updateChain
        };

        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        return { db, updateChain };
    }

    // -------------------------------------------------------------------------
    // Test 1: Happy path — successful payment.updated retry
    // -------------------------------------------------------------------------
    it('should resolve event and call markAsResolved on successful payment.updated retry', async () => {
        // Arrange
        const event = makeDeadLetterEvent();
        const billing = makeBillingMock({
            id: 'cust-1',
            email: 'user@example.com',
            metadata: { name: 'Alice', userId: 'user-1' }
        });
        const { db } = arrangeDb([event]);

        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 1500,
            currency: 'ARS',
            status: 'approved',
            statusDetail: null,
            paymentMethod: 'credit_card'
        });
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'extra-photos',
            customerId: 'cust-1'
        });
        vi.mocked(getAddonBySlug).mockReturnValue({
            slug: 'extra-photos',
            name: 'Extra Photos'
        } as ReturnType<typeof getAddonBySlug>);

        const confirmPurchaseMock = vi.fn().mockResolvedValue({ success: true, data: undefined });
        vi.mocked(AddonService).mockImplementation(
            () =>
                ({
                    confirmPurchase: confirmPurchaseMock
                }) as unknown as InstanceType<typeof AddonService>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        // markAsResolved updates the dead-letter row with resolvedAt
        expect(db.update).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 2: Unknown provider — marked as resolved without re-processing
    // -------------------------------------------------------------------------
    it('should resolve event without processing when provider is not mercadopago', async () => {
        // Arrange
        const event = makeDeadLetterEvent({ provider: 'stripe' });
        const { db } = arrangeDb([event]);

        // No billing needed — routing short-circuits on unknown provider
        vi.mocked(getQZPayBilling).mockReturnValue(null);

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        // Should call markAsResolved (db.update) for the event
        expect(db.update).toHaveBeenCalled();
        // Should NOT touch billing system
        expect(extractPaymentInfo).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 3: Already processed event — idempotency guard returns true early
    // -------------------------------------------------------------------------
    it('should resolve event without re-processing when billingWebhookEvents status is processed', async () => {
        // Arrange
        const event = makeDeadLetterEvent();
        // Idempotency check returns status='processed'
        const { db } = arrangeDb([event], [{ status: 'processed' }]);

        vi.mocked(getQZPayBilling).mockReturnValue(
            makeBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        // No business logic should run (extractPaymentInfo not called)
        expect(extractPaymentInfo).not.toHaveBeenCalled();
        // markAsResolved still updates the dead-letter row
        expect(db.update).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 4: payment.created type — no business logic, resolves immediately
    // -------------------------------------------------------------------------
    it('should resolve payment.created events without running business logic', async () => {
        // Arrange
        const event = makeDeadLetterEvent({ type: 'payment.created' });
        const { db } = arrangeDb([event]);

        vi.mocked(getQZPayBilling).mockReturnValue(
            makeBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(extractPaymentInfo).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 5: subscription_preapproval.updated type — runs processSubscriptionUpdated
    // -------------------------------------------------------------------------
    it('should run processSubscriptionUpdated for subscription_preapproval.updated events', async () => {
        // Arrange
        const event = makeDeadLetterEvent({
            type: 'subscription_preapproval.updated',
            providerEventId: 'mp-sub-event-1',
            payload: {
                data: { id: 'preapproval-123' },
                date_created: '2024-01-01T00:00:00Z'
            }
        });
        const { db } = arrangeDb([event]);

        const billing = makeBillingMock({ id: 'cust-1' });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        // createMercadoPagoAdapter must succeed for retrySubscriptionUpdated to proceed
        const mockAdapter = { subscriptions: { retrieve: vi.fn() } };
        vi.mocked(createMercadoPagoAdapter).mockReturnValue(
            mockAdapter as unknown as ReturnType<typeof createMercadoPagoAdapter>
        );

        // processSubscriptionUpdated returns success
        vi.mocked(processSubscriptionUpdated).mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'active'
        });

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert — business logic ran
        expect(result.success).toBe(true);
        expect(result.errors).toBe(0);
        expect(processSubscriptionUpdated).toHaveBeenCalledOnce();
        expect(processSubscriptionUpdated).toHaveBeenCalledWith(
            expect.objectContaining({
                providerEventId: 'mp-sub-event-1',
                source: 'dead-letter-retry'
            })
        );
        // markAsResolved should be called because processing succeeded
        expect(db.update).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 5a: subscription_preapproval.updated — processSubscriptionUpdated fails
    // -------------------------------------------------------------------------
    it('should increment attempts when processSubscriptionUpdated returns failure', async () => {
        // Arrange
        const event = makeDeadLetterEvent({
            type: 'subscription_preapproval.updated',
            providerEventId: 'mp-sub-event-fail',
            payload: { data: { id: 'preapproval-456' } }
        });
        const { db } = arrangeDb([event]);

        const billing = makeBillingMock({ id: 'cust-2' });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        const mockAdapter = { subscriptions: { retrieve: vi.fn() } };
        vi.mocked(createMercadoPagoAdapter).mockReturnValue(
            mockAdapter as unknown as ReturnType<typeof createMercadoPagoAdapter>
        );

        // processSubscriptionUpdated returns failure
        vi.mocked(processSubscriptionUpdated).mockResolvedValue({
            success: false,
            statusChanged: false,
            error: 'Subscription not found in MercadoPago'
        });

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert — job still completes but records an error
        expect(result.success).toBe(true);
        expect(result.errors).toBe(1);
        expect(processSubscriptionUpdated).toHaveBeenCalledOnce();
        // incrementAttempts path: db.update is called without resolvedAt
        const setCalls = vi.mocked(db.set).mock.calls;
        const firstSetArg = setCalls[0]?.[0] as Record<string, unknown> | undefined;
        expect(firstSetArg).not.toHaveProperty('resolvedAt');
    });

    // -------------------------------------------------------------------------
    // Test 5b: subscription_preapproval.updated — billing not configured
    // -------------------------------------------------------------------------
    it('should mark subscription_preapproval.updated as resolved when billing is not configured', async () => {
        // Arrange: billing returns null (not configured)
        const event = makeDeadLetterEvent({
            type: 'subscription_preapproval.updated',
            providerEventId: 'mp-sub-event-no-billing'
        });
        const { db } = arrangeDb([event]);

        vi.mocked(getQZPayBilling).mockReturnValue(null);

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert — retrySubscriptionUpdated returns true when billing is null,
        // so the event is marked as resolved (not an error)
        expect(result.success).toBe(true);
        expect(result.errors).toBe(0);
        expect(processSubscriptionUpdated).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 6: Unknown MercadoPago event type — resolves with a warning
    // -------------------------------------------------------------------------
    it('should resolve unknown MercadoPago event types without failing', async () => {
        // Arrange
        const event = makeDeadLetterEvent({ type: 'some.unknown_type' });
        const { db } = arrangeDb([event]);

        vi.mocked(getQZPayBilling).mockReturnValue(
            makeBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(extractPaymentInfo).not.toHaveBeenCalled();
        expect(db.update).toHaveBeenCalled();
    });
});

// ===========================================================================
// retryMercadoPagoPaymentUpdated (indirectly via handler)
// ===========================================================================

describe('webhookRetryJob.handler — retryMercadoPagoPaymentUpdated', () => {
    function arrangeDb(deadLetterRows: unknown[]) {
        const updateChain = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(undefined)
        };
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi
                            .fn()
                            .mockResolvedValueOnce(deadLetterRows)
                            .mockResolvedValueOnce([{ status: 'pending' }])
                    }))
                }))
            })),
            ...updateChain
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        return { db, updateChain };
    }

    // -------------------------------------------------------------------------
    // Test 7: Billing not configured — returns true (not a processing error)
    // -------------------------------------------------------------------------
    it('should resolve event when billing is not configured', async () => {
        // Arrange
        const event = makeDeadLetterEvent();
        const { db } = arrangeDb([event]);

        vi.mocked(getQZPayBilling).mockReturnValue(null);

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert — billing not configured is not treated as a failure
        expect(result.success).toBe(true);
        expect(result.errors).toBe(0);
        // markAsResolved should still be called because retryMercadoPagoPaymentUpdated returns true
        expect(db.update).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 8: AddonService.confirmPurchase fails — returns false, increments attempts
    // -------------------------------------------------------------------------
    it('should increment attempts when AddonService.confirmPurchase returns failure', async () => {
        // Arrange
        const event = makeDeadLetterEvent({ attempts: 0 });
        const { db } = arrangeDb([event]);

        const billing = makeBillingMock({
            id: 'cust-1',
            email: 'user@example.com',
            metadata: {}
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'extra-photos',
            customerId: 'cust-1'
        });

        const confirmPurchaseMock = vi.fn().mockResolvedValue({
            success: false,
            error: { code: 'DB_ERROR', message: 'insert failed' }
        });
        vi.mocked(AddonService).mockImplementation(
            () =>
                ({
                    confirmPurchase: confirmPurchaseMock
                }) as unknown as InstanceType<typeof AddonService>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true); // job itself succeeds even when one event fails
        expect(result.errors).toBe(1);
        // incrementAttempts should call db.update
        expect(db.update).toHaveBeenCalled();
        // markAsResolved should NOT be called with resolvedAt when retry fails
        const setCalls = vi.mocked(db.set).mock.calls;
        // The only set call should NOT include resolvedAt (it is the incrementAttempts call)
        const firstSetArg = setCalls[0]?.[0] as Record<string, unknown> | undefined;
        expect(firstSetArg).not.toHaveProperty('resolvedAt');
    });

    // -------------------------------------------------------------------------
    // Test 9: retryWebhookEvent throws internally — handler catches and returns false
    // -------------------------------------------------------------------------
    it('should count as error and increment attempts when retryWebhookEvent throws', async () => {
        // Arrange
        const event = makeDeadLetterEvent();
        const updateChain = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(undefined)
        };
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi
                .fn()
                .mockReturnValueOnce({
                    // First call returns batch events
                    from: vi.fn(() => ({
                        where: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue([event])
                        }))
                    }))
                })
                .mockReturnValueOnce({
                    // Second call (idempotency check) throws to trigger the outer catch
                    from: vi.fn(() => ({
                        where: vi.fn(() => ({
                            limit: vi.fn().mockRejectedValue(new Error('DB connection lost'))
                        }))
                    }))
                }),
            ...updateChain
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
        vi.mocked(getQZPayBilling).mockReturnValue(
            makeBillingMock() as unknown as ReturnType<typeof getQZPayBilling>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true); // job completes; individual event errored
        expect(result.errors).toBe(1);
        // incrementAttempts should still be called (inner catch block)
        expect(db.update).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Test 10: Approved payment dispatches success notification
    // -------------------------------------------------------------------------
    it('should call sendPaymentSuccessNotification for approved payments', async () => {
        // Arrange
        const event = makeDeadLetterEvent({
            payload: {
                data: {
                    transaction_amount: 2000,
                    currency_id: 'ARS',
                    status: 'approved',
                    payment_method_id: 'debit_card',
                    metadata: { customerId: 'cust-2' }
                }
            }
        });

        const updateChain = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(undefined)
        };
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi
                            .fn()
                            .mockResolvedValueOnce([event])
                            .mockResolvedValueOnce([{ status: 'pending' }])
                    }))
                }))
            })),
            ...updateChain
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const billing = makeBillingMock(null);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 2000,
            currency: 'ARS',
            status: 'approved',
            statusDetail: null,
            paymentMethod: 'debit_card'
        });
        vi.mocked(extractAddonMetadata).mockReturnValue(null);
        vi.mocked(extractAddonFromReference).mockReturnValue(null);

        const ctx = makeCronContext();

        // Act
        await webhookRetryJob.handler(ctx);

        // Assert
        expect(sendPaymentSuccessNotification).toHaveBeenCalledWith(
            'cust-2',
            2000,
            'ARS',
            'debit_card',
            billing
        );
    });

    // -------------------------------------------------------------------------
    // Test 11: Rejected payment dispatches failure notification
    // -------------------------------------------------------------------------
    it('should call sendPaymentFailureNotifications for rejected payments', async () => {
        // Arrange
        const event = makeDeadLetterEvent({
            payload: {
                data: {
                    transaction_amount: 500,
                    currency_id: 'ARS',
                    status: 'rejected',
                    status_detail: 'cc_rejected_insufficient_amount',
                    payment_method_id: 'credit_card',
                    metadata: { customerId: 'cust-3' }
                }
            }
        });

        const updateChain = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(undefined)
        };
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi
                            .fn()
                            .mockResolvedValueOnce([event])
                            .mockResolvedValueOnce([{ status: 'pending' }])
                    }))
                }))
            })),
            ...updateChain
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const billing = makeBillingMock(null);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        vi.mocked(extractPaymentInfo).mockReturnValue({
            amount: 500,
            currency: 'ARS',
            status: 'rejected',
            statusDetail: 'cc_rejected_insufficient_amount',
            paymentMethod: 'credit_card'
        });
        vi.mocked(extractAddonMetadata).mockReturnValue(null);
        vi.mocked(extractAddonFromReference).mockReturnValue(null);

        const ctx = makeCronContext();

        // Act
        await webhookRetryJob.handler(ctx);

        // Assert
        expect(sendPaymentFailureNotifications).toHaveBeenCalledWith(
            'cust-3',
            500,
            'ARS',
            'cc_rejected_insufficient_amount',
            billing
        );
    });
});

// ===========================================================================
// Cron job handler — batch processing and edge cases
// ===========================================================================

describe('webhookRetryJob.handler — batch processing', () => {
    // -------------------------------------------------------------------------
    // Test 12: Empty queue returns early with no-events message
    // -------------------------------------------------------------------------
    it('should return success with no-events message when dead letter queue is empty', async () => {
        // Arrange
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue([])
                    }))
                }))
            }))
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(result.message).toContain('No unresolved');
    });

    // -------------------------------------------------------------------------
    // Test 13: Dry-run mode reports events without processing them
    // -------------------------------------------------------------------------
    it('should report events without processing them in dry-run mode', async () => {
        // Arrange
        const events = [makeDeadLetterEvent({ id: 'evt-1' }), makeDeadLetterEvent({ id: 'evt-2' })];
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue(events)
                    }))
                }))
            }))
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const ctx = makeCronContext({ dryRun: true });

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(result.errors).toBe(0);
        expect(result.details?.dryRun).toBe(true);
        // No actual DB mutations should happen in dry-run
        expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1); // only the batch query
    });

    // -------------------------------------------------------------------------
    // Test 14: Event at MAX_RETRY_ATTEMPTS is permanently failed
    // -------------------------------------------------------------------------
    it('should mark event as permanently failed when attempt count reaches max (5)', async () => {
        // Arrange
        const event = makeDeadLetterEvent({ attempts: 4 }); // next attempt will be 5 = MAX
        const updateChain = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(undefined)
        };
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi
                            .fn()
                            .mockResolvedValueOnce([event])
                            .mockResolvedValueOnce([{ status: 'pending' }])
                    }))
                }))
            })),
            ...updateChain
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const billing = makeBillingMock({
            id: 'cust-1',
            email: 'user@example.com',
            metadata: {}
        });
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        // Make the addon confirmation fail so retryWebhookEvent returns false
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'test-addon',
            customerId: 'cust-1'
        });
        const confirmPurchaseMock = vi.fn().mockResolvedValue({
            success: false,
            error: { code: 'FAIL', message: 'error' }
        });
        vi.mocked(AddonService).mockImplementation(
            () =>
                ({
                    confirmPurchase: confirmPurchaseMock
                }) as unknown as InstanceType<typeof AddonService>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.errors).toBe(1);
        // details.permanentlyFailed should be 1
        expect(result.details?.permanentlyFailed).toBe(1);

        // incrementAttempts for a permanently-failed event includes resolvedAt + error message
        const setCalls = vi.mocked(db.set).mock.calls;
        const permanentFailSet = setCalls.find(
            (callArgs) =>
                typeof (callArgs[0] as Record<string, unknown>)?.error === 'string' &&
                ((callArgs[0] as Record<string, unknown>)?.error as string).includes(
                    'Permanently failed'
                )
        );
        expect(permanentFailSet).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Test 15: Multiple events in batch — successful + failed processed correctly
    // -------------------------------------------------------------------------
    it('should process multiple events and track resolved vs failed counts', async () => {
        // Arrange
        const successEvent = makeDeadLetterEvent({
            id: 'evt-success',
            providerEventId: 'mp-ok',
            type: 'payment.created' // no business logic = resolves immediately
        });
        const failEvent = makeDeadLetterEvent({
            id: 'evt-fail',
            providerEventId: 'mp-fail',
            type: 'payment.updated'
        });

        let selectCallCount = 0;
        const updateChain = {
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(undefined)
        };

        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    // Batch query
                    return {
                        from: vi.fn(() => ({
                            where: vi.fn(() => ({
                                limit: vi.fn().mockResolvedValue([successEvent, failEvent])
                            }))
                        }))
                    };
                }
                // Idempotency check calls (one per event for mercadopago events)
                return {
                    from: vi.fn(() => ({
                        where: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue([{ status: 'pending' }])
                        }))
                    }))
                };
            }),
            ...updateChain
        };

        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const billing = makeBillingMock(null);
        vi.mocked(getQZPayBilling).mockReturnValue(
            billing as unknown as ReturnType<typeof getQZPayBilling>
        );

        // failEvent: payment.updated with addon that fails
        vi.mocked(extractPaymentInfo).mockReturnValue(null);
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'test-addon',
            customerId: 'cust-x'
        });
        vi.mocked(AddonService).mockImplementation(
            () =>
                ({
                    confirmPurchase: vi.fn().mockResolvedValue({
                        success: false,
                        error: { code: 'ERR', message: 'failed' }
                    })
                }) as unknown as InstanceType<typeof AddonService>
        );

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(result.errors).toBe(1);
        expect(result.details?.resolved).toBe(1);
    });

    // -------------------------------------------------------------------------
    // Test 16: Top-level DB error causes job to return success=false
    // -------------------------------------------------------------------------
    it('should return success=false when the batch query itself throws', async () => {
        // Arrange
        const db = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({
                        limit: vi.fn().mockRejectedValue(new Error('Connection timeout'))
                    }))
                }))
            }))
        };
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const ctx = makeCronContext();

        // Act
        const result = await webhookRetryJob.handler(ctx);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain('Failed to retry webhook events');
        expect(result.errors).toBeGreaterThan(0);
    });
});

// ===========================================================================
// Job definition metadata
// ===========================================================================

describe('webhookRetryJob definition', () => {
    it('should export a named CronJobDefinition with correct metadata', () => {
        expect(webhookRetryJob.name).toBe('webhook-retry');
        expect(webhookRetryJob.enabled).toBe(true);
        expect(typeof webhookRetryJob.handler).toBe('function');
        expect(webhookRetryJob.schedule).toBeDefined();
        expect(webhookRetryJob.timeoutMs).toBeGreaterThan(0);
    });
});
