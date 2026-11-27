/**
 * @file price-alert-threshold.test.ts
 * @description Pure helper tests for the price-alert threshold maths (HOS-2666, CARD-024).
 */
import { describe, expect, it } from 'vitest';
import {
    parsePercentInput,
    parseTargetPriceInput,
    percentFromTargetPrice,
    priceFromPercent,
    toCentavos
} from '@/lib/price-alert-threshold';

const CURRENT = 8_500_000; // $ 85.000 in centavos

describe('priceFromPercent', () => {
    it('applies the drop to the current price', () => {
        expect(priceFromPercent({ currentCentavos: CURRENT, percent: 10 })).toBe(7_650_000);
    });
    it('rounds down to whole pesos, never more generous than the rule', () => {
        // 1% of $ 99,99 -> 98,9901 -> $ 98
        expect(priceFromPercent({ currentCentavos: 9_999, percent: 1 })).toBe(9_800);
    });
});

describe('percentFromTargetPrice', () => {
    it('computes an exact percentage', () => {
        const result = percentFromTargetPrice({
            currentCentavos: CURRENT,
            targetCentavos: 7_650_000
        });
        expect(result).toEqual({ ok: true, percent: 10, thresholdCentavos: 7_650_000 });
    });
    it('rounds the percentage DOWN so the alert fires at a price >= the target', () => {
        // 85.000 -> 69.700 is a 18,0% drop (exactly 17,99..% -> floor 17)
        const result = percentFromTargetPrice({
            currentCentavos: CURRENT,
            targetCentavos: 6_970_100
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.percent).toBe(17);
            expect(result.thresholdCentavos).toBeGreaterThanOrEqual(6_970_100);
        }
    });
    it('rejects non-positive targets', () => {
        expect(percentFromTargetPrice({ currentCentavos: CURRENT, targetCentavos: 0 })).toEqual({
            ok: false,
            reason: 'not_positive'
        });
    });
    it('rejects a target at or above the current price', () => {
        expect(
            percentFromTargetPrice({ currentCentavos: CURRENT, targetCentavos: CURRENT })
        ).toEqual({ ok: false, reason: 'not_below_current' });
    });
    it('rejects a target that implies a drop under 1%', () => {
        expect(
            percentFromTargetPrice({ currentCentavos: CURRENT, targetCentavos: CURRENT - 100 })
        ).toEqual({ ok: false, reason: 'too_close' });
    });
});

describe('input parsing', () => {
    it('accepts integer percentages 1-100 only', () => {
        expect(parsePercentInput({ raw: '10' })).toBe(10);
        expect(parsePercentInput({ raw: '100' })).toBe(100);
        expect(parsePercentInput({ raw: '0' })).toBeNull();
        expect(parsePercentInput({ raw: '101' })).toBeNull();
        expect(parsePercentInput({ raw: '10.5' })).toBeNull();
        expect(parsePercentInput({ raw: '' })).toBeNull();
    });
    it('parses prices into centavos, with comma or dot decimals', () => {
        expect(parseTargetPriceInput({ raw: '76500' })).toBe(7_650_000);
        expect(parseTargetPriceInput({ raw: '76500,50' })).toBe(7_650_050);
        expect(parseTargetPriceInput({ raw: 'abc' })).toBeNull();
        expect(parseTargetPriceInput({ raw: '-5' })).toBeNull();
    });
    it('converts pesos to centavos without float drift', () => {
        expect(toCentavos({ amount: 19.99 })).toBe(1_999);
    });
});
