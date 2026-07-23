/**
 * Commerce route aggregator (SPEC-239 T-047, protected tier added HOS-166)
 * Re-exports all commerce route tiers (public, protected, admin).
 */
export { adminCommerceRoutes } from './admin/index.js';
export { protectedCommerceRoutes } from './protected/index.js';
export { publicCommerceRoutes } from './public/index.js';
