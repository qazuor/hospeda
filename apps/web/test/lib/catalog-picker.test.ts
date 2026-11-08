/**
 * @file catalog-picker.test.ts
 * @description Search, featured selection and grouping of the shared catalog
 * picker's view logic (HOS-2061).
 */

import { describe, expect, it } from 'vitest';
import type { AmenityData } from '@/lib/api/types';
import { groupAmenitiesByCategory } from '@/lib/catalog-categories';
import {
    buildCatalogPickerView,
    matchesCatalogQuery,
    normalizeCatalogSearchText,
    selectFeaturedCatalogItems
} from '@/lib/catalog-picker';

const LABELS: Record<string, string> = {
    wifi: 'Wi-Fi',
    heating: 'Calefacción',
    pool: 'Pileta climatizada',
    parking: 'Estacionamiento',
    orphan: 'Huérfano'
};

const getLabel = (item: AmenityData): string => LABELS[item.slug] ?? item.slug;
const t = (_key: string, fallback?: string): string => fallback ?? _key;
const group = (items: readonly AmenityData[]) => groupAmenitiesByCategory({ amenities: items, t });

const ITEMS: readonly AmenityData[] = [
    { id: 'wifi', slug: 'wifi', category: 'CONNECTIVITY', isFeatured: true, displayWeight: 60 },
    { id: 'heating', slug: 'heating', category: 'CLIMATE_CONTROL' },
    { id: 'pool', slug: 'pool', category: 'OUTDOORS', isFeatured: true, displayWeight: 90 },
    { id: 'parking', slug: 'parking', category: 'PARKING' },
    { id: 'orphan', slug: 'orphan', category: null }
];

describe('normalizeCatalogSearchText', () => {
    it('drops accents and case so "Calefacción" matches "calefaccion"', () => {
        expect(normalizeCatalogSearchText({ text: '  CaleFACCIÓN ' })).toBe('calefaccion');
    });
});

describe('matchesCatalogQuery', () => {
    it('matches the localized label, ignoring accents and case', () => {
        // Arrange
        const heating = ITEMS[1] as AmenityData;

        // Act / Assert
        expect(matchesCatalogQuery({ item: heating, query: 'calefaccion', getLabel })).toBe(true);
        expect(matchesCatalogQuery({ item: heating, query: 'CALEF', getLabel })).toBe(true);
    });

    it('requires every term of a multi-word query', () => {
        const pool = ITEMS[2] as AmenityData;

        expect(matchesCatalogQuery({ item: pool, query: 'pileta clima', getLabel })).toBe(true);
        expect(matchesCatalogQuery({ item: pool, query: 'pileta techada', getLabel })).toBe(false);
    });

    it('falls back to the slug, with separators read as spaces', () => {
        const item: AmenityData = { id: 'x', slug: 'covered_parking', category: null };

        expect(matchesCatalogQuery({ item, query: 'covered parking', getLabel })).toBe(true);
    });

    it('matches everything for a blank query', () => {
        expect(matchesCatalogQuery({ item: ITEMS[0] as AmenityData, query: '   ', getLabel })).toBe(
            true
        );
    });
});

describe('selectFeaturedCatalogItems', () => {
    it('returns only featured items, highest displayWeight first', () => {
        const featured = selectFeaturedCatalogItems({ items: ITEMS, getLabel });

        expect(featured.map((item) => item.id)).toEqual(['pool', 'wifi']);
    });

    it('breaks a weight tie by label', () => {
        const items: readonly AmenityData[] = [
            { id: 'b', slug: 'b', category: null, isFeatured: true, displayWeight: 50 },
            { id: 'a', slug: 'a', category: null, isFeatured: true }
        ];

        const featured = selectFeaturedCatalogItems({ items, getLabel });

        expect(featured.map((item) => item.id)).toEqual(['a', 'b']);
    });
});

describe('buildCatalogPickerView', () => {
    it('without a query: featured on top, the rest grouped by category', () => {
        // Act
        const view = buildCatalogPickerView({ items: ITEMS, query: '', getLabel, group });

        // Assert
        expect(view.isSearching).toBe(false);
        expect(view.featured.map((item) => item.id)).toEqual(['pool', 'wifi']);
        const groupedIds = view.groups.flatMap((g) => g.items.map((item) => item.id));
        expect(groupedIds).not.toContain('pool');
        expect(groupedIds).not.toContain('wifi');
        expect(view.groups.map((g) => g.key)).toEqual(['CLIMATE_CONTROL', 'PARKING', '__other__']);
    });

    it('puts an item with no category in the trailing "other" group', () => {
        const view = buildCatalogPickerView({ items: ITEMS, query: '', getLabel, group });

        const last = view.groups.at(-1);
        expect(last?.key).toBe('__other__');
        expect(last?.items.map((item) => item.id)).toEqual(['orphan']);
    });

    it('with a query: no featured block, every match grouped (featured ones included)', () => {
        const view = buildCatalogPickerView({ items: ITEMS, query: 'pileta', getLabel, group });

        expect(view.isSearching).toBe(true);
        expect(view.featured).toEqual([]);
        expect(view.matchCount).toBe(1);
        expect(view.groups).toHaveLength(1);
        expect(view.groups[0]?.key).toBe('OUTDOORS');
        expect(view.groups[0]?.items.map((item) => item.id)).toEqual(['pool']);
    });

    it('with a query that matches nothing: zero matches and no groups', () => {
        const view = buildCatalogPickerView({ items: ITEMS, query: 'sauna', getLabel, group });

        expect(view.matchCount).toBe(0);
        expect(view.groups).toEqual([]);
    });

    it('with no featured items: everything is grouped', () => {
        const items = ITEMS.map((item) => ({ ...item, isFeatured: false }));

        const view = buildCatalogPickerView({ items, query: '', getLabel, group });

        expect(view.featured).toEqual([]);
        expect(view.groups.flatMap((g) => g.items)).toHaveLength(items.length);
    });
});
