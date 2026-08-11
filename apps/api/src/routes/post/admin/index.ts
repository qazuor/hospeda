/**
 * Admin post routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminAddPostMediaRoute } from './addMedia';
import { adminPostBatchRoute } from './batch';
import { adminCreatePostRoute } from './create';
import { adminDeletePostRoute } from './delete';
import { adminGetPostByIdRoute } from './getById';
import { adminGetPostMediaRoute } from './getMedia';
import { adminGetPostSeoRoute } from './getSeo';
import { adminHardDeletePostRoute } from './hardDelete';
import { adminSetPostLifecycleStateRoute } from './lifecycleState';
import { adminListPostsRoute } from './list';
import { adminModeratePostRoute } from './moderate';
import { adminPatchPostRoute } from './patch';
import { adminSetPostPublishStateRoute } from './publishState';
import { adminRemovePostMediaRoute } from './removeMedia';
import { adminReorderPostMediaRoute } from './reorderMedia';
import { adminRestorePostRoute } from './restore';
import { adminSetFeaturedPostMediaRoute } from './setFeaturedMedia';
import { adminPostTrendRoute } from './trend';
import { adminUpdatePostRoute } from './update';
import { adminUpdatePostSeoRoute } from './updateSeo';

const app = createRouter();

// GET / - List all posts (including deleted)
app.route('/', adminListPostsRoute);

// GET /trend - Monthly post creation trend for admin dashboard (SPEC-155 T-008)
// NOTE: registered before /:id routes to prevent the param segment from
// matching the literal string "trend".
app.route('/', adminPostTrendRoute);

// POST / - Create post
app.route('/', adminCreatePostRoute);

// GET /:id - Get by ID
app.route('/', adminGetPostByIdRoute);

// PUT /:id - Update post
app.route('/', adminUpdatePostRoute);

// PATCH /:id - Patch post
app.route('/', adminPatchPostRoute);

// DELETE /:id - Soft delete post
app.route('/', adminDeletePostRoute);

// DELETE /:id/hard - Hard delete post
app.route('/', adminHardDeletePostRoute);

// POST /:id/restore - Restore post
app.route('/', adminRestorePostRoute);

// POST /:id/moderate - Apply the moderation verdict (HOS-374)
app.route('/', adminModeratePostRoute);

// POST /:id/publish-state - Raise or lower publication (HOS-374)
app.route('/', adminSetPostPublishStateRoute);

// POST /:id/lifecycle-state - Move through the lifecycle (HOS-374)
app.route('/', adminSetPostLifecycleStateRoute);

// POST /batch - Batch operations
app.route('/', adminPostBatchRoute);

// GET /:id/seo - Get post SEO metadata
app.route('/', adminGetPostSeoRoute);

// PUT /:id/seo - Update post SEO metadata
app.route('/', adminUpdatePostSeoRoute);

// Media management (HOS-390) — relational post_media / event_media rows.
// Registered most-specific-first by convention; Hono resolves static segments
// ahead of params on its own (see test/routes/post-protected-media.test.ts).

// PATCH /:id/media/reorder
app.route('/', adminReorderPostMediaRoute);

// GET /:id/media - List gallery photos.
app.route('/', adminGetPostMediaRoute);

// POST /:id/media - Add photo to gallery.
app.route('/', adminAddPostMediaRoute);

// PUT /:id/media/:mediaId/featured
app.route('/', adminSetFeaturedPostMediaRoute);

// DELETE /:id/media/:mediaId - Remove photo from gallery.
app.route('/', adminRemovePostMediaRoute);

export { app as adminPostRoutes };
