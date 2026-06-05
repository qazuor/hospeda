/**
 * Protected What's New routes.
 *
 * Mounted at `/api/v1/protected/whats-new` in `routes/index.ts`.
 * All routes in this module require a valid authenticated session
 * (enforced by `createProtectedRoute` / `protectedAuthMiddleware`).
 *
 * @see SPEC-175 §6.5
 */
import { createRouter } from '../../../utils/create-app';
import { protectedGetWhatsNewRoute } from './getWhatsNew';

const app = createRouter();

// GET / — list role-filtered entries with seen state
app.route('/', protectedGetWhatsNewRoute);

export { app as protectedWhatsNewRoutes };
