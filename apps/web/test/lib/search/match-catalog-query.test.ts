/**
 * @file match-catalog-query.test.ts
 * @description Unit tests for the provider trade catalog search util (HOS-919 AC-1.2, AC-1.3).
 */

import type { PublicHostTradeCatalog } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { matchCatalogQuery } from '../../../src/lib/search/match-catalog-query';

type Category = PublicHostTradeCatalog['groups'][number]['categories'][number];

const cat = (input: {
    slug: string;
    es: string;
    en?: string;
    pt?: string;
    kwEs?: string[];
    kwEn?: string[];
    weight?: number;
}): Category => ({
    id: `00000000-0000-4000-8000-${input.slug.length.toString().padStart(12, '0')}`,
    slug: input.slug,
    nameI18n: { es: input.es, en: input.en ?? '', pt: input.pt ?? '' },
    displayWeight: input.weight ?? 10,
    keywordsI18n: { es: input.kwEs ?? [], en: input.kwEn ?? [], pt: [] }
});

const catalog: PublicHostTradeCatalog = {
    groups: [
        {
            slug: 'hogar',
            nameI18n: { es: 'Hogar', en: 'Home', pt: 'Casa' },
            displayWeight: 1,
            categories: [
                cat({
                    slug: 'carpinteria',
                    es: 'Carpintería',
                    en: 'Carpentry',
                    kwEs: ['muebles', 'madera']
                }),
                cat({
                    slug: 'destapaciones-desagotes',
                    es: 'Destapaciones y desagotes',
                    en: 'Drain clearing',
                    kwEs: ['pozo ciego', 'cañerías'],
                    kwEn: ['septic tank']
                }),
                cat({
                    slug: 'climatizacion',
                    es: 'Climatización',
                    en: 'Climate control',
                    kwEs: ['aire acondicionado', 'split']
                })
            ]
        },
        {
            slug: 'exterior',
            nameI18n: { es: 'Exterior', en: 'Outdoor', pt: 'Exterior' },
            displayWeight: 2,
            categories: [cat({ slug: 'jardineria', es: 'Jardinería', kwEs: ['pasto'] })]
        }
    ]
};

const slugs = (result: ReturnType<typeof matchCatalogQuery>): string[] =>
    result.groups.flatMap((g) => g.categories.map((c) => c.slug));

describe('matchCatalogQuery', () => {
    it('returns the whole catalog for an empty or blank query', () => {
        expect(matchCatalogQuery({ catalog, query: '', locale: 'es' }).groups).toEqual(
            catalog.groups
        );
        expect(matchCatalogQuery({ catalog, query: '   ', locale: 'es' }).groups).toEqual(
            catalog.groups
        );
    });

    it('finds a category by a keyword word ("pozo")', () => {
        expect(slugs(matchCatalogQuery({ catalog, query: 'pozo', locale: 'es' }))).toEqual([
            'destapaciones-desagotes'
        ]);
    });

    it('ignores case and accents in both directions', () => {
        for (const query of ['AIRE', 'aíre', 'Aire']) {
            expect(slugs(matchCatalogQuery({ catalog, query, locale: 'es' }))).toEqual([
                'climatizacion'
            ]);
        }
        expect(slugs(matchCatalogQuery({ catalog, query: 'carpinteria', locale: 'es' }))).toEqual([
            'carpinteria'
        ]);
        expect(slugs(matchCatalogQuery({ catalog, query: 'CLIMATIZACIÓN', locale: 'es' }))).toEqual(
            ['climatizacion']
        );
    });

    it('requires every token to prefix some word (multi-token)', () => {
        expect(slugs(matchCatalogQuery({ catalog, query: 'aire acond', locale: 'es' }))).toEqual([
            'climatizacion'
        ]);
        expect(slugs(matchCatalogQuery({ catalog, query: 'aire madera', locale: 'es' }))).toEqual(
            []
        );
        expect(slugs(matchCatalogQuery({ catalog, query: 'pozo ciego', locale: 'es' }))).toEqual([
            'destapaciones-desagotes'
        ]);
    });

    it('matches word prefixes only, never infixes', () => {
        expect(slugs(matchCatalogQuery({ catalog, query: 'ería', locale: 'es' }))).toEqual([]);
        expect(slugs(matchCatalogQuery({ catalog, query: 'carp', locale: 'es' }))).toEqual([
            'carpinteria'
        ]);
    });

    it('matches the second word of a name', () => {
        expect(slugs(matchCatalogQuery({ catalog, query: 'desag', locale: 'es' }))).toEqual([
            'destapaciones-desagotes'
        ]);
    });

    it('falls back to Spanish on en and pt, and also matches the current locale', () => {
        expect(slugs(matchCatalogQuery({ catalog, query: 'pozo', locale: 'en' }))).toEqual([
            'destapaciones-desagotes'
        ]);
        expect(slugs(matchCatalogQuery({ catalog, query: 'carpint', locale: 'pt' }))).toEqual([
            'carpinteria'
        ]);
        expect(slugs(matchCatalogQuery({ catalog, query: 'septic', locale: 'en' }))).toEqual([
            'destapaciones-desagotes'
        ]);
        expect(slugs(matchCatalogQuery({ catalog, query: 'septic', locale: 'es' }))).toEqual([]);
    });

    it('ranks name-prefix matches before keyword matches, then catalog order', () => {
        const ranked: PublicHostTradeCatalog = {
            groups: [
                {
                    slug: 'g',
                    nameI18n: { es: 'G', en: '', pt: '' },
                    displayWeight: 1,
                    categories: [
                        cat({ slug: 'keyword-first', es: 'Zeta', kwEs: ['mueble'] }),
                        cat({ slug: 'name-hit', es: 'Mueblería' }),
                        cat({ slug: 'keyword-second', es: 'Alfa', kwEs: ['muebles'] })
                    ]
                }
            ]
        };
        expect(slugs(matchCatalogQuery({ catalog: ranked, query: 'muebl', locale: 'es' }))).toEqual(
            ['name-hit', 'keyword-first', 'keyword-second']
        );
    });

    it('hides groups without matches and keeps group order', () => {
        const result = matchCatalogQuery({ catalog, query: 'pasto', locale: 'es' });
        expect(result.groups.map((g) => g.slug)).toEqual(['exterior']);
    });

    it('returns no groups when nothing matches', () => {
        expect(matchCatalogQuery({ catalog, query: 'zzz', locale: 'es' }).groups).toEqual([]);
    });

    it('does not mutate the input catalog', () => {
        const before = JSON.stringify(catalog);
        matchCatalogQuery({ catalog, query: 'a', locale: 'es' });
        expect(JSON.stringify(catalog)).toBe(before);
    });
});
