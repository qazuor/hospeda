/**
 * Protected publish routes (HOS-1156).
 *
 * Requires authentication but no publish-specific permission, so a fresh USER
 * who has never listed anything can be told what they may do next.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedListingNoticesRoute } from './listing-notices';
import { protectedPublishPrecheckRoute } from './precheck';
import { protectedSubscribeDestinationRoute } from './subscribe-destination';
import { protectedTrialSummaryRoute } from './trial-summary';

const app = createRouter();
app.route('/', protectedPublishPrecheckRoute);
app.route('/', protectedSubscribeDestinationRoute);
app.route('/', protectedListingNoticesRoute);
app.route('/', protectedTrialSummaryRoute);

export { app as protectedPublishRoutes };
