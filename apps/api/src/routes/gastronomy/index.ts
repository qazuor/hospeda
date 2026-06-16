/**
 * Gastronomy route aggregator (SPEC-239 T-042 / T-043 / T-044)
 * Re-exports all gastronomy route tiers (public, protected).
 * Each tier is self-contained and registers its own routes internally.
 */
export { protectedGastronomyRoutes } from './protected/index.js';
export { publicGastronomyRoutes } from './public/index.js';
