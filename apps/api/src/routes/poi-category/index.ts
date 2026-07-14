/**
 * POI-category catalog routes (HOS-144 NG-1).
 * Admin tier only for now — the catalog is admin-editable (per
 * `packages/service-core/CLAUDE.md`) but there is no public/protected
 * consumer of it yet.
 */
export { adminPoiCategoryRoutes } from './admin/index.js';
