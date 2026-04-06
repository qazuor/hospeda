/**
 * Public event routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicGetEventsByAuthorRoute } from './getByAuthor';
import { publicGetEventByIdRoute } from './getById';
import { publicGetEventsByLocationRoute } from './getByLocation';
import { publicGetEventsByOrganizerRoute } from './getByOrganizer';
import { publicGetEventBySlugRoute } from './getBySlug';
import { publicGetEventSummaryRoute } from './getSummary';
import { publicGetUpcomingEventsRoute } from './getUpcoming';
import { publicListEventsRoute } from './list';

const app = createRouter();

// GET / - List events
app.route('/', publicListEventsRoute);

// GET /upcoming - List upcoming events (MUST come BEFORE /:id)
app.route('/', publicGetUpcomingEventsRoute);

// GET /:id - Get by ID (MUST come AFTER specific paths like /upcoming)
app.route('/', publicGetEventByIdRoute);

// GET /slug/:slug - Get by slug
app.route('/', publicGetEventBySlugRoute);

// GET /:id/summary - Get event summary
app.route('/', publicGetEventSummaryRoute);

// GET /author/:authorId - Get events by author
app.route('/', publicGetEventsByAuthorRoute);

// GET /location/:locationId - Get events by location
app.route('/', publicGetEventsByLocationRoute);

// GET /organizer/:organizerId - Get events by organizer
app.route('/', publicGetEventsByOrganizerRoute);

export { app as publicEventRoutes };
