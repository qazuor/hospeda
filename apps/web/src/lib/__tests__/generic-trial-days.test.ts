/**
 * @file generic-trial-days.test.ts
 * @description Tests for the generic owner trial length resolver (H-98) and the
 * audience-agnostic core it was generalised into for the plan index (HOS-943).
 *
 * `computeMinimumTrialDays` and `computeGenericOwnerTrialDays` are exercised
 * directly against fabricated plan lists (pure logic, no fetch). The per-
 * audience wiring on top of the core lives in
 * `test/lib/billing/audience-plans.test.ts`. `resolveGenericOwnerTrialDays` is
 * exercised with `fetchPublicPlans` mocked, so the fallback-to-constant path
 * (fetch failure, or a fetch that returns no eligible owner plan) is covered
 * without hitting the network.
 */

import { OWNER_TRIAL_DAYS } from '@repo/billing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';

vi.mock('@/lib/billing/fetch-plans', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/billing/fetch-plans')>();
    return {
        ...actual,
        fetchPublicPlans: vi.fn()
    };
});

import { fetchPublicPlans } from '@/lib/billing/fetch-plans';
import {
    computeGenericOwnerTrialDays,
    computeMinimumTrialDays,
    resolveGenericOwnerTrialDays
} from '@/lib/billing/generic-trial-days';

const mockFetchPublicPlans = vi.mocked(fetchPublicPlans);

/** Builds a fully-populated {@link PublicPlanData} fixture with overrides. */
const makePlan = (
    overrides: Partial<PublicPlanData> & { readonly slug: string }
): PublicPlanData => ({
    id: `id-${overrides.slug}`,
    name: overrides.slug,
    description: '',
    category: 'owner',
    monthlyPriceArs: 1000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 1,
    hasTrial: true,
    trialDays: 14,
    isDefault: false,
    sortOrder: 0,
    isActive: true,
    entitlements: [],
    limits: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

afterEach(() => vi.clearAllMocks());

describe('computeMinimumTrialDays', () => {
    // The audience-agnostic core, extracted for HOS-943 so the plan index can
    // resolve tourist / gastronomy / experience / partner through the SAME rule
    // the owner tier has used since H-98 rather than a second copy of it. It
    // takes plans already selected for one audience and knows nothing about
    // categories or domains — the selection is the caller's job.

    it('returns the shortest trial actually on offer', () => {
        const plans = [
            makePlan({ slug: 'a', trialDays: 30 }),
            makePlan({ slug: 'b', trialDays: 45 }),
            makePlan({ slug: 'c', trialDays: 7 })
        ];

        expect(computeMinimumTrialDays({ plans })).toBe(7);
    });

    it('does not let a no-trial plan drag the answer to zero', () => {
        // The tourist shape: a free tier that never expires has no trial, and a
        // paid tier that does. A naive `Math.min` over `trialDays` answers 0 and
        // silently removes the promise from the card.
        const plans = [
            makePlan({ slug: 'tourist-free', hasTrial: false, trialDays: 0 }),
            makePlan({ slug: 'tourist-vip', hasTrial: true, trialDays: 45 })
        ];

        expect(computeMinimumTrialDays({ plans })).toBe(45);
    });

    it('needs BOTH hasTrial and a positive trialDays', () => {
        // Each half fails on its own: a flag with no days, and days with no flag.
        expect(
            computeMinimumTrialDays({
                plans: [makePlan({ slug: 'flag-only', hasTrial: true, trialDays: 0 })]
            })
        ).toBeNull();
        expect(
            computeMinimumTrialDays({
                plans: [makePlan({ slug: 'days-only', hasTrial: false, trialDays: 30 })]
            })
        ).toBeNull();
    });

    it('drops inactive plans, including ones offering a shorter trial', () => {
        const plans = [
            makePlan({ slug: 'retired', isActive: false, trialDays: 1 }),
            makePlan({ slug: 'live', trialDays: 30 })
        ];

        expect(computeMinimumTrialDays({ plans })).toBe(30);
    });

    it('returns null, never 0, when nothing offers a trial', () => {
        // The partner shape. `null` is what tells the caller to render no line;
        // `0` would render "0 días de prueba".
        const plans = [
            makePlan({ slug: 'partner-silver', hasTrial: false, trialDays: 0 }),
            makePlan({ slug: 'partner-gold', hasTrial: false, trialDays: 0 })
        ];
        const result = computeMinimumTrialDays({ plans });

        expect(result).toBeNull();
        expect(result).not.toBe(0);
    });

    it('returns null for an empty list rather than Infinity', () => {
        // `Math.min()` with no arguments is `Infinity`, which would render as a
        // trial line reading "Infinity días".
        expect(computeMinimumTrialDays({ plans: [] })).toBeNull();
    });

    it('does not filter by category — that is the caller’s selection', () => {
        // Deliberate: the plan index selects tourist, gastronomy, experience and
        // partner plans, none of which are the `owner` category this function
        // used to be hardwired to. Narrowing here would make it unusable for
        // four of the five audiences.
        const plans = [makePlan({ slug: 'tourist-vip', category: 'tourist', trialDays: 45 })];

        expect(computeMinimumTrialDays({ plans })).toBe(45);
    });
});

describe('computeGenericOwnerTrialDays', () => {
    it('returns the minimum trialDays among several eligible owner plans', () => {
        const plans = [
            makePlan({ slug: 'owner-basico', trialDays: 14 }),
            makePlan({ slug: 'owner-pro', trialDays: 7 }),
            makePlan({ slug: 'owner-premium', trialDays: 21 })
        ];

        // A generic pre-selection promise can never exceed what the WORST
        // plan actually grants — see the module JSDoc for why min, not max.
        expect(computeGenericOwnerTrialDays({ plans })).toBe(7);
    });

    it('excludes a plan with hasTrial: false from the minimum', () => {
        const plans = [
            // Would win the naive min() if not excluded — hasTrial: false
            // means this plan's trialDays is not a real offer.
            makePlan({ slug: 'owner-no-trial', hasTrial: false, trialDays: 1 }),
            makePlan({ slug: 'owner-pro', trialDays: 10 }),
            makePlan({ slug: 'owner-premium', trialDays: 14 })
        ];

        expect(computeGenericOwnerTrialDays({ plans })).toBe(10);
    });

    it('excludes complex-category and inactive plans from the minimum', () => {
        const plans = [
            // Lower trialDays but wrong category — the generic PROMISE is
            // specifically about the anfitrión (owner) tier.
            makePlan({ slug: 'complex-basico', category: 'complex', trialDays: 1 }),
            // Lower trialDays but inactive — not a real, purchasable offer.
            makePlan({ slug: 'owner-retired', isActive: false, trialDays: 2 }),
            makePlan({ slug: 'owner-pro', trialDays: 10 })
        ];

        expect(computeGenericOwnerTrialDays({ plans })).toBe(10);
    });

    it('returns null for an empty plan list', () => {
        expect(computeGenericOwnerTrialDays({ plans: [] })).toBeNull();
    });

    it('returns null when no owner plan currently qualifies', () => {
        const plans = [
            makePlan({ slug: 'owner-no-trial', hasTrial: false }),
            makePlan({ slug: 'complex-basico', category: 'complex' })
        ];

        expect(computeGenericOwnerTrialDays({ plans })).toBeNull();
    });
});

describe('resolveGenericOwnerTrialDays', () => {
    it('resolves the minimum trialDays from a successful fetch', async () => {
        mockFetchPublicPlans.mockResolvedValueOnce({
            ok: true,
            plans: [
                makePlan({ slug: 'owner-basico', trialDays: 20 }),
                makePlan({ slug: 'owner-pro', trialDays: 5 })
            ]
        });

        await expect(resolveGenericOwnerTrialDays()).resolves.toBe(5);
    });

    it('falls back to OWNER_TRIAL_DAYS when the plan list is empty', async () => {
        mockFetchPublicPlans.mockResolvedValueOnce({ ok: true, plans: [] });

        await expect(resolveGenericOwnerTrialDays()).resolves.toBe(OWNER_TRIAL_DAYS);
    });

    it('falls back to OWNER_TRIAL_DAYS when the fetch fails', async () => {
        mockFetchPublicPlans.mockResolvedValueOnce({
            ok: false,
            error: 'Public plans endpoint returned HTTP 500'
        });

        await expect(resolveGenericOwnerTrialDays()).resolves.toBe(OWNER_TRIAL_DAYS);
    });
});
