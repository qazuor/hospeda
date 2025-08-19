/**
 * Accommodation routes index
 * Exports all accommodation-related routes using AccommodationService
 */
import { createRouter } from '../../utils/create-app';
import { addFaqRoute } from './addFaq';
import { createAccommodationRoute } from './create';
import { getByDestinationRoute } from './getByDestination';
import { accommodationGetByIdRoute } from './getById';
import { getAccommodationBySlugRoute } from './getBySlug';
import { getFaqsRoute } from './getFaqs';
import { getStatsRoute } from './getStats';
import { getSummaryRoute } from './getSummary';
import { getTopRatedByDestinationRoute } from './getTopRatedByDestination';
import { hardDeleteAccommodationRoute } from './hardDelete';
import { accommodationListRoute } from './list';
import { removeFaqRoute } from './removeFaq';
import { restoreAccommodationRoute } from './restore';
import { accommodationReviewRoutes } from './reviews';
import { softDeleteAccommodationRoute } from './softDelete';
import { updateAccommodationRoute } from './update';
import { updateFaqRoute } from './updateFaq';

const app = createRouter();

// Public routes (no authentication required)
app.route('/', accommodationListRoute); // GET / - Uses createListRoute (self-contained)
app.route('/', accommodationGetByIdRoute); // GET /:id - Uses createCRUDRoute (self-contained)
app.route('/', getAccommodationBySlugRoute); // GET /slug/:slug - Uses createCRUDRoute (self-contained)
app.route('/', getStatsRoute); // GET /:id/stats - Uses createSimpleRoute (self-contained)
app.route('/', getSummaryRoute); // GET /:id/summary - Uses createSimpleRoute (self-contained)
app.route('/', getByDestinationRoute); // GET /destination/:destinationId - Uses createSimpleRoute (self-contained)
app.route('/', getTopRatedByDestinationRoute); // GET /top-rated - Uses createSimpleRoute (self-contained)
app.route('/', getFaqsRoute); // GET /:id/faqs - Uses createSimpleRoute (self-contained)
app.route('/', accommodationReviewRoutes); // /:accommodationId/reviews (list/create)

// Protected routes (authentication required)
app.route('/', createAccommodationRoute); // POST / - Uses createCRUDRoute (self-contained)
app.route('/', updateAccommodationRoute); // PUT /:id - Uses createCRUDRoute (self-contained)
app.route('/', softDeleteAccommodationRoute); // DELETE /:id - Uses createCRUDRoute (self-contained)
app.route('/', restoreAccommodationRoute); // POST /:id/restore - Uses createCRUDRoute (self-contained)
app.route('/', addFaqRoute); // POST /:id/faqs - Uses createSimpleRoute (self-contained)
app.route('/', updateFaqRoute); // PUT /:id/faqs/:faqId - Uses createSimpleRoute (self-contained)
app.route('/', removeFaqRoute); // DELETE /:id/faqs/:faqId - Uses createSimpleRoute (self-contained)

// Admin routes (admin authentication required)
app.route('/', hardDeleteAccommodationRoute); // DELETE /:id/hard - Uses createCRUDRoute (self-contained)

export { app as accommodationRoutes };
