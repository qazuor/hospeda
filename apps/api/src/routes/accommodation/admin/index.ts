/**
 * Admin accommodation routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminBatchAccommodationsRoute } from './batch';
import { adminHardDeleteAccommodationRoute } from './hardDelete';
import { adminListAccommodationsRoute } from './list';
import { adminRestoreAccommodationRoute } from './restore';

const app = createRouter();

// GET / - List all accommodations (including deleted)
app.route('/', adminListAccommodationsRoute);

// DELETE /:id/hard - Hard delete accommodation
app.route('/', adminHardDeleteAccommodationRoute);

// POST /:id/restore - Restore accommodation
app.route('/', adminRestoreAccommodationRoute);

// POST /batch - Batch operations
app.route('/', adminBatchAccommodationsRoute);

export { app as adminAccommodationRoutes };
