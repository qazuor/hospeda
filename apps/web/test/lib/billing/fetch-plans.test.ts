/** TEST:1621:4 — the web maps only the current sellable vertical catalog. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAudiencePlans } from '@/lib/billing/audience-plans';
import { fetchPublicPlans } from '@/lib/billing/fetch-plans';

vi.mock('@/lib/env', () => ({ getApiUrl: vi.fn(() => 'http://api.test') }));

const monthlyId = '10000000-0000-4000-8000-000000000001';
const annualId = '10000000-0000-4000-8000-000000000002';
const planId = '10000000-0000-4000-8000-000000000003';
const versionId = '10000000-0000-4000-8000-000000000004';

function catalogPlan(overrides: Record<string, unknown> = {}) {
    return {
        planId,
        planVersionId: versionId,
        slug: 'tourist-vip',
        name: 'VIP',
        description: 'Descripción',
        pricingOrder: 1,
        rank: 1,
        trialDays: 14,
        inheritsTouristVip: false,
        entitlements: ['TOURIST_VIP'],
        limits: { reviews: 10 },
        billingOptions: [
            { id: monthlyId, cycle: 'monthly', amount: 120000, currency: 'ARS' },
            { id: annualId, cycle: 'annual', amount: 1200000, currency: 'ARS' }
        ],
        ...overrides
    };
}

function floorPlan(overrides: Record<string, unknown> = {}) {
    return {
        planId,
        planVersionId: versionId,
        slug: 'floor-default',
        name: 'Gratis',
        description: null,
        pricingOrder: 0,
        rank: 0,
        trialDays: 0,
        entitlements: ['TOURIST_REVIEWS'],
        limits: { reviews: 5 },
        ...overrides
    };
}

function mockCatalog(
    vertical: string,
    plans: unknown[],
    floor: unknown,
    trialOffer?: { trialDays: number } | null
): void {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
            success: true,
            data: { vertical, plans, floor, ...(trialOffer === undefined ? {} : { trialOffer }) }
        })
    });
}

function mockFailure(response: unknown): void {
    global.fetch = vi.fn().mockResolvedValue(response);
}

afterEach(() => vi.restoreAllMocks());

describe('TEST:1621:4 fetchPublicPlans', () => {
    it('(a) maps the tourist audience to its own catalog vertical', async () => {
        mockCatalog('tourist', [catalogPlan()], null);
        const plans = await fetchAudiencePlans({ audience: 'tourist' });
        expect(global.fetch).toHaveBeenCalledWith(
            'http://api.test/api/v1/public/plan-catalog?vertical=tourist',
            { headers: { Accept: 'application/json' } }
        );
        expect(plans.map((plan) => plan.slug)).toEqual(['tourist-vip']);
        expect(plans[0]?.inheritsTouristVip).toBe(false);
    });

    it('TEST:1765:4 carries inherited VIP metadata and marks the floor as non-inheriting', async () => {
        mockCatalog('tourist', [catalogPlan({ inheritsTouristVip: true })], floorPlan());

        const result = await fetchPublicPlans({ vertical: 'tourist' });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.plans.map((plan) => [plan.slug, plan.inheritsTouristVip])).toEqual([
            ['tourist-free', false],
            ['tourist-vip', true]
        ]);
    });

    it('(a) requests the selected vertical catalog', async () => {
        mockCatalog('tourist', [], null);
        await fetchPublicPlans({ vertical: 'tourist' });
        expect(global.fetch).toHaveBeenCalledWith(
            'http://api.test/api/v1/public/plan-catalog?vertical=tourist',
            { headers: { Accept: 'application/json' } }
        );
    });

    it('(b) maps prices, option ids, version, vertical, and trial from the catalog', async () => {
        mockCatalog('accommodation', [catalogPlan()], null, { trialDays: 14 });
        const result = await fetchPublicPlans({ vertical: 'accommodation' });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected catalog success');
        expect(result.plans).toEqual([
            expect.objectContaining({
                id: planId,
                planVersionId: versionId,
                vertical: 'accommodation',
                slug: 'tourist-vip',
                description: 'Descripción',
                monthlyPriceArs: 120000,
                annualPriceArs: 1200000,
                billingOptions: { monthly: monthlyId, annual: annualId },
                hasTrial: true,
                trialDays: 14
            })
        ]);
    });

    it('(c) omits plans without monthly billing and retains exactly the purchasable plan', async () => {
        mockCatalog(
            'tourist',
            [
                catalogPlan({ slug: 'not-purchasable', billingOptions: [] }),
                catalogPlan({ slug: 'purchasable', planId: annualId })
            ],
            null
        );
        const result = await fetchPublicPlans({ vertical: 'tourist' });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected catalog success');
        expect(result.plans.map((plan) => plan.slug)).toEqual(['purchasable']);
    });

    it('(d) returns ok:false for HTTP errors, network errors, and invalid bodies', async () => {
        mockFailure({ ok: false, status: 503 });
        expect((await fetchPublicPlans({ vertical: 'tourist' })).ok).toBe(false);

        global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
        expect((await fetchPublicPlans({ vertical: 'tourist' })).ok).toBe(false);

        mockFailure({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) });
        expect((await fetchPublicPlans({ vertical: 'tourist' })).ok).toBe(false);
    });

    it('(e) maps a null description to an empty string', async () => {
        mockCatalog('tourist', [catalogPlan({ description: null })], null);
        const result = await fetchPublicPlans({ vertical: 'tourist' });
        expect(result.ok && result.plans[0]?.description).toBe('');
    });

    it('(f) maps the tourist floor first as a free card without purchase references', async () => {
        mockCatalog('tourist', [catalogPlan()], floorPlan());
        const result = await fetchPublicPlans({ vertical: 'tourist' });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected catalog success');
        expect(result.plans.map((plan) => plan.slug)).toEqual(['tourist-free', 'tourist-vip']);
        expect(result.plans[0]).toMatchObject({
            monthlyPriceArs: 0,
            annualPriceArs: null,
            hasTrial: false,
            trialDays: 0,
            entitlements: ['TOURIST_REVIEWS'],
            limits: { reviews: 5 }
        });
        expect(result.plans[0]).not.toHaveProperty('billingOptions');
        expect(result.plans[0]).not.toHaveProperty('planVersionId');
    });

    it('(g) ignores a floor outside the tourist vertical', async () => {
        mockCatalog('accommodation', [catalogPlan({ slug: 'host-standard' })], floorPlan());
        const result = await fetchPublicPlans({ vertical: 'accommodation' });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected catalog success');
        expect(result.plans.map((plan) => plan.slug)).toEqual(['host-standard']);
    });

    it('(h) does not invent a tourist floor when the catalog returns null', async () => {
        mockCatalog('tourist', [catalogPlan()], null);
        const result = await fetchPublicPlans({ vertical: 'tourist' });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected catalog success');
        expect(result.plans.map((plan) => plan.slug)).toEqual(['tourist-vip']);
    });

    it('HOS-1967 the trial line comes from trialOffer, never from the plan own trialDays', async () => {
        // Arrange: the sellable plan carries 30, the vertical offers nothing.
        mockCatalog('tourist', [catalogPlan({ trialDays: 30 })], null, null);

        // Act
        const result = await fetchPublicPlans({ vertical: 'tourist' });

        // Assert
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('Expected catalog success');
        expect(result.plans[0]).toMatchObject({ hasTrial: false, trialDays: 0 });
    });

    it('HOS-1967 an absent trialOffer (older API) promises nothing', async () => {
        mockCatalog('accommodation', [catalogPlan({ trialDays: 30 })], null);
        const result = await fetchPublicPlans({ vertical: 'accommodation' });
        if (!result.ok) throw new Error('Expected catalog success');
        expect(result.plans[0]).toMatchObject({ hasTrial: false, trialDays: 0 });
    });

    it('HOS-1967 changing the trial days in the catalog changes what every card shows', async () => {
        const plans = [catalogPlan(), catalogPlan({ slug: 'second', planId: annualId })];

        mockCatalog('venue', plans, null, { trialDays: 14 });
        const before = await fetchPublicPlans({ vertical: 'venue' });
        mockCatalog('venue', plans, null, { trialDays: 45 });
        const after = await fetchPublicPlans({ vertical: 'venue' });

        if (!before.ok || !after.ok) throw new Error('Expected catalog success');
        expect(before.plans.map((plan) => [plan.hasTrial, plan.trialDays])).toEqual([
            [true, 14],
            [true, 14]
        ]);
        expect(after.plans.map((plan) => [plan.hasTrial, plan.trialDays])).toEqual([
            [true, 45],
            [true, 45]
        ]);
    });

    it('HOS-1967 rejects a malformed trialOffer instead of guessing', async () => {
        mockCatalog('venue', [catalogPlan()], null, { trialDays: 0 });
        expect((await fetchPublicPlans({ vertical: 'venue' })).ok).toBe(false);
    });
});
