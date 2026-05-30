/**
 * Protected post comment routes (SPEC-165). Mounted under the protected posts
 * router → `/api/v1/protected/posts/:postId/comments`.
 */
import { createRouter } from '../../../../utils/create-app';
import { protectedCreatePostCommentRoute } from './create';

const app = createRouter();

app.route('/', protectedCreatePostCommentRoute);

export { app as protectedPostCommentRoutes };
