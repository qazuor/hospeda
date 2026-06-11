/**
 * @file pricing-labels.test.ts
 * @description Tests for the i18n labels used in PricingSidebar fee/discount breakdown rows.
 *
 * PricingSidebar uses `t('accommodations.detail.pricing.fees.<key>', rawKey)` and
 * `t('accommodations.detail.pricing.discounts.<key>', rawKey)` to render translated
 * labels for each fee / discount row. This test verifies that all expected keys
 * resolve to non-empty, non-fallback translations in each supported locale.
 */

import { describe, expect, it } from 'vitest';
import { createT } from '../../src/lib/i18n';

/** Fee keys defined by AdditionalFeesSchema (excluding `others` — rendered via customName). */
const FEE_KEYS = [
    'cleaning',
    'tax',
    'lateCheckout',
    'pets',
    'bedlinen',
    'towels',
    'babyCrib',
    'babyHighChair',
    'extraBed',
    'securityDeposit',
    'extraGuest',
    'parking',
    'earlyCheckin',
    'lateCheckin',
    'luggageStorage',
    'others'
] as const;

/** Discount keys defined by DiscountsSchema (excluding `others` — rendered via customName). */
const DISCOUNT_KEYS = ['weekly', 'monthly', 'lastMinute', 'others'] as const;

const LOCALES = ['es', 'en', 'pt'] as const;

/**
 * Resolve a fee label through the same i18n path that PricingSidebar uses.
 * Falls back to the raw key when the translation is missing — same as the component.
 */
function resolveFeeLabel({ locale, key }: { locale: string; key: string }): string {
    const t = createT(locale as 'es' | 'en' | 'pt');
    return t(`accommodations.detail.pricing.fees.${key}`, key);
}

/**
 * Resolve a discount label through the same i18n path that PricingSidebar uses.
 * Falls back to the raw key when the translation is missing — same as the component.
 */
function resolveDiscountLabel({ locale, key }: { locale: string; key: string }): string {
    const t = createT(locale as 'es' | 'en' | 'pt');
    return t(`accommodations.detail.pricing.discounts.${key}`, key);
}

describe('PricingSidebar fee labels', () => {
    for (const locale of LOCALES) {
        describe(`locale: ${locale}`, () => {
            it.each(FEE_KEYS)(
                'resolves fee key "%s" to a translated string (not the raw key)',
                (key) => {
                    const label = resolveFeeLabel({ locale, key });
                    expect(label).toBeTruthy();
                    // The translated label should NOT equal the raw camelCase key —
                    // that would indicate a missing translation fell back to the key.
                    expect(label).not.toBe(key);
                    // Must not contain the [MISSING:] sentinel from createT.
                    expect(label).not.toMatch(/^\[MISSING:/);
                }
            );
        });
    }
});

describe('PricingSidebar discount labels', () => {
    for (const locale of LOCALES) {
        describe(`locale: ${locale}`, () => {
            it.each(DISCOUNT_KEYS)(
                'resolves discount key "%s" to a translated string (not the raw key)',
                (key) => {
                    const label = resolveDiscountLabel({ locale, key });
                    expect(label).toBeTruthy();
                    expect(label).not.toBe(key);
                    expect(label).not.toMatch(/^\[MISSING:/);
                }
            );
        });
    }
});

describe('resolveFeeLabel spot-checks', () => {
    it('returns Spanish translation for cleaning', () => {
        expect(resolveFeeLabel({ locale: 'es', key: 'cleaning' })).toBe('Limpieza');
    });

    it('returns English translation for cleaning', () => {
        expect(resolveFeeLabel({ locale: 'en', key: 'cleaning' })).toBe('Cleaning');
    });

    it('returns Portuguese translation for cleaning', () => {
        expect(resolveFeeLabel({ locale: 'pt', key: 'cleaning' })).toBe('Limpeza');
    });
});

describe('resolveDiscountLabel spot-checks', () => {
    it('returns Spanish translation for weekly', () => {
        expect(resolveDiscountLabel({ locale: 'es', key: 'weekly' })).toBe('Descuento semanal');
    });

    it('returns English translation for lastMinute', () => {
        expect(resolveDiscountLabel({ locale: 'en', key: 'lastMinute' })).toBe('Last minute');
    });

    it('returns Portuguese translation for monthly', () => {
        expect(resolveDiscountLabel({ locale: 'pt', key: 'monthly' })).toBe('Desconto mensal');
    });
});
