/**
 * Protected event routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedCreateEventRoute } from './create';
import { protectedPatchEventRoute } from './patch';
import { protectedSoftDeleteEventRoute } from './softDelete';
import { protectedUpdateEventRoute } from './update';

const app = createRouter();

// POST / - Create event
app.route('/', protectedCreateEventRoute);

// PUT /:id - Update event
app.route('/', protectedUpdateEventRoute);

// PATCH /:id - Patch event
app.route('/', protectedPatchEventRoute);

// DELETE /:id - Soft delete event
app.route('/', protectedSoftDeleteEventRoute);

export { app as protectedEventRoutes };
