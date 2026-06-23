/**
 * Admin social publish logs router — SPEC-254 T-037.
 * Mounted at /api/v1/admin/social/publish-logs.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminListSocialPublishLogsRoute } from './list';

const app = createRouter();

app.route('/', adminListSocialPublishLogsRoute);

export { app as adminSocialPublishLogRoutes };
