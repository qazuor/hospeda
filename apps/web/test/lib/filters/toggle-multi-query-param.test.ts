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

describe('buildMultiToggleParamHref — legacy singular-param fallback (HOS-96 pre-merge review, Option A)', () => {
    it('?category=MUSIC + click CULTURE -> ?categories=MUSIC,CULTURE with NO category= remaining (seeds from singular, migrates to plural)', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('category=MUSIC'),
            key: 'categories',
            value: 'CULTURE',
            singularKey: 'category'
        });
        const params = query(href);
        expect(params.get('categories')).toBe('MUSIC,CULTURE');
        expect(params.has('category')).toBe(false);
    });

    it('?category=MUSIC + click MUSIC (toggle off the value seeded from the singular) -> bare baseUrl, no category= or categories= left', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('category=MUSIC'),
            key: 'categories',
            value: 'MUSIC',
            singularKey: 'category'
        });
        expect(href).toBe('/es/eventos/');
        const params = query(href);
        expect(params.has('category')).toBe(false);
        expect(params.has('categories')).toBe(false);
    });

    it('the plural param wins over the singular when both are present (mirrors readFacetActiveValues)', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('categories=CULTURE&category=MUSIC'),
            key: 'categories',
            value: 'SPORTS',
            singularKey: 'category'
        });
        const params = query(href);
        // Seeded from the plural (CULTURE), not the singular (MUSIC) — SPORTS
        // is appended to CULTURE, and the stale singular is migrated away.
        expect(params.get('categories')).toBe('CULTURE,SPORTS');
        expect(params.has('category')).toBe(false);
    });

    it('preserves every OTHER unrelated param while migrating singular -> plural', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('q=asado&category=MUSIC&sortBy=upcoming'),
            key: 'categories',
            value: 'CULTURE',
            singularKey: 'category'
        });
        const params = query(href);
        expect(params.get('q')).toBe('asado');
        expect(params.get('sortBy')).toBe('upcoming');
        expect(params.get('categories')).toBe('MUSIC,CULTURE');
        expect(params.has('category')).toBe(false);
    });

    it('without singularKey, an old singular-only URL is left untouched (existing callers unaffected)', () => {
        const href = buildMultiToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('category=MUSIC'),
            key: 'categories',
            value: 'CULTURE'
        });
        const params = query(href);
        // No fallback seeding: current values start empty, so only CULTURE is added.
        expect(params.get('categories')).toBe('CULTURE');
        // The unrelated singular param is preserved as-is (never touched without singularKey).
        expect(params.get('category')).toBe('MUSIC');
    });
});
