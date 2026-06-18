/**
 * Experience route aggregator (SPEC-240 T-019 / T-020 / T-021)
 * Re-exports all experience route tiers (public, protected, admin).
 * Each tier is self-contained and registers its own routes internally.
 */
export { adminExperienceRoutes } from './admin/index.js';
export { protectedExperienceRoutes } from './protected/index.js';
export { publicExperienceRoutes } from './public/index.js';
