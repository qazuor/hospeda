/**
 * Admin webhook routes
 * Routes that require admin-level access for webhook operations
 */
import { createRouter } from '../../../utils/create-app';
import { listDeadLetterQueueRoute, retryDeadLetterRoute } from './dead-letter';
import { listWebhookEventsRoute } from './events';

const eventsRouter = createRouter();
eventsRouter.route('/', listWebhookEventsRoute);

const deadLetterRouter = createRouter();
deadLetterRouter.route('/', listDeadLetterQueueRoute);
deadLetterRouter.route('/', retryDeadLetterRoute);

const adminWebhookRouter = createRouter();
adminWebhookRouter.route('/events', eventsRouter);
adminWebhookRouter.route('/dead-letter', deadLetterRouter);

export { adminWebhookRouter };
