/**
 * Protected gastronomy routes (T-043 / T-044 / HOS-372)
 * Routes that require authentication.
 *
 * Routes with overlapping param patterns are registered from most specific to
 * most general, matching the convention the rest of the codebase follows:
 * - /{id}/faqs/reorder (PUT) before /{id}/faqs/{faqId} (PUT/DELETE).
 * - /{gastronomyId}/reviews (POST) before /{id} (GET/PATCH).
 * - /{id}/media/reorder (PATCH) before /{id}/media/{mediaId} (DELETE).
 * - /{id}/media/{mediaId}/featured (PUT) before /{id}/media/{mediaId} (DELETE).
 *
 * For the two media entries this ordering is DEFENSIVE, not load-bearing: Hono
 * resolves a static segment ahead of a param at the same position regardless of
 * insertion order. Verified by mutation on the post/event twin of these routes
 * (registering the DELETE first leaves
 * `test/routes/post-protected-media.test.ts` green). There is no equivalent
 * commerce-side route test to re-run that mutation against here, but it is the
 * same Hono router. The other two entries are very likely the same, but were
 * not verified — do not read them as proven.
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
