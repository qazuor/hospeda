/**
 * @file read-facet-active-values.test.ts
 * @description Unit tests for `readFacetActiveValues`, the shared helper that
 * reads a multi-select facet's currently active values from the URL's array
 * query param (HOS-96 T-009). Used by quick-filter chip rows to compute each
 * chip's `active` / `aria-current` state.
 */

import { describe, expect, it } from 'vitest';
import { readFacetActiveValues } from '../../../src/lib/filters/read-facet-active-values';

describe('readFacetActiveValues', () => {
    it('returns an empty array when the param is absent', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams(''),
            paramKey: 'types'
        });
        expect(values).toEqual([]);
    });

    it('parses a single value', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('types=HOTEL'),
            paramKey: 'types'
        });
        expect(values).toEqual(['HOTEL']);
    });

    it('parses a CSV multi-value param, preserving order', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('types=HOTEL,CABIN,APARTMENT'),
            paramKey: 'types'
        });
        expect(values).toEqual(['HOTEL', 'CABIN', 'APARTMENT']);
    });

    it('parses a repeated-key encoding as well as CSV', () => {
        const params = new URLSearchParams();
        params.append('categories', 'MUSIC');
        params.append('categories', 'CULTURE');
        const values = readFacetActiveValues({ searchParams: params, paramKey: 'categories' });
        expect(values).toEqual(['MUSIC', 'CULTURE']);
    });

    it('trims whitespace around CSV members', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('types= HOTEL , CABIN '),
            paramKey: 'types'
        });
        expect(values).toEqual(['HOTEL', 'CABIN']);
    });

    it('de-duplicates repeated members, preserving first-seen order', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('types=HOTEL,HOTEL,CABIN'),
            paramKey: 'types'
        });
        expect(values).toEqual(['HOTEL', 'CABIN']);
    });

    it('ignores unrelated params', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('q=rio&types=HOTEL&categories=MUSIC'),
            paramKey: 'types'
        });
        expect(values).toEqual(['HOTEL']);
    });

    it('resolves an empty param value to an empty array (no [""])', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('types='),
            paramKey: 'types'
        });
        expect(values).toEqual([]);
    });
});

describe('readFacetActiveValues — legacy singular-param fallback (HOS-96 pre-merge review, Option A)', () => {
    it('falls back to the singular param when the plural param is absent', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('type=HOTEL'),
            paramKey: 'types',
            singularParamKey: 'type'
        });
        expect(values).toEqual(['HOTEL']);
    });

    it('the plural param wins when BOTH are present (mirrors backend precedence)', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('types=CABIN&type=HOTEL'),
            paramKey: 'types',
            singularParamKey: 'type'
        });
        expect(values).toEqual(['CABIN']);
    });

    it('returns an empty array when neither the plural nor the singular param is present', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('q=rio'),
            paramKey: 'types',
            singularParamKey: 'type'
        });
        expect(values).toEqual([]);
    });

    it('reads the singular fallback the same tolerant way (trim, CSV split, dedup)', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('type= HOTEL , HOTEL '),
            paramKey: 'types',
            singularParamKey: 'type'
        });
        expect(values).toEqual(['HOTEL']);
    });

    it('without singularParamKey, absent plural still resolves to empty (existing callers unaffected)', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('category=MUSIC'),
            paramKey: 'categories'
        });
        expect(values).toEqual([]);
    });

    it('events/blog: falls back to the singular category param', () => {
        const values = readFacetActiveValues({
            searchParams: new URLSearchParams('category=MUSIC'),
            paramKey: 'categories',
            singularParamKey: 'category'
        });
        expect(values).toEqual(['MUSIC']);
    });
});
