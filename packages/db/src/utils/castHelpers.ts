import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostId,
    RoleId,
    TagId,
    UserId
} from '@repo/types';

/**
 * Castea todos los campos brandId conocidos a su tipo correspondiente si existen en el input.
 */
export const castBrandedIds = <T extends Record<string, unknown>>(input: T): T => {
    const brandIdFields: Record<string, (id: string) => unknown> = {
        ownerId: (id: string) => id as UserId,
        destinationId: (id: string) => id as DestinationId,
        createdById: (id: string) => id as UserId,
        updatedById: (id: string) => id as UserId,
        deletedById: (id: string) => id as UserId,
        id: (id: string) => id as AccommodationId, // para entidades principales
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
    return result as T;
};

/**
 * Convierte todos los campos de fecha conocidos de string a Date si es necesario.
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
