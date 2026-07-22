/**
 * @file SearchBar.buildSearchUrl.test.ts
 * @description Regression tests for the hero SearchBar's `buildSearchUrl`
 * (BETA-161). An untouched guests stepper must NOT emit an `adults` param —
 * otherwise the listing page applies it as a real `minGuests` filter and
 * silently excludes single-guest accommodations on the primary search path.
 */

import { describe, expect, it } from 'vitest';
import { buildSearchUrl } from '../SearchBar.client';

describe('buildSearchUrl', () => {
    const baseArgs = {
        baseUrl: '/es/alojamientos/',
        destinationId: null,
        types: new Set<never>(),
        adults: 2,
        children: 0
    };

    it('omits adults when the guests stepper was not touched', () => {
        const url = buildSearchUrl({ ...baseArgs, guestsTouched: false });
        const params = new URL(url, 'https://example.com').searchParams;
        expect(params.has('adults')).toBe(false);
    });

    it('includes adults when the guests stepper was touched, even at the default value', () => {
        const url = buildSearchUrl({ ...baseArgs, guestsTouched: true });
        const params = new URL(url, 'https://example.com').searchParams;
        expect(params.get('adults')).toBe('2');
    });

    it('includes adults with the deliberately chosen value when touched', () => {
        const url = buildSearchUrl({ ...baseArgs, adults: 1, guestsTouched: true });
        const params = new URL(url, 'https://example.com').searchParams;
        expect(params.get('adults')).toBe('1');
    });

    it('omits children when 0, regardless of guestsTouched', () => {
        const url = buildSearchUrl({ ...baseArgs, children: 0, guestsTouched: true });
        const params = new URL(url, 'https://example.com').searchParams;
        expect(params.has('children')).toBe(false);
    });

    it('includes children when non-zero', () => {
        const url = buildSearchUrl({ ...baseArgs, children: 2, guestsTouched: true });
        const params = new URL(url, 'https://example.com').searchParams;
        expect(params.get('children')).toBe('2');
    });

    it('omits adults when only children was touched (adults untouched)', () => {
        // Regression for BETA-161 round 2: the hero used a single combined
        // `guestsTouched` flag shared by both steppers, so touching only
        // children leaked the untouched `adults` default (2) into the URL
        // as an unasserted filter. The component now tracks
        // `adultsTouched`/`childrenTouched` independently and passes only
        // `adultsTouched` as this `guestsTouched` gate arg.
        const url = buildSearchUrl({ ...baseArgs, children: 1, guestsTouched: false });
        const params = new URL(url, 'https://example.com').searchParams;
        expect(params.has('adults')).toBe(false);
        expect(params.get('children')).toBe('1');
    });

    it('returns the bare base URL when no params are set', () => {
        const url = buildSearchUrl({ ...baseArgs, guestsTouched: false });
        expect(url).toBe('/es/alojamientos/');
    });
});
