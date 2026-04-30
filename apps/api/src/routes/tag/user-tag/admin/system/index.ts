/**
 * SYSTEM tag routes aggregator (T-025)
 *
 * Re-exports all SYSTEM tag route handlers.
 * Mounted at /api/v1/admin/tags/system.
 *
 * @see SPEC-086 D-002, D-017, T-025
 */
export { adminCreateSystemTagRoute } from './create.js';
export { adminDeleteSystemTagRoute } from './delete.js';
export { adminGetSystemTagByIdRoute } from './get.js';
export { adminGetSystemTagImpactRoute } from './impact.js';
export { adminListSystemTagsRoute } from './list.js';
export { adminUpdateSystemTagRoute } from './update.js';
