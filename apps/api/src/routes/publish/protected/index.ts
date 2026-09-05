/**
 * Protected publish routes (HOS-1156).
 *
 * Requires authentication but no publish-specific permission, so a fresh USER
 * who has never listed anything can be told what they may do next.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedPublishPrecheckRoute } from './precheck';

const app = createRouter();
app.route('/', protectedPublishPrecheckRoute);

export { app as protectedPublishRoutes };
