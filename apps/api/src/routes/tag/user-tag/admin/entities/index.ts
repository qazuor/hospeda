/**
 * Entity tag assignment routes aggregator (T-028)
 *
 * Re-exports per-actor entity tag assignment routes.
 * These routes live under /admin/entities/:type/:id/tags/*.
 *
 * The super-admin attribution view (all assignments, no /own suffix) is in
 * entity-attribution.ts (T-026), mounted at the same path without /own.
 *
 * @see SPEC-086 D-007, D-017, T-028
 */
export { adminAddEntityTagRoute } from './add.js';
export { adminListOwnEntityTagsRoute } from './list-own.js';
export { adminRemoveEntityTagRoute } from './remove.js';
