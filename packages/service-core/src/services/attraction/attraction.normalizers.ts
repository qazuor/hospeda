import type {
    CreateAttractionSchema,
    UpdateAttractionSchema
} from '@repo/schemas/entities/destination/destination.attraction.schema';
import type { z } from 'zod';
import type { Actor } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating an attraction.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: z.infer<typeof CreateAttractionSchema>,
    _actor: Actor
): z.infer<typeof CreateAttractionSchema> => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {})
    };
};

/**
 * Normalizes the input data for updating an attraction.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) data.
 */
export const normalizeUpdateInput = (
    data: z.infer<typeof UpdateAttractionSchema>,
    _actor: Actor
): z.infer<typeof UpdateAttractionSchema> => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {})
    };
};

/**
 * Normalizes the parameters for listing attractions.
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
 * Normalizes the parameters for viewing a single attraction.
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
