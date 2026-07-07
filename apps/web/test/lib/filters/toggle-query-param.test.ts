/**
 * @file toggle-query-param.test.ts
 * @description Unit tests for `buildToggleParamHref`, the shared quick-filter
 * chip href builder used by eventos, gastronomía, and experiencias (HOS-97).
 */

import { describe, expect, it } from 'vitest';
import { buildToggleParamHref } from '../../../src/lib/filters/toggle-query-param';

describe('buildToggleParamHref', () => {
    it('sets the param when the chip is not active', () => {
        const href = buildToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams(''),
            key: 'category',
            value: 'MUSIC',
            isActive: false
        });
        expect(href).toBe('/es/eventos/?category=MUSIC');
    });

    it('removes the param when the chip is already active (toggle off)', () => {
        const href = buildToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('category=MUSIC'),
            key: 'category',
            value: 'MUSIC',
            isActive: true
        });
        expect(href).toBe('/es/eventos/');
    });

    it('preserves every other active param when toggling on', () => {
        const href = buildToggleParamHref({
            baseUrl: '/es/gastronomia/',
            searchParams: new URLSearchParams('q=asado&destinationId=abc123&sortBy=featured'),
            key: 'type',
            value: 'PARRILLA',
            isActive: false
        });
        const params = new URLSearchParams(href.split('?')[1]);
        expect(params.get('q')).toBe('asado');
        expect(params.get('destinationId')).toBe('abc123');
        expect(params.get('sortBy')).toBe('featured');
        expect(params.get('type')).toBe('PARRILLA');
    });

    it('preserves every other active param when toggling off', () => {
        const href = buildToggleParamHref({
            baseUrl: '/es/gastronomia/',
            searchParams: new URLSearchParams('q=asado&type=PARRILLA&sortBy=featured'),
            key: 'type',
            value: 'PARRILLA',
            isActive: true
        });
        const params = new URLSearchParams(href.split('?')[1]);
        expect(params.get('q')).toBe('asado');
        expect(params.get('sortBy')).toBe('featured');
        expect(params.has('type')).toBe(false);
    });

    it('single-select: switching to a different value replaces (not appends) the param', () => {
        const href = buildToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('category=MUSIC'),
            key: 'category',
            value: 'CULTURE',
            isActive: false
        });
        const params = new URLSearchParams(href.split('?')[1]);
        expect(params.getAll('category')).toEqual(['CULTURE']);
    });

    it('always drops page so a filter change resets pagination', () => {
        const href = buildToggleParamHref({
            baseUrl: '/es/eventos/',
            searchParams: new URLSearchParams('page=3&q=asado'),
            key: 'category',
            value: 'MUSIC',
            isActive: false
        });
        const params = new URLSearchParams(href.split('?')[1]);
        expect(params.has('page')).toBe(false);
        expect(params.get('q')).toBe('asado');
    });

    it('returns the bare baseUrl when no params remain after toggling off', () => {
        const href = buildToggleParamHref({
            baseUrl: '/es/experiencias/',
            searchParams: new URLSearchParams('type=BOAT_TRIP'),
            key: 'type',
            value: 'BOAT_TRIP',
            isActive: true
        });
        expect(href).toBe('/es/experiencias/');
    });
});
