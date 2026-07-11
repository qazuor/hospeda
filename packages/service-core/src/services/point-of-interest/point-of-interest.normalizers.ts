import type { PointOfInterestCreateInput, PointOfInterestUpdateInput } from '@repo/schemas';
import type { Actor, ListOptions } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating a point of interest.
 *
 * Simpler than `attraction.normalizers.ts`'s version: POI has no
 * `name`-derived slug generation (HOS-113 OQ-2 — `slug` is the i18n key,
 * always provided by the caller/seed, never auto-generated), so this is
 * mostly pass-through normalization plus `adminInfo` cleanup.
 *
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: PointOfInterestCreateInput,
    _actor: Actor
): PointOfInterestCreateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {})
    };
};

/**
 * Normalizes the input data for updating a point of interest.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified, aside from adminInfo) data.
 */
export const normalizeUpdateInput = (
    data: PointOfInterestUpdateInput,
    _actor: Actor
): PointOfInterestUpdateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;
    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {})
    };
};

/**
 * Normalizes the parameters for listing points of interest.
 * @param params The original listing parameters.
 * @param _actor The actor performing the action (unused).
 * @returns The (currently unmodified) parameters.
 */
export const normalizeListInput = (params: ListOptions, _actor: Actor): ListOptions => {
    return params;
};

/**
 * Normalizes the parameters for viewing a single point of interest.
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
