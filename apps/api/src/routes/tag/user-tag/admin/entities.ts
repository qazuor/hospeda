/**
 * Entity tag assignment router (T-028)
 *
 * Assembles entity-level tag assignment routes that live under /admin/entities/*.
 * Distinct from entity-attribution.ts (T-026) which is the super-admin all-attribution view.
 *
 * Routes assembled here:
 *   GET    /admin/entities/:type/:id/tags/own   — actor's own assignments (TAG_ASSIGN_VIEW)
 *   POST   /admin/entities/:type/:id/tags        — assign tag (TAG_ASSIGN_ADD)
 *   DELETE /admin/entities/:type/:id/tags/:tagId — remove own assignment (TAG_ASSIGN_REMOVE)
 *
 * The super-admin attribution view (GET /admin/entities/:type/:id/tags without /own)
 * is imported from entity-attribution.ts and also mounted at /admin/entities here.
 *
 * IMPORTANT — Mounting order:
 *   The /own variant (list-own) and /:tagId variant (remove) must coexist at the same
 *   base. Hono distinguishes by method and path suffix, so there is no collision:
 *   - GET  /:type/:id/tags/own   (list-own)
 *   - POST /:type/:id/tags        (add)
 *   - DEL  /:type/:id/tags/:tagId (remove)
 *   - GET  /:type/:id/tags        (attribution — T-026)
 *
 * All four are safe to mount on the same router at /admin/entities.
 *
 * @see SPEC-086 T-026, T-028, D-007, D-017
 */
import { createRouter } from '../../../../utils/create-app';
import {
    adminAddEntityTagRoute,
    adminListOwnEntityTagsRoute,
    adminRemoveEntityTagRoute
} from './entities/index.js';
import { adminEntityTagAttributionRoutes } from './entity-attribution.js';

// ─── Entity assignment router ─────────────────────────────────────────────────

const entitiesApp = createRouter();

// T-026: Super-admin attribution view (GET /:type/:id/tags — all assignments)
// NOTE: MUST be registered BEFORE T-028 list-own (GET /:type/:id/tags/own)
// because Hono's routing resolves /own as a literal before /:tagId dynamic segment.
// Attribution has no /own suffix so it naturally resolves first.
entitiesApp.route('/', adminEntityTagAttributionRoutes);

// T-028: Per-actor own assignments (GET /:type/:id/tags/own)
entitiesApp.route('/', adminListOwnEntityTagsRoute);

// T-028: Assign tag to entity (POST /:type/:id/tags)
entitiesApp.route('/', adminAddEntityTagRoute);

// T-028: Remove own assignment (DELETE /:type/:id/tags/:tagId)
entitiesApp.route('/', adminRemoveEntityTagRoute);

export { entitiesApp as adminEntityTagRoutes };
