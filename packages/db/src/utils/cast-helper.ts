import type {
    DestinationId,
    EventId,
    PostId,
    RoleId,
    TagId,
    UserId
} from '@repo/types/common/id.types';

/**
 * Casts all known brandId fields to their corresponding branded type if present in the input object.
 * Optionally, you can provide a custom caster for the 'id' field to match the domain type.
 *
 * @template T - The input object type
 * @param input - The object to cast brandId fields on
 * @param idCaster - Optional function to cast the 'id' field to the correct branded type
 * @returns A new object with brandId fields cast to their branded types
 *
 * @example
 * // Accommodation example
 * const input = { id: 'acc-1', ownerId: 'user-1' };
 * const result = castBrandedIds(input, id => id as AccommodationId);
 * // result.id is AccommodationId, result.ownerId is UserId
 *
 * @example
 * // Destination example
 * const input = { id: 'dest-1', createdById: 'user-2' };
 * const result = castBrandedIds(input, id => id as DestinationId);
 * // result.id is DestinationId, result.createdById is UserId
 */
export const castBrandedIds = <T extends Record<string, unknown>>(
    input: T,
    idCaster?: (id: string) => unknown
): T => {
    const brandIdFields: Record<string, (id: string) => unknown> = {
        ownerId: (id: string) => id as UserId,
        destinationId: (id: string) => id as DestinationId,
        createdById: (id: string) => id as UserId,
        updatedById: (id: string) => id as UserId,
        deletedById: (id: string) => id as UserId,
        postId: (id: string) => id as PostId,
        tagId: (id: string) => id as TagId,
        eventId: (id: string) => id as EventId,
        roleId: (id: string) => id as RoleId
    };
    const result: Record<string, unknown> = { ...input };
    for (const key of Object.keys(brandIdFields)) {
        if (key in result && typeof result[key] === 'string') {
            result[key] = brandIdFields[key]?.(result[key] as string);
        }
    }
    if (idCaster && 'id' in result && typeof result.id === 'string') {
        result.id = idCaster(result.id);
    }
    return result as T;
};

/**
 * Converts all known date fields from string to Date if necessary.
 *
 * @template T - The input object type
 * @param input - The object to cast date fields on
 * @returns A new object with date fields as Date objects
 *
 * @example
 * const input = { createdAt: '2024-06-01T12:00:00Z', updatedAt: '2024-06-02T12:00:00Z' };
 * const result = castDateFields(input);
 * // result.createdAt and result.updatedAt are now Date objects
 */
export const castDateFields = <T extends Record<string, unknown>>(input: T): T => {
    const dateFields = [
        'createdAt',
        'updatedAt',
        'deletedAt',
        'publishedAt',
        'startDate',
        'endDate',
        'birthDate',
        'lastLoginAt',
        'expiresAt'
    ];
    const result: Record<string, unknown> = { ...input };
    for (const key of dateFields) {
        if (key in result && typeof result[key] === 'string') {
            result[key] = new Date(result[key] as string);
        }
    }
    return result as T;
};
