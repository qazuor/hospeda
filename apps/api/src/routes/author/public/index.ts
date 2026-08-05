/**
 * Public author routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicListAuthorsRoute } from './list';

const app = createRouter();

// GET / - List public authors
app.route('/', publicListAuthorsRoute);

export { app as publicAuthorRoutes };
