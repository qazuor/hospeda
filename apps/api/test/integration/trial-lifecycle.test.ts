/**
 * Trial Lifecycle Integration Tests
 *
 * Exercises the TrialService methods that own a trial once it exists, against a
 * mocked QZPayBilling SDK:
 * 1. Get trial status -> shows an active trial with its days remaining
 * 2. Extend trial -> adds days
 * 3. Check expiry on an active trial -> returns false
 * 4. Simulate expiry via a mocked expired trialEnd -> check expiry returns true
 * 5. Reactivate from trial -> creates a real paid preapproval
 *
 * ## What deliberately is NOT here (HOS-171)
 *
 * Starting a trial is no longer a TrialService concern. Card-first made the
 * trial `free_trial` on the same MercadoPago preapproval a paid checkout
 * creates, so it is born in `initiatePaidMonthlySubscription` (covered by
 * test/services/subscription-checkout.service.test.ts) and `startTrial` is gone.
 *
 * Likewise `blockExpiredTrials`, which cancelled every trial whose window had
 * closed. An elapsed card-first trial is a customer MercadoPago is about to
 * charge, so it is reconciled against the provider rather than cancelled --
 * see `reconcileExpiredTrials`, covered by test/services/trial.service.test.ts,
 * test/cron/trial-expiry.test.ts and test/routes/billing-trial-admin.test.ts.
 *
 * @module test/integration/trial-lifecycle
 */

import type { MockedFunction } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

// Mock entitlement cache clearing (a side effect TrialService fires on the
// lifecycle writes below)
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

/** HOS-114: MP checkout return URLs required by the paid reactivation flow. */
const REACTIVATION_URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/**
 * What `subscriptions.create` returns for a real paid preapproval.
 *
 * `providerSubscriptionIds.mercadopago` is not decoration: `createPaidSubscription`
 * fails closed without it (HOS-151 Bug C), because the webhook lookup keys on that
 * id, so a row persisted without one can never activate and its preapproval can
 * never be found to cancel.
 */
function buildPaidPreapprovalResult(): Record<string, unknown> {
    return {
        id: PAID_SUBSCRIPTION_ID,
        status: 'incomplete',
        providerInitPoint: 'https://mp.test/checkout/reactivate-int',
        providerSubscriptionIds: { mercadopago: 'mp_preapproval_reactivate' }
    };
}

/** HOS-114: a paid, monthly plan fixture accepted by the reactivation plan guard. */
function buildPaidMonthlyPlanFixture(): Record<string, unknown> {
    return {
        id: PLAN_ID,
        name: 'owner-basico',
        prices: [
            {
                id: 'price-monthly-1',
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                unitAmount: 3_500_000
            }
        ]
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
    describe('reactivateFromTrial (HOS-114)', () => {
        it('should create a real paid preapproval and return a checkoutUrl, leaving the trial subscription untouched', async () => {
            // Arrange: customer has one trialing subscription; the plan guard needs a
            // plan with an active monthly price row.
            const trialSub = buildTrialingSubscription();
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([trialSub]);
            mockBilling.plans.list.mockResolvedValue({ data: [buildPaidMonthlyPlanFixture()] });
            mockBilling.subscriptions.create.mockResolvedValue(buildPaidPreapprovalResult());

            // Act
            const result = await service.reactivateFromTrial({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                urls: REACTIVATION_URLS
            });

            // Assert — real paid preapproval contract
            expect(result).toEqual({
                success: true,
                subscriptionId: PAID_SUBSCRIPTION_ID,
                checkoutUrl: 'https://mp.test/checkout/reactivate-int',
                status: 'incomplete',
                message: expect.any(String)
            });

            // Deferred to the webhook (HOS-114 T-007): the old trial subscription
            // must NOT be cancelled synchronously here.
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();

            // New paid subscription created via the real mode:'paid' contract,
            // carrying the superseded trial's id for the webhook to complete.
            expect(mockBilling.subscriptions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    mode: 'paid',
                    billingInterval: 'monthly',
                    paymentMethodReturnUrl: REACTIVATION_URLS.paymentMethodReturnUrl,
                    notificationUrl: REACTIVATION_URLS.notificationUrl,
                    metadata: expect.objectContaining({
                        convertedFromTrial: 'true',
                        supersedesSubscriptionId: SUBSCRIPTION_ID
                    })
                })
            );
        });

        it('should create a paid preapproval even when no prior trial exists', async () => {
            // Arrange: no existing subscriptions
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);
            mockBilling.plans.list.mockResolvedValue({ data: [buildPaidMonthlyPlanFixture()] });
            mockBilling.subscriptions.create.mockResolvedValue(buildPaidPreapprovalResult());

            // Act
            const result = await service.reactivateFromTrial({
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                urls: REACTIVATION_URLS
            });

            // Assert
            expect(result.subscriptionId).toBe(PAID_SUBSCRIPTION_ID);
            expect(result.checkoutUrl).toBe('https://mp.test/checkout/reactivate-int');
            expect(mockBilling.subscriptions.cancel).not.toHaveBeenCalled();
        });

        it('should reject an unknown planId and create no subscription (plan guard, fail-closed)', async () => {
            // Arrange
            mockBilling.plans.list.mockResolvedValue({ data: [] });

            // Act & Assert
            await expect(
                service.reactivateFromTrial({
                    customerId: CUSTOMER_ID,
                    planId: 'unknown-plan-id',
                    urls: REACTIVATION_URLS
                })
            ).rejects.toMatchObject({ name: 'SubscriptionCheckoutError', code: 'PLAN_NOT_FOUND' });

            expect(mockBilling.subscriptions.create).not.toHaveBeenCalled();
        });

        it('should throw when billing is disabled', async () => {
            // Arrange
            const disabledService = new TrialService(null);

            // Act & Assert
            await expect(
                disabledService.reactivateFromTrial({
                    customerId: CUSTOMER_ID,
                    planId: PLAN_ID,
                    urls: REACTIVATION_URLS
                })
            ).rejects.toThrow('Billing not enabled');
        });
    });
});
