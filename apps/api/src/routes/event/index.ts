/**
 * Event route aggregator
 * Re-exports all event route tiers (public, protected, admin).
 * Each tier is self-contained and registers its own routes internally.
 */
export { adminEventRoutes } from './admin/index.js';
export { protectedEventRoutes } from './protected/index.js';
export { publicEventRoutes } from './public/index.js';
