import type { Feature, FeatureCreateInput, FeatureUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';
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
 * Sets default pagination values and normalizes filter values.
 *
 * @param params - The original listing parameters
 * @param _actor - The actor performing the action (unused in this normalization)
 * @returns The normalized parameters with defaults applied
 *
 * @example
 * ```typescript
 * const normalized = normalizeListInput({
 *   page: 1,
 *   name: '  Pool  ',
 *   isFeatured: true
 * }, actor);
 * // Returns: {
 * //   page: 1,
 * //   pageSize: 10,
 * //   name: 'Pool',
 * //   isFeatured: true
 * // }
 * ```
 */
export const normalizeListInput = (
    params: {
        page?: number;
        pageSize?: number;
        name?: string;
        slug?: string;
        isFeatured?: boolean;
        isBuiltin?: boolean;
        category?: string;
        [key: string]: unknown;
    },
    _actor: Actor
): {
    page: number;
    pageSize: number;
    name?: string;
    slug?: string;
    isFeatured?: boolean;
    isBuiltin?: boolean;
    category?: string;
    [key: string]: unknown;
} => {
    // Set default pagination values
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize =
        params.pageSize && params.pageSize > 0 && params.pageSize <= 100 ? params.pageSize : 10;

    // Normalize string filters (trim whitespace)
    const name = typeof params.name === 'string' ? params.name.trim() : undefined;
    const slug = typeof params.slug === 'string' ? params.slug.trim().toLowerCase() : undefined;
    const category = typeof params.category === 'string' ? params.category.trim() : undefined;

    // Build normalized params
    const normalized: {
        page: number;
        pageSize: number;
        name?: string;
        slug?: string;
        isFeatured?: boolean;
        isBuiltin?: boolean;
        category?: string;
        [key: string]: unknown;
    } = {
        page,
        pageSize
    };

    // Add optional filters only if they have meaningful values
    if (name && name.length > 0) {
        normalized.name = name;
    }
    if (slug && slug.length > 0) {
        normalized.slug = slug;
    }
    if (category && category.length > 0) {
        normalized.category = category;
    }
    if (typeof params.isFeatured === 'boolean') {
        normalized.isFeatured = params.isFeatured;
    }
    if (typeof params.isBuiltin === 'boolean') {
        normalized.isBuiltin = params.isBuiltin;
    }

    // Copy any other parameters as-is
    for (const [key, value] of Object.entries(params)) {
        if (
            !['page', 'pageSize', 'name', 'slug', 'category', 'isFeatured', 'isBuiltin'].includes(
                key
            )
        ) {
            normalized[key] = value;
        }
    }

    return normalized;
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
    // For now, return the feature as-is
    // In the future, this could:
    // 1. Remove adminInfo for non-admin actors
    // 2. Filter out internal fields based on permissions
    // 3. Transform relationships to simpler formats
    // 4. Add computed fields (e.g., accommodation count)

    // Example of future permission-based filtering:
    // if (!hasPermission(actor, 'FEATURE_VIEW_ADMIN_INFO')) {
    //   const { adminInfo, ...rest } = feature;
    //   return rest as Feature;
    // }

    return feature;
};
