/**
 * Public feedback routes.
 *
 * Mounts the POST /feedback endpoint for beta feedback submissions.
 * No authentication required - rate limited by IP.
 */
import { createRouter } from '../../utils/create-app';
import { submitFeedbackRoute } from './submit';

/** Public feedback route group */
export const feedbackRoutes = createRouter().route('/', submitFeedbackRoute);
