import type {
    CreateDestinationSchema,
    UpdateDestinationSchema
} from '@repo/schemas/entities/destination/destination.schema';
import { VisibilityEnum } from '@repo/types';
import type { z } from 'zod';
import type { Actor } from '../../types';

/**
 * Normalizes the input data for creating a destination.
 * If `visibility` is not provided, it defaults to 'PRIVATE' to ensure
 * new destinations are not public by accident.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data with default visibility set if needed.
 */
export const normalizeCreateInput = (
    data: z.infer<typeof CreateDestinationSchema>,
    _actor: Actor
): z.infer<typeof CreateDestinationSchema> => {
    return {
        ...data,
        visibility: data.visibility ?? VisibilityEnum.PRIVATE
    };
};

/**
 * Normalizes the input data for updating a destination.
 * This function currently acts as a placeholder. It can be extended in the future
 * to handle tasks like sanitizing HTML, trimming strings, or other data cleaning for updates.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) data.
 */
export const normalizeUpdateInput = (
    data: z.infer<typeof UpdateDestinationSchema>,
    _actor: Actor
): z.infer<typeof UpdateDestinationSchema> => {
    return data;
};

/**
 * Normalizes the parameters for listing destinations.
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
    return params;
};

/**
 * Normalizes the parameters for viewing a single destination.
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
    return { field, value };
};
