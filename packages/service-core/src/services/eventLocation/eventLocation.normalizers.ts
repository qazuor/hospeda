import type { z } from 'zod';
import type { Actor } from '../../types';
import { normalizeAdminInfo } from '../../utils';
import type { CreateEventLocationSchema, UpdateEventLocationSchema } from './eventLocation.schemas';

/**
 * Normalizes the input data for creating an event location.
 * Trims and cleans all string fields, normalizes adminInfo.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: z.infer<typeof CreateEventLocationSchema>,
    _actor: Actor
): z.infer<typeof CreateEventLocationSchema> => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);

    return {
        ...(adminInfo ? { adminInfo } : {}),
        // LocationSchema fields
        state: data.state?.trim(),
        zipCode: data.zipCode?.trim(),
        country: data.country?.trim(),
        // EventLocationSchema specific fields
        city: data.city.trim(),
        street: data.street?.trim(),
        number: data.number?.trim(),
        floor: data.floor?.trim(),
        apartment: data.apartment?.trim(),
        neighborhood: data.neighborhood?.trim(),
        department: data.department?.trim(),
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
 * Trims and cleans all updatable string fields.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeUpdateInput = (
    data: z.infer<typeof UpdateEventLocationSchema>,
    _actor: Actor
): z.infer<typeof UpdateEventLocationSchema> => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);

    const result: z.infer<typeof UpdateEventLocationSchema> = {
        ...(adminInfo ? { adminInfo } : {})
    };

    // LocationSchema fields
    if (data.state) result.state = data.state.trim();
    if (data.zipCode) result.zipCode = data.zipCode.trim();
    if (data.country) result.country = data.country.trim();

    // EventLocationSchema specific fields
    if (data.city) result.city = data.city.trim();
    if (data.street) result.street = data.street.trim();
    if (data.number) result.number = data.number.trim();
    if (data.floor) result.floor = data.floor.trim();
    if (data.apartment) result.apartment = data.apartment.trim();
    if (data.neighborhood) result.neighborhood = data.neighborhood.trim();
    if (data.department) result.department = data.department.trim();
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
