/**
 * Admin social dashboard router — SPEC-254 T-037.
 * Mounted at /api/v1/admin/social/dashboard.
 */
import { createRouter } from '../../../../utils/create-app';
import { adminGetSocialDashboardRoute } from './get';

const app = createRouter();

app.route('/', adminGetSocialDashboardRoute);

export { app as adminSocialDashboardRoutes };
