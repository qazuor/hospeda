import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getDb: vi.fn()
}));

vi.mock('@repo/db', () => ({
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
// checkEligibility tests
//
// HOS-171 removed `startTrial` / `cancelTrial` from this factory entirely —
// publishing an accommodation no longer creates anything at MercadoPago, so
// `buildAccommodationPublishDeps()` now takes zero arguments and returns a
// single `checkEligibility` member. `checkEligibility`'s own logic (reading
// the local billing tables + `isSubscriptionLive`) is unchanged by HOS-171,
// so this coverage carries over as-is, only updated for the new zero-arg
// factory signature. The behavioral consequence of `first_publish` /
// `subscription_required` — that `AccommodationService.publish()` now
// rejects BOTH with FORBIDDEN `subscription_required` — is covered at the
// service layer (`packages/service-core/test/services/accommodation/
// publish.test.ts`), not here: this file only tests the dependency factory
// that resolves eligibility, not what the caller does with the result.
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
        const deps = buildAccommodationPublishDeps();

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('first_publish');
    });

    it('returns first_publish when customer exists but has zero subscriptions', async () => {
        // Arrange
        setupDbMock([CUSTOMER], []);
        const deps = buildAccommodationPublishDeps();

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
        const deps = buildAccommodationPublishDeps();

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
        const deps = buildAccommodationPublishDeps();

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
        const deps = buildAccommodationPublishDeps();

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
        const deps = buildAccommodationPublishDeps();

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
        const deps = buildAccommodationPublishDeps();

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
        const deps = buildAccommodationPublishDeps();

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('subscription_required');
    });
});
