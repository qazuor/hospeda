/**
 * Tests for `addon-checkout-locale.ts` (HOS-606).
 *
 * - Unit coverage for `resolveAddonCheckoutName` / `resolveAddonCheckoutDescription`:
 *   translation hit, locale switching, default-locale fallback, and the
 *   no-translation-exists fallback to the raw config string.
 * - A guard over the REAL `@repo/billing` addon catalog (`ALL_ADDONS`) asserting,
 *   for every addon and every locale: (1) `account.addons.catalog.<slug>.name`
 *   actually EXISTS in `@repo/i18n`'s translation table (not merely that
 *   `resolveAddonCheckoutName` returns *something* — that would also pass via
 *   the English fallback, which is exactly the HOS-606 regression re-entering
 *   unnoticed), and (2) the resolved name stays within MercadoPago's known
 *   60-character field budget (the same limit that already broke promo-code
 *   checkout once — see engram `project_mp_reason_60_chars_breaks_discount_checkout`
 *   — so a longer Spanish/Portuguese translation cannot silently regress it again).
 *
 * @module test/services/addon-checkout-locale.test
 */

import { ALL_ADDONS } from '@repo/billing';
import { trans } from '@repo/i18n';
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
// HOS-606 guard: for every REAL addon and every locale, the translation key
// must actually exist (not just "resolveAddonCheckoutName returned a
// string" — that also holds for the English fallback, which is the bug
// itself, silently un-caught), AND the resolved name must respect
// MercadoPago's checkout field budget. Both assertions are load-bearing:
// dropping the first would let an untranslated addon pass this guard via its
// own English fallback, exactly how HOS-606 shipped unnoticed the first time.
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

describe('HOS-606 guard — every real addon has a translated name in every locale, within the MP char budget', () => {
    const locales = ['es', 'en', 'pt'] as const;

    for (const addon of ALL_ADDONS) {
        for (const locale of locales) {
            it(`${addon.slug} (${locale}): has a real translation key, and its resolved name stays <= ${MP_CHECKOUT_TITLE_CHAR_BUDGET} chars`, () => {
                // Check the RAW translation table directly, not the resolved
                // value — resolveAddonCheckoutName degrading to the English
                // fallback would still return a defined, non-empty string,
                // so only a direct lookup against `trans` can tell "has a
                // translation" apart from "silently fell back".
                const rawKey = `account.addons.catalog.${addon.slug}.name`;
                expect(trans[locale]?.[rawKey]).toBeDefined();

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
