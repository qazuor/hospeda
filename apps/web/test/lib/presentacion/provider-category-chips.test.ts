/**
 * @file provider-category-chips.test.ts
 * @description What the `/presentacion/proveedores` page renders from the public
 * catalog (HOS-919 AC-6.1, AC-6.2): chips grouped under headings, in the page
 * locale, and a degraded flag when the catalog could not be read.
 */

import type { PublicHostTradeCatalog } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { ApiResult } from '../../../src/lib/api/types';
import { buildProviderCategoryChipGroups } from '../../../src/lib/presentacion/provider-category-chips';

const category = (slug: string, es: string, en = '') => ({
    id: `id-${slug}`,
    slug,
    nameI18n: { es, en, pt: '' },
    displayWeight: 10,
    keywordsI18n: { es: [], en: [], pt: [] }
});

const CATALOG: PublicHostTradeCatalog = {
    groups: [
        {
            slug: 'instalaciones',
            nameI18n: { es: 'Instalaciones', en: 'Installations', pt: '' },
            displayWeight: 10,
            categories: [category('plomeria', 'Plomería', 'Plumbing'), category('gas', 'Gas')]
        },
        {
            slug: 'exterior',
            nameI18n: { es: 'Exterior', en: 'Outdoors', pt: '' },
            displayWeight: 20,
            categories: [category('piletas', 'Piletas')]
        }
    ]
};

const ok = (data: PublicHostTradeCatalog): ApiResult<PublicHostTradeCatalog> => ({
    ok: true,
    data
});

describe('buildProviderCategoryChipGroups', () => {
    it('should render one group per catalog group, with its chips, in catalog order', () => {
        const result = buildProviderCategoryChipGroups({ result: ok(CATALOG), locale: 'es' });

        expect(result.degraded).toBe(false);
        expect(result.groups.map((g) => g.title)).toEqual(['Instalaciones', 'Exterior']);
        expect(result.groups[0]?.chips.map((c) => c.label)).toEqual(['Plomería', 'Gas']);
        expect(result.groups[1]?.chips.map((c) => c.label)).toEqual(['Piletas']);
    });

    it('should label in the page locale and fall back to Spanish', () => {
        const result = buildProviderCategoryChipGroups({ result: ok(CATALOG), locale: 'en' });

        expect(result.groups[0]?.title).toBe('Installations');
        expect(result.groups[0]?.chips.map((c) => c.label)).toEqual(['Plumbing', 'Gas']);
    });

    it('should skip a group that has no categories (nothing to show under its heading)', () => {
        const result = buildProviderCategoryChipGroups({
            result: ok({
                groups: [{ ...CATALOG.groups[0]!, categories: [] }, CATALOG.groups[1]!]
            }),
            locale: 'es'
        });

        expect(result.groups.map((g) => g.title)).toEqual(['Exterior']);
    });

    it('should return no chips and flag the render as degraded when the call failed', () => {
        const result = buildProviderCategoryChipGroups({
            result: { ok: false, error: { status: 503, message: 'down' } },
            locale: 'es'
        });

        expect(result.groups).toEqual([]);
        expect(result.degraded).toBe(true);
    });

    it('should not flag an empty (but successful) catalog as degraded', () => {
        const result = buildProviderCategoryChipGroups({
            result: ok({ groups: [] }),
            locale: 'es'
        });

        expect(result.groups).toEqual([]);
        expect(result.degraded).toBe(false);
    });
});
