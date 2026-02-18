/**
 * Protected user bookmark routes.
 * All routes require authentication.
 */
import { createRouter } from '../../../utils/create-app';
import { countUserBookmarksRoute } from './count';
import { createUserBookmarkRoute } from './create';
import { deleteUserBookmarkRoute } from './delete';
import { listUserBookmarksRoute } from './list';

const app = createRouter();

// GET /count - Count bookmarks (registered before / to avoid path conflicts)
app.route('/', countUserBookmarksRoute);

// GET / - List bookmarks
app.route('/', listUserBookmarksRoute);

// POST / - Create bookmark
app.route('/', createUserBookmarkRoute);

// DELETE /:id - Delete bookmark
app.route('/', deleteUserBookmarkRoute);

export { app as protectedUserBookmarkRoutes };
