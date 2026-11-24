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
 * The venue's pinned coordinates as numbers, or `null` when the owner pinned
 * none (empty strings) or they do not parse. `0` is a real coordinate.
 *
 * @param params.location - The venue's address, or `null`.
 * @returns `{ coordinates }`, `null` inside when there is no usable pin.
 */
export function resolveVenueCoordinates({
    location
}: {
    readonly location: VenueDetailLocation | null;
}): { readonly coordinates: { readonly lat: number; readonly lng: number } | null } {
    if (!location || location.lat === '' || location.long === '') return { coordinates: null };
    const lat = Number(location.lat);
    const lng = Number(location.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { coordinates: null };
    return { coordinates: { lat, lng } };
}

/**
 * OpenStreetMap link for the venue's pin, or `null` when there are no
 * coordinates. Kept next to the inline map (owner smoke, HOS-2520) as the
 * "open it in a full map" escape.
 *
 * @param params.location - The venue's address, or `null`.
 * @returns The map URL, or `null`.
 */
export function buildVenueMapUrl({
    location
}: {
    readonly location: VenueDetailLocation | null;
}): string | null {
    const { coordinates } = resolveVenueCoordinates({ location });
    if (!coordinates) return null;
    const { lat, lng } = coordinates;

    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
