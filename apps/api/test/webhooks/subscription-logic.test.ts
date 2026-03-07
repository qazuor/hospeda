/**
 * Subscription Logic Unit Tests
 *
 * Tests for status mapping constants and notification helper functions
 * used in MercadoPago subscription webhook processing.
 */

import { extractMPSubscriptionEventData } from '@qazuor/qzpay-mercadopago';
import { getDb } from '@repo/db';
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

// Hoisted mock stubs for notification functions - declared before any imports are resolved.
const { mockSendCancelled, mockSendPaused, mockSendReactivated } = vi.hoisted(() => ({
    mockSendCancelled: vi.fn().mockResolvedValue(undefined),
    mockSendPaused: vi.fn().mockResolvedValue(undefined),
    mockSendReactivated: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
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
 */
function makeDbMock(selectRows: unknown[], insertShouldFail = false) {
    const insertValuesChain = {
        values: vi.fn().mockResolvedValue(undefined)
    };
    if (insertShouldFail) {
        insertValuesChain.values = vi.fn().mockRejectedValue(new Error('insert failed'));
    }

    const updateSetChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined)
    };

    const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(selectRows)
    };

    return {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue(insertValuesChain),
        update: vi.fn().mockReturnValue(updateSetChain)
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
            expect.objectContaining({ extra: expect.objectContaining({ mpPreapprovalId }) })
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
            expect.objectContaining({ extra: expect.objectContaining({ mpPreapprovalId }) })
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
        expect(dbMock.update).not.toHaveBeenCalled();
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
        expect(dbMock.update).not.toHaveBeenCalled();
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
        expect(dbMock.update).toHaveBeenCalled();
        expect(dbMock.insert).toHaveBeenCalled();
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
        expect(dbMock.update).toHaveBeenCalled();
        expect(dbMock.insert).toHaveBeenCalled();
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
        const updateMock = dbMock.update({});
        expect(updateMock.set).toHaveBeenCalledWith(
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
        const updateChain = dbMock.update({});
        expect(updateChain.set).toHaveBeenCalledWith(
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
        const updateChain = dbMock.update({});
        expect(updateChain.set).toHaveBeenCalledWith(
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

        // Assert: insert called with correct audit data
        expect(dbMock.insert).toHaveBeenCalled();
        const insertChain = dbMock.insert({});
        expect(insertChain.values).toHaveBeenCalledWith(
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

        // Assert: DB was still updated, but notifications were skipped
        expect(result).toEqual({
            success: true,
            statusChanged: true,
            newStatus: SubscriptionStatusEnum.PAUSED
        });
        expect(dbMock.update).toHaveBeenCalled();
        expect(mockedPausedNotif).not.toHaveBeenCalled();
    });
});
