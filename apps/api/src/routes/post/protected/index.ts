/**
 * Protected post routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreatePostRoute } from './create';
import { protectedLikePostRoute } from './like';
import { protectedPatchPostRoute } from './patch';
import { protectedSoftDeletePostRoute } from './softDelete';
import { protectedUnlikePostRoute } from './unlike';
import { protectedUpdatePostRoute } from './update';

const app = createRouter();

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

export { app as protectedPostRoutes };
