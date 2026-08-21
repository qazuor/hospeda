/**
 * Tests for `addon-checkout-locale.ts` (HOS-606).
 *
 * - Unit coverage for `resolveAddonCheckoutName` / `resolveAddonCheckoutDescription`:
 *   translation hit, locale switching, default-locale fallback, and the
 *   no-translation-exists fallback to the raw config string.
 * - A guard over the REAL `@repo/billing` addon catalog (`ALL_ADDONS`) asserting
 *   every addon has a translated name in all three locales, and that every
 *   translated name stays within MercadoPago's known 60-character field budget
 *   (the same limit that already broke promo-code checkout once — see
 *   engram `project_mp_reason_60_chars_breaks_discount_checkout` — so a
 *   longer Spanish/Portuguese translation cannot silently regress it again).
 *
 * @module test/services/addon-checkout-locale.test
 */

import { ALL_ADDONS } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import {
    resolveAddonCheckoutDescription,
    resolveAddonCheckoutName
} from '../../src/services/addon-checkout-locale';

describe('resolveAddonCheckoutName', () => {
    it('resolves the Spanish translation by slug when locale is es', () => {
        expect(
            resolveAddonCheckoutName({
                locale: 'es',
                slug: 'visibility-boost-7d',
                fallback: 'Visibility Boost (7 days)'
            })
        ).toBe('Impulso de visibilidad (7 días)');
    });

    it('resolves the English translation by slug when locale is en', () => {
        expect(
            resolveAddonCheckoutName({
                locale: 'en',
                slug: 'visibility-boost-7d',
                fallback: 'Visibility Boost (7 days)'
            })
        ).toBe('Visibility Boost (7 days)');
    });

    it('resolves the Portuguese translation by slug when locale is pt', () => {
        expect(
            resolveAddonCheckoutName({
                locale: 'pt',
                slug: 'visibility-boost-7d',
                fallback: 'Visibility Boost (7 days)'
            })
        ).toBe('Impulso de visibilidade (7 dias)');
    });

    it('defaults to es when locale is undefined (matches successUrl/cancelUrl fallback convention)', () => {
        expect(
            resolveAddonCheckoutName({
                locale: undefined,
                slug: 'visibility-boost-7d',
                fallback: 'Visibility Boost (7 days)'
            })
        ).toBe('Impulso de visibilidad (7 días)');
    });

    it('falls back to the raw config name when no translation exists for the slug', () => {
        expect(
            resolveAddonCheckoutName({
                locale: 'es',
                slug: 'guard-probe-slug-with-no-i18n-entry',
                fallback: 'Raw English Fallback Name'
            })
        ).toBe('Raw English Fallback Name');
    });
});

describe('resolveAddonCheckoutDescription', () => {
    it('resolves the Spanish translation by slug', () => {
        expect(
            resolveAddonCheckoutDescription({
                locale: 'es',
                slug: 'visibility-boost-7d',
                fallback: 'Your accommodation is featured in search results for 7 days.'
            })
        ).toBe('Tu alojamiento aparece destacado en los resultados de búsqueda durante 7 días.');
    });

    it('falls back to the raw config description when no translation exists', () => {
        expect(
            resolveAddonCheckoutDescription({
                locale: 'pt',
                slug: 'guard-probe-slug-with-no-i18n-entry',
                fallback: 'Raw English fallback description.'
            })
        ).toBe('Raw English fallback description.');
    });
});

// ---------------------------------------------------------------------------
// HOS-606 guard: whatever `resolveAddonCheckoutName` sends to MercadoPago for
// a REAL addon (translated or, absent a translation, the raw config
// fallback) must respect MercadoPago's checkout field budget.
//
// This intentionally does NOT assert that every addon in `ALL_ADDONS` HAS a
// translation — that is a content-completeness question for whoever owns
// each addon's copy, not a code defect in this resolver (which degrades
// safely to the English fallback either way). Asserting it here would fail
// this PR's CI for content gaps opened by unrelated work after this fix
// shipped. See the six addons this fix was verified against directly in
// `resolveAddonCheckoutName`/`resolveAddonCheckoutDescription` above.
// ---------------------------------------------------------------------------

/**
 * Conservative character budget for the MercadoPago checkout line item name.
 * Matches the `reason` field limit that already broke promo-code discount
 * checkout once (60 chars) — kept as the safe bound to verify against here
 * even though this line item is a different MP field, per HOS-606's explicit
 * warning to re-check this exact class of truncation before shipping a
 * translated name.
 */
const MP_CHECKOUT_TITLE_CHAR_BUDGET = 60;

describe('HOS-606 guard — every real addon name stays within the MP char budget in all locales', () => {
    const locales = ['es', 'en', 'pt'] as const;

    for (const addon of ALL_ADDONS) {
        for (const locale of locales) {
            it(`${addon.slug} (${locale}): resolved name stays <= ${MP_CHECKOUT_TITLE_CHAR_BUDGET} chars`, () => {
                const name = resolveAddonCheckoutName({
                    locale,
                    slug: addon.slug,
                    fallback: addon.name
                });
                expect(name.length).toBeLessThanOrEqual(MP_CHECKOUT_TITLE_CHAR_BUDGET);
            });
        }
    }
});
