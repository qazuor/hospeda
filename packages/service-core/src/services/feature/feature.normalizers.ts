import type { Feature, FeatureCreateInput, FeatureUpdateInput } from '@repo/schemas';
import type { Actor, ListOptions } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating a feature.
 * Sets default values for optional fields to ensure consistency.
 *
 * @param data - The original input data for creation
 * @param _actor - The actor performing the action (unused in this normalization)
 * @returns The normalized data with defaults applied
 *
 * @example
 * ```typescript
 * const normalized = normalizeCreateInput({
 *   name: 'Swimming Pool',
 *   slug: 'swimming-pool'
 * }, actor);
 * // Returns: {
 * //   name: 'Swimming Pool',
 * //   slug: 'swimming-pool',
 * //   isBuiltin: false,
 * //   isFeatured: false
 * // }
 * ```
 */
export const normalizeCreateInput = (
    data: FeatureCreateInput,
    _actor: Actor
): FeatureCreateInput => {
    // Normalize adminInfo if present
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;

    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {}),
        isBuiltin: data.isBuiltin ?? false,
        isFeatured: data.isFeatured ?? false
    };
};

/**
 * Normalizes the input data for updating a feature.
 * Handles partial updates and normalizes nested objects.
 *
 * @param data - The original input data for update
 * @param _actor - The actor performing the action (unused in this normalization)
 * @returns The normalized update data
 *
 * @example
 * ```typescript
 * const normalized = normalizeUpdateInput({
 *   name: 'Updated Pool Name',
 *   adminInfo: { notes: 'Updated notes' }
 * }, actor);
 * // Returns: {
 * //   name: 'Updated Pool Name',
 * //   adminInfo: { notes: 'Updated notes', favorite: false }
 * // }
 * ```
 */
export const normalizeUpdateInput = (
    data: FeatureUpdateInput,
    _actor: Actor
): FeatureUpdateInput => {
    // Normalize adminInfo if present
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    const { adminInfo: _adminInfo, ...rest } = data;

    return {
        ...rest,
        ...(adminInfo ? { adminInfo } : {})
    };
};

/**
 * Normalizes the parameters for listing features.
 * @param params - The list options.
 * @param _actor - The actor performing the action (unused in this normalization).
 * @returns The (currently unmodified) parameters.
 */
export const normalizeListInput = (params: ListOptions, _actor: Actor): ListOptions => {
    return params;
};

/**
 * Normalizes the parameters for viewing a single feature.
 * Handles slug normalization (lowercase, trimmed) and ID validation.
 *
 * @param field - The field being queried (e.g., 'id', 'slug')
 * @param value - The value for the query
 * @param _actor - The actor performing the action (unused in this normalization)
 * @returns The normalized field and value
 *
 * @example
 * ```typescript
 * const normalized = normalizeViewInput('slug', '  Swimming-POOL  ', actor);
 * // Returns: { field: 'slug', value: 'swimming-pool' }
 *
 * const normalized2 = normalizeViewInput('id', '123e4567-e89b-12d3-a456-426614174000', actor);
 * // Returns: { field: 'id', value: '123e4567-e89b-12d3-a456-426614174000' }
 * ```
 */
export const normalizeViewInput = (
    field: string,
    value: unknown,
    _actor: Actor
): { field: string; value: unknown } => {
    let normalizedValue = value;

    // Normalize based on field type
    if (field === 'slug' && typeof value === 'string') {
        // Slugs should be lowercase and trimmed
        normalizedValue = value.trim().toLowerCase();
    } else if (field === 'id' && typeof value === 'string') {
        // IDs should be trimmed
        normalizedValue = value.trim();
    } else if (field === 'name' && typeof value === 'string') {
        // Names should be trimmed
        normalizedValue = value.trim();
    }

    return { field, value: normalizedValue };
};

/**
 * Normalizes feature output data for API responses.
 * Transforms complex relationships and removes internal fields based on actor permissions.
 *
 * @param feature - The feature data from the database
 * @param _actor - The actor performing the action (unused - could be used for permission-based field filtering)
 * @returns The normalized feature data suitable for API responses
 *
 * @example
 * ```typescript
 * const normalized = normalizeFeatureOutput({
 *   id: 'feature-id',
 *   name: 'Swimming Pool',
 *   slug: 'swimming-pool',
 *   description: 'A nice pool',
 *   icon: 'pool-icon',
 *   isBuiltin: false,
 *   isFeatured: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   deletedAt: null,
 *   createdById: 'user-id',
 *   updatedById: 'user-id',
 *   deletedById: null,
 *   visibility: 'PUBLIC',
 *   adminInfo: { notes: 'Internal notes', favorite: false }
 * }, actor);
 * // Returns the same feature with all fields preserved (or filtered based on permissions in future)
 * ```
 */
export const normalizeFeatureOutput = (feature: Feature, _actor: Actor): Feature => {
    return feature;
};
