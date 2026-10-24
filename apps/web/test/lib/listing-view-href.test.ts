import { describe, expect, it } from 'vitest';
import { buildListingViewHref } from '@/lib/listing-view-href';

describe('buildListingViewHref', () => {
    it('returns the base without an empty query', () => {
        expect(
            buildListingViewHref({
                base: '/es/alojamientos/mapa/',
                searchParams: new URLSearchParams()
            })
        ).toEqual({ href: '/es/alojamientos/mapa/' });
    });

    it('preserves filters, removes page, and keeps parameter order stable', () => {
        const searchParams = new URLSearchParams('type=HOTEL&page=3&sortBy=price');
        expect(buildListingViewHref({ base: '/es/alojamientos/mapa/', searchParams })).toEqual({
            href: '/es/alojamientos/mapa/?type=HOTEL&sortBy=price'
        });
        expect(searchParams.get('page')).toBe('3');
    });
});
