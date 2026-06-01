/**
 * Protected event comment routes (SPEC-165). Mounted under the protected events
 * router → `/api/v1/protected/events/:eventId/comments`.
 */
import { createRouter } from '../../../../utils/create-app';
import { protectedCreateEventCommentRoute } from './create';

const app = createRouter();

app.route('/', protectedCreateEventCommentRoute);

export { app as protectedEventCommentRoutes };
