/**
 * Admin post sponsor routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreatePostSponsorRoute } from './create';
import { adminDeletePostSponsorRoute } from './delete';
import { adminGetPostSponsorByIdRoute } from './getById';
import { adminHardDeletePostSponsorRoute } from './hardDelete';
import { adminListPostSponsorsRoute } from './list';
import { adminPatchPostSponsorRoute } from './patch';
import { adminRestorePostSponsorRoute } from './restore';
import { adminUpdatePostSponsorRoute } from './update';

const app = createRouter();

// GET / - List all post sponsors (including deleted)
app.route('/', adminListPostSponsorsRoute);

// POST / - Create post sponsor
app.route('/', adminCreatePostSponsorRoute);

// GET /:id - Get by ID
app.route('/', adminGetPostSponsorByIdRoute);

// PUT /:id - Update post sponsor
app.route('/', adminUpdatePostSponsorRoute);

// PATCH /:id - Partial update post sponsor
app.route('/', adminPatchPostSponsorRoute);

// DELETE /:id - Soft delete post sponsor
app.route('/', adminDeletePostSponsorRoute);

// DELETE /:id/hard - Hard delete post sponsor
app.route('/', adminHardDeletePostSponsorRoute);

// POST /:id/restore - Restore post sponsor
app.route('/', adminRestorePostSponsorRoute);

export { app as adminPostSponsorRoutes };
