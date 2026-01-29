/**
 * Admin destination routes
 * All routes here require admin role
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchDestinationsRoute } from './batch';
import { adminHardDeleteDestinationRoute } from './hardDelete';
import { adminListDestinationsRoute } from './list';
import { adminRestoreDestinationRoute } from './restore';

const app = createRouter();

// Register routes
app.route('/', adminListDestinationsRoute);
app.route('/', adminBatchDestinationsRoute);
app.route('/', adminHardDeleteDestinationRoute);
app.route('/', adminRestoreDestinationRoute);

export { app as adminDestinationRoutes };
