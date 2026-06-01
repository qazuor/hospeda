/**
 * Protected standalone comment routes (SPEC-165). Mounted at
 * `/api/v1/protected/comments`. Holds cross-entity comment operations that are
 * not scoped under a post or event path — currently the author's own delete.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedDeleteOwnCommentRoute } from './delete';

const app = createRouter();

app.route('/', protectedDeleteOwnCommentRoute);

export { app as protectedCommentRoutes };
