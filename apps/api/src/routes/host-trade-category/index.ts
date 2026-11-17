/**
 * Provider trade category catalog routes (HOS-919).
 * Admin tier (full CRUD) and public tier (the read-only catalog consumed by the
 * alliance form, the directory filter and the providers presentation page).
 */
export { adminHostTradeCategoryRoutes } from './admin/index.js';
export { publicHostTradeCategoryRoutes } from './public/index.js';
