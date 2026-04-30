/**
 * Own USER tag routes aggregator (T-027)
 *
 * Re-exports all own USER tag route handlers.
 * Mounted at /api/v1/admin/tags/own.
 *
 * @see SPEC-086 D-007, D-017, D-021, D-022, T-027
 */
export { adminCreateOwnTagRoute } from './create.js';
export { adminDeleteOwnTagRoute } from './delete.js';
export { adminGetOwnTagImpactRoute } from './impact.js';
export { adminListOwnTagsRoute } from './list.js';
export { adminGetOwnTagQuotaRoute } from './quota.js';
export { adminUpdateOwnTagRoute } from './update.js';
