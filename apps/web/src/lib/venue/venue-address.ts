/**
 * @file venue-address.ts
 * @description Pure helpers that turn a venue's structured postal address into
 * what the public page shows (HOS-2189).
 *
 * The postal address holds only street, number, floor, apartment and
 * coordinates; the city comes from the destination, never from the address
 * itself (SPEC-095). Nothing here reads the session: the address is public
 * data of the listing, so the page stays session-blind.
 */

import type { VenueDetailLocation } from '@/data/types';

/**
 * Formats the street line of an address: "Av. San Martín 123, piso 2, depto B".
 *
 * @param params.location - The venue's address, or `null`.
 * @param params.floorLabel - Localized word for "floor".
 * @param params.apartmentLabel - Localized word for "apartment / unit".
 * @returns The street line, or `''` when there is no street.
 */
export function formatVenueStreetLine({
    location,
    floorLabel,
    apartmentLabel
}: {
    readonly location: VenueDetailLocation | null;
    readonly floorLabel: string;
    readonly apartmentLabel: string;
}): string {
    if (!location || location.street === '') return '';
    const base = [location.street, location.number].filter((part) => part !== '').join(' ');
    const extras = [
        location.floor === '' ? '' : `${floorLabel} ${location.floor}`,
        location.apartment === '' ? '' : `${apartmentLabel} ${location.apartment}`
    ].filter((part) => part !== '');

    return [base, ...extras].join(', ');
}

/**
 * Builds the schema.org `address` and `geo` objects for the venue JSON-LD.
 *
 * @param params.location - The venue's address, or `null`.
 * @param params.locality - The destination name (the city).
 * @returns The two optional objects; each key is absent when it has no data.
 */
export function buildVenueJsonLdPlace({
    location,
    locality
}: {
    readonly location: VenueDetailLocation | null;
    readonly locality: string;
}): {
    readonly address?: Readonly<Record<string, string>>;
    readonly geo?: Readonly<Record<string, string | number>>;
} {
    if (!location) return {};
    const street = [location.street, location.number].filter((part) => part !== '').join(' ');
    const result: {
        address?: Readonly<Record<string, string>>;
        geo?: Readonly<Record<string, string | number>>;
    } = {};

    if (street !== '') {
        result.address = {
            '@type': 'PostalAddress',
            streetAddress: street,
            ...(locality === '' ? {} : { addressLocality: locality }),
            addressCountry: 'AR'
        };
    }

    const lat = Number(location.lat);
    const long = Number(location.long);
    if (
        location.lat !== '' &&
        location.long !== '' &&
        Number.isFinite(lat) &&
        Number.isFinite(long)
    ) {
        result.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: long };
    }

    return result;
}

/**
 * OpenStreetMap link for the venue's pin, or `null` when there are no
 * coordinates. A plain link rather than an embedded map: no script, no cookie,
 * nothing that varies by session.
 *
 * @param params.location - The venue's address, or `null`.
 * @returns The map URL, or `null`.
 */
export function buildVenueMapUrl({
    location
}: {
    readonly location: VenueDetailLocation | null;
}): string | null {
    if (!location || location.lat === '' || location.long === '') return null;
    const lat = Number(location.lat);
    const long = Number(location.long);
    if (!Number.isFinite(lat) || !Number.isFinite(long)) return null;

    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${long}#map=17/${lat}/${long}`;
}
