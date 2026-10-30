/**
 * Venue route aggregator (SPEC-239 T-042 / T-043 / T-044 / T-045 / T-046)
 * Re-exports all venue route tiers (public, protected, admin).
 * Each tier is self-contained and registers its own routes internally.
 */
export { adminVenueRoutes } from './admin/index.js';
export { protectedVenueRoutes } from './protected/index.js';
export { publicVenueRoutes } from './public/index.js';
