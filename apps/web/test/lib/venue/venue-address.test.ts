/**
 * @file venue-address.test.ts
 * @description Public formatting of a venue's postal address (HOS-2189).
 */
import { describe, expect, it } from 'vitest';
import type { VenueDetailLocation } from '../../../src/data/types';
import {
    buildVenueJsonLdPlace,
    buildVenueMapUrl,
    formatVenueStreetLine
} from '../../../src/lib/venue/venue-address';

const FULL: VenueDetailLocation = {
    street: 'Av. San Martín',
    number: '123',
    floor: '2',
    apartment: 'B',
    lat: '-32.4825',
    long: '-58.2333'
};
const LABELS = { floorLabel: 'piso', apartmentLabel: 'depto.' };

describe('formatVenueStreetLine', () => {
    it('joins street, number, floor and apartment', () => {
        expect(formatVenueStreetLine({ location: FULL, ...LABELS })).toBe(
            'Av. San Martín 123, piso 2, depto. B'
        );
    });

    it('omits what is not informed', () => {
        expect(
            formatVenueStreetLine({
                location: { ...FULL, number: '', floor: '', apartment: '' },
                ...LABELS
            })
        ).toBe('Av. San Martín');
    });

    it('is empty without a location or a street', () => {
        expect(formatVenueStreetLine({ location: null, ...LABELS })).toBe('');
        expect(formatVenueStreetLine({ location: { ...FULL, street: '' }, ...LABELS })).toBe('');
    });
});

describe('buildVenueJsonLdPlace', () => {
    it('builds the address and the geo point', () => {
        const place = buildVenueJsonLdPlace({ location: FULL, locality: 'Colón' });
        expect(place.address).toEqual({
            '@type': 'PostalAddress',
            streetAddress: 'Av. San Martín 123',
            addressLocality: 'Colón',
            addressCountry: 'AR'
        });
        expect(place.geo).toEqual({
            '@type': 'GeoCoordinates',
            latitude: -32.4825,
            longitude: -58.2333
        });
    });

    it('omits the geo point without coordinates and everything without a location', () => {
        expect(
            buildVenueJsonLdPlace({ location: { ...FULL, lat: '', long: '' }, locality: '' }).geo
        ).toBeUndefined();
        expect(buildVenueJsonLdPlace({ location: null, locality: 'Colón' })).toEqual({});
    });
});

describe('buildVenueMapUrl', () => {
    it('links the pin', () => {
        expect(buildVenueMapUrl({ location: FULL })).toContain('mlat=-32.4825&mlon=-58.2333');
    });

    it('is null without usable coordinates', () => {
        expect(buildVenueMapUrl({ location: null })).toBeNull();
        expect(buildVenueMapUrl({ location: { ...FULL, lat: 'abc' } })).toBeNull();
        expect(buildVenueMapUrl({ location: { ...FULL, long: '' } })).toBeNull();
    });
});
