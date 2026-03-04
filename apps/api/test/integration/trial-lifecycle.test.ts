/**
 * Trial Lifecycle Integration Tests
 *
 * Tests the complete trial lifecycle by exercising TrialService methods
 * end-to-end with a mocked QZPayBilling SDK. Validates the full sequence:
 * 1. Start trial -> returns subscription ID
 * 2. Get trial status -> shows active trial with 14 days remaining
 * 3. Extend trial -> adds 7 more days
 * 4. Check expiry on active trial -> returns false
 * 5. Simulate expiry via mocked expired trialEnd -> check expiry returns true
 * 6. Block expired trials -> cancels 1 subscription
 * 7. Reactivate from trial -> creates new paid subscription
 *
 * @module test/integration/trial-lifecycle
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { TrialService } from '../../src/services/trial.service';

// Standard mocks required by the billing system
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// Mock @repo/logger to suppress noise in test output
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel,
        apiLogger: createMockedLogger()
    };
});

// Mock entitlement cache clearing (side effect in blockExpiredTrials)
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

// Mock notifications (fire-and-forget side effect)
vi.mock('@repo/notifications', () => ({
    NotificationType: {
        TRIAL_EXPIRED: 'TRIAL_EXPIRED',
        TRIAL_ENDING: 'TRIAL_ENDING'
    }
}));

// ----------------------------------------------------------------
// Test data constants
// ----------------------------------------------------------------

const CUSTOMER_ID = 'cust-test-001';
const PLAN_ID = 'plan-1';
const SUBSCRIPTION_ID = 'sub-trial-001';
const PAID_SUBSCRIPTION_ID = 'sub-paid-001';

/** Build an active trialing subscription fixture */
function buildTrialingSubscription(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    const now = new Date();
    const trialStart = new Date(now);
    trialStart.setDate(trialStart.getDate() - 1); // started 1 day ago
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 13); // 13 days remaining (total 14-day trial)

    return {
        id: SUBSCRIPTION_ID,
        customerId: CUSTOMER_ID,
        planId: PLAN_ID,
        status: 'trialing',
        trialStart: trialStart.toISOString(),
        trialEnd: trialEnd.toISOString(),
        metadata: { autoStarted: 'true', createdBy: 'trial-service' },
        ...overrides
    };
}

/** Build an expired trialing subscription fixture */
function buildExpiredSubscription(): Record<string, unknown> {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() - 2); // expired 2 days ago

    return buildTrialingSubscription({ trialEnd: trialEnd.toISOString() });
}

/** Build a mock QZPayBilling instance */
function buildMockBilling() {
    return {
        plans: {
            list: vi.fn().mockResolvedValue({
                data: [{ id: PLAN_ID, name: 'owner-basico' }]
            }),
            get: vi.fn().mockResolvedValue({ id: PLAN_ID, name: 'owner-basico' })
        },
        subscriptions: {
            create: vi.fn().mockResolvedValue({ id: SUBSCRIPTION_ID }),
            getByCustomerId: vi.fn().mockResolvedValue([]),
            list: vi.fn().mockResolvedValue({ data: [] }),
            update: vi.fn().mockResolvedValue({}),
            cancel: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue(buildTrialingSubscription())
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'owner@example.com',
                metadata: { name: 'Test Owner', userId: 'user-001' }
            })
        }
    };
}

// ----------------------------------------------------------------
// Test suite
// ----------------------------------------------------------------

describe('Trial Lifecycle Integration', () => {
    let mockBilling: ReturnType<typeof buildMockBilling>;
    let service: TrialService;
    const mockedGetQZPayBilling = getQZPayBilling as MockedFunction<typeof getQZPayBilling>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockBilling = buildMockBilling();

        // Cast necessary because QZPayBilling is a complex type; mock satisfies the shape
        service = new TrialService(mockBilling as any);

        mockedGetQZPayBilling.mockReturnValue(mockBilling as any);
    });

    // ----------------------------------------------------------------
    // Step 1: Start trial
    // ----------------------------------------------------------------
    describe('startTrial', () => {
        it('should start a trial and return a subscription ID', async () => {
            // Arrange: no existing subscriptions for this customer
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);

            // Act
            const subscriptionId = await service.startTrial({ customerId: CUSTOMER_ID });

            // Assert
            expect(subscriptionId).toBe(SUBSCRIPTION_ID);
            expect(mockBilling.plans.list).toHaveBeenCalledOnce();
            expect(mockBilling.subscriptions.create).toHaveBeenCalledOnce();

            const createCall = mockBilling.subscriptions.create.mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(createCall).toMatchObject({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                trialDays: expect.any(Number)
            });
        });

        it('should return null when customer already has an active subscription', async () => {
            // Arrange: customer already subscribed
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                buildTrialingSubscription()
            ]);

            // Act
            const result = await service.startTrial({ customerId: CUSTOMER_ID });

            // Assert
            expect(result).toBeNull();
            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should return null when billing is disabled', async () => {
            // Arrange: service without billing
            const disabledService = new TrialService(null);

            // Act
            const result = await disabledService.startTrial({ customerId: CUSTOMER_ID });

            // Assert
            expect(result).toBeNull();
        });

        it('should throw when the trial plan is not found in the catalog', async () => {
            // Arrange: billing returns empty plan list
            mockBilling.plans.list.mockResolvedValue({ data: [] });

            // Act & Assert
            await expect(service.startTrial({ customerId: CUSTOMER_ID })).rejects.toThrow(
                'Trial plan not found: owner-basico'
            );
        });
    });

    // ----------------------------------------------------------------
    // Step 2: Get trial status
    // ----------------------------------------------------------------
    describe('getTrialStatus', () => {
        it('should return active trial status with days remaining when on trial', async () => {
            // Arrange: customer is trialing with ~13 days left
            const trialSub = buildTrialingSubscription();
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([trialSub]);

            // Act
            const status = await service.getTrialStatus({ customerId: CUSTOMER_ID });

            // Assert
            expect(status.isOnTrial).toBe(true);
            expect(status.isExpired).toBe(false);
            expect(status.daysRemaining).toBeGreaterThan(0);
            expect(status.daysRemaining).toBeLessThanOrEqual(14);
            expect(status.planSlug).toBe('owner-basico');
            expect(status.startedAt).toBeTruthy();
            expect(status.expiresAt).toBeTruthy();
        });

        it('should return not-on-trial status when no subscriptions exist', async () => {
            // Arrange
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);

            // Act
            const status = await service.getTrialStatus({ customerId: CUSTOMER_ID });

            // Assert
            expect(status.isOnTrial).toBe(false);
            expect(status.isExpired).toBe(false);
            expect(status.daysRemaining).toBe(0);
            expect(status.planSlug).toBeNull();
        });

        it('should return safe defaults when billing is disabled', async () => {
            // Arrange
            const disabledService = new TrialService(null);

            // Act
            const status = await disabledService.getTrialStatus({ customerId: CUSTOMER_ID });

            // Assert
            expect(status.isOnTrial).toBe(false);
            expect(status.isExpired).toBe(false);
            expect(status.daysRemaining).toBe(0);
        });
    });

    // ----------------------------------------------------------------
    // Step 3: Extend trial
    // ----------------------------------------------------------------
    describe('extendTrial', () => {
        it('should extend an active trial by the specified number of days', async () => {
            // Arrange: trialing subscription with known trialEnd
            const trialSub = buildTrialingSubscription();
            mockBilling.subscriptions.get.mockResolvedValue(trialSub);
            mockBilling.subscriptions.update.mockResolvedValue({});

            // Act
            const result = await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: 7
            });

            // Assert
            expect(result.newTrialEnd).toBeTruthy();

            // Verify the new trial end is 7 days after the original
            const trialEnd = new Date(trialSub.trialEnd as string);
            const newEnd = new Date(result.newTrialEnd);
            const diffDays = Math.round(
                (newEnd.getTime() - trialEnd.getTime()) / (1000 * 60 * 60 * 24)
            );
            expect(diffDays).toBe(7);

            expect(mockBilling.subscriptions.update).toHaveBeenCalledOnce();
        });

        it('should throw when trying to extend a non-trialing subscription', async () => {
            // Arrange: subscription in active (paid) status
            mockBilling.subscriptions.get.mockResolvedValue({
                ...buildTrialingSubscription(),
                status: 'active'
            });

            // Act & Assert
            await expect(
                service.extendTrial({ subscriptionId: SUBSCRIPTION_ID, additionalDays: 7 })
            ).rejects.toThrow("Cannot extend trial: subscription status is 'active'");
        });

        it('should throw when billing is disabled', async () => {
            // Arrange
            const disabledService = new TrialService(null);

            // Act & Assert
            await expect(
                disabledService.extendTrial({ subscriptionId: SUBSCRIPTION_ID, additionalDays: 7 })
            ).rejects.toThrow('Billing not enabled');
        });
    });

    // ----------------------------------------------------------------
    // Step 4: Check expiry on active trial -> returns false
    // ----------------------------------------------------------------
    describe('checkTrialExpiry (active trial)', () => {
        it('should return false when trial is still active', async () => {
            // Arrange: trialing subscription with future trialEnd
            const trialSub = buildTrialingSubscription();
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([trialSub]);

            // Act
            const isExpired = await service.checkTrialExpiry({ customerId: CUSTOMER_ID });

            // Assert
            expect(isExpired).toBe(false);
        });
    });

    // ----------------------------------------------------------------
    // Step 5: Simulate expiry -> check expiry returns true
    // ----------------------------------------------------------------
    describe('checkTrialExpiry (expired trial)', () => {
        it('should return true when trial has passed its trialEnd date', async () => {
            // Arrange: expired trialing subscription (status still 'trialing' but date is past)
            const expiredSub = buildExpiredSubscription();
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([expiredSub]);
            // getTrialStatus also calls plans.get
            mockBilling.plans.get.mockResolvedValue({ id: PLAN_ID, name: 'owner-basico' });

            // Act
            const isExpired = await service.checkTrialExpiry({ customerId: CUSTOMER_ID });

            // Assert
            expect(isExpired).toBe(true);
        });
    });

    // ----------------------------------------------------------------
    // Step 6: Block expired trials
    // ----------------------------------------------------------------
    describe('blockExpiredTrials', () => {
        it('should cancel expired trialing subscriptions and return count', async () => {
            // Arrange: one expired trialing subscription in the list
            const expiredSub = buildExpiredSubscription();
            mockBilling.subscriptions.list.mockResolvedValue({ data: [expiredSub] });
            mockBilling.customers.get.mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'owner@example.com',
                metadata: { name: 'Test Owner', userId: 'user-001' }
            });
            mockBilling.plans.get.mockResolvedValue({ id: PLAN_ID, name: 'owner-basico' });

            // Act
            const blockedCount = await service.blockExpiredTrials();

            // Assert
            expect(blockedCount).toBe(1);
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith(SUBSCRIPTION_ID);
        });

        it('should skip subscriptions with no trialEnd date', async () => {
            // Arrange: trialing subscription missing trialEnd
            const noEndSub = { ...buildTrialingSubscription(), trialEnd: null };
            mockBilling.subscriptions.list.mockResolvedValue({ data: [noEndSub] });

            // Act
            const blockedCount = await service.blockExpiredTrials();

            // Assert
            expect(blockedCount).toBe(0);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should not cancel active trialing subscriptions that have not expired', async () => {
            // Arrange: active trial with future end date
            const activeSub = buildTrialingSubscription();
            mockBilling.subscriptions.list.mockResolvedValue({ data: [activeSub] });

            // Act
            const blockedCount = await service.blockExpiredTrials();

            // Assert
            expect(blockedCount).toBe(0);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should return 0 when there are no trialing subscriptions', async () => {
            // Arrange
            mockBilling.subscriptions.list.mockResolvedValue({ data: [] });

            // Act
            const blockedCount = await service.blockExpiredTrials();

            // Assert
            expect(blockedCount).toBe(0);
        });

        it('should return 0 when billing is disabled', async () => {
            // Arrange
            const disabledService = new TrialService(null);

            // Act
            const blockedCount = await disabledService.blockExpiredTrials();

            // Assert
            expect(blockedCount).toBe(0);
        });
    });

    // ----------------------------------------------------------------
    // Step 7: Reactivate from trial
    // ----------------------------------------------------------------
    describe('reactivateFromTrial', () => {
        it('should cancel the trial subscription and create a new paid subscription', async () => {
            // Arrange: customer has one trialing subscription
            const trialSub = buildTrialingSubscription();
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([trialSub]);
            mockBilling.subscriptions.create.mockResolvedValue({ id: PAID_SUBSCRIPTION_ID });

            // Act
            const newSubscriptionId = await service.reactivateFromTrial({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID
            });

            // Assert
            expect(newSubscriptionId).toBe(PAID_SUBSCRIPTION_ID);

            // Previous trial subscription should have been cancelled
            expect(mockBilling.subscriptions.cancel).toHaveBeenCalledWith(SUBSCRIPTION_ID);

            // New paid subscription should have been created without trialDays
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    metadata: expect.objectContaining({ convertedFromTrial: 'true' })
                })
            );
        });

        it('should create a paid subscription even when no prior trial exists', async () => {
            // Arrange: no existing subscriptions
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);
            mockBilling.subscriptions.create.mockResolvedValue({ id: PAID_SUBSCRIPTION_ID });

            // Act
            const newSubscriptionId = await service.reactivateFromTrial({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID
            });

            // Assert
            expect(newSubscriptionId).toBe(PAID_SUBSCRIPTION_ID);
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should throw when billing is disabled', async () => {
            // Arrange
            const disabledService = new TrialService(null);

            // Act & Assert
            await expect(
                disabledService.reactivateFromTrial({ customerId: CUSTOMER_ID, planId: PLAN_ID })
            ).rejects.toThrow('Billing not enabled');
        });
    });
});
