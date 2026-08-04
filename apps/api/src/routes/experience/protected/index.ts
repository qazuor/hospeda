/**
 * Protected experience routes (T-020 / HOS-372)
 * Routes that require authentication.
 *
 * IMPORTANT: Routes with overlapping param patterns are registered in order from
 * most specific to most general to prevent Hono's param catch-all routes from
 * swallowing named sub-paths:
 * - /{id}/faqs/reorder (PUT) MUST be before /{id}/faqs/{faqId} (PUT/DELETE).
 * - /{experienceId}/reviews (POST) MUST be before /{id} (GET/PATCH).
 * - /{id}/media/reorder (PATCH) MUST be before /{id}/media/{mediaId} (DELETE).
 * - /{id}/media/{mediaId}/featured (PUT) MUST be before /{id}/media/{mediaId} (DELETE).
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddExperienceFaqRoute } from './addFaq';
import { protectedAddExperienceMediaRoute } from './addMedia';
import { protectedCreateExperienceReviewRoute } from './createReview';
import { protectedGetExperienceByIdRoute } from './getById';
import { protectedGetExperienceMediaRoute } from './getMedia';
import { protectedListMyExperienceRoute } from './listMine';
import { protectedPatchExperienceRoute } from './patch';
import { protectedRemoveExperienceFaqRoute } from './removeFaq';
import { protectedRemoveExperienceMediaRoute } from './removeMedia';
import { protectedReorderExperienceFaqsRoute } from './reorderFaqs';
import { protectedReorderExperienceMediaRoute } from './reorderMedia';
import { protectedSetFeaturedExperienceMediaRoute } from './setFeaturedMedia';
import { protectedUpdateExperienceFaqRoute } from './updateFaq';

const app = createRouter();

// PUT /{id}/faqs/reorder — Must be before /{id}/faqs/{faqId} (PUT).
app.route('/', protectedReorderExperienceFaqsRoute);

// GET /mine — Owner's own listings. MUST be before /{id} so the literal
// "mine" segment is not captured as an :id param.
app.route('/', protectedListMyExperienceRoute);

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

// Media management (HOS-372) — gated on COMMERCE_EDIT_OWN/COMMERCE_EDIT_ALL
// inside the service layer via checkExperienceCanEditMedia.

// PATCH /{id}/media/reorder — Must be before /{id}/media/{mediaId} (DELETE).
app.route('/', protectedReorderExperienceMediaRoute);

// GET /{id}/media — List gallery photos.
app.route('/', protectedGetExperienceMediaRoute);

// POST /{id}/media — Add photo to gallery.
app.route('/', protectedAddExperienceMediaRoute);

// PUT /{id}/media/{mediaId}/featured — Must be before /{id}/media/{mediaId} (DELETE).
app.route('/', protectedSetFeaturedExperienceMediaRoute);

// DELETE /{id}/media/{mediaId} — Remove photo from gallery.
app.route('/', protectedRemoveExperienceMediaRoute);

export { app as protectedExperienceRoutes };
