/**
 * @file listing-cache.test.ts
 * @description Regression tests for the accommodation listing/map Cloudflare
 * edge-cache policy (HOS-218). The listing/map SSR pages served
 * `cf-cache-status: DYNAMIC` (no `Cache-Control`), so every anonymous/bot hit
 * re-ran the SSR + 4 catalog fetches. These tests pin the pure decision behind
 * the fix: which responses are shareable.
 *
 * The `Cache-Control` VALUE itself is no longer decided by this file — since
 * HOS-426 the TTL comes from the page's cache class (`cache-classes.ts`), and
 * `resolveListingCacheControl`/`LISTING_CACHEABLE_CONTROL` were deleted along
 * with it. `resolveCacheableControl` (`cache-classes.test.ts`, if present) and
 * `applyCacheHeaders` (`response-cache.test.ts`) cover that value now.
 */

import { describe, expect, it } from 'vitest';
import { hasActiveAccommodationListingFilters } from '@/lib/cache/listing-cache';

/** Convenience: build the params from a query string. */
const params = (qs: string): URLSearchParams => new URLSearchParams(qs);

describe('hasActiveAccommodationListingFilters', () => {
    it('returns false for a bare base listing URL', () => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params('') })).toBe(false);
    });

    it('returns false when only pagination / sort / type params are present', () => {
        // These do not narrow the underlying result set (sort/pagination), or
        // are the type facet handled separately per page.
        expect(
            hasActiveAccommodationListingFilters({
                searchParams: params('page=3&sortBy=priceAsc&sortOrder=asc&types=HOTEL')
            })
        ).toBe(false);
    });

    // H-120: this case used to assert `false` for a URL carrying checkIn and
    // checkOut, on the grounds that the dates were "informational". They are
    // not any more — the listing pages forward them and the server filters by
    // availability. Had this stayed `false`, wiring the filter would have made
    // Cloudflare cache one visitor's date-filtered HTML and serve it to the
    // next visitor asking for different dates: a missing filter traded for a
    // wrong one.
    it('treats a complete date range as an active filter', () => {
        expect(
            hasActiveAccommodationListingFilters({
                searchParams: params('checkIn=2026-08-01&checkOut=2026-08-05')
            })
        ).toBe(true);
    });

    it('treats even a lone date as an active filter', () => {
        // The API drops a half range, so the RESULTS come back unfiltered — but
        // this predicate decides SHAREABILITY, and it stays conservative:
        // erring toward `private` costs a cache miss, while erring the other
        // way serves the wrong page to the next visitor.
        expect(
            hasActiveAccommodationListingFilters({ searchParams: params('checkIn=2026-08-01') })
        ).toBe(true);
        expect(
            hasActiveAccommodationListingFilters({ searchParams: params('checkOut=2026-08-05') })
        ).toBe(true);
    });

    it('treats an explicit adults=2 as an active filter (no more invisible default, BETA-161)', () => {
        // Since BETA-161 the hero only emits `adults` when its stepper was
        // touched, so ANY explicit `adults` reaching this predicate — even the
        // old "invisible default" of 2 — is a real, active filter.
        expect(
            hasActiveAccommodationListingFilters({
                searchParams: params('adults=2&children=0&sortBy=featured')
            })
        ).toBe(true);
    });

    it('treats an explicit adults=1 as an active filter', () => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params('adults=1') })).toBe(
            true
        );
    });

    it('returns true when adults are above the default (narrows via minGuests)', () => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params('adults=4') })).toBe(
            true
        );
    });

    it('does not treat children=0 alone (without adults) as an active filter', () => {
        expect(hasActiveAccommodationListingFilters({ searchParams: params('children=0') })).toBe(
            false
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
