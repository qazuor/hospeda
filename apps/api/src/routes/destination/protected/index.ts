/**
 * Protected destination routes
 * All routes here require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { protectedDestinationReviewRoutes } from '../reviews/protected/index.js';
import { protectedCreateDestinationRoute } from './create';
import { protectedPatchDestinationRoute } from './patch';
import { protectedSoftDeleteDestinationRoute } from './softDelete';
import { protectedUpdateDestinationRoute } from './update';

const app = createRouter();

// Register routes
app.route('/', protectedCreateDestinationRoute);
app.route('/', protectedUpdateDestinationRoute);
app.route('/', protectedPatchDestinationRoute);
app.route('/', protectedSoftDeleteDestinationRoute);

// Review routes
app.route('/', protectedDestinationReviewRoutes);

export { app as protectedDestinationRoutes };
