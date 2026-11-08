/**
 * @file amenity-attributes.ts
 * @description Parses the declared amenity relation attributes (`scope`,
 * `availability`) off raw API rows (HOS-2058, HOS-2061).
 *
 * Its own dependency-free module so the client editor islands can read the
 * protected read-back without pulling the whole `transforms` module (and its
 * logger/env imports) into their bundle and their test mocks.
 *
 * @module lib/api/amenity-attributes
 */

import type { AmenityAttributeValue, AmenityAvailabilityValue, AmenityScopeValue } from './types';

/** Narrows a raw value to a declared amenity scope, or `null`. */
export function toAmenityScope(value: unknown): AmenityScopeValue | null {
    return value === 'private' || value === 'shared' ? value : null;
}

/** Narrows a raw value to a declared amenity availability, or `null`. */
export function toAmenityAvailability(value: unknown): AmenityAvailabilityValue | null {
    return value === 'year_round' || value === 'seasonal' ? value : null;
}

/**
 * Reads the HOS-2058 relation attributes off the protected amenity rows into a
 * map keyed by amenity id. Also reads the venue/experience `amenityAttributes`
 * read-back list (HOS-2061), whose entries carry the same keys. Rows with
 * nothing declared are left out, so the map only ever holds real declarations.
 *
 * @param items - The protected accommodation `amenities` array, or the
 *   venue/experience `amenityAttributes` list
 * @returns Declared scope/availability per amenity id
 */
export function extractAmenityAttributes(
    items: readonly (Record<string, unknown> | string)[] | undefined
): Readonly<Record<string, AmenityAttributeValue>> {
    const result: Record<string, AmenityAttributeValue> = {};
    if (!items) return result;
    for (const entry of items) {
        if (typeof entry === 'string') continue;
        const nested = entry.amenity as Record<string, unknown> | undefined;
        const id = String(entry.amenityId ?? nested?.id ?? entry.id ?? '');
        if (id.length === 0) continue;
        const scope = toAmenityScope(entry.scope);
        const availability = toAmenityAvailability(entry.availability);
        if (scope === null && availability === null) continue;
        result[id] = { scope, availability };
    }
    return result;
}
