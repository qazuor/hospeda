/**
 * Protected user bookmark routes.
 * All routes require authentication.
 */
import { createRouter } from '../../../utils/create-app';
import { checkUserBookmarkRoute } from './check';
import { checkBulkUserBookmarksRoute } from './check-bulk';
import { countUserBookmarksRoute } from './count';
import { createUserBookmarkRoute } from './create';
import { deleteUserBookmarkRoute } from './delete';
import { listUserBookmarksRoute } from './list';
import { updateUserBookmarkRoute } from './update';

const app = createRouter();

// GET /check - Check bookmark status (registered before / to avoid path conflicts)
app.route('/', checkUserBookmarkRoute);

// POST /check-bulk - Bulk-check bookmark status (registered before POST / to avoid path conflicts)
app.route('/', checkBulkUserBookmarksRoute);

// GET /count - Count bookmarks (registered before / to avoid path conflicts)
app.route('/', countUserBookmarksRoute);

// GET / - List bookmarks
app.route('/', listUserBookmarksRoute);

// POST / - Toggle bookmark (create or delete)
app.route('/', createUserBookmarkRoute);

// DELETE /:id - Delete bookmark
app.route('/', deleteUserBookmarkRoute);

// PATCH /:id - Update bookmark notes
app.route('/', updateUserBookmarkRoute);

export { app as protectedUserBookmarkRoutes };
