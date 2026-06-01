/**
 * Public event comment routes (SPEC-165).
 * Mounted under the public events router, so paths resolve to
 * `/api/v1/public/events/:eventId/comments`.
 */
import { createRouter } from '../../../../utils/create-app';
import { publicListEventCommentsRoute } from './list';

const app = createRouter();

app.route('/', publicListEventCommentsRoute);

export { app as publicEventCommentRoutes };
