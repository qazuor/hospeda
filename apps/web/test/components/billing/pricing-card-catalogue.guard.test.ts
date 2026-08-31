/**
 * @file pricing-card-catalogue.guard.test.ts
 * @description Two guards over what the pricing grid is FED and what it SAYS
 * (HOS-943 AC-12, AC-13, AC-15, AC-16, AC-17).
 *
 * Both cover things that are invisible at the call site. The pricing pages read
 * `filterPlansByCategory(plans, 'owner' | 'tourist')` and pass the result
 * straight to the grid — nothing there mentions `isActive`, and nothing there
 * mentions the complex tier, yet both exclusions are load-bearing: the public
 * endpoint returns the whole catalogue, complex plans and the internal
 * `owner-test-daily` plan included. And the "recommended for" copy is resolved
 * by a template-literal key, which no static i18n guard in this repo can see.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_PLANS, LimitKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { filterPlansByCategory } from '@/lib/billing/fetch-plans';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

const LOCALES_DIR = resolve(__dirname, '../../../../../packages/i18n/src/locales');

function readLocaleJson(locale: Locale, file: string): Record<string, unknown> {
    return JSON.parse(readFileSync(resolve(LOCALES_DIR, locale, file), 'utf8'));
}

/** Resolve a dot path against a nested locale object. */
function at(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, part) => {
        if (current && typeof current === 'object' && !Array.isArray(current)) {
            return (current as Record<string, unknown>)[part];
        }
        return undefined;
    }, obj);
}

/** Minimal `PublicPlanData` fixture. */
function apiPlan(input: Partial<PublicPlanData> & Pick<PublicPlanData, 'slug'>): PublicPlanData {
    return {
        id: `id-${input.slug}`,
        slug: input.slug,
        name: input.slug,
        description: '',
        category: 'owner',
        monthlyPriceArs: 1000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 1,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 1,
        isActive: true,
        entitlements: [],
        limits: {},
        createdAt: '',
        updatedAt: '',
        ...input
    };
}

describe('what reaches the pricing grid', () => {
    it('drops INACTIVE plans, which is what keeps owner-test-daily off the page', () => {
        // `owner-test-daily` is a real row with `category: 'owner'` — nothing
        // about its category excludes it. Only `isActive` does, and the pricing
        // page never mentions `isActive`, so this property is invisible where
        // it is relied upon.
        const plans = [
            apiPlan({ slug: 'owner-basico', sortOrder: 1 }),
            apiPlan({ slug: 'owner-test-daily', sortOrder: 99, isActive: false })
        ];

        expect(filterPlansByCategory(plans, 'owner').map((p) => p.slug)).toEqual(['owner-basico']);
    });

    it('drops the complex tier from the owner grid', () => {
        // The complex plans are `category: 'complex'` AND inactive; either
        // alone excludes them. Asserted so a future change to one of the two
        // does not silently surface them on the owner pricing page.
        const plans = [
            apiPlan({ slug: 'owner-basico', category: 'owner', sortOrder: 1 }),
            apiPlan({ slug: 'complex-basico', category: 'complex', isActive: false, sortOrder: 2 }),
            apiPlan({ slug: 'complex-pro', category: 'complex', isActive: true, sortOrder: 3 })
        ];

        const owner = filterPlansByCategory(plans, 'owner');

        expect(owner.map((p) => p.slug)).toEqual(['owner-basico']);
        expect(owner.some((p) => p.slug.startsWith('complex-'))).toBe(false);
    });

    it('returns tiers ordered by sortOrder, which is what makes the delta cumulative', () => {
        // The delta diffs each card against `plans[i - 1]`. If the list were
        // not sorted, "everything in <previous>" would name an arbitrary tier.
        const plans = [
            apiPlan({ slug: 'c', sortOrder: 3 }),
            apiPlan({ slug: 'a', sortOrder: 1 }),
            apiPlan({ slug: 'b', sortOrder: 2 })
        ];

        expect(filterPlansByCategory(plans, 'owner').map((p) => p.slug)).toEqual(['a', 'b', 'c']);
    });

    it('degrades to a one-card and a zero-card grid rather than throwing', () => {
        // AC-14 / AC-17: deactivating tiers is a live operation, and both a
        // single-tier and an empty audience must be representable.
        expect(filterPlansByCategory([apiPlan({ slug: 'only' })], 'owner')).toHaveLength(1);
        expect(filterPlansByCategory([], 'owner')).toHaveLength(0);
    });
});

describe('plan-card copy (AC-12, AC-13, AC-15, AC-16)', () => {
    const ownerAndTouristSlugs = ALL_PLANS.filter(
        (plan) => plan.category === 'owner' || plan.category === 'tourist'
    ).map((plan) => plan.slug);

    it('covers every owner and tourist plan with a "recommended for" profile', () => {
        // AC-12: no card without a profile. The key is resolved from a template
        // literal (`pricing.recommendedFor.plan.${slug}`), which the repo's
        // i18n key-coverage guard cannot see — so it is asserted here.
        expect(ownerAndTouristSlugs.length).toBeGreaterThan(0);

        for (const locale of LOCALES) {
            const pricing = readLocaleJson(locale, 'pricing.json');
            for (const slug of ownerAndTouristSlugs) {
                const value = at(pricing, `recommendedFor.plan.${slug}`);
                expect(typeof value, `${locale} / ${slug}`).toBe('string');
                expect((value as string).length, `${locale} / ${slug}`).toBeGreaterThan(0);
            }
        }
    });

    it('provides a generic profile per audience, so an uncurated slug still gets one', () => {
        for (const locale of LOCALES) {
            const pricing = readLocaleJson(locale, 'pricing.json');
            for (const audience of ['owner', 'tourist']) {
                const value = at(pricing, `recommendedFor.default.${audience}`);
                expect(typeof value, `${locale} / ${audience}`).toBe('string');
                expect((value as string).length).toBeGreaterThan(0);
            }
        }
    });

    it('explains every limit key in the catalogue, in all three locales', () => {
        // AC-13. Keyed off the LimitKey enum, so a new limit fails here rather
        // than degrading to an English catalogue description on a Spanish page.
        const keys = Object.values(LimitKey);
        expect(keys.length).toBeGreaterThan(0);

        for (const locale of LOCALES) {
            const billing = readLocaleJson(locale, 'billing.json');
            for (const key of keys) {
                const value = at(billing, `limitHelp.${key}`);
                expect(typeof value, `${locale} / ${key}`).toBe('string');
                expect((value as string).length, `${locale} / ${key}`).toBeGreaterThan(20);
            }
        }
    });

    it('gives every limit a label as well as an explanation', () => {
        for (const locale of LOCALES) {
            const billing = readLocaleJson(locale, 'billing.json');
            for (const key of Object.values(LimitKey)) {
                expect(typeof at(billing, `comparison.limitLabel.${key}`), `${locale}/${key}`).toBe(
                    'string'
                );
            }
        }
    });

    it('never promises a card-free trial in the new plan-card copy (AC-15)', () => {
        // Card-first (HOS-171): the card is collected on day 1. This sweeps the
        // whole `recommendedFor` subtree plus every limit explanation, not an
        // enumerated key list, so copy added later is covered without an edit.
        const banned = ['sin tarjeta', 'no credit card', 'sem cartão', 'sem cartao'];

        for (const text of collectNewCopy()) {
            const lowered = text.toLowerCase();
            for (const phrase of banned) {
                expect(lowered, `"${text}"`).not.toContain(phrase);
            }
        }
    });

    it('hardcodes no trial day count in the new plan-card copy (AC-16)', () => {
        // The number must come from `plan.trialDays`; a copy string carrying it
        // goes stale the moment the catalogue changes and cannot be caught by
        // reading the catalogue.
        const literalDays = [
            /\b\d+[\s-]*(d[ií]as?|dias?|days?)\b/i,
            /\b(d[ií]as?|days?)[\s-]*\d+\b/i
        ];

        for (const text of collectNewCopy()) {
            for (const pattern of literalDays) {
                expect(text, `"${text}"`).not.toMatch(pattern);
            }
        }
    });
});

/**
 * Every string HOS-943 added: the whole `pricing.recommendedFor` subtree and
 * every `billing.limitHelp` value, across all three locales.
 *
 * Swept rather than enumerated so a profile or explanation added later is held
 * to the same rules without anyone remembering to list it.
 */
function collectNewCopy(): readonly string[] {
    const out: string[] = [];
    const walk = (value: unknown): void => {
        if (typeof value === 'string') {
            out.push(value);
            return;
        }
        if (typeof value !== 'object' || value === null) return;
        for (const nested of Object.values(value as Record<string, unknown>)) walk(nested);
    };
    for (const locale of LOCALES) {
        walk(at(readLocaleJson(locale, 'pricing.json'), 'recommendedFor'));
        walk(at(readLocaleJson(locale, 'billing.json'), 'limitHelp'));
    }
    // A sweep over an empty tree passes vacuously; assert it found something.
    if (out.length === 0) throw new Error('collectNewCopy found no strings — the sweep is blind');
    return out;
}
