/**
 * Protected host-onboarding routes.
 * Aggregates routes that require authentication but do not require
 * accommodation-specific permissions, so a fresh USER can use them.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedHostOnboardingStartRoute } from './start';

const app = createRouter();
app.route('/', protectedHostOnboardingStartRoute);

export { app as protectedHostOnboardingRoutes };
