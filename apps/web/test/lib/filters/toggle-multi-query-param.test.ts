/**
 * @file toggle-multi-query-param.test.ts
 * @description Unit tests for `buildMultiToggleParamHref`, the shared
 * quick-filter chip href builder that accumulates/removes a value inside a
 * CSV array query param (multi-select) while preserving every other active
 * filter/sort param and always resetting pagination (HOS-96 T-008).
 */

import { describe, expect, it } from 'vitest';
import { buildMultiToggleParamHref } from '../../../src/lib/filters/toggle-multi-query-param';

/** Parse the query portion of an href back into URLSearchParams. */
function query(href: string): URLSearchParams {
    return new URLSearchParams(href.split('?')[1] ?? '');
}

describe('buildMultiToggleParamHref', () => {
    it('adds the value when the param is absent', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams(''),
            key: 'types',
            value: 'HOTEL'
        });
        expect(query(href).getAll('types')).toEqual(['HOTEL']);
    });

    it('appends a new value (accumulates, does not replace) preserving order', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL'),
            key: 'types',
            value: 'CABIN'
        });
        expect(query(href).get('types')).toBe('HOTEL,CABIN');
    });

    it('appends a third value preserving insertion order', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,CABIN'),
            key: 'types',
            value: 'APARTMENT'
        });
        expect(query(href).get('types')).toBe('HOTEL,CABIN,APARTMENT');
    });

    it('removes only the clicked value when it is present', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,CABIN,APARTMENT'),
            key: 'types',
            value: 'CABIN'
        });
        expect(query(href).get('types')).toBe('HOTEL,APARTMENT');
    });

    it('drops the param entirely when removing the last remaining value (no empty ?key=)', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL'),
            key: 'types',
            value: 'HOTEL'
        });
        expect(href).toBe('/es/alojamientos/');
        expect(query(href).has('types')).toBe(false);
    });

    it('preserves every unrelated param (q, sortBy, other facets)', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('q=rio&sortBy=featured&categories=MUSIC&types=HOTEL'),
            key: 'types',
            value: 'CABIN'
        });
        const params = query(href);
        expect(params.get('q')).toBe('rio');
        expect(params.get('sortBy')).toBe('featured');
        expect(params.get('categories')).toBe('MUSIC');
        expect(params.get('types')).toBe('HOTEL,CABIN');
    });

    it('always drops page regardless of add or remove', () => {
        const added = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('page=3&types=HOTEL'),
            key: 'types',
            value: 'CABIN'
        });
        expect(query(added).has('page')).toBe(false);
        expect(query(added).get('types')).toBe('HOTEL,CABIN');

        const removed = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('page=2&types=HOTEL,CABIN'),
            key: 'types',
            value: 'CABIN'
        });
        expect(query(removed).has('page')).toBe(false);
        expect(query(removed).get('types')).toBe('HOTEL');
    });

    it('de-duplicates repeated members from a crafted URL (OQ-4)', () => {
        // Adding a brand-new value to a param that already contains duplicates
        // normalizes the whole param to unique values, preserving first-seen order.
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,HOTEL,CABIN'),
            key: 'types',
            value: 'APARTMENT'
        });
        expect(query(href).get('types')).toBe('HOTEL,CABIN,APARTMENT');
    });

    it('toggling off a duplicated value removes all its occurrences', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types=HOTEL,HOTEL,CABIN'),
            key: 'types',
            value: 'HOTEL'
        });
        expect(query(href).get('types')).toBe('CABIN');
    });

    it('reads the repeated-key URL form as well as CSV', () => {
        const params = new URLSearchParams();
        params.append('types', 'HOTEL');
        params.append('types', 'CABIN');
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: params,
            key: 'types',
            value: 'APARTMENT'
        });
        expect(query(href).get('types')).toBe('HOTEL,CABIN,APARTMENT');
    });

    it('trims whitespace around CSV members', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/alojamientos/',
            searchParams: new URLSearchParams('types= HOTEL , CABIN '),
            key: 'types',
            value: 'APARTMENT'
        });
        expect(query(href).get('types')).toBe('HOTEL,CABIN,APARTMENT');
    });
});
