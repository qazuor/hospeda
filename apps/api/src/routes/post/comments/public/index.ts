/**
 * Public post comment routes (SPEC-165).
 * Mounted under the public posts router, so paths resolve to
 * `/api/v1/public/posts/:postId/comments`.
 */
import { createRouter } from '../../../../utils/create-app';
import { publicListPostCommentsRoute } from './list';

const app = createRouter();

app.route('/', publicListPostCommentsRoute);

export { app as publicPostCommentRoutes };
