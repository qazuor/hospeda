/**
 * @file listing-cache.test.ts
 * @description Regression tests for the accommodation listing/map CDN cache
 * eligibility predicate (BETA-161). `adults` no longer has an invisible
 * "2 = default" baseline — the hero only emits `adults` when its own
 * stepper was touched (`adultsTouched`, independent of `childrenTouched`),
 * and the listing/type/map pages only seed the sidebar's `adults` from an
 * `initialParams` value that genuinely came from the incoming URL. So ANY
 * explicit `adults` value reaching this predicate (including 2) must count
 * as an active, non-shareable filter.
 */

import { describe, expect, it } from 'vitest';
import { hasActiveAccommodationListingFilters } from '../listing-cache';

describe('hasActiveAccommodationListingFilters', () => {
    it('returns false for a bare URL with no params', () => {
        const searchParams = new URLSearchParams();
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(false);
    });

    it('returns false for only non-filtering params (page/sort/context)', () => {
        const searchParams = new URLSearchParams({
            page: '2',
            sortBy: 'price',
            sortOrder: 'asc',
            checkIn: '2026-08-01',
            checkOut: '2026-08-05',
            type: 'HOTEL'
        });
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(false);
    });

    it('treats an explicit adults=2 as an active filter (no more invisible default)', () => {
        const searchParams = new URLSearchParams({ adults: '2' });
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(true);
    });

    it('treats an explicit adults=1 as an active filter', () => {
        const searchParams = new URLSearchParams({ adults: '1' });
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(true);
    });

    it('does not treat an absent adults param as an active filter', () => {
        const searchParams = new URLSearchParams({ page: '1' });
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(false);
    });

    it('treats children away from the 0 default as an active filter', () => {
        const searchParams = new URLSearchParams({ children: '1' });
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(true);
    });

    it('does not treat children=0 (the default) as an active filter', () => {
        const searchParams = new URLSearchParams({ children: '0' });
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(false);
    });

    it('returns true when any other real filter param is present', () => {
        const searchParams = new URLSearchParams({ q: 'colon' });
        expect(hasActiveAccommodationListingFilters({ searchParams })).toBe(true);
    });
});
