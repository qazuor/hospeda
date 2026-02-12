/**
 * Authentication routes
 * Routes for authentication status and management.
 * Note: Better Auth handles core auth endpoints (sign-in, sign-up, sign-out, etc.)
 * at /api/auth/*. These routes provide Hospeda-specific auth utilities.
 */
import { createRouter } from '../../utils/create-app';
import { cacheStatsRoute } from './cache-stats';
import { authMeRoute } from './me';
import { authSignOutRoute } from './signout';
import { authStatusRoute } from './status';

const app = createRouter();

app.route('/', authStatusRoute);
app.route('/', authMeRoute);
app.route('/', authSignOutRoute);
app.route('/', cacheStatsRoute);

export const authRoutes = app;
