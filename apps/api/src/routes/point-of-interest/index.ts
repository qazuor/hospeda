/**
 * Point-of-interest routes
 * Re-exports the public route tier only. Points of interest are a
 * seed-only editorial catalog in Phase 1 (HOS-113 NG-5/OQ-6) — there are
 * deliberately NO protected or admin route tiers here. Admin CRUD is a
 * deferred follow-up (see spec §6.5).
 */
export { publicPointOfInterestRoutes } from './public/index.js';
