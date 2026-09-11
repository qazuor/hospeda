import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getDb: vi.fn(),
    // HOS-217: checkEligibility now calls isOwnerCategorySubscription per live
    // subscription to confirm it's an owner/complex plan, not just "any live
    // sub". Mocked here (rather than exercised against the mocked @repo/db
    // chain, which only wires the customer + subscriptions queries) so the
    // pre-existing "any live sub = has_active_sub" tests keep working
    // unchanged via a default resolved-true, with dedicated tests below
    // overriding it to false for the HOS-217 tourist-plan case.
    isOwnerCategorySubscription: vi.fn(),
    // HOS-1012 T-007: the `first_publish` branch is now answered by the shared
    // per-vertical trial-eligibility resolver, not by "this owner has zero
    // subscription rows". Mocked so this file tests the BRANCHING, and
    // `trial-eligibility.service`'s own suite tests the rule.
    resolveTrialEligibility: vi.fn()
}));

vi.mock('@repo/db', () => ({
    and: vi.fn((...conditions: unknown[]) => ({ _type: 'and', conditions })),
    billingCustomers: {},
    billingSubscriptions: {},
    desc: vi.fn(),
    eq: vi.fn(),
    isNull: vi.fn((column: unknown) => ({ _type: 'isNull', column })),
    getDb: mocks.getDb
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, isOwnerCategorySubscription: mocks.isOwnerCategorySubscription };
});

vi.mock('../../src/services/billing/trial-eligibility.service', () => ({
    resolveTrialEligibility: mocks.resolveTrialEligibility
}));

import { buildAccommodationPublishDeps } from '../../src/services/accommodation-publish-deps';

/**
 * Non-null billing getter. `checkEligibility` refuses to resolve trial
 * eligibility without a client (answering `subscription_required`), so every
 * case that is not specifically about billing being disabled hands it this.
 */
const getBillingStub = () => ({}) as never;

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
// The `has_active_sub` half of this suite (local billing tables +
// `isSubscriptionLive` + the HOS-217 owner-category filter) is unchanged by
// HOS-1012 and carries over verbatim.
//
// What HOS-1012 T-007 changed is the OTHER half. `first_publish` used to mean
// "no customer row, or zero subscription rows"; it now means "no live owner
// subscription AND this owner still has their ACCOMMODATION trial", answered by
// the shared per-vertical resolver (mocked here — its own suite owns the rule).
// Two consequences this file pins down: a missing customer row now answers
// `subscription_required` rather than `first_publish`, and an owner whose only
// prior subscription is in another vertical keeps their accommodation trial
// (D-2, absorbing HOS-931).
//
// What `publish()` DOES with the answer is covered at the service layer
// (`packages/service-core/test/services/accommodation/publish.test.ts`).
// ---------------------------------------------------------------------------

describe('buildAccommodationPublishDeps.checkEligibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: every live subscription resolves as an owner/complex plan,
        // matching this suite's pre-HOS-217 assumption ("any live sub is a
        // host plan"). Tests exercising the new tourist-plan rejection path
        // override this per-case.
        mocks.isOwnerCategorySubscription.mockResolvedValue(true);
        // Default: the trial is already spent. Every pre-existing case below
        // hands the owner a prior subscription, which is exactly the shape the
        // real resolver classifies as consuming, so this default keeps their
        // `subscription_required` expectations honest. The cases that are ABOUT
        // an unspent trial override it.
        mocks.resolveTrialEligibility.mockResolvedValue({ eligible: false });
        // checkEligibility -> isSubscriptionLive uses Date.now() internally (no nowMs
        // param). Freeze time at NOW_MS so the date-relative grace cases are
        // deterministic regardless of wall-clock time of day.
        vi.useFakeTimers();
        vi.setSystemTime(NOW_MS);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns subscription_required when no billing customer row exists (HOS-1012)', async () => {
        // This used to answer `first_publish`. The customer row is created
        // eagerly at signup (`lib/auth.ts`) and again in
        // `host-onboarding/start`, so its absence is an edge, not the normal
        // first-publish shape — and with no customer there is no trial to
        // create, so the plans page is the correct degradation. The resolver is
        // never even asked: it is keyed on a customer id we do not have.
        setupDbMock([], []);
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.checkEligibility('owner-1');

        expect(result).toBe('subscription_required');
        expect(mocks.resolveTrialEligibility).not.toHaveBeenCalled();
    });

    it('returns first_publish when the customer has zero subscriptions and the trial is unspent', async () => {
        setupDbMock([CUSTOMER], []);
        mocks.resolveTrialEligibility.mockResolvedValue({ eligible: true });
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.checkEligibility('owner-1');

        expect(result).toBe('first_publish');
        // D-2: the question asked is per-vertical, and this factory only ever
        // speaks for accommodation.
        expect(mocks.resolveTrialEligibility).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: CUSTOMER.id, productDomain: 'accommodation' })
        );
    });

    it('returns subscription_required when the customer has zero subscriptions but the trial is spent', async () => {
        // The mirror of the case above, and the one that stops a lapsed host
        // from re-publishing free forever by cancelling and starting over.
        setupDbMock([CUSTOMER], []);
        mocks.resolveTrialEligibility.mockResolvedValue({ eligible: false });
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.checkEligibility('owner-1');

        expect(result).toBe('subscription_required');
    });

    it('returns subscription_required without consulting the resolver when billing is disabled', async () => {
        // A null billing client means eligibility cannot be RESOLVED. Granting a
        // trial on a guess is the one outcome that cannot be undone, so the
        // degradation is to reject.
        setupDbMock([CUSTOMER], []);
        const deps = buildAccommodationPublishDeps(() => null);

        const result = await deps.checkEligibility('owner-1');

        expect(result).toBe('subscription_required');
        expect(mocks.resolveTrialEligibility).not.toHaveBeenCalled();
    });

    it('returns first_publish for an owner whose only prior subscription is another vertical (D-2)', async () => {
        // HOS-931, absorbed by D-2: this owner has a live gastronomy
        // subscription. It is not an accommodation subscription, so it neither
        // permits publishing nor consumes the accommodation trial — the
        // resolver, which is domain-scoped, still answers eligible.
        const futureEnd = new Date(NOW_MS + hoursMs(24));
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'active',
                    trialEnd: null,
                    currentPeriodEnd: futureEnd,
                    planId: 'plan-gastronomy-basico',
                    productDomain: 'gastronomy'
                }
            ]
        );
        mocks.resolveTrialEligibility.mockResolvedValue({ eligible: true });
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.checkEligibility('owner-1');

        expect(result).toBe('first_publish');
    });

    it('returns has_active_sub when active sub with currentPeriodEnd in the future', async () => {
        // Arrange: period ends 24h from now — well within any grace window
        const futureEnd = new Date(NOW_MS + hoursMs(24));
        setupDbMock(
            [CUSTOMER],
            [{ status: 'active', trialEnd: null, currentPeriodEnd: futureEnd }]
        );
        const deps = buildAccommodationPublishDeps(getBillingStub);

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
        const deps = buildAccommodationPublishDeps(getBillingStub);

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
        const deps = buildAccommodationPublishDeps(getBillingStub);

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
        const deps = buildAccommodationPublishDeps(getBillingStub);

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
        const deps = buildAccommodationPublishDeps(getBillingStub);

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
        const deps = buildAccommodationPublishDeps(getBillingStub);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('subscription_required');
    });

    // -----------------------------------------------------------------------
    // HOS-217: a live subscription alone is not enough — it must also be an
    // owner/complex-category plan. A HOST promoted via host-onboarding who
    // still only has a live tourist-vip subscription must NOT be treated as
    // eligible to publish.
    // -----------------------------------------------------------------------

    it('returns subscription_required when the only live subscription is a tourist-category plan', async () => {
        // Arrange: an active, non-expired subscription (would have been
        // has_active_sub pre-HOS-217) whose plan is tourist-category — e.g.
        // tourist-vip, still active on a HOST who onboarded without ever
        // picking an owner plan.
        const futureEnd = new Date(NOW_MS + hoursMs(24));
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'active',
                    trialEnd: null,
                    currentPeriodEnd: futureEnd,
                    planId: 'plan-tourist-vip'
                }
            ]
        );
        mocks.isOwnerCategorySubscription.mockResolvedValue(false);
        const deps = buildAccommodationPublishDeps(getBillingStub);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('subscription_required');
        expect(mocks.isOwnerCategorySubscription).toHaveBeenCalledWith(
            expect.objectContaining({ planId: 'plan-tourist-vip' })
        );
    });

    // -----------------------------------------------------------------------
    // HOS-217 follow-up: `commerce-listing`/`partner-listing` plans have
    // `metadata.category = 'owner'` on purpose (SPEC-239 T-034 quirk), so a
    // live commerce-domain subscription must be filtered out by product
    // domain BEFORE the owner/complex category check runs — otherwise a host
    // with only a commerce subscription would be allowed to publish an
    // accommodation with no accommodation plan at all.
    // -----------------------------------------------------------------------

    it('returns subscription_required when the only live subscription is a commerce-domain plan (owner-category quirk)', async () => {
        // Arrange: a live subscription whose productDomain is 'commerce' —
        // isOwnerCategorySubscription would resolve true for it (the
        // commerce-listing plan's category is 'owner' on purpose), so this
        // case only passes if isAccommodationSubscription filters it out
        // before the category loop ever runs.
        const futureEnd = new Date(NOW_MS + hoursMs(24));
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'active',
                    trialEnd: null,
                    currentPeriodEnd: futureEnd,
                    planId: 'plan-commerce-listing',
                    productDomain: 'commerce'
                }
            ]
        );
        // isOwnerCategorySubscription default mock resolves true — if the
        // product-domain filter is missing, this sub would incorrectly pass.
        const deps = buildAccommodationPublishDeps(getBillingStub);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('subscription_required');
        expect(mocks.isOwnerCategorySubscription).not.toHaveBeenCalled();
    });

    it('returns has_active_sub when an owner accommodation-domain subscription exists', async () => {
        // Regression: a normal accommodation-domain, owner-category live
        // subscription must still be eligible after the product-domain
        // filter is added.
        const futureEnd = new Date(NOW_MS + hoursMs(24));
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'active',
                    trialEnd: null,
                    currentPeriodEnd: futureEnd,
                    planId: 'plan-owner-basico',
                    productDomain: 'accommodation'
                }
            ]
        );
        const deps = buildAccommodationPublishDeps(getBillingStub);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('has_active_sub');
        // A live owner subscription settles it: no trial question is asked, so a
        // paying host cannot be handed a second trial by a resolver hiccup.
        expect(mocks.resolveTrialEligibility).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // HOS-239: a `comp` (SPEC-262 complimentary) subscription grants its plan's
    // entitlements forever. Before HOS-239 `isSubscriptionLive` returned false
    // for `comp`, so a HOST legitimately comped on an owner plan passed the
    // entitlement middleware but was filtered out of `liveSubscriptions` here
    // and blocked from actually publishing (subscription_required). The comp
    // branch in isSubscriptionLive fixes that.
    // -----------------------------------------------------------------------

    it('returns has_active_sub for a comp owner-category accommodation subscription (HOS-239)', async () => {
        // Arrange: a comp sub whose currentPeriodEnd is even in the PAST — comp
        // never expires, so it must still count as live.
        const pastEnd = new Date(NOW_MS - hoursMs(9000));
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'comp',
                    trialEnd: null,
                    currentPeriodEnd: pastEnd,
                    planId: 'plan-owner-vip',
                    productDomain: 'accommodation'
                }
            ]
        );
        const deps = buildAccommodationPublishDeps(getBillingStub);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('has_active_sub');
        expect(mocks.isOwnerCategorySubscription).toHaveBeenCalledWith(
            expect.objectContaining({ planId: 'plan-owner-vip' })
        );
    });

    it('returns subscription_required for a comp tourist-category subscription (not an owner plan)', async () => {
        // A comp on a tourist plan is live but not owner-category → cannot publish.
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'comp',
                    trialEnd: null,
                    currentPeriodEnd: null,
                    planId: 'plan-tourist-plus',
                    productDomain: 'accommodation'
                }
            ]
        );
        mocks.isOwnerCategorySubscription.mockResolvedValue(false);
        const deps = buildAccommodationPublishDeps(getBillingStub);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('subscription_required');
    });

    it('returns has_active_sub when a live owner-category plan exists alongside a live tourist plan', async () => {
        // Arrange: two live subscriptions — the tourist one is not an owner
        // plan, but the owner one is. The loop must not bail out on the first
        // (tourist) match; it must keep checking until it finds an owner match.
        const futureEnd = new Date(NOW_MS + hoursMs(24));
        setupDbMock(
            [CUSTOMER],
            [
                {
                    status: 'active',
                    trialEnd: null,
                    currentPeriodEnd: futureEnd,
                    planId: 'plan-tourist-vip'
                },
                {
                    status: 'active',
                    trialEnd: null,
                    currentPeriodEnd: futureEnd,
                    planId: 'plan-owner-basico'
                }
            ]
        );
        mocks.isOwnerCategorySubscription.mockImplementation(
            async ({ planId }: { planId: string }) => planId === 'plan-owner-basico'
        );
        const deps = buildAccommodationPublishDeps(getBillingStub);

        // Act
        const result = await deps.checkEligibility('owner-1');

        // Assert
        expect(result).toBe('has_active_sub');
    });
});
