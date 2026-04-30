/**
 * INTERNAL tag routes aggregator (T-025)
 *
 * Re-exports all INTERNAL tag route handlers.
 * Mounted at /api/v1/admin/tags/internal.
 *
 * @see SPEC-086 D-002, D-017, T-025
 */
export { adminCreateInternalTagRoute } from './create.js';
export { adminDeleteInternalTagRoute } from './delete.js';
export { adminGetInternalTagByIdRoute } from './get.js';
export { adminGetInternalTagImpactRoute } from './impact.js';
export { adminListInternalTagsRoute } from './list.js';
export { adminUpdateInternalTagRoute } from './update.js';
