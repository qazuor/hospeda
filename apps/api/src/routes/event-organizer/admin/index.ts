/**
 * Admin event organizer routes
 * Routes that require admin-level access
 */
import { createRouter } from '../../../utils/create-app';
import { adminHardDeleteEventOrganizerRoute } from './hardDelete';
import { adminListEventOrganizersRoute } from './list';
import { adminRestoreEventOrganizerRoute } from './restore';

const app = createRouter();

// GET / - List all event organizers (including deleted)
app.route('/', adminListEventOrganizersRoute);

// DELETE /:id/hard - Hard delete event organizer
app.route('/', adminHardDeleteEventOrganizerRoute);

// POST /:id/restore - Restore event organizer
app.route('/', adminRestoreEventOrganizerRoute);

export { app as adminEventOrganizerRoutes };
