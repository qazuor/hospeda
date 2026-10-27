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
 * gastronomy/experience-side route test to re-run that mutation against here, but it is the
 * same Hono router. The other two entries are very likely the same, but were
 * not verified — do not read them as proven.
 */
import { createRouter } from '../../../utils/create-app';
import { protectedAddVenueFaqRoute } from './addFaq';
import { protectedAddVenueFeaturedMediaRoute } from './addFeaturedMedia';
import { protectedAddVenueMediaRoute } from './addMedia';
import { protectedGetVenueBrochureRoute } from './brochure';
import { protectedCreateVenueListingRoute } from './create';
import { protectedCreateVenueReviewRoute } from './createReview';
import { protectedDeleteVenueMenuFileRoute } from './deleteMenuFile';
import { protectedGetVenueByIdRoute } from './getById';
import { protectedGetVenueDailySpecialsRoute } from './getDailySpecials';
import { protectedGetVenueEventsRoute } from './getEvents';
import { protectedGetVenueMediaRoute } from './getMedia';
import { protectedGetVenueMenuRoute } from './getMenu';
import { protectedListMyVenueRoute } from './listMine';
import { protectedGetVenueMenuQrRoute } from './menuQr';
import { protectedGetVenueMenuQrScansRoute } from './menuQrScans';
import { protectedPatchVenueRoute } from './patch';
import { protectedPublishVenueRoute } from './publish';
import { protectedPurgeVenueRoute } from './purge';
import { protectedVenuePurgePreviewRoute } from './purgePreview';
import { protectedPutVenueDailySpecialsRoute } from './putDailySpecials';
import { protectedPutVenueEventsRoute } from './putEvents';
import { protectedPutVenueMenuRoute } from './putMenu';
import { protectedGetVenueQrCodeRoute } from './qrCode';
import { protectedGetVenueQrSheetRoute } from './qrSheet';
import { protectedReactivateVenueRoute } from './reactivate';
import { protectedRemoveVenueFaqRoute } from './removeFaq';
import { protectedRemoveVenueMediaRoute } from './removeMedia';
import { protectedReorderVenueFaqsRoute } from './reorderFaqs';
import { protectedReorderVenueMediaRoute } from './reorderMedia';
import { protectedVenueReportFixedRoute } from './reportFixed';
import { protectedSetFeaturedVenueMediaRoute } from './setFeaturedMedia';
import { protectedVenueSupportEditsRoute } from './supportEdits';
import { protectedUnpublishVenueRoute } from './unpublish';
import { protectedUpdateVenueFaqRoute } from './updateFaq';
import { protectedUpdateVenueMediaRoute } from './updateMedia';
import { protectedUploadVenueMenuFileRoute } from './uploadMenuFile';
import { protectedUploadVenueMenuItemPhotoRoute } from './uploadMenuItemPhoto';
import { protectedVenueViewStatsRoute } from './viewStats';
import { protectedVenueViewStatsDailySeriesRoute } from './viewStatsDailySeries';

const app = createRouter();

// POST / — Owner self-service create (HOS-166 §7.2). Root path, so it cannot
// collide with any /{id}/... route.
app.route('/', protectedCreateVenueListingRoute);

// PUT /{id}/faqs/reorder — Must be before /{id}/faqs/{faqId} (PUT).
app.route('/', protectedReorderVenueFaqsRoute);

// GET /mine — Owner's own listings. MUST be before /{id} so the literal
// "mine" segment is not captured as an :id param.
app.route('/', protectedListMyVenueRoute);

// GET /mine/views, /mine/views/daily-series — Basic view stats (HOS-734).
// Two literal segments under /mine, so ordering relative to /mine and /{id}
// is not load-bearing (Hono matches exact segment counts), but registered
// alongside /mine for readability.
app.route('/', protectedVenueViewStatsRoute);
app.route('/', protectedVenueViewStatsDailySeriesRoute);

// GET /{id}/brochure — Printable PDF sheet (HOS-1058). Registered before
// /{id} for the same DEFENSIVE reason as the media entries: Hono resolves a
// static segment ahead of a param at the same position regardless of insertion
// order, so this ordering is belt-and-braces, not load-bearing.
app.route('/', protectedGetVenueBrochureRoute);

// GET /{id}/qr-sheet — Printable QR sheet for the door (HOS-982). A different
// document from the brochure above and from the table's menu code: this one is
// `purpose: LISTING` and carries NO entitlement gate (owner decision). Same
// defensive ordering rationale as the brochure.
app.route('/', protectedGetVenueQrSheetRoute);
app.route('/', protectedGetVenueQrCodeRoute);

// Menu (HOS-895) — the carta and its photo/PDF alternative. Registered
// before /{id} for the same DEFENSIVE reason as the media and brochure
// entries: Hono resolves a static segment ahead of a param at the same
// position regardless of insertion order.
//
// GET /{id}/menu — read the carta. NOT entitlement-gated: every gastronomy
// tier sees its own menu, and only writing the structured half is paid.
app.route('/', protectedGetVenueMenuRoute);

// PUT /{id}/menu — replace the structured carta. Gated on
// MANAGE_VENUE_MENU (venue-pro and above).
app.route('/', protectedPutVenueMenuRoute);

// POST /{id}/menu-file — upload the photo/PDF alternative. Gated on
// MANAGE_VENUE_MENU, same as PUT /{id}/menu (HOS-895 PR2 — owner
// decision reversed PR1's ungated shipment).
app.route('/', protectedUploadVenueMenuFileRoute);

// DELETE /{id}/menu-file — clear it, asset included. Same gate as the upload.
app.route('/', protectedDeleteVenueMenuFileRoute);

// POST /{id}/menu-item-photo — upload ONE dish photo (HOS-1045). Gated on
// MENU_ITEM_PHOTOS (venue-premium), a strictly narrower gate than the
// carta's: writing a carta is `-pro`, putting a picture on a dish of it is the
// tier above. Returns the asset; the association is written by PUT /{id}/menu,
// because a dish's id does not survive that write.
app.route('/', protectedUploadVenueMenuItemPhotoRoute);

// GET /{id}/menu-qr — the venue's printable menu QR (HOS-1044), minted (or
// reused) on this call only — never on the public /carta/ page. Gated on
// MENU_QR_SCAN_METRICS (venue-premium). Registered before /{id} for the
// same DEFENSIVE reason as the entries above.
app.route('/', protectedGetVenueMenuQrRoute);

// GET /{id}/menu-qr/scans — the scan aggregate for that same QR (HOS-1044
// §6.4): total, daily series, device/OS/language breakdowns. Never mints —
// a venue with no code yet gets an all-zero aggregate. Same gate as above,
// three literal segments so ordering relative to /{id}/menu-qr is defensive
// only (Hono matches exact segment counts).
app.route('/', protectedGetVenueMenuQrScansRoute);

// Menú del día (HOS-1041) — a dish with its own validity window. Registered
// before /{id} for the same DEFENSIVE reason as the entries above.
//
// GET /{id}/daily-specials — read them, UNFILTERED by the window. NOT
// entitlement-gated: every gastronomy tier sees its own specials, and only
// publishing them is paid.
app.route('/', protectedGetVenueDailySpecialsRoute);

// PUT /{id}/daily-specials — replace them. Gated on
// MANAGE_VENUE_DAILY_SPECIAL (venue-pro and above).
app.route('/', protectedPutVenueDailySpecialsRoute);
// Venue events (HOS-1042) — the venue's own agenda. Registered before /{id}
// for the same DEFENSIVE reason as every static-segment entry above.
//
// GET /{id}/events — read the agenda. NOT entitlement-gated: an owner whose
// plan no longer grants it still owns the rows, and only writing is paid.
app.route('/', protectedGetVenueEventsRoute);

// PUT /{id}/events — replace the agenda. Gated on MANAGE_VENUE_EVENTS
// (venue-pro and above).
app.route('/', protectedPutVenueEventsRoute);

// GET /{id} — Owner view (protected projection).
app.route('/', protectedPublishVenueRoute);
app.route('/', protectedUnpublishVenueRoute);
app.route('/', protectedReactivateVenueRoute);
app.route('/', protectedPurgeVenueRoute);
app.route('/', protectedVenuePurgePreviewRoute);
app.route('/', protectedVenueSupportEditsRoute);
app.route('/', protectedVenueReportFixedRoute);
app.route('/', protectedGetVenueByIdRoute);

// PATCH /{id} — Owner operational update.
app.route('/', protectedPatchVenueRoute);

// POST /{id}/faqs — Add FAQ.
app.route('/', protectedAddVenueFaqRoute);

// PUT /{id}/faqs/{faqId} — Update FAQ.
app.route('/', protectedUpdateVenueFaqRoute);

// DELETE /{id}/faqs/{faqId} — Remove FAQ.
app.route('/', protectedRemoveVenueFaqRoute);

// POST /{gastronomyId}/reviews — Tourist creates a review.
app.route('/', protectedCreateVenueReviewRoute);

// Media management (HOS-372) — gated on GASTRONOMY_EDIT_OWN/GASTRONOMY_EDIT_ALL
// inside the service layer via checkVenueCanEditMedia.

// PATCH /{id}/media/reorder — Must be before /{id}/media/{mediaId} (DELETE).
app.route('/', protectedReorderVenueMediaRoute);

// GET /{id}/media — List gallery photos.
app.route('/', protectedGetVenueMediaRoute);

// POST /{id}/media — Add photo to gallery.
// POST /:id/media/featured - Upload straight to cover (HOS-803).
// Registered before POST /:id/media so "featured" resolves as the fixed
// suffix rather than being absorbed by the collection route.
app.route('/', protectedAddVenueFeaturedMediaRoute);

app.route('/', protectedAddVenueMediaRoute);

// PUT /{id}/media/{mediaId}/featured — Must be before /{id}/media/{mediaId} (DELETE).
app.route('/', protectedSetFeaturedVenueMediaRoute);

// DELETE /{id}/media/{mediaId} — Remove photo from gallery.
app.route('/', protectedRemoveVenueMediaRoute);

// PATCH /:id/media/:mediaId - Correct a photo's text metadata
// (caption/description/alt/attribution) — HOS-1036.
app.route('/', protectedUpdateVenueMediaRoute);

export { app as protectedVenueRoutes };
