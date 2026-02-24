/**
 * Post route aggregator
 * Re-exports all post route tiers (public, protected, admin).
 * Each tier is self-contained and registers its own routes internally.
 */
export { adminPostRoutes } from './admin/index.js';
export { protectedPostRoutes } from './protected/index.js';
export { publicPostRoutes } from './public/index.js';
