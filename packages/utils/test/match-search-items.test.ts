/**
 * @file match-search-items.test.ts
 * @description Unit tests for the shared flat-item keyword matcher (HOS-2340 AC-2.1..2.3, 2.5, 2.7, 2.8).
 */
import { describe, expect, it } from 'vitest';
import type { SearchableTerms, SearchLocale } from '../src/match-search-items';
import { matchSearchItems, normalizeSearchText } from '../src/match-search-items';

interface Item {
    readonly slug: string;
    readonly terms: SearchableTerms;
}

const item = (
    slug: string,
    es: string,
    en = '',
    kwEs: string[] = [],
    kwEn: string[] = []
): Item => ({
    slug,
    terms: { nameI18n: { es, en, pt: '' }, keywordsI18n: { es: kwEs, en: kwEn, pt: [] } }
});

const items: readonly Item[] = [
    item('carpinteria', 'Carpintería', 'Carpentry', ['muebles', 'madera']),
    item('climatizacion', 'Climatización', 'Air conditioning', ['aire acondicionado']),
    item('destapaciones', 'Destapaciones y desagotes', 'Unclogging', ['pozo ciego', 'cloacas']),
    item('plomeria', 'Plomería', 'Plumbing', ['canillas', 'aire']),
    item('albanileria', 'Albañilería', 'Masonry')
];

const run = (
    query: string,
    locales: SearchLocale[] = ['es', 'en', 'pt'],
    source: readonly Item[] = items
) =>
    matchSearchItems({ items: source, query, locales, getTerms: (i) => i.terms }).map(
        (i) => i.slug
    );

describe('normalizeSearchText', () => {
    it('strips accents, lowercases and collapses spaces', () => {
        expect(normalizeSearchText('  ClimatizaCIÓN   Aíre ')).toBe('climatizacion aire');
    });
});

describe('matchSearchItems', () => {
    it('returns every item unchanged for a blank query (AC-2.8)', () => {
        expect(run('   ')).toEqual(items.map((i) => i.slug));
    });

    it('finds an item through a keyword (AC-2.1)', () => {
        expect(run('pozo')).toEqual(['destapaciones']);
    });

    it('is accent and case insensitive (AC-2.2)', () => {
        expect(run('AIRE')).toContain('climatizacion');
        expect(run('aíre')).toContain('climatizacion');
        expect(run('albanil')).toEqual(['albanileria']);
    });

    it('requires every token to prefix some word (AC-2.3)', () => {
        expect(run('pozo cie')).toEqual(['destapaciones']);
        expect(run('pozo xyz')).toEqual([]);
    });

    it('searches every requested locale (AC-2.5)', () => {
        expect(run('plumbing')).toEqual(['plomeria']);
        expect(run('plumbing', ['es'])).toEqual([]);
    });

    it('ranks name matches before keyword-only matches, keeping input order (AC-2.7)', () => {
        const withName = [...items, item('ventilacion', 'Aire y ventilación')];
        expect(run('aire', ['es'], withName)).toEqual(['ventilacion', 'climatizacion', 'plomeria']);
    });

    it('does not mutate the input', () => {
        const copy = [...items];
        run('aire');
        expect(items).toEqual(copy);
    });
});
