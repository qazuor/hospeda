/**
 * @file build-location-section.test.ts
 * @description Unit tests of the location block builders (HOS-2579 §6.5,
 * AC-17 to AC-19). They took over the data half of the deleted
 * `VenueAddress.astro` and `ExperienceMeetingPoint.astro` and of the moved
 * accommodation `LocationSection.astro`, so their gates are asserted here by
 * CALLING the builders.
 */

import { describe, expect, it } from 'vitest';
import type {
    AccommodationDetailData,
    ExperienceDetailData,
    VenueDetailData,
    VenueDetailLocation
} from '@/data/types';
import {
    buildAccommodationLocation,
    buildExperienceLocation,
    buildVenueLocation
} from '@/lib/listing-location/build-location-section';

const accommodation = (
    over: Partial<AccommodationDetailData> = {}
): Pick<AccommodationDetailData, 'destination' | 'approximateLocation'> => ({
    destination: { id: 'd1', slug: 'colon', name: 'Colón' },
    approximateLocation: { lat: -32.2, lng: -58.1, radiusMeters: 500 },
    ...over
});

const venueLocation = (over: Partial<VenueDetailLocation> = {}): VenueDetailLocation =>
    ({
        street: 'San Martín',
        number: '123',
        floor: '',
        apartment: '',
        lat: '-32.48',
        long: '-58.23',
        ...over
    }) as unknown as VenueDetailLocation;

const venue = (
    over: Partial<VenueDetailData> = {}
): Pick<VenueDetailData, 'name' | 'location' | 'destinationName' | 'destinationSlug'> => ({
    name: 'Bar Central',
    location: venueLocation(),
    destinationName: 'Concepción del Uruguay',
    destinationSlug: 'concepcion-del-uruguay',
    ...over
});

type ExperienceLocationInput = Parameters<typeof buildExperienceLocation>[0]['experience'];
const experience = (over: Partial<ExperienceDetailData> = {}): ExperienceLocationInput => ({
    meetingPoint: 'Muelle del puerto',
    meetingPointLat: -33.0,
    meetingPointLong: -58.5,
    meetingPointDirections: ['Entrar por la calle 25 de Mayo', 'Estacionar en la explanada'],
    meetingPointDirectionsEnabled: true,
    destinationName: 'Gualeguaychú',
    destinationSlug: 'gualeguaychu',
    ...over
});

describe('buildAccommodationLocation (AC-19)', () => {
    it('draws the approximate circle and links the destination', () => {
        // Arrange / Act
        const model = buildAccommodationLocation({ accommodation: accommodation(), locale: 'es' });
        // Assert
        expect(model.map).toMatchObject({ mode: 'approximate', radiusMeters: 500 });
        expect(model.destination).toEqual({ name: 'Colón', href: '/es/destinos/colon/' });
        expect(model.addressLines).toEqual([]);
    });

    it('draws no map without approximateLocation', () => {
        const model = buildAccommodationLocation({
            accommodation: accommodation({ approximateLocation: undefined }),
            locale: 'es'
        });
        expect(model.map).toBeNull();
    });
});

describe('buildVenueLocation (AC-17)', () => {
    it('draws the exact pin and the counted map link with coordinates', () => {
        const model = buildVenueLocation({ venue: venue(), locale: 'es' });
        expect(model?.map).toMatchObject({ mode: 'exact', lat: -32.48, lng: -58.23, zoom: 16 });
        expect(model?.addressLines).toEqual(['San Martín 123']);
        expect(model?.externalMapHref).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
        expect(model?.trackingData).toEqual({ 'interaction-kind': 'MAP_CLICK' });
        expect(model?.id).toBe('venue-address');
        expect(model?.destination).toEqual({
            name: 'Concepción del Uruguay',
            href: '/es/destinos/concepcion-del-uruguay/'
        });
    });

    it('renders the street line only without coordinates', () => {
        const model = buildVenueLocation({
            venue: venue({ location: venueLocation({ lat: '', long: '' }) }),
            locale: 'es'
        });
        expect(model?.map).toBeNull();
        expect(model?.externalMapHref).toBeUndefined();
        expect(model?.addressLines).toEqual(['San Martín 123']);
    });

    it('returns null without a street address', () => {
        expect(buildVenueLocation({ venue: venue({ location: null }), locale: 'es' })).toBeNull();
    });
});

describe('buildExperienceLocation (AC-18, HOS-1048, HOS-1049)', () => {
    it('with the entitlement: exact map and directions', () => {
        const model = buildExperienceLocation({ experience: experience(), locale: 'es' });
        expect(model?.map).toMatchObject({ mode: 'exact', lat: -33, lng: -58.5, zoom: 15 });
        expect(model?.directions).toHaveLength(2);
        expect(model?.addressLines).toEqual(['Muelle del puerto']);
    });

    it('without the entitlement: no map and no directions, text and destination stay', () => {
        const model = buildExperienceLocation({
            experience: experience({ meetingPointDirectionsEnabled: false }),
            locale: 'es'
        });
        expect(model?.map).toBeNull();
        expect(model?.directions).toBeUndefined();
        expect(model?.addressLines).toEqual(['Muelle del puerto']);
        expect(model?.destination?.href).toBe('/es/destinos/gualeguaychu/');
    });

    it('keeps a 0 coordinate (typeof, not truthiness) and drops a missing one', () => {
        expect(
            buildExperienceLocation({
                experience: experience({ meetingPointLat: 0, meetingPointLong: 0 }),
                locale: 'es'
            })?.map
        ).toMatchObject({ lat: 0, lng: 0 });
        expect(
            buildExperienceLocation({
                experience: experience({ meetingPointLat: null }),
                locale: 'es'
            })?.map
        ).toBeNull();
    });

    it('draws the map for an entitled provider with no directions typed', () => {
        const model = buildExperienceLocation({
            experience: experience({ meetingPointDirections: [] }),
            locale: 'es'
        });
        expect(model?.map).not.toBeNull();
        expect(model?.directions).toBeUndefined();
    });

    it('returns null without a meeting point', () => {
        expect(
            buildExperienceLocation({
                experience: experience({ meetingPoint: null }),
                locale: 'es'
            })
        ).toBeNull();
    });
});
