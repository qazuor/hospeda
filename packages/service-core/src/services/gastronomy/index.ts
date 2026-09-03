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
// Menu entitlement resolver (HOS-895 PR2) — live owner-plan check for the
// public detail page's display gate
export { resolveOwnerGrantsGastronomyMenuManagement } from './gastronomy.menu-entitlement';
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
