/**
 * Admin event location routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminHardDeleteEventLocationRoute } from './hardDelete';
import { adminListEventLocationsRoute } from './list';
import { adminRestoreEventLocationRoute } from './restore';

const app = createRouter();

// GET / - List all event locations (including deleted)
app.route('/', adminListEventLocationsRoute);

// DELETE /:id/hard - Hard delete event location
app.route('/', adminHardDeleteEventLocationRoute);

// POST /:id/restore - Restore event location
app.route('/', adminRestoreEventLocationRoute);

export { app as adminEventLocationRoutes };
