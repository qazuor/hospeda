/**
 * @file listing-cache.test.ts
 * @description Regression tests for the accommodation listing/map Cloudflare
 * edge-cache policy (HOS-218). The listing/map SSR pages served
 * `cf-cache-status: DYNAMIC` (no `Cache-Control`), so every anonymous/bot hit
 * re-ran the SSR + 4 catalog fetches. These tests pin the two pure decisions
 * behind the fix: which responses are shareable, and the header value emitted.
 */

import { describe, expect, it } from 'vitest';
import {
    hasActiveAccommodationListingFilters,
    LISTING_CACHEABLE_CONTROL,
    LISTING_PRIVATE_CONTROL,
    resolveListingCacheControl
} from '@/lib/cache/listing-cache';

/** Convenience: build the params from a query string. */
const params = (qs: string): URLSearchParams => new URLSearchParams(qs);

describe('resolveListingCacheControl', () => {
    it('emits a public, edge-cacheable Cache-Control for a shareable response', () => {
        // Arrange / Act
        const value = resolveListingCacheControl({ cacheable: true });

        // Assert
        expect(value).toBe(LISTING_CACHEABLE_CONTROL);
        expect(value).toContain('public');
        expect(value).toContain('s-maxage=');
        expect(value).toContain('stale-while-revalidate=');
    });

    it('emits a private, non-shareable Cache-Control for a personalised/filtered response', () => {
        // Arrange / Act
        const value = resolveListingCacheControl({ cacheable: false });

        // Assert
        expect(value).toBe(LISTING_PRIVATE_CONTROL);
        expect(value).toContain('private');
        expect(value).not.toContain('public');
        expect(value).not.toContain('s-maxage');
    });
});

describe('hasActiveAccommodationListingFilters', () => {
    it('returns false for a bare base listing URL', () => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params('') })).toBe(false);
    });

    it('returns false when only pagination / sort / date-context / type params are present', () => {
        // These do not narrow the underlying result set (sort/pagination) or are
        // informational (checkIn/checkOut), or are the type facet handled
        // separately per page.
        expect(
            hasActiveAccommodationListingFilters({
                searchParams: params(
                    'page=3&sortBy=priceAsc&sortOrder=asc&checkIn=2026-08-01&checkOut=2026-08-05&types=HOTEL'
                )
            })
        ).toBe(false);
    });

    it('returns false when party size is at its defaults (2 adults / 0 children)', () => {
        expect(
            hasActiveAccommodationListingFilters({
                searchParams: params('adults=2&children=0&sortBy=featured')
            })
        ).toBe(false);
    });

    it('returns true when adults are above the default (narrows via minGuests)', () => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params('adults=4') })).toBe(
            true
        );
    });

    it('returns true when children are above the default (narrows via minGuests)', () => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params('children=2') })).toBe(
            true
        );
    });

    it.each([
        'q=hotel',
        'minPrice=5000',
        'maxPrice=90000',
        'destinationIds=abc',
        'amenities=wifi',
        'features=pool',
        'minRating=4',
        'minBedrooms=2',
        'minBathrooms=1',
        'isFeatured=true',
        'hasWifi=true',
        'hasPool=true',
        'hasParking=true',
        'allowsPets=true',
        'includeNoPrice=false',
        'includeNoReviews=false',
        'latitude=-32&longitude=-58&radius=5',
        'poiId=abc&radius=5',
        'poiSlug=parque-nacional&radius=5'
    ])('returns true when a result-narrowing filter is active: %s', (qs) => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params(qs) })).toBe(true);
    });

    it('returns true when a real filter is combined with non-filtering params', () => {
        expect(
            hasActiveAccommodationListingFilters({
                searchParams: params('sortBy=featured&page=2&minPrice=10000')
            })
        ).toBe(true);
    });
});
