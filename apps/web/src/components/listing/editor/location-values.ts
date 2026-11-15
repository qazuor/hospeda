/**
 * @file location-values.ts
 * @description Form-state helpers for the venue postal address (HOS-2189).
 *
 * Kept out of `ListingEditor.client.tsx` (already far past the file-size
 * ceiling) so the load and the diff can be unit-tested without mounting the
 * editor.
 */

import { LOCATION_ADDRESS_KEYS, type LocationValues } from './listing-edit-data';

/** An address with nothing informed. */
export const EMPTY_LOCATION_VALUES: LocationValues = {
    street: '',
    number: '',
    floor: '',
    apartment: '',
    lat: '',
    long: ''
};

/** Reads one possibly-absent string member of an unknown record. */
function readString({ source, key }: { readonly source: unknown; readonly key: string }): string {
    if (typeof source !== 'object' || source === null) return '';
    const value = (source as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
}

/**
 * Parses the stored `location` JSON into the form state.
 *
 * Anything that is not an object collapses to an empty address, which is what
 * a listing saved before the column existed looks like (`null`).
 *
 * @param params - The raw `location` value read off the listing detail.
 * @returns The form state, with `''` for every member not informed.
 */
export function parseLocationValues({ raw }: { readonly raw: unknown }): LocationValues {
    const coordinates =
        typeof raw === 'object' && raw !== null
            ? (raw as Record<string, unknown>).coordinates
            : undefined;

    return {
        street: readString({ source: raw, key: 'street' }),
        number: readString({ source: raw, key: 'number' }),
        floor: readString({ source: raw, key: 'floor' }),
        apartment: readString({ source: raw, key: 'apartment' }),
        lat: readString({ source: coordinates, key: 'lat' }),
        long: readString({ source: coordinates, key: 'long' })
    };
}

/**
 * Builds the `location` PATCH object: only the members that changed.
 *
 * The API merges `location` per key, so an omitted key means "keep" and `''`
 * means "clear" (the shared postal schema admits `''` for exactly that).
 * Coordinates travel as a unit and only when BOTH are filled: the API has no
 * way to clear them and a half pin is not a place.
 *
 * @param params - The current and baseline form state.
 * @returns The PATCH object, or `undefined` when nothing changed.
 */
export function buildLocationPatch({
    current,
    baseline
}: {
    readonly current: LocationValues;
    readonly baseline: LocationValues;
}): Record<string, unknown> | undefined {
    const patch: Record<string, unknown> = {};

    for (const key of LOCATION_ADDRESS_KEYS) {
        if (current[key].trim() !== baseline[key].trim()) {
            patch[key] = current[key].trim();
        }
    }

    const coordinatesChanged = current.lat !== baseline.lat || current.long !== baseline.long;
    if (coordinatesChanged && current.lat.trim() !== '' && current.long.trim() !== '') {
        patch.coordinates = { lat: current.lat.trim(), long: current.long.trim() };
    }

    return Object.keys(patch).length > 0 ? patch : undefined;
}
