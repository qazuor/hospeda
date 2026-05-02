/**
 * Public user-bookmark routes.
 * Routes that do not require authentication.
 */
import { createRouter } from '../../../utils/create-app';
import { publicCountBookmarksForEntityRoute } from './count';

const app = createRouter();

// GET /count - Count bookmarks for a given entity
app.route('/', publicCountBookmarksForEntityRoute);

export { app as publicUserBookmarkRoutes };
