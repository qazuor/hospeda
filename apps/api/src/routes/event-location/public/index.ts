/**
 * Public event location routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetEventLocationByIdRoute } from './getById';
import { publicGetEventLocationBySlugRoute } from './getBySlug';
import { publicListEventLocationsRoute } from './list';

const app = createRouter();

// GET / - List event locations
app.route('/', publicListEventLocationsRoute);

// GET /:id - Get by ID
app.route('/', publicGetEventLocationByIdRoute);

// GET /slug/:slug - Get by slug
app.route('/', publicGetEventLocationBySlugRoute);

export { app as publicEventLocationRoutes };
