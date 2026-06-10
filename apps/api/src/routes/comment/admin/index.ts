import { createRouter } from '../../../utils/create-app';
import { adminDeleteCommentRoute } from './delete';
import { adminGetCommentByIdRoute } from './getById';
import { adminHardDeleteCommentRoute } from './hardDelete';
import { adminListCommentsRoute } from './list';
import { adminModerateCommentRoute } from './moderate';
import { adminRecentCommentsRoute } from './recent';
import { adminRestoreCommentRoute } from './restore';

const app = createRouter();

// GET /recent — must be registered BEFORE /{commentId} so "recent" is not
// captured as a path param (same ordering rule as post/admin/trend.ts).
app.route('/', adminRecentCommentsRoute);
// GET / — paginated list
app.route('/', adminListCommentsRoute);

// Sub-path mutations registered before the bare /{commentId} routes.
// PATCH /{commentId}/moderation — moderate (approve / reject)
app.route('/', adminModerateCommentRoute);
// DELETE /{commentId}/hard — permanent removal
app.route('/', adminHardDeleteCommentRoute);
// POST /{commentId}/restore — clear deletedAt
app.route('/', adminRestoreCommentRoute);

// GET /{commentId} — single comment
app.route('/', adminGetCommentByIdRoute);
// DELETE /{commentId} — soft delete
app.route('/', adminDeleteCommentRoute);

export { app as adminCommentRoutes };
