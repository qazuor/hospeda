import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        // Arrange: cancelled sub — isSubscriptionLive returns false for any non-active/trialing
        setupDbMock([CUSTOMER], [{ status: 'cancelled', trialEnd: null, currentPeriodEnd: null }]);
        const deps = buildAccommodationPublishDeps(() => null);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('subscription_required');
    });
});
