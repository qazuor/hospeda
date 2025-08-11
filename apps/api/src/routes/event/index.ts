import createApp from '../../utils/create-app';
import { createEventRoute } from './create';
import { getEventsByAuthorRoute } from './getByAuthor';
import { getEventsByCategoryRoute } from './getByCategory';
import { eventGetByIdRoute } from './getById';
import { getEventsByLocationRoute } from './getByLocation';
import { getEventsByOrganizerRoute } from './getByOrganizer';
import { getEventBySlugRoute } from './getBySlug';
import { getFreeEventsRoute } from './getFreeEvents';
import { getEventSummaryRoute } from './getSummary';
import { getUpcomingEventsRoute } from './getUpcomingEvents';
import { hardDeleteEventRoute } from './hardDelete';
import { eventListRoute } from './list';
import { restoreEventRoute } from './restore';
import { softDeleteEventRoute } from './softDelete';
import { updateEventRoute } from './update';

const app = createApp();

app.route('/', eventListRoute);
app.route('/', eventGetByIdRoute);
app.route('/', getEventSummaryRoute);
app.route('/', getEventBySlugRoute);
app.route('/', createEventRoute);
app.route('/', updateEventRoute);
app.route('/', softDeleteEventRoute);
app.route('/', hardDeleteEventRoute);
app.route('/', restoreEventRoute);
app.route('/', getEventsByAuthorRoute);
app.route('/', getEventsByLocationRoute);
app.route('/', getEventsByOrganizerRoute);
app.route('/', getEventsByCategoryRoute);
app.route('/', getFreeEventsRoute);
app.route('/', getUpcomingEventsRoute);

export const eventRoutes = app;
