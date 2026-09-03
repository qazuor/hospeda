/**
 * Gastronomy services barrel export (SPEC-239).
 *
 * Public API surface for the gastronomy service layer:
 * - {@link GastronomyService} — main CRUD + operational-update + search service
 * - {@link GastronomyReviewService} — review create / moderate / list / rating recompute
 * - FAQ helpers — addGastronomyFaq / updateGastronomyFaq / removeGastronomyFaq /
 *   listGastronomyFaqs / reorderGastronomyFaqs
 * - Menu helpers (HOS-895) — getGastronomyMenu / replaceGastronomyMenu
 * - Media helpers (HOS-372) — addGastronomyMedia / removeGastronomyMedia /
 *   reorderGastronomyMedia / getGastronomyMedia / setFeaturedGastronomyMedia,
 *   plus the composed-media read attach helpers
 * - Projection utilities — projectGastronomyPublic / projectGastronomyOwnerAvatar
 * - Permission helpers — granular COMMERCE_* gate wrappers
 * - Types — GastronomyHookState
 */

// Daily-special helpers (HOS-1041) — the menú del día, read whole and written
// whole. The expiry is the `validOn` filter on the read, not a cron.
export {
    getGastronomyDailySpecials,
    replaceGastronomyDailySpecials
} from './gastronomy.daily-specials';
// FAQ helpers
export {
    addGastronomyFaq,
    listGastronomyFaqs,
    removeGastronomyFaq,
    reorderGastronomyFaqs,
    updateGastronomyFaq
} from './gastronomy.faq';
// Media helpers (HOS-372)
export {
    addGastronomyMedia,
    getGastronomyMedia,
    removeGastronomyMedia,
    reorderGastronomyMedia,
    setFeaturedGastronomyMedia
} from './gastronomy.media';
// Media read/compose attach helpers (HOS-372)
export {
    attachComposedGastronomyMedia,
    attachComposedGastronomyMediaList
} from './gastronomy.media-read';
// Menu helpers (HOS-895) — the carta, read whole and written whole
export { getGastronomyMenu, replaceGastronomyMenu } from './gastronomy.menu';
// Menu entitlement resolvers (HOS-895 PR2; generalised by HOS-1041, widened by
// HOS-1045) — live owner-plan checks for the public detail page's display
// gates. All four share ONE three-query lookup, so they cannot drift.
export {
    type GastronomyMenuGrants,
    resolveOwnerGastronomyMenuGrants,
    resolveOwnerGrantsGastronomyDailySpecial,
    resolveOwnerGrantsGastronomyEntitlement,
    resolveOwnerGrantsGastronomyMenuManagement
} from './gastronomy.menu-entitlement';
// Permission helpers
export {
    checkGastronomyCanAdminList,
    checkGastronomyCanCreate,
    checkGastronomyCanDelete,
    checkGastronomyCanEditAll,
    checkGastronomyCanEditFaqs,
    checkGastronomyCanEditMedia,
    checkGastronomyCanEditOwn,
    checkGastronomyCanHardDelete,
    checkGastronomyCanModerateReview,
    checkGastronomyCanRestore,
    checkGastronomyCanView
} from './gastronomy.permissions';
// Projection utilities
export {
    projectGastronomyOwnerAvatar,
    projectGastronomyOwnerAvatarList,
    projectGastronomyPublic,
    projectGastronomyPublicList
} from './gastronomy.projections';
// Review service
export {
    type GastronomyReviewModerateInput,
    GastronomyReviewService
} from './gastronomy.review.service';
// Main service
export { GastronomyService } from './gastronomy.service';

// Types
export type { GastronomyHookState } from './gastronomy.types';
