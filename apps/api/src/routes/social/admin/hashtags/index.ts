/**
 * Admin social hashtag routes.
 * Requires SOCIAL_HASHTAG_VIEW (read) or SOCIAL_HASHTAG_MANAGE (write) permissions.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminCreateSocialHashtagRoute } from './create';
import { adminDeleteSocialHashtagRoute } from './delete';
import { adminGetSocialHashtagByIdRoute } from './getById';
import { adminListSocialHashtagsRoute } from './list';
import { adminPatchSocialHashtagRoute } from './patch';

const app = createRouter();

// GET /  — list all hashtags
app.route('/', adminListSocialHashtagsRoute);

// POST / — create
app.route('/', adminCreateSocialHashtagRoute);

// GET /:id — get by ID
app.route('/', adminGetSocialHashtagByIdRoute);

// PATCH /:id — partial update
app.route('/', adminPatchSocialHashtagRoute);

// DELETE /:id — soft-delete
app.route('/', adminDeleteSocialHashtagRoute);

export { app as adminSocialHashtagRoutes };
