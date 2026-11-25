/**
 * HOS-2589 §7.6 / AC-1: X and the VIP plan name come from the catalog.
 */
import { describe, expect, it } from 'vitest';
import type { FetchPlansResult, PublicPlanData } from '../../../src/lib/billing/fetch-plans';
import { readPromotionPolicy } from '../../../src/lib/promotions/promotion-policy';

function plan(overrides: Partial<PublicPlanData>): PublicPlanData {
    return {
        id: 'p',
        vertical: 'tourist',
        slug: 'x',
        name: 'X',
        description: '',
        category: 'tourist',
        monthlyPriceArs: 0,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        sortOrder: 0,
        isActive: true,
        inheritsTouristVip: false,
        entitlements: [],
        limits: {},
        ...overrides
    };
}

describe('readPromotionPolicy', () => {
    it('reads X from the floor card and the VIP plan name from the entitlement', () => {
        const result: FetchPlansResult = {
            ok: true,
            plans: [
                plan({ slug: 'tourist-free', limits: { max_free_visible_promotions: 5 } }),
                plan({
                    slug: 'tourist-vip',
                    name: 'Viajero VIP',
                    entitlements: ['vip_promotions_access']
                })
            ]
        };
        expect(readPromotionPolicy({ result })).toEqual({
            freeQuota: 5,
            vipPlanName: 'Viajero VIP'
        });
    });

    it('returns nulls when the catalog is unreadable or lacks the values', () => {
        expect(readPromotionPolicy({ result: { ok: false, error: 'x' } })).toEqual({
            freeQuota: null,
            vipPlanName: null
        });
        expect(readPromotionPolicy({ result: { ok: true, plans: [plan({})] } })).toEqual({
            freeQuota: null,
            vipPlanName: null
        });
    });
});
