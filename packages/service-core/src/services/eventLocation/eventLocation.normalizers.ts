import type { EventLocationType, UpdateEventLocationInputType } from '@repo/types';
import type { Actor } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating an event location.
 * Trims and cleans all string fields, normalizes adminInfo.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (data: EventLocationType, _actor: Actor): EventLocationType => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    return {
        id: data.id,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        city: data.city.trim(),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdById: data.createdById,
        updatedById: data.updatedById,
        street: data.street?.trim(),
        number: data.number?.trim(),
        floor: data.floor?.trim(),
        apartment: data.apartment?.trim(),
        neighborhood: data.neighborhood?.trim(),
        department: data.department?.trim(),
        placeName: data.placeName?.trim(),
        coordinates:
            data.coordinates?.lat && data.coordinates?.long
                ? { lat: String(data.coordinates.lat), long: String(data.coordinates.long) }
                : undefined,
        adminInfo,
        lifecycleState: data.lifecycleState,
        deletedAt: data.deletedAt,
        deletedById: data.deletedById
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
    data: UpdateEventLocationInputType,
    _actor: Actor
): UpdateEventLocationInputType => {
    const result: UpdateEventLocationInputType = {};
    if (data.id) result.id = data.id;
    if (data.state) result.state = data.state;
    if (data.zipCode) result.zipCode = data.zipCode;
    if (data.country) result.country = data.country;
    if (data.city) result.city = data.city.trim();
    if (data.createdAt) result.createdAt = data.createdAt;
    if (data.updatedAt) result.updatedAt = data.updatedAt;
    if (data.createdById) result.createdById = data.createdById;
    if (data.updatedById) result.updatedById = data.updatedById;
    if (data.street) result.street = data.street.trim();
    if (data.number) result.number = data.number.trim();
    if (data.floor) result.floor = data.floor.trim();
    if (data.apartment) result.apartment = data.apartment.trim();
    if (data.neighborhood) result.neighborhood = data.neighborhood.trim();
    if (data.department) result.department = data.department.trim();
    if (data.placeName) result.placeName = data.placeName.trim();
    if (data.coordinates) {
        const { lat, long } = data.coordinates;
        if (
            typeof lat === 'string' &&
            typeof long === 'string' &&
            lat.length > 0 &&
            long.length > 0
        ) {
            result.coordinates = { lat, long };
        }
    }
    if (data.adminInfo) result.adminInfo = normalizeAdminInfo(data.adminInfo);
    if (data.lifecycleState) result.lifecycleState = data.lifecycleState;
    if (data.deletedAt) result.deletedAt = data.deletedAt;
    if (data.deletedById) result.deletedById = data.deletedById;
    return result;
};
