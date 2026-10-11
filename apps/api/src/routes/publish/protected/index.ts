/**
 * Protected publish routes (HOS-1156).
 *
 * Requires authentication but no publish-specific permission, so a fresh USER
 * who has never listed anything can be told what they may do next.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedPublishPrecheckRoute } from './precheck';
import { protectedSubscribeDestinationRoute } from './subscribe-destination';

const app = createRouter();
app.route('/', protectedPublishPrecheckRoute);
app.route('/', protectedSubscribeDestinationRoute);

export { app as protectedPublishRoutes };
