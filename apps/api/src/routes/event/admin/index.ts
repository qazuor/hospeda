/**
 * Admin event routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminEventBatchRoute } from './batch';
import { adminCreateEventRoute } from './create';
import { adminDeleteEventRoute } from './delete';
import { adminGetEventByIdRoute } from './getById';
import { adminHardDeleteEventRoute } from './hardDelete';
import { adminListEventsRoute } from './list';
import { adminPatchEventRoute } from './patch';
import { adminRestoreEventRoute } from './restore';
import { adminUpdateEventRoute } from './update';

const app = createRouter();

// GET / - List all events (including deleted)
app.route('/', adminListEventsRoute);

// POST / - Create event
app.route('/', adminCreateEventRoute);

// GET /:id - Get by ID
app.route('/', adminGetEventByIdRoute);

// PUT /:id - Update event
app.route('/', adminUpdateEventRoute);

// PATCH /:id - Patch event
app.route('/', adminPatchEventRoute);

// DELETE /:id - Soft delete event
app.route('/', adminDeleteEventRoute);

// POST /batch - Get multiple events by IDs
app.route('/', adminEventBatchRoute);

// DELETE /:id/hard - Hard delete event
app.route('/', adminHardDeleteEventRoute);

// POST /:id/restore - Restore event
app.route('/', adminRestoreEventRoute);

export { app as adminEventRoutes };
