/**
 * Host route aggregator
 *
 * Re-exports all host route tiers (protected only — host endpoints are
 * always authenticated). Public and admin tiers will be added in future
 * phases as needed (SPEC-205 Phase 2+).
 */
export { protectedHostRoutes } from './protected/index.js';
