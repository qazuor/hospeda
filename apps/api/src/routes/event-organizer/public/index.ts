/**
 * Public event organizer routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetEventOrganizerByIdRoute } from './getById';
import { publicGetEventOrganizerBySlugRoute } from './getBySlug';
import { publicListEventOrganizersRoute } from './list';

const app = createRouter();

// GET / - List event organizers
app.route('/', publicListEventOrganizersRoute);

// GET /:id - Get by ID
app.route('/', publicGetEventOrganizerByIdRoute);

// GET /slug/:slug - Get by slug
app.route('/', publicGetEventOrganizerBySlugRoute);

export { app as publicEventOrganizerRoutes };
