/**
 * Protected event location routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreateEventLocationRoute } from './create';
import { protectedPatchEventLocationRoute } from './patch';
import { protectedSoftDeleteEventLocationRoute } from './softDelete';
import { protectedUpdateEventLocationRoute } from './update';

const app = createRouter();

// POST / - Create event location
app.route('/', protectedCreateEventLocationRoute);

// PUT /:id - Update event location
app.route('/', protectedUpdateEventLocationRoute);

// PATCH /:id - Patch event location
app.route('/', protectedPatchEventLocationRoute);

// DELETE /:id - Soft delete event location
app.route('/', protectedSoftDeleteEventLocationRoute);

export { app as protectedEventLocationRoutes };
