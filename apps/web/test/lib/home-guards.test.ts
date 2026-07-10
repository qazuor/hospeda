/**
 * @file home-guards.test.ts
 * @description Unit tests for the homepage guard helpers. These decide whether
 * optional homepage fragments render, so they never leak misleading "0+" /
 * "0/5" / "NaN" signals into the SSR HTML that a crawler or LLM would index.
 *
 * Tasks: HOS-117 T-004 (isMeaningfulStat), plus baseline coverage for
 * shouldShowSocialProof.
 */

import { describe, expect, it } from 'vitest';
import { isMeaningfulStat, shouldShowSocialProof } from '../../src/lib/home-guards';

describe('isMeaningfulStat', () => {
    it('returns true for a finite, strictly positive value', () => {
        expect(isMeaningfulStat({ value: 104 })).toBe(true);
        expect(isMeaningfulStat({ value: 1 })).toBe(true);
        expect(isMeaningfulStat({ value: 0.5 })).toBe(true);
    });

    it('returns false for zero — the "0+" case this guard exists to prevent', () => {
        expect(isMeaningfulStat({ value: 0 })).toBe(false);
    });

    it('returns false for negative values', () => {
        expect(isMeaningfulStat({ value: -1 })).toBe(false);
    });

    it('returns false for non-finite values (NaN, Infinity)', () => {
        expect(isMeaningfulStat({ value: Number.NaN })).toBe(false);
        expect(isMeaningfulStat({ value: Number.POSITIVE_INFINITY })).toBe(false);
        expect(isMeaningfulStat({ value: Number.NEGATIVE_INFINITY })).toBe(false);
    });

    it('returns false for non-number values (defensive)', () => {
        expect(isMeaningfulStat({ value: undefined as unknown as number })).toBe(false);
        expect(isMeaningfulStat({ value: null as unknown as number })).toBe(false);
    });
});

describe('shouldShowSocialProof', () => {
    it('returns true when there is at least one review and a finite positive rating', () => {
        expect(shouldShowSocialProof({ reviewsCount: 5, averageRating: 4.2 })).toBe(true);
    });

    it('returns false when there are no reviews', () => {
        expect(shouldShowSocialProof({ reviewsCount: 0, averageRating: 4.5 })).toBe(false);
    });

    it('returns false when the rating is zero, non-finite, or missing', () => {
        expect(shouldShowSocialProof({ reviewsCount: 5, averageRating: 0 })).toBe(false);
        expect(shouldShowSocialProof({ reviewsCount: 5, averageRating: Number.NaN })).toBe(false);
        expect(
            shouldShowSocialProof({ reviewsCount: 5, averageRating: Number.POSITIVE_INFINITY })
        ).toBe(false);
        expect(shouldShowSocialProof({ reviewsCount: 5, averageRating: undefined })).toBe(false);
    });
});
