/**
 * Protected experience routes (T-020)
 * Routes that require authentication.
 *
 * IMPORTANT: Routes with overlapping param patterns are registered in order from
 * most specific to most general to prevent Hono's param catch-all routes from
 * swallowing named sub-paths:
 * - /{id}/faqs/reorder (PUT) MUST be before /{id}/faqs/{faqId} (PUT/DELETE).
 * - /{experienceId}/reviews (POST) MUST be before /{id} (GET/PATCH).
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddExperienceFaqRoute } from './addFaq';
import { protectedCreateExperienceReviewRoute } from './createReview';
import { protectedGetExperienceByIdRoute } from './getById';
import { protectedPatchExperienceRoute } from './patch';
import { protectedRemoveExperienceFaqRoute } from './removeFaq';
import { protectedReorderExperienceFaqsRoute } from './reorderFaqs';
import { protectedUpdateExperienceFaqRoute } from './updateFaq';

const app = createRouter();

// PUT /{id}/faqs/reorder — Must be before /{id}/faqs/{faqId} (PUT).
app.route('/', protectedReorderExperienceFaqsRoute);

// GET /{id} — Owner view (protected projection).
app.route('/', protectedGetExperienceByIdRoute);

// PATCH /{id} — Owner operational update.
app.route('/', protectedPatchExperienceRoute);

// POST /{id}/faqs — Add FAQ.
app.route('/', protectedAddExperienceFaqRoute);

// PUT /{id}/faqs/{faqId} — Update FAQ.
app.route('/', protectedUpdateExperienceFaqRoute);

// DELETE /{id}/faqs/{faqId} — Remove FAQ.
app.route('/', protectedRemoveExperienceFaqRoute);

// POST /{experienceId}/reviews — Tourist creates a review.
app.route('/', protectedCreateExperienceReviewRoute);

export { app as protectedExperienceRoutes };
