/**
 * Admin PostTag routes
 *
 * Exports two separate routers:
 *
 * 1. `adminPostTagCrudRoutes` — PostTag CRUD operations:
 *    Mounted at: /api/v1/admin/posts/tags
 *    GET    /                    — List all PostTags (POST_TAG_VIEW)
 *    POST   /                    — Create PostTag (POST_TAG_CREATE)
 *    GET    /:id                 — Get by ID (POST_TAG_VIEW)
 *    PATCH  /:id                 — Update (POST_TAG_UPDATE)
 *    GET    /:id/impact          — Pre-delete impact count (POST_TAG_VIEW)
 *    DELETE /:id                 — Hard delete (POST_TAG_DELETE)
 *
 * 2. `adminPostTagAssignmentRoutes` — Post-assignment management:
 *    Mounted at: /api/v1/admin/posts
 *    POST   /:postId/tags        — Set/replace tags on a post (POST_TAG_ASSIGN)
 *    DELETE /:postId/tags/:tagId — Remove single tag from post (POST_TAG_ASSIGN)
 *
 * @see SPEC-086 D-001, D-024
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreatePostTagRoute } from './create';
import { adminDeletePostTagRoute } from './delete';
import { adminGetPostTagByIdRoute } from './getById';
import { adminGetPostTagImpactRoute } from './impact';
import { adminListPostTagsRoute } from './list';
import { adminPatchPostTagRoute } from './patch';
import { adminRemovePostTagRoute } from './removePostTag';
import { adminSetPostTagsRoute } from './setPostTags';

// ─── PostTag CRUD Router ─────────────────────────────────────────────────────
// Mounted at /api/v1/admin/posts/tags

const crudApp = createRouter();

// GET / - List all PostTags (with pagination and filters)
crudApp.route('/', adminListPostTagsRoute);

// POST / - Create PostTag
crudApp.route('/', adminCreatePostTagRoute);

// GET /:id/impact - Pre-delete impact count
// MUST be registered before /:id to avoid Hono routing the /impact segment as an ID
crudApp.route('/', adminGetPostTagImpactRoute);

// GET /:id - Get PostTag by ID
crudApp.route('/', adminGetPostTagByIdRoute);

// PATCH /:id - Update PostTag
crudApp.route('/', adminPatchPostTagRoute);

// DELETE /:id - Hard delete PostTag
crudApp.route('/', adminDeletePostTagRoute);

// ─── PostTag Assignment Router ───────────────────────────────────────────────
// Mounted at /api/v1/admin/posts

const assignmentApp = createRouter();

// POST /:postId/tags - Set/replace PostTags on a post
assignmentApp.route('/', adminSetPostTagsRoute);

// DELETE /:postId/tags/:tagId - Remove single PostTag from post
assignmentApp.route('/', adminRemovePostTagRoute);

export { crudApp as adminPostTagCrudRoutes, assignmentApp as adminPostTagAssignmentRoutes };
