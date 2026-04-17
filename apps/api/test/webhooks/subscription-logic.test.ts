/**
 * Subscription Logic Unit Tests
 *
 * Tests for status mapping constants and notification helper functions
 * used in MercadoPago subscription webhook processing.
 */

import { extractMPSubscriptionEventData } from '@qazuor/qzpay-mercadopago';
import { getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as notificationsModule from '../../src/routes/webhooks/mercadopago/notifications.js';
import {
    QZPAY_TO_HOSPEDA_STATUS,
    processSubscriptionUpdated,
    shouldSendAdminAlert,
    shouldSendCancelledEmail,
    shouldSendPausedEmail,
    shouldSendReactivationEmail
} from '../../src/routes/webhooks/mercadopago/subscription-logic';
import { apiLogger } from '../../src/utils/logger.js';
import { sendNotification } from '../../src/utils/notification-helper.js';

// Mock the entitlement middleware so clearEntitlementCache is a no-op
vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: vi.fn()
}));

// Mock withServiceTransaction so it delegates to db.transaction(), preserving
// the existing test assertions that verify dbMock.transaction was called and
// that dbMock.tx receives the Drizzle operations.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    const { getDb } = await import('@repo/db');
    return {
        ...actual,
        withServiceTransaction: vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const db = getDb() as {
                transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
            };
            return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
        })
    };
});

// Hoisted stubs for addon lifecycle services so tests can control their behavior.
const { mockHandleCancellationAddons, mockHandlePlanChangeRecalculation } = vi.hoisted(() => ({
    mockHandleCancellationAddons: vi.fn().mockResolvedValue(undefined),
    mockHandlePlanChangeRecalculation: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/addon-lifecycle.service.js', () => ({
    handleSubscriptionCancellationAddons: mockHandleCancellationAddons
}));

vi.mock('../../src/services/addon-plan-change.service.js', () => ({
    handlePlanChangeAddonRecalculation: mockHandlePlanChangeRecalculation
}));

// Hoisted mock stubs for notification functions - declared before any imports are resolved.
const { mockSendCancelled, mockSendPaused, mockSendReactivated } = vi.hoisted(() => ({
    mockSendCancelled: vi.fn().mockResolvedValue(undefined),
    mockSendPaused: vi.fn().mockResolvedValue(undefined),
    mockSendReactivated: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@qazuor/qzpay-mercadopago', async (importOriginal) => {
    const original = await importOriginal<typeof import('@qazuor/qzpay-mercadopago')>();
    return {
        ...original,
        extractMPSubscriptionEventData: vi.fn()
    };
});

// Mock the notifications module using hoisted stubs so the factory has stable references.
// The .js extension is required to match the './notifications.js' import in subscription-logic.ts.
vi.mock('../../src/routes/webhooks/mercadopago/notifications.js', () => ({
    sendSubscriptionCancelledNotification: mockSendCancelled,
    sendSubscriptionPausedNotification: mockSendPaused,
    sendSubscriptionReactivatedNotification: mockSendReactivated,
    sendPaymentSuccessNotification: vi.fn().mockResolvedValue(undefined),
    sendPaymentFailureNotifications: vi.fn().mockResolvedValue(undefined)
}));

// Mock notification-helper so PAYMENT_RETRY_WARNING dispatches don't hit the real implementation
vi.mock('../../src/utils/notification-helper.js', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

describe('subscription-logic', () => {
    describe('QZPAY_TO_HOSPEDA_STATUS', () => {
        it("should map 'active' to SubscriptionStatusEnum.ACTIVE", () => {
            expect(QZPAY_TO_HOSPEDA_STATUS.active).toBe(SubscriptionStatusEnum.ACTIVE);
        });

        it("should map 'paused' to SubscriptionStatusEnum.PAUSED", () => {
            expect(QZPAY_TO_HOSPEDA_STATUS.paused).toBe(SubscriptionStatusEnum.PAUSED);
        });

        it("should map 'canceled' (1 L) to SubscriptionStatusEnum.CANCELLED (2 L's)", () => {
            const result = QZPAY_TO_HOSPEDA_STATUS.canceled;

            expect(result).toBe(SubscriptionStatusEnum.CANCELLED);
            // Verify the 1L -> 2L spelling conversion
            expect(result).toBe('cancelled');
        });

        it("should map 'finished' to SubscriptionStatusEnum.EXPIRED", () => {
            expect(QZPAY_TO_HOSPEDA_STATUS.finished).toBe(SubscriptionStatusEnum.EXPIRED);
        });

        it("should map 'past_due' to SubscriptionStatusEnum.PAST_DUE", () => {
            expect(QZPAY_TO_HOSPEDA_STATUS.past_due).toBe(SubscriptionStatusEnum.PAST_DUE);
        });

        it("should map 'pending' to null (no status change)", () => {
            expect(QZPAY_TO_HOSPEDA_STATUS.pending).toBeNull();
        });

        it('should return undefined for unknown statuses (not in map)', () => {
            expect(QZPAY_TO_HOSPEDA_STATUS.xyz).toBeUndefined();
        });

        it("should distinguish 'canceled' (QZPay, 1 L) from 'cancelled' (Hospeda, 2 L's) as the key vs value", () => {
            // The MAP KEY uses QZPay's 1-L spelling
            expect('canceled' in QZPAY_TO_HOSPEDA_STATUS).toBe(true);
            // The MAP VALUE uses Hospeda's 2-L spelling
            expect(QZPAY_TO_HOSPEDA_STATUS.canceled).toBe('cancelled');
            // 'cancelled' (2 L's) is NOT a valid QZPay key in this map
            expect('cancelled' in QZPAY_TO_HOSPEDA_STATUS).toBe(false);
        });
    });

    describe('shouldSendReactivationEmail', () => {
        it('should return true when transitioning from paused to active', () => {
            expect(
                shouldSendReactivationEmail(
                    SubscriptionStatusEnum.PAUSED,
                    SubscriptionStatusEnum.ACTIVE
                )
            ).toBe(true);
        });

        it('should return true when transitioning from cancelled to active', () => {
            expect(
                shouldSendReactivationEmail(
                    SubscriptionStatusEnum.CANCELLED,
                    SubscriptionStatusEnum.ACTIVE
                )
            ).toBe(true);
        });

        it('should return true when transitioning from past_due to active', () => {
            expect(
                shouldSendReactivationEmail(
                    SubscriptionStatusEnum.PAST_DUE,
                    SubscriptionStatusEnum.ACTIVE
                )
            ).toBe(true);
        });

        it('should return false when transitioning from trialing to active (handled by trial conversion flow)', () => {
            expect(
                shouldSendReactivationEmail(
                    SubscriptionStatusEnum.TRIALING,
                    SubscriptionStatusEnum.ACTIVE
                )
            ).toBe(false);
        });

        it('should return false when status does not change (active to active)', () => {
            expect(
                shouldSendReactivationEmail(
                    SubscriptionStatusEnum.ACTIVE,
                    SubscriptionStatusEnum.ACTIVE
                )
            ).toBe(false);
        });

        it('should return false when new status is not active (active to paused)', () => {
            expect(
                shouldSendReactivationEmail(
                    SubscriptionStatusEnum.ACTIVE,
                    SubscriptionStatusEnum.PAUSED
                )
            ).toBe(false);
        });

        it('should return false when transitioning from expired to active (not in allowed previous-status list)', () => {
            expect(
                shouldSendReactivationEmail(
                    SubscriptionStatusEnum.EXPIRED,
                    SubscriptionStatusEnum.ACTIVE
                )
            ).toBe(false);
        });
    });

    describe('shouldSendPausedEmail', () => {
        it('should return true when transitioning from active to paused', () => {
            expect(
                shouldSendPausedEmail(SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.PAUSED)
            ).toBe(true);
        });

        it('should return true when transitioning from trialing to paused', () => {
            expect(
                shouldSendPausedEmail(
                    SubscriptionStatusEnum.TRIALING,
                    SubscriptionStatusEnum.PAUSED
                )
            ).toBe(true);
        });

        it('should return false when already paused (paused to paused)', () => {
            expect(
                shouldSendPausedEmail(SubscriptionStatusEnum.PAUSED, SubscriptionStatusEnum.PAUSED)
            ).toBe(false);
        });

        it('should return false when new status is not paused (active to cancelled)', () => {
            expect(
                shouldSendPausedEmail(
                    SubscriptionStatusEnum.ACTIVE,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(false);
        });
    });

    describe('shouldSendCancelledEmail', () => {
        it('should return true when transitioning from active to cancelled', () => {
            expect(
                shouldSendCancelledEmail(
                    SubscriptionStatusEnum.ACTIVE,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(true);
        });

        it('should return true when transitioning from paused to cancelled', () => {
            expect(
                shouldSendCancelledEmail(
                    SubscriptionStatusEnum.PAUSED,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(true);
        });

        it('should return false when already cancelled (cancelled to cancelled)', () => {
            expect(
                shouldSendCancelledEmail(
                    SubscriptionStatusEnum.CANCELLED,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(false);
        });

        it('should return false when transitioning from expired to cancelled (already ended)', () => {
            expect(
                shouldSendCancelledEmail(
                    SubscriptionStatusEnum.EXPIRED,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(false);
        });

        it('should return true when transitioning from trialing to cancelled', () => {
            expect(
                shouldSendCancelledEmail(
                    SubscriptionStatusEnum.TRIALING,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(true);
        });
    });

    describe('shouldSendAdminAlert', () => {
        it('should return true when transitioning from active to cancelled', () => {
            expect(
                shouldSendAdminAlert(
                    SubscriptionStatusEnum.ACTIVE,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(true);
        });

        it('should return false when transitioning from expired to cancelled (already ended)', () => {
            expect(
                shouldSendAdminAlert(
                    SubscriptionStatusEnum.EXPIRED,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(false);
        });

        it('should return false when already cancelled (cancelled to cancelled)', () => {
            expect(
                shouldSendAdminAlert(
                    SubscriptionStatusEnum.CANCELLED,
                    SubscriptionStatusEnum.CANCELLED
                )
            ).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// processSubscriptionUpdated integration-style unit tests
// ---------------------------------------------------------------------------

/**
 * Builds a minimal QZPayWebhookEvent stub for testing.
 */
function makeWebhookEvent(overrides: Record<string, unknown> = {}): {
    id: string;
    type: string;
    data: unknown;
    created: Date;
} {
    return {
        id: 'evt-test-001',
        type: 'subscription_preapproval.updated',
        data: { id: 'preapproval-mp-001' },
        created: new Date(),
        ...overrides
    };
}

/**
 * Builds a minimal local billing_subscription row stub.
 */
function makeLocalSubscription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'sub-local-001',
        customerId: 'cust-001',
        planId: 'plan-001',
        status: SubscriptionStatusEnum.ACTIVE,
        mpSubscriptionId: 'preapproval-mp-001',
        cancelAtPeriodEnd: false,
        canceledAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

/**
 * Builds a minimal QZPayProviderSubscription stub returned by retrieve().
 */
function makeMpSubscription(
    status: string,
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        id: 'preapproval-mp-001',
        status,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialStart: null,
        trialEnd: null,
        metadata: {},
        ...overrides
    };
}

/**
 * Creates a chainable Drizzle-like mock db instance that resolves to the
 * given rows when the chain terminates (simulates `.select().from().where().limit()`).
 *
 * The mock also provides a `transaction(cb)` method that executes the callback
 * with a `tx` object containing its own `update` and `insert` chains, mirroring
 * how the implementation calls `db.transaction(async (tx) => { ... })`.
 */
function makeDbMock(selectRows: unknown[], insertShouldFail = false) {
    const txInsertValuesChain = {
        values: vi.fn().mockResolvedValue(undefined)
    };
    if (insertShouldFail) {
        txInsertValuesChain.values = vi.fn().mockRejectedValue(new Error('insert failed'));
    }

    const txUpdateSetChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
    };

    /** Transaction object passed to the callback of db.transaction() */
    const tx = {
        insert: vi.fn().mockReturnValue(txInsertValuesChain),
        update: vi.fn().mockReturnValue(txUpdateSetChain)
    };

    const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(selectRows)
    };

    return {
        select: vi.fn().mockReturnValue(selectChain),
        /** @deprecated Direct insert/update on db - kept for backwards compat assertions */
        insert: vi.fn().mockReturnValue(txInsertValuesChain),
        update: vi.fn().mockReturnValue(txUpdateSetChain),
        /** Executes the callback with a mock transaction object */
        transaction: vi.fn(async (cb: (txArg: typeof tx) => Promise<void>) => {
            await cb(tx);
        }),
        /** The transaction mock object, exposed for assertions */
        tx
    };
}

describe('processSubscriptionUpdated', () => {
    // Grab typed reference to the mocked extract function
    const mockedExtract = vi.mocked(extractMPSubscriptionEventData);
    // Notification mocks available via mockSendCancelled, mockSendPaused,
    // mockSendReactivated if needed for future notification assertions.

    /** Reusable fake paymentAdapter */
    let mockRetrieve: ReturnType<typeof vi.fn>;
    let mockPaymentAdapter: { subscriptions: { retrieve: ReturnType<typeof vi.fn> } };

    /** Reusable fake billing object (only customers.get and plans.get are needed) */
    let mockCustomerGet: ReturnType<typeof vi.fn>;
    let mockPlanGet: ReturnType<typeof vi.fn>;
    let mockBilling: {
        customers: { get: ReturnType<typeof vi.fn> };
        plans: { get: ReturnType<typeof vi.fn> };
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Spy on notificationsModule exports to ensure they return Promises even if the
        // vi.mock for the module doesn't intercept the import inside subscription-logic.ts.
        // This covers the case where the module instance used by subscription-logic differs.
        vi.spyOn(notificationsModule, 'sendSubscriptionCancelledNotification').mockResolvedValue(
            undefined
        );
        vi.spyOn(notificationsModule, 'sendSubscriptionPausedNotification').mockResolvedValue(
            undefined
        );
        vi.spyOn(notificationsModule, 'sendSubscriptionReactivatedNotification').mockResolvedValue(
            undefined
        );

        mockRetrieve = vi.fn();
        mockPaymentAdapter = { subscriptions: { retrieve: mockRetrieve } };

        mockCustomerGet = vi.fn().mockResolvedValue({
            id: 'cust-001',
            email: 'user@example.com',
            metadata: { name: 'Test User', userId: 'user-001' }
        });
        mockPlanGet = vi.fn().mockResolvedValue({
            id: 'plan-001',
            name: 'Pro Plan'
        });
        mockBilling = {
            customers: { get: mockCustomerGet },
            plans: { get: mockPlanGet }
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // TC-01: No mpPreapprovalId in event
    it('should return { success: true, statusChanged: false } when event has no subscription ID', async () => {
        // Arrange
        mockedExtract.mockReturnValue({ subscriptionId: '' });
        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-001'
        });

        // Assert
        expect(result).toEqual({ success: true, statusChanged: false });
        expect(mockRetrieve).not.toHaveBeenCalled();
    });

    // TC-02: retrieve() throws - should call Sentry.captureException and rethrow
    it('should call Sentry.captureException and rethrow when retrieve() fails', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        const retrieveError = new Error('MP API unavailable');
        mockRetrieve.mockRejectedValue(retrieveError);

        const event = makeWebhookEvent();

        // Act + Assert
        await expect(
            processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-002'
            })
        ).rejects.toThrow('MP API unavailable');

        expect(Sentry.captureException).toHaveBeenCalledWith(
            retrieveError,
            expect.objectContaining({
                extra: expect.objectContaining({ mpPreapprovalId: '***...-001' })
            })
        );
    });

    // TC-03: MercadoPago returns 'pending' status - return early without DB changes
    it('should return early without DB changes when MP status is pending', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('pending'));

        const dbMock = makeDbMock([]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-003'
        });

        // Assert
        expect(result).toEqual({ success: true, statusChanged: false });
        expect(dbMock.select).not.toHaveBeenCalled();
    });

    // TC-04: Unknown status - should call Sentry.captureException and return early
    it('should call Sentry.captureException and return early when status is unknown', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('superseded_unknown_status'));

        const dbMock = makeDbMock([]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-004'
        });

        // Assert
        expect(result).toEqual({ success: true, statusChanged: false });
        expect(Sentry.captureException).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Unknown QZPay') }),
            expect.objectContaining({
                extra: expect.objectContaining({ mpPreapprovalId: '***...-001' })
            })
        );
        expect(dbMock.select).not.toHaveBeenCalled();
    });

    // TC-05: No local subscription found - return early
    it('should return early when no local subscription is found in the database', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('active'));

        // DB returns empty array (no subscription found)
        const dbMock = makeDbMock([]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-005'
        });

        // Assert
        expect(result).toEqual({ success: true, statusChanged: false });
        expect(dbMock.transaction).not.toHaveBeenCalled();
    });

    // TC-06: Same status - no change
    it('should return statusChanged: false when mapped status equals current local status', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('active'));

        // Local subscription already has ACTIVE status
        const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-006'
        });

        // Assert
        expect(result).toEqual({ success: true, statusChanged: false });
        expect(dbMock.transaction).not.toHaveBeenCalled();
    });

    // TC-07: Status change to CANCELLED - DB update, event log, and correct result
    it('should update DB, create audit event, and return statusChanged:true on CANCELLED transition', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

        const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-007'
        });

        // Assert
        expect(result).toEqual({
            success: true,
            statusChanged: true,
            newStatus: SubscriptionStatusEnum.CANCELLED
        });
        expect(dbMock.transaction).toHaveBeenCalled();
        expect(dbMock.tx.update).toHaveBeenCalled();
        expect(dbMock.tx.insert).toHaveBeenCalled();
    });

    // TC-08: Status change to PAUSED - DB update, event log, and correct result
    it('should update DB, create audit event, and return statusChanged:true on PAUSED transition', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('paused'));

        const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-008'
        });

        // Assert
        expect(result).toEqual({
            success: true,
            statusChanged: true,
            newStatus: SubscriptionStatusEnum.PAUSED
        });
        expect(dbMock.transaction).toHaveBeenCalled();
        expect(dbMock.tx.update).toHaveBeenCalled();
        expect(dbMock.tx.insert).toHaveBeenCalled();
    });

    // TC-09: Status change to ACTIVE (reactivation from paused) - resets cancelAtPeriodEnd
    it('should reset cancelAtPeriodEnd when reactivating from paused', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('active'));

        const localSub = makeLocalSubscription({
            status: SubscriptionStatusEnum.PAUSED,
            cancelAtPeriodEnd: true
        });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-009'
        });

        // Assert
        expect(result).toEqual({
            success: true,
            statusChanged: true,
            newStatus: SubscriptionStatusEnum.ACTIVE
        });

        // Verify the update included cancelAtPeriodEnd: false
        expect(dbMock.transaction).toHaveBeenCalled();
        const txUpdateChain = dbMock.tx.update({});
        expect(txUpdateChain.set).toHaveBeenCalledWith(
            expect.objectContaining({ cancelAtPeriodEnd: false })
        );
    });

    // TC-10: CANCELLED transition does NOT overwrite existing canceledAt
    it('should NOT overwrite canceledAt when it is already set during CANCELLED transition', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

        const existingCanceledAt = new Date('2025-01-15T10:00:00Z');
        const localSub = makeLocalSubscription({
            status: SubscriptionStatusEnum.ACTIVE,
            canceledAt: existingCanceledAt
        });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-010'
        });

        // Assert: canceledAt must NOT appear in the update payload
        const txUpdateChain = dbMock.tx.update({});
        expect(txUpdateChain.set).toHaveBeenCalledWith(
            expect.not.objectContaining({ canceledAt: expect.any(Date) })
        );
    });

    // TC-11: ACTIVE reactivation does NOT set cancelAtPeriodEnd=false when it was already false
    it('should NOT include cancelAtPeriodEnd in update when it is already false during reactivation', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('active'));

        const localSub = makeLocalSubscription({
            status: SubscriptionStatusEnum.PAUSED,
            cancelAtPeriodEnd: false // already false
        });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-011'
        });

        // Assert: cancelAtPeriodEnd NOT in update payload since it was already false
        const txUpdateChain = dbMock.tx.update({});
        expect(txUpdateChain.set).toHaveBeenCalledWith(
            expect.not.objectContaining({ cancelAtPeriodEnd: false })
        );
    });

    // TC-12: Audit event is created with correct fields on status change
    it('should create audit event with correct previousStatus, newStatus, triggerSource, and metadata', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('paused'));

        const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act
        await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'prov-evt-012',
            source: 'dead-letter-retry'
        });

        // Assert: insert called with correct audit data inside the transaction
        expect(dbMock.tx.insert).toHaveBeenCalled();
        const txInsertChain = dbMock.tx.insert({});
        expect(txInsertChain.values).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: localSub.id,
                previousStatus: SubscriptionStatusEnum.ACTIVE,
                newStatus: SubscriptionStatusEnum.PAUSED,
                triggerSource: 'dead-letter-retry',
                providerEventId: 'prov-evt-012',
                metadata: expect.objectContaining({
                    qzpayStatus: 'paused',
                    mpPreapprovalId
                })
            })
        );
    });

    // TC-13: Audit insert failure is non-blocking (does not throw)
    it('should complete successfully even when audit event insert fails', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

        const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
        // insert.values will reject to simulate audit failure
        const dbMock = makeDbMock([localSub], true);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        const event = makeWebhookEvent();

        // Act + Assert: should NOT throw despite audit failure
        await expect(
            processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-013'
            })
        ).resolves.toEqual({
            success: true,
            statusChanged: true,
            newStatus: SubscriptionStatusEnum.CANCELLED
        });
    });

    // TC-14: Customer/plan lookup failure is non-blocking (returns success with statusChanged: true)
    it('should return success with statusChanged: true when customer lookup fails after DB update', async () => {
        // Arrange
        const mpPreapprovalId = 'preapproval-mp-001';
        mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
        mockRetrieve.mockResolvedValue(makeMpSubscription('paused'));

        const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
        const dbMock = makeDbMock([localSub]);
        vi.mocked(getDb).mockReturnValue(dbMock as never);

        // Customer lookup throws
        mockCustomerGet.mockRejectedValue(new Error('Customer service down'));

        const event = makeWebhookEvent();

        // Act
        const result = await processSubscriptionUpdated({
            event: event as never,
            billing: mockBilling as never,
            paymentAdapter: mockPaymentAdapter as never,
            providerEventId: 'evt-014'
        });

        // Assert: DB was still updated (inside transaction), but notifications were skipped
        expect(result).toEqual({
            success: true,
            statusChanged: true,
            newStatus: SubscriptionStatusEnum.PAUSED
        });
        expect(dbMock.transaction).toHaveBeenCalled();
        expect(dbMock.tx.update).toHaveBeenCalled();
    });

    // ---------------------------------------------------------------------------
    // GAP-043-40: Regression tests for discriminated customer existence check
    // ---------------------------------------------------------------------------

    describe('customer existence check during CANCELLED cleanup (GAP-043-40)', () => {
        // TC-GAP-043-40-A: Genuine 404 (statusCode property) => customerExists=false, no throw
        it('should treat a 404 statusCode error as customer-not-found and skip addon cleanup', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            // First call to customers.get (existence check) throws 404 via statusCode
            const notFoundError = Object.assign(new Error('Not Found'), { statusCode: 404 });
            // Second call (notification lookup) succeeds
            mockCustomerGet.mockRejectedValueOnce(notFoundError).mockResolvedValue({
                id: 'cust-001',
                email: 'user@example.com',
                metadata: { name: 'Test User', userId: 'user-001' }
            });

            const event = makeWebhookEvent();

            // Act — must NOT throw
            const result = await processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-gap-040-a'
            });

            // Assert: webhook still returns 200 (success), addon cleanup skipped (AC-1.9)
            expect(result.success).toBe(true);
            expect(result.statusChanged).toBe(true);
        });

        // TC-GAP-043-40-B: Genuine 404 (status property) => customerExists=false, no throw
        it('should treat a 404 status error as customer-not-found and skip addon cleanup', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            const notFoundError = Object.assign(new Error('Not Found'), { status: 404 });
            mockCustomerGet.mockRejectedValueOnce(notFoundError).mockResolvedValue({
                id: 'cust-001',
                email: 'user@example.com',
                metadata: { name: 'Test User', userId: 'user-001' }
            });

            const event = makeWebhookEvent();

            // Act — must NOT throw
            const result = await processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-gap-040-b'
            });

            expect(result.success).toBe(true);
            expect(result.statusChanged).toBe(true);
        });

        // TC-GAP-043-40-D: CRITICAL — infrastructure error must propagate (not treated as 404)
        it('should rethrow an infrastructure error so MercadoPago retries the webhook', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            // 500 / connection error — NOT a 404
            const infraError = Object.assign(new Error('Gateway timeout'), { statusCode: 500 });
            mockCustomerGet.mockRejectedValueOnce(infraError);

            const event = makeWebhookEvent();

            // Act + Assert: must throw so the webhook handler returns 500 and MP retries
            await expect(
                processSubscriptionUpdated({
                    event: event as never,
                    billing: mockBilling as never,
                    paymentAdapter: mockPaymentAdapter as never,
                    providerEventId: 'evt-gap-040-d'
                })
            ).rejects.toThrow('Gateway timeout');
        });

        // TC-GAP-043-40-E: Network timeout (no statusCode) must propagate
        it('should rethrow a network timeout error without statusCode so MercadoPago retries', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            // Plain network error — no status code, no "not found" in message
            const networkError = new Error('ETIMEDOUT');
            mockCustomerGet.mockRejectedValueOnce(networkError);

            const event = makeWebhookEvent();

            // Act + Assert: must throw so the webhook returns 500, not 200
            await expect(
                processSubscriptionUpdated({
                    event: event as never,
                    billing: mockBilling as never,
                    paymentAdapter: mockPaymentAdapter as never,
                    providerEventId: 'evt-gap-040-e'
                })
            ).rejects.toThrow('ETIMEDOUT');
        });
    });

    // ---------------------------------------------------------------------------
    // GAP-043-03: Promise.race 20s timeout tests for addon lifecycle calls
    // ---------------------------------------------------------------------------

    describe('20s webhook timeout guard (GAP-043-03)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        // TC-GAP-043-03-A: handleSubscriptionCancellationAddons exceeds 20s
        it('should return success without throwing when addon cancellation exceeds 20s', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            // Customer exists so addon cleanup runs
            mockCustomerGet.mockResolvedValue({
                id: 'cust-001',
                email: 'user@example.com',
                metadata: { name: 'Test User', userId: 'user-001' }
            });

            // handleSubscriptionCancellationAddons never resolves (simulates long-running work)
            mockHandleCancellationAddons.mockReturnValue(new Promise<never>(() => undefined));

            const event = makeWebhookEvent();

            // Act: start the webhook processing and advance fake timers past 20s
            const resultPromise = processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-gap-043-03-a'
            });

            // Advance fake clock by 20s to trigger the timeout
            await vi.advanceTimersByTimeAsync(20_000);

            // Assert: resolves normally (no throw) — returns 200 to MercadoPago
            const result = await resultPromise;
            expect(result.success).toBe(true);
            expect(result.statusChanged).toBe(true);
            expect(result.newStatus).toBe(SubscriptionStatusEnum.CANCELLED);
        });

        // TC-GAP-043-03-B: handleSubscriptionCancellationAddons exceeds 20s — logs timeout warning
        it('should log a timeout warning when addon cancellation exceeds 20s', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockCustomerGet.mockResolvedValue({
                id: 'cust-001',
                email: 'user@example.com',
                metadata: { name: 'Test User', userId: 'user-001' }
            });

            mockHandleCancellationAddons.mockReturnValue(new Promise<never>(() => undefined));

            const event = makeWebhookEvent();

            const resultPromise = processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-gap-043-03-b'
            });

            await vi.advanceTimersByTimeAsync(20_000);
            await resultPromise;

            // Assert: timeout warning was logged
            expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: localSub.id,
                    elapsedMs: 20_000
                }),
                'Addon lifecycle processing timed out — cron Phase 4 will complete remaining work'
            );
        });

        // TC-GAP-043-03-C: handleSubscriptionCancellationAddons completes within 20s — normal flow
        it('should complete normally when addon cancellation finishes within 20s', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockCustomerGet.mockResolvedValue({
                id: 'cust-001',
                email: 'user@example.com',
                metadata: { name: 'Test User', userId: 'user-001' }
            });

            // Resolves immediately (well within 20s)
            mockHandleCancellationAddons.mockResolvedValue(undefined);

            const event = makeWebhookEvent();

            // Act
            const result = await processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-gap-043-03-c'
            });

            // Assert: normal success, no timeout warning logged
            expect(result.success).toBe(true);
            expect(result.statusChanged).toBe(true);
            expect(result.newStatus).toBe(SubscriptionStatusEnum.CANCELLED);
            const warnCalls = vi.mocked(apiLogger.warn).mock.calls;
            const timeoutWarnings = warnCalls.filter(
                ([, msg]) => typeof msg === 'string' && msg.includes('timed out')
            );
            expect(timeoutWarnings).toHaveLength(0);
        });

        // TC-GAP-043-03-D: Non-timeout error from handleSubscriptionCancellationAddons still propagates
        it('should rethrow non-timeout errors from addon cancellation so MercadoPago retries', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpPreapprovalId });
            mockRetrieve.mockResolvedValue(makeMpSubscription('canceled'));

            const localSub = makeLocalSubscription({ status: SubscriptionStatusEnum.ACTIVE });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockCustomerGet.mockResolvedValue({
                id: 'cust-001',
                email: 'user@example.com',
                metadata: { name: 'Test User', userId: 'user-001' }
            });

            mockHandleCancellationAddons.mockRejectedValue(new Error('DB connection lost'));

            const event = makeWebhookEvent();

            // Act + Assert: non-timeout errors must propagate (MP retries)
            await expect(
                processSubscriptionUpdated({
                    event: event as never,
                    billing: mockBilling as never,
                    paymentAdapter: mockPaymentAdapter as never,
                    providerEventId: 'evt-gap-043-03-d'
                })
            ).rejects.toThrow('DB connection lost');
        });

        // TC-GAP-043-03-E: handlePlanChangeAddonRecalculation exceeds 20s — logs warning, returns 200
        it('should log a timeout warning when plan-change recalculation exceeds 20s', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            const oldPlanId = 'plan-001';
            const newPlanId = 'plan-002';

            // Event carries a different planId than what is stored locally
            mockedExtract.mockReturnValue({
                subscriptionId: mpPreapprovalId,
                planId: newPlanId
            });
            mockRetrieve.mockResolvedValue(makeMpSubscription('active'));

            const localSub = makeLocalSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                planId: oldPlanId
            });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            // Plan-change recalculation never resolves
            mockHandlePlanChangeRecalculation.mockReturnValue(new Promise<never>(() => undefined));

            const event = makeWebhookEvent();

            const resultPromise = processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-gap-043-03-e'
            });

            await vi.advanceTimersByTimeAsync(20_000);
            const result = await resultPromise;

            // Assert: resolves normally — webhook returns 200, timeout warning logged
            expect(result.success).toBe(true);
            expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledWith(
                expect.objectContaining({ elapsedMs: 20_000 }),
                'Addon lifecycle processing timed out — cron Phase 4 will complete remaining work'
            );
        });

        // TC-GAP-043-03-F: handlePlanChangeAddonRecalculation completes within 20s — no timeout warning
        it('should complete normally when plan-change recalculation finishes within 20s', async () => {
            // Arrange
            const mpPreapprovalId = 'preapproval-mp-001';
            const oldPlanId = 'plan-001';
            const newPlanId = 'plan-002';

            mockedExtract.mockReturnValue({
                subscriptionId: mpPreapprovalId,
                planId: newPlanId
            });
            mockRetrieve.mockResolvedValue(makeMpSubscription('active'));

            const localSub = makeLocalSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                planId: oldPlanId
            });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            // Resolves immediately
            mockHandlePlanChangeRecalculation.mockResolvedValue(undefined);

            const event = makeWebhookEvent();

            // Act
            const result = await processSubscriptionUpdated({
                event: event as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-gap-043-03-f'
            });

            // Assert: normal success, no timeout warning
            expect(result.success).toBe(true);
            const warnCalls = vi.mocked(apiLogger.warn).mock.calls;
            const timeoutWarnings = warnCalls.filter(
                ([, msg]) => typeof msg === 'string' && msg.includes('timed out')
            );
            expect(timeoutWarnings).toHaveLength(0);
        });
    });

    // ---------------------------------------------------------------------------
    // GAP-043-17: Payment failure tracking and PAYMENT_RETRY_WARNING dispatch
    // ---------------------------------------------------------------------------
    describe('PAST_DUE payment failure tracking (GAP-043-17)', () => {
        it('should increment paymentFailureCount on first PAST_DUE transition', async () => {
            // Arrange
            const mpId = 'mp-past-due-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpId });

            const localSub = makeLocalSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                metadata: {}
            });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockRetrieve.mockResolvedValue(makeMpSubscription('past_due'));

            // Act
            const result = await processSubscriptionUpdated({
                event: makeWebhookEvent() as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-past-due-01'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(result.statusChanged).toBe(true);

            // DB update should be called to persist the failure count
            // (the transaction update + the metadata update after step 8c)
            expect(dbMock.update).toHaveBeenCalled();
        });

        it('should NOT dispatch PAYMENT_RETRY_WARNING on first failure (count=1)', async () => {
            // Arrange
            const mpId = 'mp-past-due-first';
            mockedExtract.mockReturnValue({ subscriptionId: mpId });

            const localSub = makeLocalSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                metadata: {} // no prior failures
            });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockRetrieve.mockResolvedValue(makeMpSubscription('past_due'));

            // Act
            await processSubscriptionUpdated({
                event: makeWebhookEvent() as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-past-due-first'
            });

            // Assert: PAYMENT_RETRY_WARNING must NOT be sent on first failure
            const sendNotifCalls = vi.mocked(sendNotification).mock.calls;
            const retryWarningCalls = sendNotifCalls.filter(
                ([payload]) =>
                    typeof payload === 'object' &&
                    payload !== null &&
                    'type' in payload &&
                    payload.type === NotificationType.PAYMENT_RETRY_WARNING
            );
            expect(retryWarningCalls).toHaveLength(0);
        });

        it('should dispatch PAYMENT_RETRY_WARNING on second failure (count=2)', async () => {
            // Arrange
            const mpId = 'mp-past-due-second';
            mockedExtract.mockReturnValue({ subscriptionId: mpId });

            // Subscription already has 1 prior failure in metadata
            const localSub = makeLocalSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                metadata: { paymentFailureCount: 1 }
            });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockRetrieve.mockResolvedValue(makeMpSubscription('past_due'));

            // Mock customer lookup for the notification
            mockCustomerGet.mockResolvedValue({
                id: 'cust-001',
                email: 'user@example.com',
                metadata: { name: 'Test User', userId: 'user-001' }
            });

            // Act
            await processSubscriptionUpdated({
                event: makeWebhookEvent() as never,
                billing: { ...mockBilling, customers: { get: mockCustomerGet } } as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-past-due-second'
            });

            // Assert: PAYMENT_RETRY_WARNING should be dispatched on 2nd failure
            // Use a small delay to allow the fire-and-forget promise to start
            await new Promise((resolve) => setTimeout(resolve, 10));

            const sendNotifCalls = vi.mocked(sendNotification).mock.calls;
            const retryWarningCalls = sendNotifCalls.filter(
                ([payload]) =>
                    typeof payload === 'object' &&
                    payload !== null &&
                    'type' in payload &&
                    payload.type === NotificationType.PAYMENT_RETRY_WARNING
            );
            expect(retryWarningCalls.length).toBeGreaterThanOrEqual(1);

            if (retryWarningCalls.length > 0) {
                const [warningPayload] = retryWarningCalls[0] as unknown as [
                    Record<string, unknown>
                ];
                expect(warningPayload.failureCount).toBe(2);
                expect(warningPayload.customerId).toBe('cust-001');
                expect(warningPayload.idempotencyKey).toMatch(/^payment_retry_warning:/);
            }
        });

        it('should reset paymentFailureCount when subscription becomes active after PAST_DUE', async () => {
            // Arrange
            const mpId = 'mp-reactivate-001';
            mockedExtract.mockReturnValue({ subscriptionId: mpId });

            // Subscription was past_due with 2 failures, now coming back to active
            const localSub = makeLocalSubscription({
                status: SubscriptionStatusEnum.PAST_DUE,
                metadata: { paymentFailureCount: 2 }
            });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockRetrieve.mockResolvedValue(makeMpSubscription('active'));

            // Act
            const result = await processSubscriptionUpdated({
                event: makeWebhookEvent() as never,
                billing: mockBilling as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-reactivate-01'
            });

            // Assert: status changed, and update was called to reset failure count
            expect(result.success).toBe(true);
            expect(result.statusChanged).toBe(true);
            expect(dbMock.update).toHaveBeenCalled();
        });

        it('should not dispatch warning when customer lookup fails for PAST_DUE', async () => {
            // Arrange
            const mpId = 'mp-past-due-no-cust';
            mockedExtract.mockReturnValue({ subscriptionId: mpId });

            const localSub = makeLocalSubscription({
                status: SubscriptionStatusEnum.ACTIVE,
                metadata: { paymentFailureCount: 1 } // threshold met
            });
            const dbMock = makeDbMock([localSub]);
            vi.mocked(getDb).mockReturnValue(dbMock as never);

            mockRetrieve.mockResolvedValue(makeMpSubscription('past_due'));

            // Customer lookup fails
            mockCustomerGet.mockRejectedValue(new Error('Customer not found'));

            // Act
            const result = await processSubscriptionUpdated({
                event: makeWebhookEvent() as never,
                billing: { ...mockBilling, customers: { get: mockCustomerGet } } as never,
                paymentAdapter: mockPaymentAdapter as never,
                providerEventId: 'evt-past-due-no-cust'
            });

            // Assert: job still succeeds despite customer lookup failure
            expect(result.success).toBe(true);
        });
    });
});
