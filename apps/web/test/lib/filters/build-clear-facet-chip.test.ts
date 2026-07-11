/**
 * @file build-clear-facet-chip.test.ts
 * @description Unit tests for `buildClearFacetChip`, the shared, standalone
 * builder for the "Clear (N)" bulk-reset quick-filter chip (HOS-96 US-4 /
 * T-010). Not wired into any listing page yet (T-011/12/13) — these tests
 * exercise the helper in isolation.
 */

import { XCircleIcon } from '@repo/icons';
import { describe, expect, it } from 'vitest';
import { buildClearFacetChip } from '../../../src/lib/filters/build-clear-facet-chip';

const LABEL_TEMPLATE = 'Limpiar ({{count}})';
const ARIA_LABEL_TEMPLATE = 'Limpiar {{count}} filtros';

describe('buildClearFacetChip', () => {
    it('returns undefined when zero values are active', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams(''),
            paramKey: 'types',
            count: 0,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip).toBeUndefined();
    });

    it('returns undefined when exactly 1 value is active (re-clicking the chip already clears it, US-3)', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL'),
            paramKey: 'types',
            count: 1,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip).toBeUndefined();
    });

    it('returns a chip when 2+ values are active, with the count interpolated into the label', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,CABIN'),
            paramKey: 'types',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip).toBeDefined();
        expect(chip?.label).toBe('Limpiar (2)');
    });

    it('interpolates a count greater than 2 correctly (e.g. 3)', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,CABIN,APARTMENT'),
            paramKey: 'types',
            count: 3,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip?.label).toBe('Limpiar (3)');
    });

    it('includes the numeric count in the accessible name (ariaLabel)', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('categories=MUSIC,CULTURE'),
            paramKey: 'categories',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip?.ariaLabel).toBe('Limpiar 2 filtros');
        expect(chip?.ariaLabel).toContain('2');
    });

    it('sets active: false (this is an action chip, not a selected-value indicator)', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,CABIN'),
            paramKey: 'types',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip?.active).toBe(false);
    });

    it('passes the icon through unchanged', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,CABIN'),
            paramKey: 'types',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip?.icon).toBe(XCircleIcon);
    });

    it('the href removes the whole facet array param while preserving every other param', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams(
                'q=rio&sortBy=featured&types=HOTEL,CABIN&categories=MUSIC'
            ),
            paramKey: 'types',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        const params = new URLSearchParams(chip?.href.split('?')[1] ?? '');
        expect(params.has('types')).toBe(false);
        expect(params.get('q')).toBe('rio');
        expect(params.get('sortBy')).toBe('featured');
        expect(params.get('categories')).toBe('MUSIC');
    });

    it('always drops page from the href', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('page=3&types=HOTEL,CABIN'),
            paramKey: 'types',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        const params = new URLSearchParams(chip?.href.split('?')[1] ?? '');
        expect(params.has('page')).toBe(false);
    });

    it('returns baseUrl alone when no other params remain after clearing', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,CABIN'),
            paramKey: 'types',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        expect(chip?.href).toBe('/es/alojamientos/');
    });
});

describe('buildClearFacetChip — legacy singular-param fallback (HOS-96 pre-merge review, Option A)', () => {
    it('deletes BOTH the plural paramKey and the singular legacy param when clearing a mixed URL', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('categories=MUSIC,CULTURE&category=SPORTS&q=asado'),
            paramKey: 'categories',
            singularParamKey: 'category',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        const params = new URLSearchParams(chip?.href.split('?')[1] ?? '');
        expect(params.has('categories')).toBe(false);
        expect(params.has('category')).toBe(false);
        expect(params.get('q')).toBe('asado');
    });

    it('without singularParamKey, only the plural param is deleted (existing behavior unchanged)', () => {
        const chip = buildClearFacetChip({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('categories=MUSIC,CULTURE&category=SPORTS'),
            paramKey: 'categories',
            count: 2,
            labelTemplate: LABEL_TEMPLATE,
            ariaLabelTemplate: ARIA_LABEL_TEMPLATE,
            icon: XCircleIcon
        });
        const params = new URLSearchParams(chip?.href.split('?')[1] ?? '');
        expect(params.has('categories')).toBe(false);
        expect(params.get('category')).toBe('SPORTS');
    });
});
