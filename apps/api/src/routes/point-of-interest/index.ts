/**
 * Point-of-interest routes
 * Public read tier plus the admin CRUD tier (HOS-143). There is
 * deliberately still NO protected tier here — points of interest are
 * curated/seed content, not user-owned resources.
 */
export { adminPointOfInterestRoutes } from './admin/index.js';
export { publicPointOfInterestRoutes } from './public/index.js';
