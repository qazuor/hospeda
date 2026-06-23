/**
 * Unit tests for the Dunning Cron Job
 *
 * Tests cover:
 * - Job metadata (name, schedule, enabled, timeout)
 * - Billing not configured (skip path)
 * - Dry-run mode (count past-due subscriptions without mutating)
 * - Production mode (processRetries + processCancellations)
 * - Unexpected error handling
 *
 * Mocking strategy: mocks the service layer (qzpay-core lifecycle,
 * billing middleware, billing settings) instead of raw DB access.
 * The only remaining @repo/db mock is for the onEvent audit callback
 * which has inline DB insert (no service abstraction).
 *
 * @module test/cron/dunning.job
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// @sentry/node requires @sentry/opentelemetry at import time, which is not
// available in the test environment. Stub it so transitive imports from
// commerce-reconcile.service.ts (which uses service-core → renewal module)
// don't fail.
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn()
}));

// commerce-reconcile.service imports @repo/service-core which transitively
// imports @sentry/node. We mock the whole module since dunning tests don't
// test commerce reconciliation (that's tested in its own suite).
vi.mock('../../src/services/commerce-reconcile.service', () => ({
    reconcileCommerceListingForSubscription: vi.fn().mockResolvedValue(undefined)
}));

const {
    mockGetQZPayBilling,
    mockCreateSubscriptionLifecycle,
    mockDbInsert,
    mockDbExecute,
    mockLoadBillingSettings,
    mockWithTransaction,
    mockClearEntitlementCache,
    _mockTx
} = vi.hoisted(() => {
    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    // Default: advisory-lock acquire shape. SPEC-262 guard tests override this
    // per-test to return a comp / discounted subscription row.
    const dbExecute = vi.fn().mockResolvedValue({ rows: [{ acquired: true }] });
    const tx = {
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
    };
    const withTx = vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) => callback(tx));
    return {
        mockGetQZPayBilling: vi.fn(),
        mockCreateSubscriptionLifecycle: vi.fn(),
        mockDbInsert: mockInsert,
        mockDbExecute: dbExecute,
        mockLoadBillingSettings: vi.fn().mockResolvedValue({
            gracePeriodDays: 7,
            maxPaymentRetries: 4,
            retryIntervalHours: 24,
            trialExpiryReminderDays: 3,
            sendTrialExpiryReminder: true,
            sendPaymentFailedNotification: true
        }),
        mockWithTransaction: withTx,
        mockClearEntitlementCache: vi.fn(),
        _mockTx: tx
    };
});

// Service layer mock: subscription lifecycle from qzpay-core
vi.mock('@qazuor/qzpay-core', () => ({
    createSubscriptionLifecycle: mockCreateSubscriptionLifecycle
}));

// Service layer mock: billing middleware
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Minimal @repo/db mock: only for the onEvent audit insert callback.
// The dunning job's onEvent handler writes directly to billingDunningAttempts.
// sql is required for pg_try_advisory_xact_lock (concurrency guard added in GAP-035).
// withTransaction is required because the job now wraps all work in a transaction.
vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        insert: mockDbInsert,
        execute: mockDbExecute
    }),
    withTransaction: mockWithTransaction,
    billingDunningAttempts: { _: 'billingDunningAttempts' },
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        __sql: true,
        strings,
        values
    }))
}));

// Service layer mock: billing config constants
vi.mock('@repo/billing', () => ({
    DUNNING_RETRY_INTERVALS: [1, 3, 5, 7],
    DUNNING_GRACE_PERIOD_DAYS: 7
}));

// Service layer mock: billing settings loader
vi.mock('../../src/utils/billing-settings', () => ({
    loadBillingSettings: mockLoadBillingSettings
}));

// Service layer mock: notification sender
vi.mock('../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendSubscriptionCancelledNotification: vi.fn().mockResolvedValue(undefined)
}));

// Entitlement cache mock: needed to assert INV-1 cache clear on cancellation
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { dunningJob } from '../../src/cron/jobs/dunning.job';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeBillingMock(subscriptionListData: unknown[] = []) {
    return {
        getStorage: vi.fn().mockReturnValue({
            paymentMethods: {
                findDefaultByCustomerId: vi.fn().mockResolvedValue(null)
            }
        }),
        subscriptions: {
            list: vi.fn().mockResolvedValue({ data: subscriptionListData })
        },
        payments: {
            process: vi.fn().mockResolvedValue({ id: 'pay_1', status: 'succeeded' })
        }
    };
}

function makeLifecycleMock(
    retriesResult: { processed: number; succeeded: number; failed: number; details: unknown[] } = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        details: []
    },
    cancellationsResult: { processed: number; details: unknown[] } = { processed: 0, details: [] }
) {
    return {
        processRetries: vi.fn().mockResolvedValue(retriesResult),
        processCancellations: vi.fn().mockResolvedValue(cancellationsResult)
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dunningJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Restore the default advisory-lock acquire shape after clearAllMocks
        // (which wipes the per-test SPEC-262 guard overrides).
        mockDbExecute.mockResolvedValue({ rows: [{ acquired: true }] });
    });

    // -----------------------------------------------------------------------
    // Job metadata
    // -----------------------------------------------------------------------

    describe('metadata', () => {
        it('should have correct name', () => {
            expect(dunningJob.name).toBe('dunning');
        });

        it('should run daily at 6:00 AM UTC', () => {
            expect(dunningJob.schedule).toBe('0 6 * * *');
        });

        it('should be enabled by default', () => {
            expect(dunningJob.enabled).toBe(true);
        });

        it('should have 5 minute timeout', () => {
            expect(dunningJob.timeoutMs).toBe(300000);
        });
    });

    // -----------------------------------------------------------------------
    // Billing not configured
    // -----------------------------------------------------------------------

    describe('when billing is not configured', () => {
        it('should return success with skip message', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue(null);
            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.message).toContain('Billing not configured');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(mockCreateSubscriptionLifecycle).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Dry-run mode
    // -----------------------------------------------------------------------

    describe('dry-run mode', () => {
        it('should count past-due subscriptions without processing', async () => {
            // Arrange
            const billing = makeBillingMock([
                { id: 'sub_1', status: 'past_due' },
                { id: 'sub_2', status: 'active' },
                { id: 'sub_3', status: 'past_due' }
            ]);
            mockGetQZPayBilling.mockReturnValue(billing);
            mockCreateSubscriptionLifecycle.mockReturnValue(makeLifecycleMock());

            const ctx = makeCronContext({ dryRun: true });

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(2); // only past_due counted
            expect(result.errors).toBe(0);
            expect(result.message).toContain('Dry run');
            expect(result.message).toContain('2');
            expect(result.details).toMatchObject({
                dryRun: true,
                pastDueCount: 2,
                gracePeriodDays: 7
            });
        });

        it('should handle empty subscription list in dry-run', async () => {
            // Arrange
            const billing = makeBillingMock([]);
            mockGetQZPayBilling.mockReturnValue(billing);
            mockCreateSubscriptionLifecycle.mockReturnValue(makeLifecycleMock());

            const ctx = makeCronContext({ dryRun: true });

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
        });

        it('should handle null data from subscriptions.list()', async () => {
            // Arrange
            const billing = makeBillingMock();
            billing.subscriptions.list.mockResolvedValue({ data: null });
            mockGetQZPayBilling.mockReturnValue(billing);
            mockCreateSubscriptionLifecycle.mockReturnValue(makeLifecycleMock());

            const ctx = makeCronContext({ dryRun: true });

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // Production mode
    // -----------------------------------------------------------------------

    describe('production mode', () => {
        it('should call processRetries and processCancellations', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock(
                { processed: 3, succeeded: 2, failed: 1, details: [] },
                { processed: 1, details: [] }
            );
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(lifecycle.processRetries).toHaveBeenCalledOnce();
            expect(lifecycle.processCancellations).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
            expect(result.processed).toBe(4); // 3 retries + 1 cancellation
            expect(result.errors).toBe(1); // failed retries
        });

        it('should include retry and cancellation details in result', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock(
                { processed: 5, succeeded: 4, failed: 1, details: ['retry-detail'] },
                { processed: 2, details: ['cancel-detail'] }
            );
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.message).toContain('4/5 succeeded');
            expect(result.message).toContain('2 processed');
            expect(result.details).toMatchObject({
                retries: {
                    processed: 5,
                    succeeded: 4,
                    failed: 1,
                    details: ['retry-detail']
                },
                cancellations: {
                    processed: 2,
                    details: ['cancel-detail']
                }
            });
        });

        it('should run retries before cancellations (sequential, not parallel)', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const callOrder: string[] = [];

            const lifecycle = {
                processRetries: vi.fn().mockImplementation(async () => {
                    callOrder.push('retries');
                    return { processed: 1, succeeded: 1, failed: 0, details: [] };
                }),
                processCancellations: vi.fn().mockImplementation(async () => {
                    callOrder.push('cancellations');
                    return { processed: 1, details: [] };
                })
            };
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            await dunningJob.handler(ctx);

            // Assert - retries must run first
            expect(callOrder).toEqual(['retries', 'cancellations']);
        });

        it('should include cancellation failures in totalErrors', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock(
                { processed: 2, succeeded: 1, failed: 1, details: [] },
                { processed: 3, details: [], failed: 2 } as {
                    processed: number;
                    details: unknown[];
                    failed?: number;
                }
            );
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert - totalErrors = retriesResult.failed (1) + cancellationsResult.failed (2)
            expect(result.errors).toBe(3);
        });

        it('should return zero counts when no subscriptions need processing', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
        });

        it('should pass correct config to createSubscriptionLifecycle', async () => {
            // Arrange
            const billing = makeBillingMock();
            const storage = billing.getStorage();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            await dunningJob.handler(ctx);

            // Assert
            expect(mockCreateSubscriptionLifecycle).toHaveBeenCalledOnce();
            const [billingArg, storageArg, configArg] =
                mockCreateSubscriptionLifecycle.mock.calls[0]!;
            expect(billingArg).toBe(billing);
            expect(storageArg).toBe(storage);
            expect(configArg.gracePeriodDays).toBe(7);
            expect(configArg.retryIntervals).toEqual([1, 3, 5, 7]);
            expect(configArg.trialConversionDays).toBe(0);
            expect(typeof configArg.processPayment).toBe('function');
            expect(typeof configArg.getDefaultPaymentMethod).toBe('function');
            expect(typeof configArg.onEvent).toBe('function');
        });

        // SPEC-262 T-007: processPayment must NOT charge a comp / actively
        // multi-cycle-discounted subscription (AC-2.1, risk mitigations §13).
        it('processPayment skips a comp subscription (no MP charge)', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);
            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            await dunningJob.handler(makeCronContext());
            const [, , configArg] = mockCreateSubscriptionLifecycle.mock.calls[0]!;

            // The guard reads billing_subscriptions; return a comp row.
            mockDbExecute.mockResolvedValueOnce({
                rows: [
                    {
                        status: 'comp',
                        promo_code_id: 'pc-1',
                        promo_effect_remaining_cycles: null
                    }
                ]
            });
            const processSpy = billing.payments.process as ReturnType<typeof vi.fn>;
            processSpy.mockClear();

            // Act — invoke the captured processPayment callback directly.
            const result = await configArg.processPayment({
                customerId: 'cust-1',
                amount: 10000,
                currency: 'ARS',
                paymentMethodId: 'pm-1',
                metadata: { subscriptionId: 'sub-comp', type: 'retry' }
            });

            // Assert — short-circuited as success, MP never charged.
            expect(result.success).toBe(true);
            expect(processSpy).not.toHaveBeenCalled();
        });

        it('processPayment skips an actively-discounted subscription (remaining cycles > 0)', async () => {
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);
            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            await dunningJob.handler(makeCronContext());
            const [, , configArg] = mockCreateSubscriptionLifecycle.mock.calls[0]!;

            mockDbExecute.mockResolvedValueOnce({
                rows: [
                    {
                        status: 'active',
                        promo_code_id: 'pc-1',
                        promo_effect_remaining_cycles: 2
                    }
                ]
            });
            const processSpy = billing.payments.process as ReturnType<typeof vi.fn>;
            processSpy.mockClear();

            const result = await configArg.processPayment({
                customerId: 'cust-1',
                amount: 10000,
                currency: 'ARS',
                paymentMethodId: 'pm-1',
                metadata: { subscriptionId: 'sub-disc', type: 'retry' }
            });

            expect(result.success).toBe(true);
            expect(processSpy).not.toHaveBeenCalled();
        });

        it('processPayment skips a forever-discount subscription (S2: remaining_cycles=null, promo_code_id set)', async () => {
            // S2 fix: the previous guard required remaining_cycles !== null && > 0
            // which silently skipped the forever-discount case (remaining=null + promo_code_id set).
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);
            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            await dunningJob.handler(makeCronContext());
            const [, , configArg] = mockCreateSubscriptionLifecycle.mock.calls[0]!;

            // Forever discount: promo_code_id set, remaining = null (not comp).
            mockDbExecute.mockResolvedValueOnce({
                rows: [
                    {
                        status: 'active',
                        promo_code_id: 'pc-forever',
                        promo_effect_remaining_cycles: null
                    }
                ]
            });
            const processSpy = billing.payments.process as ReturnType<typeof vi.fn>;
            processSpy.mockClear();

            const result = await configArg.processPayment({
                customerId: 'cust-1',
                amount: 10000,
                currency: 'ARS',
                paymentMethodId: 'pm-1',
                metadata: { subscriptionId: 'sub-forever', type: 'retry' }
            });

            // Forever-discount sub must be skipped (active-discount), NOT charged.
            expect(result.success).toBe(true);
            expect(processSpy).not.toHaveBeenCalled();
        });

        it('processPayment proceeds normally for a plain past-due subscription', async () => {
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);
            const lifecycle = makeLifecycleMock();
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            await dunningJob.handler(makeCronContext());
            const [, , configArg] = mockCreateSubscriptionLifecycle.mock.calls[0]!;

            // Guard reads a plain active row with no discount → not skipped.
            mockDbExecute.mockResolvedValueOnce({
                rows: [
                    {
                        status: 'past_due',
                        promo_code_id: null,
                        promo_effect_remaining_cycles: null
                    }
                ]
            });
            const processSpy = billing.payments.process as ReturnType<typeof vi.fn>;
            processSpy.mockClear();
            processSpy.mockResolvedValue({ id: 'pay-1', status: 'succeeded' });

            const result = await configArg.processPayment({
                customerId: 'cust-1',
                amount: 10000,
                currency: 'ARS',
                paymentMethodId: 'pm-1',
                metadata: { subscriptionId: 'sub-pastdue', type: 'retry' }
            });

            expect(processSpy).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    describe('error handling', () => {
        it('should return failure result when an unexpected error occurs', async () => {
            // Arrange
            mockGetQZPayBilling.mockImplementation(() => {
                throw new Error('Database connection lost');
            });
            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Database connection lost');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(1);
            expect(result.details).toMatchObject({
                error: 'Database connection lost'
            });
        });

        it('should handle non-Error thrown values', async () => {
            // Arrange
            mockGetQZPayBilling.mockImplementation(() => {
                throw 'string error';
            });
            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('string error');
        });

        it('should handle processRetries failure', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            const lifecycle = {
                processRetries: vi.fn().mockRejectedValue(new Error('Retry service down')),
                processCancellations: vi.fn().mockResolvedValue({ processed: 0, details: [] })
            };
            mockCreateSubscriptionLifecycle.mockReturnValue(lifecycle);

            const ctx = makeCronContext();

            // Act
            const result = await dunningJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Retry service down');
        });
    });

    // -----------------------------------------------------------------------
    // Dunning attempt audit logging (tests onEvent callback)
    // -----------------------------------------------------------------------

    describe('audit logging via onEvent', () => {
        it('should record retry_succeeded event in billing_dunning_attempts', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act
            const event = {
                type: 'subscription.retry_succeeded',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date('2026-03-02T06:00:00Z'),
                data: {
                    attemptNumber: 2,
                    amount: 150000,
                    currency: 'ARS',
                    paymentId: 'pay_789',
                    provider: 'mercadopago'
                }
            };
            await capturedOnEvent!(event);

            // Assert
            expect(mockDbInsert).toHaveBeenCalledOnce();
        });

        it('should record retry_failed event in billing_dunning_attempts', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act
            const event = {
                type: 'subscription.retry_failed',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date('2026-03-02T06:00:00Z'),
                data: {
                    attemptNumber: 3,
                    error: 'Insufficient funds',
                    failureCode: 'card_declined'
                }
            };
            await capturedOnEvent!(event);

            // Assert
            expect(mockDbInsert).toHaveBeenCalledOnce();
        });

        // INV-1: canceled_nonpayment must clear the entitlement cache so the
        // cancelled customer stops seeing paid-plan entitlements immediately.
        it('should clear entitlement cache on canceled_nonpayment event', async () => {
            // Arrange
            const billing = makeBillingMock();
            // Provide a minimal customer stub so the notification path resolves
            const billingWithCustomer = {
                ...billing,
                customers: {
                    get: vi.fn().mockResolvedValue({
                        id: 'cust_456',
                        email: 'user@example.com',
                        metadata: { name: 'Test User', userId: 'user_789' }
                    })
                }
            };
            mockGetQZPayBilling.mockReturnValue(billingWithCustomer);

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act
            await capturedOnEvent!({
                type: 'subscription.canceled_nonpayment',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date(),
                data: { planName: 'owner-basico', reason: 'grace period expired' }
            });

            // Assert — cache must be invalidated with the event's customerId
            expect(mockClearEntitlementCache).toHaveBeenCalledWith('cust_456');
        });

        it('should NOT record non-retry events (e.g. canceled_nonpayment)', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act
            const event = {
                type: 'subscription.canceled_nonpayment',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date(),
                data: { reason: 'grace period expired' }
            };
            await capturedOnEvent!(event);

            // Assert
            expect(mockDbInsert).not.toHaveBeenCalled();
        });

        it('should not throw if DB insert fails (best-effort)', async () => {
            // Arrange
            const billing = makeBillingMock();
            mockGetQZPayBilling.mockReturnValue(billing);

            mockDbInsert.mockReturnValueOnce({
                values: vi.fn().mockRejectedValue(new Error('DB connection lost'))
            });

            let capturedOnEvent: ((event: unknown) => Promise<void>) | undefined;
            mockCreateSubscriptionLifecycle.mockImplementation(
                (
                    _b: unknown,
                    _s: unknown,
                    config: { onEvent?: (event: unknown) => Promise<void> }
                ) => {
                    capturedOnEvent = config.onEvent;
                    return makeLifecycleMock();
                }
            );

            const ctx = makeCronContext();
            await dunningJob.handler(ctx);

            // Act & Assert - should not throw
            const event = {
                type: 'subscription.retry_failed',
                subscriptionId: 'sub_123',
                customerId: 'cust_456',
                timestamp: new Date(),
                data: { attemptNumber: 1, error: 'timeout' }
            };
            await expect(capturedOnEvent!(event)).resolves.toBeUndefined();
        });
    });
});
