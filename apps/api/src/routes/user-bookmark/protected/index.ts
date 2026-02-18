/**
 * Protected user bookmark routes.
 * All routes require authentication.
 */
import { createRouter } from '../../../utils/create-app';
import { checkUserBookmarkRoute } from './check';
import { countUserBookmarksRoute } from './count';
import { createUserBookmarkRoute } from './create';
import { deleteUserBookmarkRoute } from './delete';
import { listUserBookmarksRoute } from './list';

const app = createRouter();

// GET /check - Check bookmark status (registered before / to avoid path conflicts)
app.route('/', checkUserBookmarkRoute);

// GET /count - Count bookmarks (registered before / to avoid path conflicts)
app.route('/', countUserBookmarksRoute);

// GET / - List bookmarks
app.route('/', listUserBookmarksRoute);

// POST / - Toggle bookmark (create or delete)
app.route('/', createUserBookmarkRoute);

// DELETE /:id - Delete bookmark
app.route('/', deleteUserBookmarkRoute);

export { app as protectedUserBookmarkRoutes };
