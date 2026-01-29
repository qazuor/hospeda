/**
 * Admin event routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminEventBatchRoute } from './batch';
import { adminHardDeleteEventRoute } from './hardDelete';
import { adminListEventsRoute } from './list';
import { adminRestoreEventRoute } from './restore';

const app = createRouter();

// GET / - List all events (including deleted)
app.route('/', adminListEventsRoute);

// POST /batch - Get multiple events by IDs
app.route('/', adminEventBatchRoute);

// DELETE /:id/hard - Hard delete event
app.route('/', adminHardDeleteEventRoute);

// POST /:id/restore - Restore event
app.route('/', adminRestoreEventRoute);

export { app as adminEventRoutes };
