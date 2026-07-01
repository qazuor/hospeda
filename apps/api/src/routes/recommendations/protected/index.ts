/**
 * Protected recommendations routes (SPEC-284).
 * All routes require authentication.
 *
 * Route registration order:
 *   1. GET / — personalized recommendations feed (only route so far).
 */
import { createRouter } from '../../../utils/create-app';
import { getRecommendationsRoute } from './get';

const app = createRouter();

// GET / — personalized recommendations feed
app.route('/', getRecommendationsRoute);

export { app as protectedRecommendationsRoutes };
