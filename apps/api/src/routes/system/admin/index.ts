/**
 * Admin system routes.
 *
 * Platform-operations endpoints for the admin dashboard (system health, etc.).
 * All routes require SYSTEM_MAINTENANCE_MODE permission.
 *
 * @module routes/system/admin
 * @see SPEC-155 follow-up (dashboard card E)
 */
import { createRouter } from '../../../utils/create-app.js';
import { adminSystemHealthRoute } from './health.js';

const app = createRouter();

// GET /health — database + Redis rollup status for the dashboard widget.
app.route('/', adminSystemHealthRoute);

export { app as adminSystemRoutes };
