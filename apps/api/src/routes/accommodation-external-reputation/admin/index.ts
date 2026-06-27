/**
 * Barrel for SPEC-237 T-009 admin accommodation external reputation routes.
 *
 * Mounts:
 *   POST /api/v1/admin/accommodations/:id/external-reputation/disable
 */
import { createRouter } from '../../../utils/create-app';
import { adminDisableReputationRoute } from './disable-reputation.js';

const app = createRouter();

// POST /:id/external-reputation/disable
app.route('/', adminDisableReputationRoute);

export { app as adminExternalReputationRoutes };
