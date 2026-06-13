import { failNext, getRecordedCalls, resetTestControl } from '@repo/billing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ensureCustomerExists: vi.fn(),
    startTrial: vi.fn(),
    findUserById: vi.fn(),
    clearEntitlementCache: vi.fn(),
    getDb: vi.fn()
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mocks.clearEntitlementCache
}));

vi.mock('../../src/services/billing-customer-sync', () => ({
    BillingCustomerSyncService: class BillingCustomerSyncService {
        ensureCustomerExists = mocks.ensureCustomerExists;
    }
}));

vi.mock('../../src/services/trial.service', () => ({
    TrialService: class TrialService {
        startTrial = mocks.startTrial;
    }
}));

vi.mock('@repo/db', () => ({
    UserModel: class UserModel {
        findById = mocks.findUserById;
    },
    billingCustomers: {},
    billingSubscriptions: {},
    desc: vi.fn(),
    eq: vi.fn(),
    getDb: mocks.getDb
}));

import { buildAccommodationPublishDeps } from '../../src/services/accommodation-publish-deps';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fixed epoch used as "now" throughout the checkEligibility tests (ms). */
const NOW_MS = new Date('2026-06-11T12:00:00.000Z').getTime();

/** Hours offset as milliseconds. */
const hoursMs = (h: number) => h * 3_600_000;

/** Minimal customer row shape returned by the first DB query. */
const CUSTOMER = { id: 'cust_123' };

/**
 * Builds a chainable Drizzle-style SELECT mock.
 *
 * The chain is `select().from().where()[.orderBy()][.limit()]`.
 * Every method in the chain returns `this`-like object. The terminal method
 * (`.limit()`, or `.where()` when `.limit()` is absent) resolves with `rows`.
 *
 * This factory covers both query shapes used in `checkEligibility`:
 *   1. `select().from().where(eq(...)).limit(1)`
 *   2. `select().from().where(eq(...)).orderBy(desc(...)).limit(10)`
 */
function makeSelectChain(rows: unknown[]) {
    const limitMock = vi.fn().mockResolvedValue(rows);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock, limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    return { selectMock, fromMock, whereMock, orderByMock, limitMock };
}

/**
 * Wires `mocks.getDb` to return a single `db` object whose `.select()` method
 * returns the customer-query chain on the first call and the subscriptions-query
 * chain on the second call.
 */
function setupDbMock(customerRows: unknown[], subscriptionRows: unknown[]) {
    const customerChain = makeSelectChain(customerRows);
    const subscriptionChain = makeSelectChain(subscriptionRows);

    const selectMock = vi
        .fn()
        .mockReturnValueOnce(customerChain.selectMock())
        .mockReturnValueOnce(subscriptionChain.selectMock());

    mocks.getDb.mockReturnValue({ select: selectMock });
}

// ---------------------------------------------------------------------------
// startTrial tests (pre-existing)
// ---------------------------------------------------------------------------

describe('buildAccommodationPublishDeps.startTrial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findUserById.mockResolvedValue({
            id: 'owner-1',
            email: 'owner@example.com',
            displayName: 'Owner One'
        });
        mocks.ensureCustomerExists.mockResolvedValue('cust_123');
        mocks.startTrial.mockResolvedValue('sub_123');
    });

    it('clears the entitlement cache after creating the first-publish trial', async () => {
        const deps = buildAccommodationPublishDeps(() => ({}) as never);

        const result = await deps.startTrial({ ownerId: 'owner-1' });

        expect(result).toEqual({ subscriptionId: 'sub_123' });
        expect(mocks.clearEntitlementCache).toHaveBeenCalledTimes(1);
        expect(mocks.clearEntitlementCache).toHaveBeenCalledWith('cust_123');
    });
});

// ---------------------------------------------------------------------------
// checkEligibility tests
// ---------------------------------------------------------------------------

describe('buildAccommodationPublishDeps.checkEligibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // checkEligibility -> isSubscriptionLive uses Date.now() internally (no nowMs
        // param). Freeze time at NOW_MS so the date-relative grace cases are
        // deterministic regardless of wall-clock time of day.
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns first_publish when no billing customer row exists', async () => {
        // Arrange: customer query returns empty
        setupDbMock([], []);
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('first_publish');
    });

    it('returns first_publish when customer exists but has zero subscriptions', async () => {
        // Arrange
        setupDbMock([CUSTOMER], []);
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('first_publish');
    });

    it('returns has_active_sub when active sub with currentPeriodEnd in the future', async () => {
        // Arrange: period ends 24h from now — well within any grace window
        const futureEnd = new Date(NOW_MS + hoursMs(24));
        setupDbMock(
            [CUSTOMER],
            [{ status: 'active', trialEnd: null, currentPeriodEnd: futureEnd }]
        );
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('has_active_sub');
    });

    it('returns has_active_sub when active sub with currentPeriodEnd 1h past (within grace)', async () => {
        // Arrange: period ended 1h ago, 6h grace applies → still live
        const recentPast = new Date(NOW_MS - hoursMs(1));
        setupDbMock(
            [CUSTOMER],
            [{ status: 'active', trialEnd: null, currentPeriodEnd: recentPast }]
        );
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('has_active_sub');
    });

    it('returns subscription_required when active sub with currentPeriodEnd 7h past (beyond grace)', async () => {
        // Arrange: period ended 7h ago, exceeds the 6h grace → expired
        // This is the gap-closing case: previously returned has_active_sub
        const expiredEnd = new Date(NOW_MS - hoursMs(7));
        setupDbMock(
            [CUSTOMER],
            [{ status: 'active', trialEnd: null, currentPeriodEnd: expiredEnd }]
        );
        const deps = buildAccommodationPublishDeps(() => null);

        // Act — pass nowMs so the predicate uses the same fixed clock
        // isSubscriptionLive uses Date.now() by default; we must control it
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        try {
            const result = await deps.checkEligibility('owner-1');
            expect(result).toBe('subscription_required');
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns has_active_sub when trialing sub with trialEnd 1h past (within grace)', async () => {
        // Arrange: trial ended 1h ago, within 6h grace → still live
        const recentTrialEnd = new Date(NOW_MS - hoursMs(1));
        setupDbMock(
            [CUSTOMER],
            [{ status: 'trialing', trialEnd: recentTrialEnd, currentPeriodEnd: null }]
        );
        const deps = buildAccommodationPublishDeps(() => null);

        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        try {
            const result = await deps.checkEligibility('owner-1');
            expect(result).toBe('has_active_sub');
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns subscription_required when trialing sub with trialEnd 7h past (beyond grace)', async () => {
        // Arrange: trial ended 7h ago, exceeds 6h grace → expired
        // This is the second gap-closing case: an expired-trial host that
        // previously slipped through as has_active_sub.
        const expiredTrialEnd = new Date(NOW_MS - hoursMs(7));
        setupDbMock(
            [CUSTOMER],
            [{ status: 'trialing', trialEnd: expiredTrialEnd, currentPeriodEnd: null }]
        );
        const deps = buildAccommodationPublishDeps(() => null);

        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
        try {
            const result = await deps.checkEligibility('owner-1');
            expect(result).toBe('subscription_required');
        } finally {
            vi.useRealTimers();
        }
    });

    it('returns subscription_required when only a cancelled subscription exists', async () => {
        // Arrange: cancelled sub whose paid period already ended (1h past). Soft-cancel
        // grace grants access only until current_period_end, so a lapsed cancelled sub
        // is blocked.
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'cancelled',
                    trialEnd: null,
                    currentPeriodEnd: new Date(NOW_MS - hoursMs(1))
                }
            ]
        );
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('subscription_required');
    });
});

// ---------------------------------------------------------------------------
// Test-control wrapping (SPEC-217 T-006 Option B)
// ---------------------------------------------------------------------------

describe('buildAccommodationPublishDeps — test-control wrapping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetTestControl();
        mocks.findUserById.mockResolvedValue({
            id: 'owner-1',
            email: 'owner@example.com',
            displayName: 'Owner One'
        });
        mocks.ensureCustomerExists.mockResolvedValue('cust_123');
        mocks.startTrial.mockResolvedValue('sub_123');
    });

    afterEach(() => {
        process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = undefined;
        resetTestControl();
    });

    describe('startTrial', () => {
        it('should reject with queued fault and NOT invoke inner work when flag ON + failNext', async () => {
            // Arrange
            process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
            failNext({
                operation: 'startTrial',
                errorCode: 'TIMEOUT',
                errorMessage: 'simulated start-trial timeout'
            });
            const deps = buildAccommodationPublishDeps(() => ({}) as never);

            // Act & Assert
            await expect(deps.startTrial({ ownerId: 'owner-1' })).rejects.toThrow(
                'simulated start-trial timeout'
            );

            // Inner work must NOT have been invoked — fault short-circuits before the body.
            expect(mocks.findUserById).not.toHaveBeenCalled();
            expect(mocks.ensureCustomerExists).not.toHaveBeenCalled();
            expect(mocks.startTrial).not.toHaveBeenCalled();
        });

        it('should run body normally and record ok when flag ON + no fault', async () => {
            // Arrange
            process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
            const deps = buildAccommodationPublishDeps(() => ({}) as never);

            // Act
            const result = await deps.startTrial({ ownerId: 'owner-1' });

            // Assert — body executed normally
            expect(result).toEqual({ subscriptionId: 'sub_123' });
            expect(mocks.ensureCustomerExists).toHaveBeenCalledTimes(1);
            expect(mocks.startTrial).toHaveBeenCalledTimes(1);

            // Call recorded with outcome ok
            const calls = getRecordedCalls('startTrial');
            expect(calls).toHaveLength(1);
            expect(calls[0]?.outcome).toBe('ok');
        });

        it('should run body normally and NOT record calls when flag OFF', async () => {
            // Arrange — gate disabled (env var absent)
            process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = undefined;
            const deps = buildAccommodationPublishDeps(() => ({}) as never);

            // Act
            const result = await deps.startTrial({ ownerId: 'owner-1' });

            // Assert — no interception, body ran
            expect(result).toEqual({ subscriptionId: 'sub_123' });
            expect(mocks.ensureCustomerExists).toHaveBeenCalledTimes(1);

            // getRecordedCalls returns [] when gate is off
            expect(getRecordedCalls('startTrial')).toHaveLength(0);
        });
    });

    describe('cancelTrial', () => {
        it('should reject with queued fault when flag ON + failNext(cancelTrial)', async () => {
            // Arrange
            process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
            failNext({
                operation: 'cancelTrial',
                errorCode: 'MP_CANCEL_FAIL',
                errorMessage: 'simulated cancel failure'
            });
            const mockCancel = vi.fn();
            const billingStub = { subscriptions: { cancel: mockCancel } };
            const deps = buildAccommodationPublishDeps(() => billingStub as never);

            // Act & Assert
            await expect(deps.cancelTrial('sub_999')).rejects.toThrow('simulated cancel failure');

            // Real billing.subscriptions.cancel must NOT have been called.
            expect(mockCancel).not.toHaveBeenCalled();

            // Recorded as failed
            const calls = getRecordedCalls('cancelTrial');
            expect(calls).toHaveLength(1);
            expect(calls[0]?.outcome).toBe('failed');
        });

        it('should invoke billing.subscriptions.cancel and record ok when flag ON + no fault', async () => {
            // Arrange
            process.env.HOSPEDA_QZPAY_TEST_CONTROL_ENABLED = 'true';
            const mockCancel = vi.fn().mockResolvedValue(undefined);
            const billingStub = { subscriptions: { cancel: mockCancel } };
            const deps = buildAccommodationPublishDeps(() => billingStub as never);

            // Act
            await deps.cancelTrial('sub_456');

            // Assert — billing.cancel called with the subscription id
            expect(mockCancel).toHaveBeenCalledWith('sub_456');

            const calls = getRecordedCalls('cancelTrial');
            expect(calls).toHaveLength(1);
            expect(calls[0]?.outcome).toBe('ok');
        });
    });
});
