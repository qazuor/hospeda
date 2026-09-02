/**
 * HOS-1012 T-037 — which plan the publish path starts the trial on.
 *
 * T-008 resolved it by `DEFAULT_TRIAL_PLAN_SLUG` (`owner-basico`), the correct
 * placeholder before D-5 was decided. It is now the vertical's own trial plan,
 * resolved FROM the product domain — so gastronomy and experiences reach their
 * own plans instead of falling back to the accommodation one.
 *
 * The assertion that matters is on the SLUG the lookup filters by. The sibling
 * suite's transaction mock returns its plan fixture regardless of the `where`
 * clause, so it would pass just as happily against `owner-basico`; this one
 * captures the predicate instead.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const fixtures = vi.hoisted(() => ({
    customers: [] as Row[],
    plans: [] as Row[]
}));

/** Every `eq()` the module built, so the plan lookup's filter is inspectable. */
const captured = vi.hoisted(() => ({ eqs: [] as Array<{ col: unknown; value: unknown }> }));

const mocks = vi.hoisted(() => ({
    createTrialSubscription: vi.fn(),
    clearEntitlementCache: vi.fn(),
    resolveTrialEligibility: vi.fn()
}));

const TX = vi.hoisted(() => {
    return {
        select: () => {
            let rows: Record<string, unknown>[] = [];
            const builder = {
                from(table: Record<string, unknown>) {
                    rows = 'externalId' in table ? [...fixtures.customers] : [...fixtures.plans];
                    return builder;
                },
                where() {
                    return builder;
                },
                orderBy() {
                    return builder;
                },
                limit(count: number) {
                    return Promise.resolve(rows.slice(0, count));
                }
            };
            return builder;
        }
    };
});

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;

    const billingCustomers = { id: 'id', externalId: 'externalId' } as const;
    const billingPlans = { id: 'id', name: 'name' } as const;
    const billingSubscriptions = {} as const;

    return {
        ...base,
        and: (...c: unknown[]) => c,
        billingCustomers,
        billingPlans,
        billingSubscriptions,
        desc: (c: unknown) => c,
        eq: (col: unknown, value: unknown) => {
            captured.eqs.push({ col, value });
            return [col, value];
        },
        isNull: (c: unknown) => c,
        getDb: () => TX
    };
});

vi.mock('../../src/services/subscription-trial-create.service', () => ({
    createTrialSubscription: mocks.createTrialSubscription
}));

vi.mock('../../src/services/billing/trial-eligibility.service', () => ({
    resolveTrialEligibility: mocks.resolveTrialEligibility
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mocks.clearEntitlementCache
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_MERCADO_PAGO_SANDBOX: true }
}));

import { ALL_TRIAL_PLANS, resolveTrialPlanSlug } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import { buildAccommodationPublishDeps } from '../../src/services/accommodation-publish-deps';

const OWNER_ID = 'owner-1012';
const CUSTOMER_ID = 'cus-1012';
const PLAN_ID = '11111111-2222-3333-4444-555555555555';

const getBillingStub = () => ({}) as never;
const txCtx = { tx: TX, hookState: {} } as never;

describe('HOS-1012 T-037 — the publish path resolves the ACCOMMODATION trial plan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        captured.eqs = [];
        fixtures.customers = [{ id: CUSTOMER_ID, externalId: OWNER_ID }];
        fixtures.plans = [{ id: PLAN_ID, name: 'owner-trial' }];
        mocks.createTrialSubscription.mockResolvedValue({
            localSubscriptionId: 'sub-local-1',
            trialStart: new Date('2026-09-01T00:00:00.000Z'),
            trialEnd: new Date('2026-10-01T00:00:00.000Z'),
            entitlementCacheCleared: false
        });
    });

    it('looks the plan up by the OWNER-TRIAL slug, not owner-basico', async () => {
        const deps = buildAccommodationPublishDeps(getBillingStub);

        await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        const filteredValues = captured.eqs.map((e) => e.value);
        expect(filteredValues).toContain('owner-trial');
        // The pre-D-5 placeholder. A trial on the entry tier shows the host a
        // Hospeda nobody pays for, then asks them on day 30 to pay for exactly
        // what they already had.
        expect(filteredValues).not.toContain('owner-basico');
    });

    it('still stamps the accommodation product domain on the subscription', async () => {
        const deps = buildAccommodationPublishDeps(getBillingStub);

        await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        expect(mocks.createTrialSubscription).toHaveBeenCalledWith(
            expect.objectContaining({
                planId: PLAN_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        );
    });

    it('refuses rather than publishing without a clock when the trial plan row is absent', async () => {
        fixtures.plans = [];
        const deps = buildAccommodationPublishDeps(getBillingStub);

        const result = await deps.startLocalTrial({ ownerId: OWNER_ID, ctx: txCtx });

        expect(result).toBeNull();
        expect(mocks.createTrialSubscription).not.toHaveBeenCalled();
    });
});

describe('HOS-1012 T-037 — the vertical → trial plan mapping', () => {
    it('gives each vertical its OWN trial plan, never a shared one', () => {
        const slugs = [
            resolveTrialPlanSlug({ productDomain: ProductDomainEnum.ACCOMMODATION }),
            resolveTrialPlanSlug({ productDomain: ProductDomainEnum.GASTRONOMY }),
            resolveTrialPlanSlug({ productDomain: ProductDomainEnum.EXPERIENCE })
        ];
        expect(slugs).toEqual(['owner-trial', 'gastronomy-trial', 'experience-trial']);
        expect(new Set(slugs).size).toBe(3);
    });

    it('registers every trial plan under ITS OWN product domain', () => {
        // This is the invariant `createTrialSubscription`'s domain check
        // enforces again at the database, one layer down: a plan resolved for
        // vertical X whose `product_domain` is Y makes that call throw. Catching
        // it here means the mapping is wrong at build time rather than at the
        // first publish of the vertical nobody tested.
        for (const { plan, productDomain } of ALL_TRIAL_PLANS) {
            expect(resolveTrialPlanSlug({ productDomain })).toBe(plan.slug);
        }
    });
});
