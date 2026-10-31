/**
 * @file pricing-card-audience-label.test.ts
 * @description HOS-1799. `ai_chat` means two different things: the visitor's chat
 * about a stay (tourist) and the chat on the owner's own listing (venue,
 * experience). The label must follow the audience, and a cap of 0 must not be
 * advertised as a benefit.
 */

import { describe, expect, it } from 'vitest';
import type { PricingPlan } from '@/components/billing/pricing-card-view';
import { buildPricingCardViews } from '@/components/billing/pricing-card-view';
import type { PricingAudience } from '@/lib/billing-i18n';
import { getDisplayFeatures } from '@/lib/billing-i18n';
import type { TranslationFn } from '@/lib/i18n';

const DICT: Record<string, string> = {
    'billing.entitlement.ai_chat': 'GENERIC_CHAT',
    'billing.entitlementByAudience.venue.ai_chat': 'VENUE_CHAT',
    'billing.entitlementByAudience.experience.ai_chat': 'EXPERIENCE_CHAT'
};
const t: TranslationFn = (key, fallback) => DICT[key] ?? fallback ?? '';

function labelFor(audience: PricingAudience): string | undefined {
    return getDisplayFeatures({ keys: ['ai_chat'], audience, t })[0]?.label;
}

function plan(input: Partial<PricingPlan> & Pick<PricingPlan, 'slug'>): PricingPlan {
    return {
        name: input.slug,
        description: '',
        monthlyPriceArs: 1000,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        sortOrder: 1,
        isActive: true,
        inheritsTouristVip: false,
        entitlements: [],
        limits: {},
        ...input
    };
}

describe('getDisplayFeatures - ai_chat label by audience', () => {
    it('keeps the generic label for tourists', () => {
        expect(labelFor('tourist')).toBe('GENERIC_CHAT');
    });

    it('uses the venue label for gastronomy', () => {
        expect(labelFor('venue')).toBe('VENUE_CHAT');
    });

    it('uses the experience label for experiences', () => {
        expect(labelFor('experience')).toBe('EXPERIENCE_CHAT');
    });

    it('falls back to the generic label when an audience has no override', () => {
        expect(labelFor('partner')).toBe('GENERIC_CHAT');
    });
});

describe('buildPricingCardViews - zero limits', () => {
    function lineIds(limits: Record<string, number>): string[] {
        const { cards } = buildPricingCardViews({
            plans: [plan({ slug: 'venue-basic', limits })],
            audience: 'venue',
            intlLocale: 'es-AR',
            t,
            touristVipBenefits: null
        });
        return [...cards[0]!.visibleItems, ...cards[0]!.hiddenItems].map((i) => i.id);
    }

    it('does not list a limit whose value is 0', () => {
        expect(lineIds({ max_ai_chat_venue_per_month: 0, max_venues: 1 })).toEqual(['max_venues']);
    });

    it('still lists a positive limit', () => {
        expect(lineIds({ max_ai_chat_venue_per_month: 1250 })).toEqual([
            'max_ai_chat_venue_per_month'
        ]);
    });
});
