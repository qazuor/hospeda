/**
 * @file match-catalog-query.adapter.test.ts
 * @description The web catalog matcher is a thin adapter over the shared flat-item matcher
 * in `@repo/utils` (HOS-2340 AC-2.6): it must delegate to it per group, with the current
 * locale plus Spanish. Behaviour itself is pinned by `match-catalog-query.test.ts`.
 */

import type { PublicHostTradeCatalog } from '@repo/schemas';
import * as utils from '@repo/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchCatalogQuery } from '../../../src/lib/search/match-catalog-query';

vi.mock('@repo/utils', async (importActual) => {
    const actual = await importActual<typeof import('@repo/utils')>();
    return { ...actual, matchSearchItems: vi.fn(actual.matchSearchItems) };
});

const catalog: PublicHostTradeCatalog = {
    groups: [
        {
            slug: 'hogar',
            nameI18n: { es: 'Hogar', en: 'Home', pt: 'Casa' },
            displayWeight: 1,
            categories: [
                {
                    id: '00000000-0000-4000-8000-000000000001',
                    slug: 'destapaciones',
                    nameI18n: { es: 'Destapaciones', en: 'Unclogging', pt: 'Desentupimento' },
                    displayWeight: 10,
                    keywordsI18n: { es: ['pozo ciego'], en: [], pt: [] }
                }
            ]
        }
    ]
};

afterEach(() => vi.clearAllMocks());

describe('matchCatalogQuery adapter', () => {
    it('delegates to the shared matcher with the current locale plus Spanish', () => {
        const result = matchCatalogQuery({ catalog, query: 'pozo', locale: 'en' });

        expect(utils.matchSearchItems).toHaveBeenCalledTimes(1);
        expect(vi.mocked(utils.matchSearchItems).mock.calls[0]?.[0]).toMatchObject({
            query: 'pozo',
            locales: ['en', 'es']
        });
        expect(result.groups.map((g) => g.slug)).toEqual(['hogar']);
    });

    it('searches Spanish only on the Spanish locale', () => {
        matchCatalogQuery({ catalog, query: 'pozo', locale: 'es' });

        expect(vi.mocked(utils.matchSearchItems).mock.calls[0]?.[0]).toMatchObject({
            locales: ['es']
        });
    });

    it('returns the catalog untouched for a blank query without calling the matcher', () => {
        const result = matchCatalogQuery({ catalog, query: '  ', locale: 'es' });

        expect(result.groups).toBe(catalog.groups);
        expect(utils.matchSearchItems).not.toHaveBeenCalled();
    });
});
