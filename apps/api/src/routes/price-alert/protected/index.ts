/**
 * Protected price-alert routes (SPEC-286 T-005).
 * All routes require authentication.
 *
 * Route registration order: POST /, DELETE /{alertId}, GET / — no
 * path-collision risk since each route uses a distinct HTTP method.
 */
import { createRouter } from '../../../utils/create-app';
import { createPriceAlertRoute } from './create';
import { listPriceAlertsRoute } from './list';
import { deletePriceAlertRoute } from './remove';

const app = createRouter();

// POST / — subscribe to price-drop alerts
app.route('/', createPriceAlertRoute);

// DELETE /{alertId} — cancel a subscription
app.route('/', deletePriceAlertRoute);

// GET / — list own subscriptions
app.route('/', listPriceAlertsRoute);

export { app as protectedPriceAlertRoutes };
