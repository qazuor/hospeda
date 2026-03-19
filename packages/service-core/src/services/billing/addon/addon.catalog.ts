/**
 * Add-on Catalog Module
 *
 * Handles listing and retrieval of available add-on definitions.
 * Filters by billing type, target category, and active status.
 *
 * @module services/addon.catalog
 */

import { ALL_ADDONS, type AddonDefinition, getAddonBySlug } from '@repo/billing';
import type { ListAvailableAddonsInput, ServiceResult } from './addon.types.js';

/**
 * List available add-ons.
 *
 * Filters the static add-on catalog by billing type, target category, and
 * active status. Results are sorted by sortOrder ascending.
 *
 * @param input - Filter options
 * @returns Filtered and sorted list of add-on definitions
 *
 * @example
 * ```ts
 * const result = await listAvailableAddons({ billingType: 'one_time', active: true });
 * if (result.success) {
 *   console.log(result.data); // AddonDefinition[]
 * }
 * ```
 */
export async function listAvailableAddons(
    input: ListAvailableAddonsInput = {}
): Promise<ServiceResult<AddonDefinition[]>> {
    try {
        let addons = [...ALL_ADDONS];

        if (input.billingType) {
            addons = addons.filter((addon) => addon.billingType === input.billingType);
        }

        if (input.targetCategory) {
            const targetCategory = input.targetCategory;
            addons = addons.filter((addon) => addon.targetCategories.includes(targetCategory));
        }

        if (input.active !== undefined) {
            addons = addons.filter((addon) => addon.isActive === input.active);
        }

        addons.sort((a, b) => a.sortOrder - b.sortOrder);

        return { success: true, data: addons };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: `Failed to list available add-ons: ${errorMessage}`
            }
        };
    }
}

/**
 * Get a single add-on by its slug.
 *
 * Looks up the static catalog by slug. Returns NOT_FOUND if the slug does not
 * match any registered add-on definition.
 *
 * @param slug - The add-on slug identifier
 * @returns The matching add-on definition or a NOT_FOUND error
 *
 * @example
 * ```ts
 * const result = await getAddonCatalogEntry('extra-photos');
 * if (result.success) {
 *   console.log(result.data.name);
 * }
 * ```
 */
export async function getAddonCatalogEntry(slug: string): Promise<ServiceResult<AddonDefinition>> {
    try {
        const addon = getAddonBySlug(slug);

        if (!addon) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${slug}' not found` }
            };
        }

        return { success: true, data: addon };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: `Failed to get add-on: ${errorMessage}` }
        };
    }
}
