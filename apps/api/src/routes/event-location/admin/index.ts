/**
 * Admin event location routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreateEventLocationRoute } from './create';
import { adminDeleteEventLocationRoute } from './delete';
import { adminGetEventLocationByIdRoute } from './getById';
import { adminHardDeleteEventLocationRoute } from './hardDelete';
import { adminListEventLocationsRoute } from './list';
import { adminPatchEventLocationRoute } from './patch';
import { adminRestoreEventLocationRoute } from './restore';
import { adminUpdateEventLocationRoute } from './update';

const app = createRouter();

// GET / - List all event locations (including deleted)
app.route('/', adminListEventLocationsRoute);

// POST / - Create event location
app.route('/', adminCreateEventLocationRoute);

// GET /:id - Get by ID
app.route('/', adminGetEventLocationByIdRoute);

// PUT /:id - Update event location
app.route('/', adminUpdateEventLocationRoute);

// PATCH /:id - Partial update event location
app.route('/', adminPatchEventLocationRoute);

// DELETE /:id - Soft delete event location
app.route('/', adminDeleteEventLocationRoute);

// DELETE /:id/hard - Hard delete event location
app.route('/', adminHardDeleteEventLocationRoute);

// POST /:id/restore - Restore event location
app.route('/', adminRestoreEventLocationRoute);

export { app as adminEventLocationRoutes };
