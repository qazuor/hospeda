/**
 * Authentication routes
 * Routes for authentication status and management.
 * Note: Better Auth handles core auth endpoints (sign-in, sign-up, sign-out, etc.)
 * at /api/auth/*. These routes provide Hospeda-specific auth utilities.
 */
import { createRouter } from '../../utils/create-app';
import { cacheStatsRoute } from './cache-stats';
import { changePasswordRoute } from './change-password';
import { authMeRoute } from './me';
import { resetPasswordCheckRoute } from './reset-password-check';
import { authSignOutRoute } from './signout';
import { signupAsHostRoute } from './signup-as-host';
import { authStatusRoute } from './status';

const app = createRouter();

app.route('/', authStatusRoute);
app.route('/', authMeRoute);
app.route('/', authSignOutRoute);
app.route('/', resetPasswordCheckRoute);

export const authRoutes = app;

// Protected auth routes (require authentication)
const protectedApp = createRouter();
protectedApp.route('/', changePasswordRoute);
export const protectedAuthRoutes = protectedApp;

// Admin-only auth routes (mounted under /api/v1/admin/auth). These require a
// valid admin session + permission, enforced by the admin route factory.
const adminApp = createRouter();
adminApp.route('/', cacheStatsRoute);
// SPEC-182 T-011: staff host provisioning, gated by USER_CREATE (was a public
// Origin-checked route under /api/v1/public/auth before this spec).
adminApp.route('/', signupAsHostRoute);
export const adminAuthRoutes = adminApp;
