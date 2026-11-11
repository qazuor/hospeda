/**
 * @file review-language.test.ts
 * @description Unit tests for the review-language label helper.
 */

import { describe, expect, it } from 'vitest';
import { getReviewLanguageLabel } from '../../src/lib/review-language';

describe('getReviewLanguageLabel', () => {
    it('returns the localized language name when it differs from the page locale', () => {
        expect(getReviewLanguageLabel({ languageCode: 'pt', locale: 'es' })).toBe('portugués');
    });

    it('returns null when the review language matches the page language', () => {
        expect(getReviewLanguageLabel({ languageCode: 'es', locale: 'es' })).toBeNull();
    });

    it('compares primary subtags, so es-AR matches an es page', () => {
        expect(getReviewLanguageLabel({ languageCode: 'es-AR', locale: 'es' })).toBeNull();
    });

    it('uses the primary subtag for a regional review language', () => {
        expect(getReviewLanguageLabel({ languageCode: 'pt-BR', locale: 'es' })).toBe('portugués');
    });

    it('returns null when no language code is present', () => {
        expect(getReviewLanguageLabel({ languageCode: null, locale: 'es' })).toBeNull();
        expect(getReviewLanguageLabel({ languageCode: undefined, locale: 'es' })).toBeNull();
        expect(getReviewLanguageLabel({ languageCode: '', locale: 'es' })).toBeNull();
    });

    it('returns null for an unknown language code', () => {
        expect(getReviewLanguageLabel({ languageCode: 'zz', locale: 'es' })).toBeNull();
    });

    it.each([
        'und',
        'mul',
        'zxx'
    ])('returns null for the special-purpose tag %s (Intl would name und "root")', (code) => {
        expect(getReviewLanguageLabel({ languageCode: code, locale: 'es' })).toBeNull();
    });

    it('resolves the language name in the page locale', () => {
        expect(getReviewLanguageLabel({ languageCode: 'pt', locale: 'en' })).toBe('Portuguese');
    });
});
