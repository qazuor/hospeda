/**
 * Protected post routes
 * Routes that require authentication
 *
 * Routes with overlapping param patterns are registered from most specific to
 * most general (/{id}/media/reorder and /{id}/media/{mediaId}/featured before
 * /{id}/media/{mediaId}), matching the convention the rest of the codebase
 * follows. It is defensive rather than load-bearing: Hono resolves a static
 * segment ahead of a param segment regardless of insertion order, verified by
 * mutation in `test/routes/post-protected-media.test.ts`.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedPostCommentRoutes } from '../comments/protected/index.js';
import { protectedAddPostMediaRoute } from './addMedia';
import { protectedCreatePostRoute } from './create';
import { protectedGetPostByIdRoute } from './getById';
import { protectedGetPostMediaRoute } from './getMedia';
import { protectedLikePostRoute } from './like';
import { protectedListOwnPostsRoute } from './list';
import { protectedPatchPostRoute } from './patch';
import { protectedSetPostPublishStateRoute } from './publishState';
import { protectedRemovePostMediaRoute } from './removeMedia';
import { protectedReorderPostMediaRoute } from './reorderMedia';
import { protectedSetFeaturedPostMediaRoute } from './setFeaturedMedia';
import { protectedSoftDeletePostRoute } from './softDelete';
import { protectedUnlikePostRoute } from './unlike';
import { protectedUpdatePostRoute } from './update';

const app = createRouter();

// GET / - List own posts (HOS-374)
app.route('/', protectedListOwnPostsRoute);

// GET /:id - Get own post by id (HOS-374)
app.route('/', protectedGetPostByIdRoute);

// POST / - Create post
app.route('/', protectedCreatePostRoute);

// PUT /:id - Update post
app.route('/', protectedUpdatePostRoute);

// PATCH /:id - Patch post
app.route('/', protectedPatchPostRoute);

// DELETE /:id - Soft delete post
app.route('/', protectedSoftDeletePostRoute);

// POST /:id/like - Like post
app.route('/', protectedLikePostRoute);

// DELETE /:id/like - Unlike post
app.route('/', protectedUnlikePostRoute);

// POST /:id/publish-state - Publish or unpublish own post (HOS-374)
app.route('/', protectedSetPostPublishStateRoute);

// POST /:postId/comments - Create comment (SPEC-165)
app.route('/', protectedPostCommentRoutes);

// Media management (HOS-390) — gated on the same permission as updating the
// post, inside the service layer via checkPostCanEditMedia.

// PATCH /:id/media/reorder
app.route('/', protectedReorderPostMediaRoute);

// GET /:id/media - List gallery photos.
app.route('/', protectedGetPostMediaRoute);

// POST /:id/media - Add photo to gallery.
app.route('/', protectedAddPostMediaRoute);

// PUT /:id/media/:mediaId/featured
app.route('/', protectedSetFeaturedPostMediaRoute);

// DELETE /:id/media/:mediaId - Remove photo from gallery.
app.route('/', protectedRemovePostMediaRoute);

export { app as protectedPostRoutes };
