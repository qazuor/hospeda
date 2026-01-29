/**
 * Protected accommodation routes
 * Routes that require authentication
 */
import { createRouter } from '../../../utils/create-app';
// FAQ routes (require auth and ownership)
import { addFaqRoute } from './addFaq';
import { protectedCreateAccommodationRoute } from './create';
import { getFaqsRoute } from './getFaqs';
import { protectedPatchAccommodationRoute } from './patch';
import { removeFaqRoute } from './removeFaq';
import { protectedSoftDeleteAccommodationRoute } from './softDelete';
import { protectedUpdateAccommodationRoute } from './update';
import { updateFaqRoute } from './updateFaq';

const app = createRouter();

// POST / - Create accommodation
app.route('/', protectedCreateAccommodationRoute);

// PUT /:id - Update accommodation
app.route('/', protectedUpdateAccommodationRoute);

// PATCH /:id - Patch accommodation
app.route('/', protectedPatchAccommodationRoute);

// DELETE /:id - Soft delete accommodation
app.route('/', protectedSoftDeleteAccommodationRoute);

// FAQ management
app.route('/', getFaqsRoute);
app.route('/', addFaqRoute);
app.route('/', updateFaqRoute);
app.route('/', removeFaqRoute);

export { app as protectedAccommodationRoutes };
