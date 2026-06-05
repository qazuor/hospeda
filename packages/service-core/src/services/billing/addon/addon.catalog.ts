/**
 * Add-on Catalog Module
 *
 * Handles listing and retrieval of available add-on definitions.
 * Delegates to {@link AddonCatalogService} which reads from the `billing_addons`
 * DB table (SPEC-192 T-004).
 *
 * Public API is unchanged from the static-config era — all downstream consumers
 * continue to call `listAvailableAddons()` and `getAddonCatalogEntry()` with the
 * same signatures and receive the same `ServiceResult<AddonDefinition>` shapes.
 *
 * @module services/addon.catalog
 */

import type { AddonDefinition } from '@repo/billing';
import { AddonCatalogService } from './addon-catalog.service.js';
import type { ListAvailableAddonsInput, ServiceResult } from './addon.types.js';

// ---------------------------------------------------------------------------
// Module-level singleton — avoids re-constructing on every call while keeping
// the module stateless (no shared DB connection beyond what getDb() manages).
// ---------------------------------------------------------------------------
const catalogService = new AddonCatalogService();

/**
 * List available add-ons.
 *
 * Delegates to {@link AddonCatalogService#list}. Reads from the `billing_addons`
 * DB table filtered by billing type, target category, and active status. Results
 * are sorted by `sortOrder` ascending.
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
    return catalogService.list(input);
}

/**
 * Get a single add-on by its slug.
 *
 * Delegates to {@link AddonCatalogService#getBySlug}. Returns NOT_FOUND if
 * the slug does not match any row in `billing_addons`.
 *
 * @param slug - The add-on slug identifier
 * @returns The matching add-on definition or a NOT_FOUND error
 *
 * @example
 * ```ts
 * const result = await getAddonCatalogEntry('extra-photos-20');
 * if (result.success) {
 *   console.log(result.data.name);
 * }
 * ```
 */
export async function getAddonCatalogEntry(slug: string): Promise<ServiceResult<AddonDefinition>> {
    return catalogService.getBySlug(slug);
}
