/**
 * Protected event organizer routes
 * Routes that require authentication
 */

import { eventOrganizerCacheInvalidationMiddleware } from '../../../middlewares/event-organizer-cache-invalidation';
import { createRouter } from '../../../utils/create-app';
import { protectedCreateEventOrganizerRoute } from './create';
import { protectedPatchEventOrganizerRoute } from './patch';
import { protectedSoftDeleteEventOrganizerRoute } from './softDelete';
import { protectedUpdateEventOrganizerRoute } from './update';

const app = createRouter();

app.use('*', eventOrganizerCacheInvalidationMiddleware());

// POST / - Create event organizer
app.route('/', protectedCreateEventOrganizerRoute);

// PUT /:id - Update event organizer
app.route('/', protectedUpdateEventOrganizerRoute);

// PATCH /:id - Patch event organizer
app.route('/', protectedPatchEventOrganizerRoute);

// DELETE /:id - Soft delete event organizer
app.route('/', protectedSoftDeleteEventOrganizerRoute);

export { app as protectedEventOrganizerRoutes };
