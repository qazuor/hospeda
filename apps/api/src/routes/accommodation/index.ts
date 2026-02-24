/**
 * Accommodation route aggregator
 * Re-exports all accommodation route tiers (public, protected, admin).
 * Each tier is self-contained and registers its own routes internally.
 */
export { adminAccommodationRoutes } from './admin/index.js';
export { protectedAccommodationRoutes } from './protected/index.js';
export { publicAccommodationRoutes } from './public/index.js';
