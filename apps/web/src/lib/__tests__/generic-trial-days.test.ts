/**
 * @file generic-trial-days.test.ts
 * @description Tests for the generic owner trial length resolver (H-98).
 *
 * `computeGenericOwnerTrialDays` is exercised directly against fabricated
 * plan lists (pure logic, no fetch). `resolveGenericOwnerTrialDays` is
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
