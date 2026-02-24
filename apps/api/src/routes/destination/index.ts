/**
 * Destination route aggregator
 * Re-exports all destination route tiers (public, protected, admin).
 * Each tier is self-contained and registers its own routes internally.
 */
export { adminDestinationRoutes } from './admin/index.js';
export { protectedDestinationRoutes } from './protected/index.js';
export { publicDestinationRoutes } from './public/index.js';
