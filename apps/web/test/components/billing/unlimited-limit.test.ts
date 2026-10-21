import { LimitKeyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { PlanDeltaSource } from '@/components/billing/plan-card-delta';
import { computePlanDelta } from '@/components/billing/plan-card-delta';
import { resolveCell } from '@/components/billing/plan-comparison-rows';
import type { PricingPlan } from '@/components/billing/pricing-card-view';
import { buildPricingCardViews } from '@/components/billing/pricing-card-view';
import type { TranslationFn } from '@/lib/i18n';

// Coord-41 chose int4 max; literal comes from 0144_production_plan_catalog.sql:321.
const CATALOG_UNLIMITED = 2147483647;
const t: TranslationFn = (_key, fallback) => fallback ?? '';

function pricingPlan(input: Partial<PricingPlan> & Pick<PricingPlan, 'slug'>): PricingPlan {
    return {
        name: input.slug,
        description: '',
        monthlyPriceArs: 1000,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        sortOrder: 1,
        isActive: true,
        entitlements: [],
        limits: {},
        ...input
    };
}

function deltaPlan(slug: string, value: number): PlanDeltaSource {
    return { slug, entitlements: [], limits: { max_active_promotions: value } };
}

describe('HOS-1719 unlimited limit', () => {
    it('TEST:1719:1 builds the localized unlimited label on pricing cards', () => {
        const { cards } = buildPricingCardViews({
            plans: [
                pricingPlan({ slug: 'tourist-vip', limits: { max_favorites: CATALOG_UNLIMITED } })
            ],
            audience: 'tourist',
            intlLocale: 'es-AR',
            t
        });
        const card = cards[0];
        const limitText = [...(card?.visibleItems ?? []), ...(card?.hiddenItems ?? [])]
            .filter((item) => item.kind === 'limit')
            .map((item) => item.text)
            .join(' ');

        expect(limitText).toContain('Ilimitado');
        expect(limitText).not.toMatch(/2\.147\.483\.647|2147483647/);
        const finiteCard = buildPricingCardViews({
            plans: [pricingPlan({ slug: 'tourist-plus', limits: { max_favorites: 5 } })],
            audience: 'tourist',
            intlLocale: 'es-AR',
            t
        }).cards[0];
        const finiteText = [...(finiteCard?.visibleItems ?? []), ...(finiteCard?.hiddenItems ?? [])]
            .filter((item) => item.kind === 'limit')
            .map((item) => item.text)
            .join(' ');
        expect(finiteText).toContain('5');
    });

    it('TEST:1719:2 resolves the real sentinel as unlimited and finite or absent values normally', () => {
        const cell = { kind: 'limit' as const, key: LimitKeyEnum.MAX_FAVORITES };
        const plan = (limits: Record<string, number>) => ({
            slug: 'tourist-vip',
            limits,
            entitlements: []
        });

        expect(resolveCell({ cell, plan: plan({ max_favorites: CATALOG_UNLIMITED }) })).toBe(
            'unlimited'
        );
        expect(resolveCell({ cell, plan: plan({ max_favorites: 5 }) })).toBe(5);
        expect(resolveCell({ cell, plan: plan({ max_favorites: 25 }) })).toBe(25);
        expect(resolveCell({ cell, plan: plan({}) })).toBe('no');
    });

    it('TEST:1719:3 ranks sentinel transitions and values above the sentinel correctly', () => {
        const finiteToUnlimited = computePlanDelta({
            plan: deltaPlan('owner-premium', CATALOG_UNLIMITED),
            previous: deltaPlan('owner-pro', 5)
        });
        expect(finiteToUnlimited.limitChanges).toMatchObject([
            { value: CATALOG_UNLIMITED, kind: 'raised', isUnlimited: true }
        ]);

        expect(
            computePlanDelta({
                plan: deltaPlan('b', CATALOG_UNLIMITED),
                previous: deltaPlan('a', CATALOG_UNLIMITED)
            }).limitChanges
        ).toEqual([]);
        expect(
            computePlanDelta({
                plan: deltaPlan('b', 25),
                previous: deltaPlan('a', CATALOG_UNLIMITED)
            }).limitChanges
        ).toEqual([]);
        expect(
            computePlanDelta({
                plan: deltaPlan('b', CATALOG_UNLIMITED + 1),
                previous: deltaPlan('a', 5)
            }).limitChanges
        ).toMatchObject([{ kind: 'raised', isUnlimited: true }]);
    });
});
