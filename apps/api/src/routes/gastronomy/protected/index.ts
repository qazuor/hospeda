/**
 * Protected gastronomy routes (T-043 / T-044)
 * Routes that require authentication.
 *
 * IMPORTANT: Routes with overlapping param patterns are registered in order from
 * most specific to most general to prevent Hono's param catch-all routes from
 * swallowing named sub-paths:
 * - /{id}/faqs/reorder (PUT) MUST be before /{id}/faqs/{faqId} (PUT/DELETE).
 * - /{gastronomyId}/reviews (POST) MUST be before /{id} (GET/PATCH).
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddGastronomyFaqRoute } from './addFaq';
import { protectedCreateGastronomyReviewRoute } from './createReview';
import { protectedGetGastronomyByIdRoute } from './getById';
import { protectedPatchGastronomyRoute } from './patch';
import { protectedRemoveGastronomyFaqRoute } from './removeFaq';
import { protectedReorderGastronomyFaqsRoute } from './reorderFaqs';
import { protectedUpdateGastronomyFaqRoute } from './updateFaq';

const app = createRouter();

// PUT /{id}/faqs/reorder — Must be before /{id}/faqs/{faqId} (PUT).
app.route('/', protectedReorderGastronomyFaqsRoute);

// GET /{id} — Owner view (protected projection).
app.route('/', protectedGetGastronomyByIdRoute);

// PATCH /{id} — Owner operational update.
app.route('/', protectedPatchGastronomyRoute);

// POST /{id}/faqs — Add FAQ.
app.route('/', protectedAddGastronomyFaqRoute);

// PUT /{id}/faqs/{faqId} — Update FAQ.
app.route('/', protectedUpdateGastronomyFaqRoute);

// DELETE /{id}/faqs/{faqId} — Remove FAQ.
app.route('/', protectedRemoveGastronomyFaqRoute);

// POST /{gastronomyId}/reviews — Tourist creates a review.
app.route('/', protectedCreateGastronomyReviewRoute);

export { app as protectedGastronomyRoutes };
