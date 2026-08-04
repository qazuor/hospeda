/**
 * Protected gastronomy routes (T-043 / T-044 / HOS-372)
 * Routes that require authentication.
 *
 * IMPORTANT: Routes with overlapping param patterns are registered in order from
 * most specific to most general to prevent Hono's param catch-all routes from
 * swallowing named sub-paths:
 * - /{id}/faqs/reorder (PUT) MUST be before /{id}/faqs/{faqId} (PUT/DELETE).
 * - /{gastronomyId}/reviews (POST) MUST be before /{id} (GET/PATCH).
 * - /{id}/media/reorder (PATCH) MUST be before /{id}/media/{mediaId} (DELETE).
 * - /{id}/media/{mediaId}/featured (PUT) MUST be before /{id}/media/{mediaId} (DELETE).
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddGastronomyFaqRoute } from './addFaq';
import { protectedAddGastronomyMediaRoute } from './addMedia';
import { protectedCreateGastronomyReviewRoute } from './createReview';
import { protectedGetGastronomyByIdRoute } from './getById';
import { protectedGetGastronomyMediaRoute } from './getMedia';
import { protectedListMyGastronomyRoute } from './listMine';
import { protectedPatchGastronomyRoute } from './patch';
import { protectedRemoveGastronomyFaqRoute } from './removeFaq';
import { protectedRemoveGastronomyMediaRoute } from './removeMedia';
import { protectedReorderGastronomyFaqsRoute } from './reorderFaqs';
import { protectedReorderGastronomyMediaRoute } from './reorderMedia';
import { protectedSetFeaturedGastronomyMediaRoute } from './setFeaturedMedia';
import { protectedUpdateGastronomyFaqRoute } from './updateFaq';

const app = createRouter();

// PUT /{id}/faqs/reorder — Must be before /{id}/faqs/{faqId} (PUT).
app.route('/', protectedReorderGastronomyFaqsRoute);

// GET /mine — Owner's own listings. MUST be before /{id} so the literal
// "mine" segment is not captured as an :id param.
app.route('/', protectedListMyGastronomyRoute);

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

// Media management (HOS-372) — gated on COMMERCE_EDIT_OWN/COMMERCE_EDIT_ALL
// inside the service layer via checkGastronomyCanEditMedia.

// PATCH /{id}/media/reorder — Must be before /{id}/media/{mediaId} (DELETE).
app.route('/', protectedReorderGastronomyMediaRoute);

// GET /{id}/media — List gallery photos.
app.route('/', protectedGetGastronomyMediaRoute);

// POST /{id}/media — Add photo to gallery.
app.route('/', protectedAddGastronomyMediaRoute);

// PUT /{id}/media/{mediaId}/featured — Must be before /{id}/media/{mediaId} (DELETE).
app.route('/', protectedSetFeaturedGastronomyMediaRoute);

// DELETE /{id}/media/{mediaId} — Remove photo from gallery.
app.route('/', protectedRemoveGastronomyMediaRoute);

export { app as protectedGastronomyRoutes };
