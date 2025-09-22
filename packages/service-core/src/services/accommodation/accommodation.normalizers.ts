import type {
    AccommodationCreateInput,
    AccommodationUpdateInput,
    AccommodationWithRelations,
    NormalizedAccommodationType
} from '@repo/schemas';
import { VisibilityEnum } from '@repo/schemas';
import type { Actor } from '../../types';
import { normalizeAdminInfo, normalizeContactInfo } from '../../utils';

/**
 * Normalizes the input data for creating an accommodation.
 * If `visibility` is not provided, it defaults to 'PRIVATE' to ensure
 * new accommodations are not public by accident.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data with default visibility set if needed.
 */
export const normalizeCreateInput = (
    data: AccommodationCreateInput,
    _actor: Actor
): AccommodationCreateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;

    // Normalize contact info if present
    const normalizedContactInfo = data.contactInfo
        ? (normalizeContactInfo(data.contactInfo) as typeof data.contactInfo)
        : undefined;

    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {}),
        ...(normalizedContactInfo ? { contactInfo: normalizedContactInfo } : {}),
        visibility: data.visibility ?? VisibilityEnum.PRIVATE
    };
};

/**
 * Normalizes the input data for updating an accommodation.
 * This function currently acts as a placeholder. It can be extended in the future
 * to handle tasks like sanitizing HTML, trimming strings, or other data cleaning for updates.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) data.
 */
export const normalizeUpdateInput = (
    data: AccommodationUpdateInput,
    _actor: Actor
): AccommodationUpdateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;

    // Normalize contact info if present
    const normalizedContactInfo = data.contactInfo
        ? (normalizeContactInfo(data.contactInfo) as typeof data.contactInfo)
        : undefined;

    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {}),
        ...(normalizedContactInfo ? { contactInfo: normalizedContactInfo } : {})
    };
};

/**
 * Normalizes the parameters for listing accommodations.
 * This function is a placeholder for future logic, such as setting default
 * pagination values (e.g., page=1, pageSize=20) if they are not provided.
 * @param params The original listing parameters.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) parameters.
 */
export const normalizeListInput = (
    params: { page?: number; pageSize?: number },
    _actor: Actor
): { page?: number; pageSize?: number } => {
    // No normalization needed for list parameters at this time.
    return params;
};

/**
 * Normalizes the parameters for viewing a single accommodation.
 * This function is a placeholder for future logic, such as case-insensitivity
 * for slugs or trimming whitespace from an ID.
 * @param field The field being queried (e.g., 'id', 'slug').
 * @param value The value for the query.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) field and value.
 */
export const normalizeViewInput = (
    field: string,
    value: unknown,
    _actor: Actor
): { field: string; value: unknown } => {
    // No normalization needed for view parameters at this time.
    return { field, value };
};

/**
 * Normalizes accommodation output data for API responses.
 * Transforms complex relationship objects into simple string arrays for amenities and features.
 * Simplifies destination object to only include name and slug.
 * @param accommodation The accommodation data from the database.
 * @param _actor The actor performing the action (unused).
 * @returns The normalized accommodation data.
 */
export const normalizeAccommodationOutput = (
    accommodation: AccommodationWithRelations,
    _actor: Actor
): NormalizedAccommodationType => {
    return {
        ...accommodation,
        // Transform amenities from relationship objects to string array of slugs
        amenities: accommodation.amenities
            ?.map((amenity) =>
                typeof amenity === 'object' && amenity && 'amenity' in amenity
                    ? (amenity.amenity?.slug ?? '')
                    : amenity
            )
            .filter((slug): slug is string => typeof slug === 'string' && !!slug),

        // Transform features from relationship objects to string array of slugs
        features: accommodation.features
            ?.map((feature) =>
                typeof feature === 'object' && feature && 'feature' in feature
                    ? (feature.feature?.slug ?? '')
                    : feature
            )
            .filter((slug): slug is string => typeof slug === 'string' && !!slug),

        // Simplify destination to only include essential fields
        destination: accommodation.destination
            ? {
                  name: accommodation.destination.name ?? '',
                  slug: accommodation.destination.slug ?? ''
              }
            : undefined
    };
};
