/**
 * @file pricing-page-copy.guard.test.ts
 * @description Every i18n key the five pricing pages resolve THROUGH A TEMPLATE
 * LITERAL exists, in all three locales (HOS-1032).
 *
 * ## The hole this fills
 *
 * `scripts/check-i18n-key-coverage.ts` is the repo's key guard, and it scans for
 * LITERAL key references — `t('pricing.owner.heading')`. The pricing pages do
 * not write their keys that way: they resolve a `copyRoot` per audience and read
 * `t(`${copyRoot}.heading`)`, which is what lets five pages share one sections
 * component instead of five near-copies. The scanner cannot follow that, so it
 * reported "every referenced key resolves" over a set that did not include a
 * single one of these.
 *
 * That is not a defect in the scanner — a static scan cannot resolve a runtime
 * template — but it does mean these keys are unguarded by it, and unguarded is
 * how `pricing.gastronomy.pageTitle` ends up present in `es` and missing in
 * `pt`. A missing key does not throw: `t()` returns the key itself, so the page
 * renders `pricing.gastronomy.pageTitle` as its `<title>` and its `<h1>`, and
 * nothing fails until somebody opens the Portuguese page.
 *
 * ## Why it asserts the SHAPE and not the strings
 *
 * It checks that every audience carries every key, in every locale, and that
 * none is empty. It does not check what any of them say — that is a content
 * review, and freezing the copy here would mean this file needs editing every
 * time a word changes, which is how a guard becomes something people delete.
 */

import { describe, expect, it } from 'vitest';
import enPricing from '../../../../../packages/i18n/src/locales/en/pricing.json';
import esPricing from '../../../../../packages/i18n/src/locales/es/pricing.json';
import ptPricing from '../../../../../packages/i18n/src/locales/pt/pricing.json';

/**
 * The five `copyRoot` values, spelled as the audience segment under `pricing.`.
 * Mirrors `COPY_ROOT_BY_AUDIENCE` in `lib/billing/pricing-page-content.ts`.
 */
const AUDIENCE_SEGMENTS = ['owner', 'tourist', 'gastronomy', 'experience', 'partner'] as const;

/**
 * Every key the pages and `AudiencePricingSections` read off `${copyRoot}.`.
 *
 * Kept as one list rather than derived from the source, deliberately: a guard
 * that reads its expectations out of the thing it guards passes whatever that
 * thing happens to do. Adding a `${copyRoot}.` read without adding it here is
 * the case this cannot catch, and it is the trade for the guard being able to
 * fail at all.
 */
const REQUIRED_AUDIENCE_KEYS = [
    'pageTitle',
    'pageDescription',
    'tagline',
    'heading',
    'subtitle',
    'cardsHeading',
    'empty',
    'ctaLabel'
] as const;

/** Keys the billing FAQ reads directly, shared by all five audiences. */
const REQUIRED_BILLING_FAQ_KEYS = [
    'tagline',
    'title',
    'trialQ',
    'trialA_one',
    'trialA_other',
    'trialANone',
    'cancelQ',
    'cancelA',
    'changeQ',
    'changeA',
    'methodQ',
    'methodA',
    'invoiceQ',
    'invoiceA',
    'partnerPriceQ',
    'partnerPriceA'
] as const;

const LOCALES = {
    es: esPricing as Record<string, unknown>,
    en: enPricing as Record<string, unknown>,
    pt: ptPricing as Record<string, unknown>
};

describe.each(Object.entries(LOCALES))('pricing.json (%s)', (_locale, pricing) => {
    it.each(AUDIENCE_SEGMENTS)('%s carries every key the pages read', (segment) => {
        const node = pricing[segment] as Record<string, unknown> | undefined;
        expect(node, `pricing.${segment} is missing entirely`).toBeDefined();

        for (const key of REQUIRED_AUDIENCE_KEYS) {
            const value = node?.[key];
            expect(typeof value, `pricing.${segment}.${key} is not a string`).toBe('string');
            expect(
                (value as string).trim().length,
                `pricing.${segment}.${key} is empty`
            ).toBeGreaterThan(0);
        }
    });

    it('carries every billing-FAQ key', () => {
        const faq = pricing.billingFaq as Record<string, unknown> | undefined;
        expect(faq, 'pricing.billingFaq is missing entirely').toBeDefined();

        for (const key of REQUIRED_BILLING_FAQ_KEYS) {
            const value = faq?.[key];
            expect(typeof value, `pricing.billingFaq.${key} is not a string`).toBe('string');
        }
    });

    it('carries a "Consultar" label and the inline comparison heading', () => {
        // Both are read by `PricingCardsGrid` / `AudiencePricingSections` with no
        // fallback argument, which is what `check:i18n-key-coverage` requires —
        // a hardcoded fallback is served verbatim under /en and /pt.
        expect(typeof pricing.consultPrice).toBe('string');
        expect(
            typeof (pricing.comparison as Record<string, unknown> | undefined)?.sectionTitle
        ).toBe('string');
    });

    it('gives every audience a "recommended for" default', () => {
        // `getPlanRecommendedFor` falls back to
        // `pricing.recommendedFor.default.<audience>` for any plan slug without
        // its own line. A missing default renders the KEY on the card, in the
        // most-read line of the most conversion-critical page.
        const defaults = (pricing.recommendedFor as Record<string, unknown>).default as Record<
            string,
            unknown
        >;
        for (const segment of AUDIENCE_SEGMENTS) {
            expect(typeof defaults[segment], `recommendedFor.default.${segment}`).toBe('string');
        }
    });
});

describe('locale parity', () => {
    it('gives the three locales the same audience key sets', () => {
        // The comparison that actually catches a half-done translation: `es`
        // gaining a key that `pt` never got renders the KEY on the Portuguese
        // page, silently.
        for (const segment of AUDIENCE_SEGMENTS) {
            const es = Object.keys((esPricing as Record<string, object>)[segment]).sort();
            const en = Object.keys((enPricing as Record<string, object>)[segment]).sort();
            const pt = Object.keys((ptPricing as Record<string, object>)[segment]).sort();
            expect(en, `en/pricing.${segment} differs from es`).toEqual(es);
            expect(pt, `pt/pricing.${segment} differs from es`).toEqual(es);
        }
    });
});
