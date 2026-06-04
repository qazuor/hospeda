/**
 * Admin App Log Routes (SPEC-184)
 *
 * Router assembly for the admin log viewer surface:
 * - GET /api/v1/admin/logs - paginated + filtered WARN/ERROR log entries
 *
 * @module routes/app-logs
 */

import { createRouter } from '../../utils/create-app';
import { listAppLogsRoute } from './list';

const app = createRouter();

app.route('/', listAppLogsRoute);

export { app as adminAppLogRoutes };
