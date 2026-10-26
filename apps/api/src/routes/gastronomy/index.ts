/**
 * Gastronomy route aggregator (SPEC-239 T-042 / T-043 / T-044 / T-045 / T-046)
 * Re-exports all gastronomy route tiers (public, protected, admin).
 * Each tier is self-contained and registers its own routes internally.
 */
export { adminGastronomyRoutes } from '../gastronomy/admin/index.js';
export { protectedGastronomyRoutes } from '../gastronomy/protected/index.js';
export { publicGastronomyRoutes } from '../gastronomy/public/index.js';
