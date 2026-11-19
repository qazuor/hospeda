import { describe, expect, it } from 'vitest';
import { formatPromotionBenefit } from '../../../src/lib/promotions/format-benefit';

describe('formatPromotionBenefit', () => {
    it('formats percentage, fixed and free-night benefits in each locale', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            expect(
                formatPromotionBenefit({ discountType: 'percentage', discountValue: 20, locale })
            ).toContain('20%');
            expect(
                formatPromotionBenefit({ discountType: 'fixed', discountValue: 100, locale })
            ).not.toBe('');
            expect(
                formatPromotionBenefit({ discountType: 'free_night', discountValue: null, locale })
            ).not.toBe('');
        }
    });

    it('returns the special-offer text without a number', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const value = formatPromotionBenefit({
                discountType: 'special_offer',
                discountValue: null,
                locale,
                specialOfferText: '2x1 en tragos'
            });
            expect(value).toBe('2x1 en tragos');
        }
    });
});
