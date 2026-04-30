/**
 * User-tag route aggregator (SPEC-086)
 *
 * Re-exports all user-tag admin route groups for mounting in routes/index.ts.
 *
 * All user-tag routes live under /api/v1/admin/* (D-024):
 * - adminInternalTagRoutes    → /api/v1/admin/tags/internal
 * - adminSystemTagRoutes      → /api/v1/admin/tags/system
 * - adminOwnTagRoutes         → /api/v1/admin/tags/own
 * - adminUserTagModerationRoutes → /api/v1/admin/tags/user
 * - adminEntityTagRoutes      → /api/v1/admin/entities
 *
 * @see SPEC-086 D-024, T-025..T-028
 */
export {
    adminInternalTagRoutes,
    adminSystemTagRoutes,
    adminOwnTagRoutes,
    adminUserTagModerationRoutes,
    adminEntityTagAttributionRoutes
} from './admin/index.js';

export { adminEntityTagRoutes } from './admin/entities.js';
