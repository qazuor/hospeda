import type { EventLocationCreateInput, EventLocationUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating an event location (SPEC-095).
 * Trims and cleans postal-address strings; normalizes adminInfo. Geographic
 * context is owned by the destination relation, so no city/state/country here.
 *
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: EventLocationCreateInput,
    _actor: Actor
): EventLocationCreateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);

    return {
        ...(adminInfo ? { adminInfo } : {}),
        // Required fields
        slug: data.slug?.trim().toLowerCase() || '',
        destinationId: data.destinationId,
        // Postal address fields
        street: data.street?.trim(),
        number: data.number?.trim(),
        floor: data.floor?.trim(),
        apartment: data.apartment?.trim(),
        placeName: data.placeName?.trim(),
        // Lifecycle fields
        lifecycleState: data.lifecycleState,
        // Coordinates validation
        coordinates:
            data.coordinates?.lat &&
            data.coordinates?.long &&
            typeof data.coordinates.lat === 'string' &&
            typeof data.coordinates.long === 'string' &&
            data.coordinates.lat.trim().length > 0 &&
            data.coordinates.long.trim().length > 0
                ? { lat: data.coordinates.lat.trim(), long: data.coordinates.long.trim() }
                : undefined
    };
};

/**
 * Normalizes the input data for updating an event location.
 * Trims and cleans postal-address strings.
 *
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeUpdateInput = (
    data: EventLocationUpdateInput,
    _actor: Actor
): EventLocationUpdateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);

    const result: EventLocationUpdateInput = {
        ...(adminInfo ? { adminInfo } : {})
    };

    // Identifiers / FKs
    if (data.slug) result.slug = data.slug.trim().toLowerCase();
    if (data.destinationId) result.destinationId = data.destinationId;

    // Postal address fields
    if (data.street) result.street = data.street.trim();
    if (data.number) result.number = data.number.trim();
    if (data.floor) result.floor = data.floor.trim();
    if (data.apartment) result.apartment = data.apartment.trim();
    if (data.placeName) result.placeName = data.placeName.trim();

    // Lifecycle fields
    if (data.lifecycleState) result.lifecycleState = data.lifecycleState;

    // Coordinates validation
    if (data.coordinates) {
        const { lat, long } = data.coordinates;
        if (
            typeof lat === 'string' &&
            typeof long === 'string' &&
            lat.trim().length > 0 &&
            long.trim().length > 0
        ) {
            result.coordinates = { lat: lat.trim(), long: long.trim() };
        }
    }

    return result;
};
