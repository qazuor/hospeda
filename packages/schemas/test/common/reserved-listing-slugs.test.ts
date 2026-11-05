import { describe, expect, it } from 'vitest';
import {
    isReservedListingSlug,
    RESERVED_LISTING_SLUGS
} from '../../src/common/reserved-listing-slugs.js';
import { VerticalEnum } from '../../src/enums/vertical.enum.js';

describe('RESERVED_LISTING_SLUGS', () => {
    it('reserves rubro and pagination segments for venues', () => {
        expect(RESERVED_LISTING_SLUGS[VerticalEnum.VENUE]).toEqual(['page', 'rubro']);
    });

    it('reserves the accommodation static siblings', () => {
        expect(RESERVED_LISTING_SLUGS[VerticalEnum.ACCOMMODATION]).toEqual([
            'caracteristicas',
            'comodidades',
            'comparar',
            'mapa',
            'page',
            'rubro',
            'tipo'
        ]);
    });

    it('reserves page and rubro for experiences', () => {
        expect(RESERVED_LISTING_SLUGS[VerticalEnum.EXPERIENCE]).toEqual(['page', 'rubro']);
    });

    it('has no reserved slugs for verticals without a listing detail route', () => {
        expect(RESERVED_LISTING_SLUGS[VerticalEnum.TOURIST]).toEqual([]);
        expect(RESERVED_LISTING_SLUGS[VerticalEnum.PARTNER]).toEqual([]);
    });
});

describe('isReservedListingSlug', () => {
    it('reserves rubro and page for venues', () => {
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'rubro' })).toBe(true);
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'page' })).toBe(true);
    });

    it('reserves tipo and mapa for accommodations but not for venues', () => {
        expect(isReservedListingSlug({ vertical: VerticalEnum.ACCOMMODATION, slug: 'tipo' })).toBe(
            true
        );
        expect(isReservedListingSlug({ vertical: VerticalEnum.ACCOMMODATION, slug: 'mapa' })).toBe(
            true
        );
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'tipo' })).toBe(false);
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'mapa' })).toBe(false);
    });

    it('reserves page for experiences', () => {
        expect(isReservedListingSlug({ vertical: VerticalEnum.EXPERIENCE, slug: 'page' })).toBe(
            true
        );
    });

    it('compares case-insensitively', () => {
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'Rubro' })).toBe(true);
    });

    it('does not reserve suffixed or embedded variants', () => {
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'rubro-2' })).toBe(
            false
        );
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'rubros' })).toBe(false);
        expect(isReservedListingSlug({ vertical: VerticalEnum.VENUE, slug: 'bar-rubro' })).toBe(
            false
        );
    });

    it('has nothing reserved for tourist and partner', () => {
        for (const keyword of ['rubro', 'page', 'tipo', 'mapa']) {
            expect(isReservedListingSlug({ vertical: VerticalEnum.TOURIST, slug: keyword })).toBe(
                false
            );
            expect(isReservedListingSlug({ vertical: VerticalEnum.PARTNER, slug: keyword })).toBe(
                false
            );
        }
    });
});
