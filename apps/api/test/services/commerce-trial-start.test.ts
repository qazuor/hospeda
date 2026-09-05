/**
 * HOS-1184 — the commerce local trial: verdict and grant.
 *
 * The bug these cover is a REGRESSION with a very specific shape, so the
 * assertions are written to fail against the code as it stood before this fix
 * rather than to describe the code as it stands now:
 *
 *  - a commerce owner publishing their first listing reached
 *    `initiateCommerceMonthlySubscription`, which hardcodes `trialDays: 0` and
 *    sends them to MercadoPago. The test that matters most is therefore that a
 *    trial IS created and that the vertical's own trial plan is the one used —
 *    a fix that granted the accommodation trial instead would be worse than the
 *    bug, because it would silently spend a trial in the wrong vertical;
 *  - eligibility is enforced INSIDE the grant, not at the call site. A caller
 *    that skips the check must not be able to mint a second free trial;
 *  - the verdict is three states. Collapsing `trial_available` and
 *    `has_active_sub` into a boolean is exactly the defect HOS-1183 is fixing
 *    one layer up, and a test that only asserts truthiness would not notice.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const fixtures = vi.hoisted(() => ({
    plans: [] as Row[]
}));

const mocks = vi.hoisted(() => ({
    createTrialSubscription: vi.fn(),
    resolveTrialEligibility: vi.fn(),
    attachListingToSubscription: vi.fn(),
    findOwnerVerticalSubscription: vi.fn(),
    clearEntitlementCache: vi.fn()
}));

/**
 * A Drizzle-ish client that really answers the one query this module makes:
 * the trial-plan lookup. `limit()` resolves the fixture rows so a test can put
 * a plan there, or leave it empty to exercise the missing-plan path.
 */
const DB = vi.hoisted(() => ({
    select: () => {
        const builder = {
            from() {
                return builder;
            },
            where() {
                return builder;
            },
            limit(count: number) {
                return Promise.resolve(fixtures.plans.slice(0, count));
            }
        };
        return builder;
    }
}));

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;

    return {
        ...base,
        and: (...c: unknown[]) => c,
        billingPlans: { id: 'id', name: 'name', metadata: 'metadata', deletedAt: 'deletedAt' },
        eq: (c: unknown, v: unknown) => [c, v],
        isNull: (c: unknown) => c,
        getDb: () => DB
    };
});

vi.mock('../../src/services/subscription-trial-create.service.js', () => ({
    createTrialSubscription: mocks.createTrialSubscription
}));

vi.mock('../../src/services/billing/trial-eligibility.service.js', () => ({
    resolveTrialEligibility: mocks.resolveTrialEligibility
}));

vi.mock('../../src/services/commerce-subscription-attach.service.js', () => ({
    attachListingToSubscription: mocks.attachListingToSubscription,
    findOwnerVerticalSubscription: mocks.findOwnerVerticalSubscription
}));

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: mocks.clearEntitlementCache
}));

vi.mock('../../src/utils/env.js', () => ({
    env: { HOSPEDA_MERCADO_PAGO_SANDBOX: true }
}));

import {
    resolveCommerceTrialVerdict,
    startCommerceListingTrial
} from '../../src/services/commerce-trial-start.service';

/** A stand-in billing client; every method this module needs is mocked away. */
const billing = {} as never;

const TRIAL_END = new Date('2026-10-05T12:00:00.000Z');

beforeEach(() => {
    vi.clearAllMocks();
    fixtures.plans = [];

    // Defaults describe the case this feature exists for: an owner with no
    // subscription in this vertical who has never spent its trial.
    mocks.findOwnerVerticalSubscription.mockResolvedValue(null);
    mocks.resolveTrialEligibility.mockResolvedValue({ eligible: true });
    mocks.createTrialSubscription.mockResolvedValue({
        localSubscriptionId: 'sub-trial-1',
        trialStart: new Date('2026-09-05T12:00:00.000Z'),
        trialEnd: TRIAL_END,
        entitlementCacheCleared: true
    });
    mocks.attachListingToSubscription.mockResolvedValue(undefined);
});

describe('startCommerceListingTrial', () => {
    it('creates the trial on the GASTRONOMY trial plan, in the gastronomy domain', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];

        const result = await startCommerceListingTrial({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy',
            entityId: 'listing-1'
        });

        expect(result).toEqual({
            localSubscriptionId: 'sub-trial-1',
            trialEnd: TRIAL_END
        });

        // The domain is the whole point: granting `accommodation` here would
        // spend the wrong vertical's one-per-domain trial and would still look
        // like a working feature from the outside.
        expect(mocks.createTrialSubscription).toHaveBeenCalledTimes(1);
        const grant = mocks.createTrialSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(grant.productDomain).toBe('gastronomy');
        expect(grant.planId).toBe('plan-gastronomy-trial');
        expect(grant.customerId).toBe('cus-1');
        expect(grant.trialDays).toBe(30);
    });

    it('resolves the EXPERIENCE trial plan for the experience vertical', async () => {
        fixtures.plans = [{ id: 'plan-experience-trial', metadata: { trialDays: 30 } }];

        await startCommerceListingTrial({
            billing,
            customerId: 'cus-1',
            vertical: 'experience',
            entityId: 'listing-1'
        });

        const grant = mocks.createTrialSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(grant.productDomain).toBe('experience');
        expect(grant.planId).toBe('plan-experience-trial');
    });

    it('attaches the listing to the trial, which is what publishes it', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];

        await startCommerceListingTrial({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy',
            entityId: 'listing-42'
        });

        // Without the attach the subscription exists and the listing stays
        // PRIVATE — invisible from the API and indistinguishable, to the owner,
        // from the bug being fixed.
        expect(mocks.attachListingToSubscription).toHaveBeenCalledTimes(1);
        const attach = mocks.attachListingToSubscription.mock.calls[0]?.[0] as {
            subscription: { id: string; status: string };
            entityType: string;
            entityId: string;
        };
        expect(attach.entityId).toBe('listing-42');
        expect(attach.entityType).toBe('gastronomy');
        expect(attach.subscription.id).toBe('sub-trial-1');
        // `trialing` is what makes the visibility reconciler publish: its gate
        // is `isEntitlementGrantingStatus`, which includes it.
        expect(attach.subscription.status).toBe('trialing');
    });

    it('REFUSES to grant when the vertical trial is already spent, even though the caller did not check', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];
        mocks.resolveTrialEligibility.mockResolvedValue({ eligible: false });

        const result = await startCommerceListingTrial({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy',
            entityId: 'listing-1'
        });

        expect(result).toBeNull();
        // Nothing was created and nothing was attached — a second free trial is
        // free entitlements with no card and nothing in the response to reveal it.
        expect(mocks.createTrialSubscription).not.toHaveBeenCalled();
        expect(mocks.attachListingToSubscription).not.toHaveBeenCalled();
    });

    it('asks about eligibility in the LISTING vertical, never accommodation', async () => {
        fixtures.plans = [{ id: 'plan-experience-trial', metadata: { trialDays: 30 } }];

        await startCommerceListingTrial({
            billing,
            customerId: 'cus-1',
            vertical: 'experience',
            entityId: 'listing-1'
        });

        const query = mocks.resolveTrialEligibility.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(query.productDomain).toBe('experience');
        expect(query.customerId).toBe('cus-1');
    });

    it('returns null (so the caller falls back to checkout) when the trial plan row is missing', async () => {
        fixtures.plans = [];

        const result = await startCommerceListingTrial({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy',
            entityId: 'listing-1'
        });

        expect(result).toBeNull();
        expect(mocks.createTrialSubscription).not.toHaveBeenCalled();
    });

    it('omits trialDays entirely when the plan declares an unusable one, rather than granting zero days', async () => {
        // A zero or negative value must not reach the creator as a literal:
        // it rejects a non-positive `trialDays`, so passing it through would
        // turn a recoverable metadata problem into a failed publish.
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 0 } }];

        await startCommerceListingTrial({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy',
            entityId: 'listing-1'
        });

        const grant = mocks.createTrialSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(grant).not.toHaveProperty('trialDays');
    });
});

describe('resolveCommerceTrialVerdict', () => {
    it('answers trial_available with the plan own trial length', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];

        const result = await resolveCommerceTrialVerdict({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy'
        });

        expect(result).toEqual({ verdict: 'trial_available', trialDays: 30 });
    });

    it('reads the trial length from the PLAN ROW, not from a constant', async () => {
        // `metadata.trialDays` is commercial-layer (HOS-39): an operator can
        // change it from the admin panel and the seed will not revert it. A
        // hardcoded 30 here would make the button promise a number the grant
        // does not write.
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 45 } }];

        const result = await resolveCommerceTrialVerdict({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy'
        });

        expect(result.trialDays).toBe(45);
    });

    it('answers has_active_sub — DISTINCT from trial_available — when the owner already pays', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];
        mocks.findOwnerVerticalSubscription.mockResolvedValue({
            id: 'sub-live',
            status: 'active',
            planId: 'plan-paid'
        });

        const result = await resolveCommerceTrialVerdict({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy'
        });

        // Both states mean "publishing works and costs nothing today", which is
        // precisely why a boolean loses the only thing worth telling apart:
        // whether a clock starts.
        expect(result.verdict).toBe('has_active_sub');
        expect(result.verdict).not.toBe('trial_available');
        expect(result.trialDays).toBeUndefined();
    });

    it('checks the live subscription BEFORE eligibility, so a paying owner is never told a clock starts', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];
        mocks.findOwnerVerticalSubscription.mockResolvedValue({
            id: 'sub-live',
            status: 'active',
            planId: 'plan-paid'
        });
        // Eligible by the billing rule — they never spent the trial — and still
        // not the right thing to tell them.
        mocks.resolveTrialEligibility.mockResolvedValue({ eligible: true });

        const result = await resolveCommerceTrialVerdict({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy'
        });

        expect(result.verdict).toBe('has_active_sub');
        expect(mocks.resolveTrialEligibility).not.toHaveBeenCalled();
    });

    it('answers payment_required when the trial is spent', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];
        mocks.resolveTrialEligibility.mockResolvedValue({ eligible: false });

        const result = await resolveCommerceTrialVerdict({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy'
        });

        expect(result.verdict).toBe('payment_required');
    });

    it('answers payment_required rather than promising a trial the grant could not create', async () => {
        fixtures.plans = [];

        const result = await resolveCommerceTrialVerdict({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy'
        });

        expect(result.verdict).toBe('payment_required');
    });

    it('never mutates anything — it is safe to call on every render', async () => {
        fixtures.plans = [{ id: 'plan-gastronomy-trial', metadata: { trialDays: 30 } }];

        await resolveCommerceTrialVerdict({
            billing,
            customerId: 'cus-1',
            vertical: 'gastronomy'
        });

        expect(mocks.createTrialSubscription).not.toHaveBeenCalled();
        expect(mocks.attachListingToSubscription).not.toHaveBeenCalled();
        expect(mocks.clearEntitlementCache).not.toHaveBeenCalled();
    });
});
