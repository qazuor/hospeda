/**
 * Admin post routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminPostBatchRoute } from './batch';
import { adminHardDeletePostRoute } from './hardDelete';
import { adminListPostsRoute } from './list';
import { adminRestorePostRoute } from './restore';

const app = createRouter();

// GET / - List all posts (including deleted)
app.route('/', adminListPostsRoute);

// DELETE /:id/hard - Hard delete post
app.route('/', adminHardDeletePostRoute);

// POST /:id/restore - Restore post
app.route('/', adminRestorePostRoute);

// POST /batch - Batch operations
app.route('/', adminPostBatchRoute);

export { app as adminPostRoutes };
