/**
 * Alliance route aggregator (HOS-277, protected tier added by HOS-278)
 * Re-exports all alliance route tiers (public, protected, admin). Submission
 * stays public and handling stays admin-only (HOS-277 §6.3); the protected tier
 * exists so an applicant can read their OWN applications (HOS-278 AC-5).
 */
export { adminAllianceRoutes } from './admin/index.js';
export { protectedAllianceRoutes } from './protected/index.js';
export { publicAllianceRoutes } from './public/index.js';
