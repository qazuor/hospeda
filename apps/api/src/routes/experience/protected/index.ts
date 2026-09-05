/**
 * Protected experience routes (T-020 / HOS-372)
 * Routes that require authentication.
 *
 * Routes with overlapping param patterns are registered from most specific to
 * most general, matching the convention the rest of the codebase follows:
 * - /{id}/faqs/reorder (PUT) before /{id}/faqs/{faqId} (PUT/DELETE).
 * - /{experienceId}/reviews (POST) before /{id} (GET/PATCH).
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
import { protectedAddExperienceFaqRoute } from './addFaq';
import { protectedAddExperienceFeaturedMediaRoute } from './addFeaturedMedia';
import { protectedAddExperienceMediaRoute } from './addMedia';
import { protectedGetExperienceBrochureRoute } from './brochure';
import {
    protectedGetExperienceCertificatePdfRoute,
    protectedIssueExperienceCertificateRoute,
    protectedListExperienceCertificatesRoute
} from './certificates';
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
import { protectedUpdateExperienceMediaRoute } from './updateMedia';
import { protectedExperienceViewStatsRoute } from './viewStats';
import { protectedExperienceViewStatsDailySeriesRoute } from './viewStatsDailySeries';

const app = createRouter();

// PUT /{id}/faqs/reorder — Must be before /{id}/faqs/{faqId} (PUT).
app.route('/', protectedReorderExperienceFaqsRoute);

// GET /mine — Owner's own listings. MUST be before /{id} so the literal
// "mine" segment is not captured as an :id param.
app.route('/', protectedListMyExperienceRoute);

// GET /mine/views, /mine/views/daily-series — Basic view stats (HOS-734).
// Two literal segments under /mine, so ordering relative to /mine and /{id}
// is not load-bearing (Hono matches exact segment counts), but registered
// alongside /mine for readability.
app.route('/', protectedExperienceViewStatsRoute);
app.route('/', protectedExperienceViewStatsDailySeriesRoute);

// GET /{id}/brochure — Printable PDF sheet (HOS-1058). Registered before
// /{id} for the same DEFENSIVE reason as the media entries: Hono resolves a
// static segment ahead of a param at the same position regardless of insertion
// order, so this ordering is belt-and-braces, not load-bearing.
app.route('/', protectedGetExperienceBrochureRoute);

// POST/GET /{id}/certificates and GET /{id}/certificates/{certificateId}/pdf —
// The certificate a provider issues to whoever did the experience (HOS-1057).
// Registered before /{id} for the same defensive reason as the brochure above.
app.route('/', protectedGetExperienceCertificatePdfRoute);
app.route('/', protectedIssueExperienceCertificateRoute);
app.route('/', protectedListExperienceCertificatesRoute);

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
// POST /:id/media/featured - Upload straight to cover (HOS-803).
// Registered before POST /:id/media so "featured" resolves as the fixed
// suffix rather than being absorbed by the collection route.
app.route('/', protectedAddExperienceFeaturedMediaRoute);

app.route('/', protectedAddExperienceMediaRoute);

// PUT /{id}/media/{mediaId}/featured — Must be before /{id}/media/{mediaId} (DELETE).
app.route('/', protectedSetFeaturedExperienceMediaRoute);

// DELETE /{id}/media/{mediaId} — Remove photo from gallery.
app.route('/', protectedRemoveExperienceMediaRoute);

// PATCH /:id/media/:mediaId - Correct a photo's text metadata
// (caption/description/alt/attribution) — HOS-1036.
app.route('/', protectedUpdateExperienceMediaRoute);

export { app as protectedExperienceRoutes };
