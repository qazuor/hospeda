/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/addon/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/addon.catalog
 */
export { listAvailableAddons, getAddonCatalogEntry } from '@repo/service-core';
