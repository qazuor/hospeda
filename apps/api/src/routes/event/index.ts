import { createRouter } from '../../utils/create-app';
import { eventBatchRoute } from './batch';
import { createEventRoute } from './create';
import { eventsByAuthorRoute } from './getByAuthor';
import { getEventsByCategoryRoute } from './getByCategory';
import { getEventByIdRoute } from './getById';
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

const app = createRouter();

app.route('/', eventListRoute);
app.route('/', eventBatchRoute);
app.route('/', getEventByIdRoute);
app.route('/', getEventSummaryRoute);
app.route('/', getEventBySlugRoute);
app.route('/', createEventRoute);
app.route('/', updateEventRoute);
app.route('/', softDeleteEventRoute);
app.route('/', hardDeleteEventRoute);
app.route('/', restoreEventRoute);
app.route('/', eventsByAuthorRoute);
app.route('/', getEventsByLocationRoute);
app.route('/', getEventsByOrganizerRoute);
app.route('/', getEventsByCategoryRoute);
app.route('/', getFreeEventsRoute);
app.route('/', getUpcomingEventsRoute);

export const eventRoutes = app;
