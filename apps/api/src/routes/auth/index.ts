/**
 * Authentication routes
 * Routes for authentication status and management
 */
import { createRouter } from '../../utils/create-app';
import { cacheStatsRoute } from './cache-stats';
import { authMeRoute } from './me';
import { authSignOutRoute } from './signout';
import { authStatusRoute } from './status';
import { authSyncRoute } from './sync';
import { clerkWebhookRoute } from './webhook';

// Compose auth routes into a single router to be mounted in setupRoutes
const app = createRouter();

// status is exported as an app
app.route('/', authStatusRoute);
// sync is a single route definition
app.route('/', authSyncRoute);
app.route('/', authMeRoute);
app.route('/', authSignOutRoute);
app.route('/', clerkWebhookRoute);
// cache stats for monitoring
app.route('/', cacheStatsRoute);

export const authRoutes = app;
