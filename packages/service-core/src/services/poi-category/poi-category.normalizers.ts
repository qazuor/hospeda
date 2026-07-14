import type { PoiCategoryCreateInput, PoiCategoryUpdateInput } from '@repo/schemas';
import type { Actor, ListOptions } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating a POI category.
 *
 * Mirrors `point-of-interest.normalizers.ts`'s shape: `slug` is always
 * caller-provided (no name-derived slug generation), so this is mostly
 * pass-through normalization plus `adminInfo` cleanup.
 *
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: PoiCategoryCreateInput,
    _actor: Actor
): PoiCategoryCreateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {})
    };
};

/**
 * Normalizes the input data for updating a POI category.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified, aside from adminInfo) data.
 */
export const normalizeUpdateInput = (
    data: PoiCategoryUpdateInput,
    _actor: Actor
): PoiCategoryUpdateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {})
    };
};

/**
 * Normalizes the parameters for listing POI categories.
 * @param params The original listing parameters.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) parameters.
 */
export const normalizeListInput = (params: ListOptions, _actor: Actor): ListOptions => {
    return params;
};

/**
 * Normalizes the parameters for viewing a single POI category.
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
