/**
 * Alliance route aggregator (HOS-277)
 * Re-exports all alliance route tiers (public, admin). No protected tier —
 * lead submission is public and lead handling is admin-only (HOS-277 §6.3).
 */
export { adminAllianceRoutes } from './admin/index.js';
export { publicAllianceRoutes } from './public/index.js';
