/**
 * @file trade-category-labels.test.ts
 * @description Unit tests for the shared provider-category label helper
 * (HOS-919 T-039, AC-5.1): locale label with Spanish fallback, and the
 * visible/overflow split behind the card badges.
 */

import { describe, expect, it } from 'vitest';
import {
    resolveTradeCategoryName,
    splitTradeCategoryBadges
} from '../../src/lib/trade-category-labels';

const ref = (slug: string, es: string, en?: string, pt?: string) => ({
    id: `id-${slug}`,
    slug,
    nameI18n: { es, ...(en === undefined ? {} : { en }), ...(pt === undefined ? {} : { pt }) },
    groupSlug: 'g'
});

describe('resolveTradeCategoryName', () => {
    it('should return the name in the requested locale', () => {
        const name = resolveTradeCategoryName({
            nameI18n: { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento' },
            locale: 'en'
        });

        expect(name).toBe('Plumbing');
    });

    it('should fall back to Spanish when the locale has no name', () => {
        const name = resolveTradeCategoryName({
            nameI18n: { es: 'Plomería' },
            locale: 'pt'
        });

        expect(name).toBe('Plomería');
    });

    it('should fall back to Spanish when the locale name is blank', () => {
        const name = resolveTradeCategoryName({
            nameI18n: { es: 'Plomería', en: '   ' },
            locale: 'en'
        });

        expect(name).toBe('Plomería');
    });
});

describe('splitTradeCategoryBadges', () => {
    const five = [
        ref('a', 'Alfa', 'Alpha'),
        ref('b', 'Beta', 'Beta'),
        ref('c', 'Gamma', 'Gamma'),
        ref('d', 'Delta', 'Delta'),
        ref('e', 'Epsilon', 'Epsilon')
    ];

    it('should show 3 badges and an overflow of 2 for 5 categories', () => {
        const result = splitTradeCategoryBadges({ categories: five, locale: 'es' });

        expect(result.visible.map((b) => b.label)).toEqual(['Alfa', 'Beta', 'Gamma']);
        expect(result.overflowCount).toBe(2);
    });

    it('should show a single badge and no overflow for 1 category', () => {
        const result = splitTradeCategoryBadges({ categories: five.slice(0, 1), locale: 'es' });

        expect(result.visible).toHaveLength(1);
        expect(result.overflowCount).toBe(0);
    });

    it('should preserve the incoming (catalog) order', () => {
        const result = splitTradeCategoryBadges({
            categories: [ref('z', 'Zeta'), ref('a', 'Alfa')],
            locale: 'es'
        });

        expect(result.visible.map((b) => b.slug)).toEqual(['z', 'a']);
    });

    it('should localize each label with the Spanish fallback', () => {
        const result = splitTradeCategoryBadges({
            categories: [ref('a', 'Alfa', 'Alpha'), ref('b', 'Beta')],
            locale: 'en'
        });

        expect(result.visible.map((b) => b.label)).toEqual(['Alpha', 'Beta']);
    });

    it('should show everything when no cap is requested', () => {
        const result = splitTradeCategoryBadges({
            categories: five,
            locale: 'es',
            max: Number.POSITIVE_INFINITY
        });

        expect(result.visible).toHaveLength(5);
        expect(result.overflowCount).toBe(0);
    });

    it('should return an empty result for no categories', () => {
        const result = splitTradeCategoryBadges({ categories: [], locale: 'es' });

        expect(result.visible).toEqual([]);
        expect(result.overflowCount).toBe(0);
    });
});
