/**
 * venue services barrel export (SPEC-239).
 *
 * Public API surface for the venue service layer:
 * - {@link VenueService} — main CRUD + operational-update + search service
 * - {@link VenueReviewService} — review create / moderate / list / rating recompute
 * - FAQ helpers — addVenueFaq / updateVenueFaq / removeVenueFaq /
 *   listVenueFaqs / reorderVenueFaqs
 * - Menu helpers (HOS-895) — getVenueMenu / replaceVenueMenu
 * - Media helpers (HOS-372) — addVenueMedia / removeVenueMedia /
 *   reorderVenueMedia / getVenueMedia / setFeaturedVenueMedia,
 *   plus the composed-media read attach helpers
 * - Projection utilities — projectVenuePublic / projectVenueOwnerAvatar
 * - Permission helpers — granular per-vertical gate wrappers
 * - Types — VenueHookState
 */

// Daily-special helpers (HOS-1041) — the menú del día, read whole and written
// whole. The expiry is the `validOn` filter on the read, not a cron.
export {
    getVenueDailySpecials,
    replaceVenueDailySpecials
} from './venue.daily-specials';
// Venue events helpers (HOS-1042) — the agenda, read whole and written whole
export { getVenueEvents, replaceVenueEvents } from './venue.events';
// FAQ helpers
export {
    addVenueFaq,
    listVenueFaqs,
    removeVenueFaq,
    reorderVenueFaqs,
    updateVenueFaq
} from './venue.faq';
// Media helpers (HOS-372); the born-featured cover upload is HOS-803
export {
    addVenueFeaturedMedia,
    addVenueMedia,
    getVenueMedia,
    removeVenueMedia,
    reorderVenueMedia,
    setFeaturedVenueMedia,
    updateVenueMedia
} from './venue.media';
// Media read/compose attach helpers (HOS-372)
export {
    attachComposedVenueMedia,
    attachComposedVenueMediaList
} from './venue.media-read';
// Menu helpers (HOS-895) — the carta, read whole and written whole
export { getVenueMenu, replaceVenueMenu } from './venue.menu';
// Permission helpers
export {
    checkVenueCanAdminList,
    checkVenueCanCreate,
    checkVenueCanDelete,
    checkVenueCanEditAll,
    checkVenueCanEditFaqs,
    checkVenueCanEditMedia,
    checkVenueCanEditOwn,
    checkVenueCanHardDelete,
    checkVenueCanModerateReview,
    checkVenueCanRestore,
    checkVenueCanView
} from './venue.permissions';
// Projection utilities
export {
    projectVenueOwnerAvatar,
    projectVenueOwnerAvatarList,
    projectVenuePublic,
    projectVenuePublicList
} from './venue.projections';
// Review service
export {
    type VenueReviewModerateInput,
    VenueReviewService
} from './venue.review.service';
// Main service
export { VenueService } from './venue.service';
// Types
export type { VenueHookState } from './venue.types';
// Menu QR helpers (HOS-1044) — the target-URL builder and its inverse, shared
// between the provisioning route and the slug-change repointing hook.
export {
    buildVenueMenuQrLabel,
    buildVenueMenuQrTargetUrl,
    resolveVenueMenuQrLangFromTargetUrl,
    VENUE_MENU_QR_ENTITY_TYPE,
    VENUE_MENU_QR_PURPOSE
} from './venue-qr';
