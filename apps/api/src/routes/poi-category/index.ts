/**
 * POI-category catalog routes.
 * Admin tier (HOS-144 NG-1): the catalog is admin-editable (per
 * `packages/service-core/CLAUDE.md`). Public tier (HOS-147): a read-only
 * catalog list consumed by the web thematic filter-chip UI.
 */
export { adminPoiCategoryRoutes } from './admin/index.js';
export { publicPoiCategoryRoutes } from './public/index.js';
