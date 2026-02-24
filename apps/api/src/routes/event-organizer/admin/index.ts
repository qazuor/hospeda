/**
 * Admin event organizer routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminCreateEventOrganizerRoute } from './create';
import { adminDeleteEventOrganizerRoute } from './delete';
import { adminGetEventOrganizerByIdRoute } from './getById';
import { adminHardDeleteEventOrganizerRoute } from './hardDelete';
import { adminListEventOrganizersRoute } from './list';
import { adminPatchEventOrganizerRoute } from './patch';
import { adminRestoreEventOrganizerRoute } from './restore';
import { adminUpdateEventOrganizerRoute } from './update';

const app = createRouter();

// GET / - List all event organizers (including deleted)
app.route('/', adminListEventOrganizersRoute);

// POST / - Create event organizer
app.route('/', adminCreateEventOrganizerRoute);

// GET /:id - Get by ID
app.route('/', adminGetEventOrganizerByIdRoute);

// PUT /:id - Update event organizer
app.route('/', adminUpdateEventOrganizerRoute);

// PATCH /:id - Partial update event organizer
app.route('/', adminPatchEventOrganizerRoute);

// DELETE /:id - Soft delete event organizer
app.route('/', adminDeleteEventOrganizerRoute);

// DELETE /:id/hard - Hard delete event organizer
app.route('/', adminHardDeleteEventOrganizerRoute);

// POST /:id/restore - Restore event organizer
app.route('/', adminRestoreEventOrganizerRoute);

export { app as adminEventOrganizerRoutes };
