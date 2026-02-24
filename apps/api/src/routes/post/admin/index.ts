/**
 * Admin post routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminPostBatchRoute } from './batch';
import { adminCreatePostRoute } from './create';
import { adminDeletePostRoute } from './delete';
import { adminGetPostByIdRoute } from './getById';
import { adminGetPostSeoRoute } from './getSeo';
import { adminHardDeletePostRoute } from './hardDelete';
import { adminListPostsRoute } from './list';
import { adminPatchPostRoute } from './patch';
import { adminRestorePostRoute } from './restore';
import { adminUpdatePostRoute } from './update';
import { adminUpdatePostSeoRoute } from './updateSeo';

const app = createRouter();

// GET / - List all posts (including deleted)
app.route('/', adminListPostsRoute);

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

// POST /batch - Batch operations
app.route('/', adminPostBatchRoute);

// GET /:id/seo - Get post SEO metadata
app.route('/', adminGetPostSeoRoute);

// PUT /:id/seo - Update post SEO metadata
app.route('/', adminUpdatePostSeoRoute);

export { app as adminPostRoutes };
