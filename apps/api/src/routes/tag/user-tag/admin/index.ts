/**
 * User-tag admin routes index (T-025, T-026, T-027)
 *
 * Assembles all admin user-tag sub-routers and exports them for mounting
 * in the main routes/index.ts.
 *
 * Routers exported:
 *   adminInternalTagRoutes     → /api/v1/admin/tags/internal
 *   adminSystemTagRoutes       → /api/v1/admin/tags/system
 *   adminOwnTagRoutes          → /api/v1/admin/tags/own
 *   adminUserTagModerationRoutes → /api/v1/admin/tags/user  (moderation)
 *
 * Entity-level routers are in entities.ts (T-028):
 *   adminEntityTagAssignmentRoutes → /api/v1/admin/entities
 *   adminEntityTagAttributionRoutes → /api/v1/admin/entities (attribution)
 *
 * IMPORTANT — Mounting order in routes/index.ts must be:
 *   1. /admin/tags/own     BEFORE /admin/tags/:id  (avoid Hono treating 'own' as UUID)
 *   2. /admin/tags/internal BEFORE /admin/tags
 *   3. /admin/tags/system   BEFORE /admin/tags
 *   4. /admin/tags/user     BEFORE /admin/tags (if existing /admin/tags covers :type)
 *
 * Hono sibling route middleware collision (project-known gotcha):
 *   When sub-routers are mounted at the same base path, ALL siblings' middleware
 *   runs on path resolution. Tests need the UNION of requiredPermissions across
 *   all sibling routers.
 *
 * @see SPEC-086 T-025..T-028, decisions.md D-002, D-017, D-024
 */
import { createRouter } from '../../../../utils/create-app';

// ─── INTERNAL sub-router ─────────────────────────────────────────────────────
import {
    adminCreateInternalTagRoute,
    adminDeleteInternalTagRoute,
    adminGetInternalTagByIdRoute,
    adminGetInternalTagImpactRoute,
    adminListInternalTagsRoute,
    adminUpdateInternalTagRoute
} from './internal/index.js';

// ─── SYSTEM sub-router ───────────────────────────────────────────────────────
import {
    adminCreateSystemTagRoute,
    adminDeleteSystemTagRoute,
    adminGetSystemTagByIdRoute,
    adminGetSystemTagImpactRoute,
    adminListSystemTagsRoute,
    adminUpdateSystemTagRoute
} from './system/index.js';

// ─── OWN USER tag sub-router ─────────────────────────────────────────────────
import {
    adminCreateOwnTagRoute,
    adminDeleteOwnTagRoute,
    adminGetOwnTagImpactRoute,
    adminGetOwnTagQuotaRoute,
    adminListOwnTagsRoute,
    adminUpdateOwnTagRoute
} from './own/index.js';

// ─── USER moderation sub-router ──────────────────────────────────────────────
import { adminUserTagModerationRoutes } from './user-moderation.js';

// ─── Entity attribution sub-router (T-026) ───────────────────────────────────
import { adminEntityTagAttributionRoutes } from './entity-attribution.js';

// ─── INTERNAL sub-router assembly ────────────────────────────────────────────
const internalApp = createRouter();

// NOTE: /:id/impact MUST be before /:id to avoid Hono matching 'impact' as UUID
internalApp.route('/', adminListInternalTagsRoute);
internalApp.route('/', adminCreateInternalTagRoute);
internalApp.route('/', adminGetInternalTagImpactRoute);
internalApp.route('/', adminGetInternalTagByIdRoute);
internalApp.route('/', adminUpdateInternalTagRoute);
internalApp.route('/', adminDeleteInternalTagRoute);

// ─── SYSTEM sub-router assembly ──────────────────────────────────────────────
const systemApp = createRouter();

// NOTE: /:id/impact MUST be before /:id to avoid Hono matching 'impact' as UUID
systemApp.route('/', adminListSystemTagsRoute);
systemApp.route('/', adminCreateSystemTagRoute);
systemApp.route('/', adminGetSystemTagImpactRoute);
systemApp.route('/', adminGetSystemTagByIdRoute);
systemApp.route('/', adminUpdateSystemTagRoute);
systemApp.route('/', adminDeleteSystemTagRoute);

// ─── OWN USER tag sub-router assembly ────────────────────────────────────────
const ownApp = createRouter();

// NOTE: /quota MUST be before /:id to avoid Hono treating 'quota' as UUID
// NOTE: /:id/impact MUST be before /:id
ownApp.route('/', adminGetOwnTagQuotaRoute);
ownApp.route('/', adminListOwnTagsRoute);
ownApp.route('/', adminCreateOwnTagRoute);
ownApp.route('/', adminGetOwnTagImpactRoute);
ownApp.route('/', adminUpdateOwnTagRoute);
ownApp.route('/', adminDeleteOwnTagRoute);

export {
    internalApp as adminInternalTagRoutes,
    systemApp as adminSystemTagRoutes,
    ownApp as adminOwnTagRoutes,
    adminUserTagModerationRoutes,
    adminEntityTagAttributionRoutes
};
