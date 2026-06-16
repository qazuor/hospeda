/**
 * Gastronomy services barrel export (SPEC-239).
 *
 * Public API surface for the gastronomy service layer:
 * - {@link GastronomyService} — main CRUD + operational-update + search service
 * - {@link GastronomyReviewService} — review create / moderate / list / rating recompute
 * - FAQ helpers — addGastronomyFaq / updateGastronomyFaq / removeGastronomyFaq /
 *   listGastronomyFaqs / reorderGastronomyFaqs
 * - Projection utilities — projectGastronomyPublic / projectGastronomyOwnerAvatar
 * - Permission helpers — granular COMMERCE_* gate wrappers
 * - Types — GastronomyHookState
 */

// Main service
export { GastronomyService } from './gastronomy.service';

// Review service
export {
    GastronomyReviewService,
    type GastronomyReviewModerateInput
} from './gastronomy.review.service';

// FAQ helpers
export {
    addGastronomyFaq,
    listGastronomyFaqs,
    removeGastronomyFaq,
    reorderGastronomyFaqs,
    updateGastronomyFaq
} from './gastronomy.faq';

// Projection utilities
export {
    projectGastronomyOwnerAvatar,
    projectGastronomyOwnerAvatarList,
    projectGastronomyPublic,
    projectGastronomyPublicList
} from './gastronomy.projections';

// Permission helpers
export {
    checkGastronomyCanAdminList,
    checkGastronomyCanCreate,
    checkGastronomyCanDelete,
    checkGastronomyCanEditAll,
    checkGastronomyCanEditFaqs,
    checkGastronomyCanEditOwn,
    checkGastronomyCanHardDelete,
    checkGastronomyCanModerateReview,
    checkGastronomyCanRestore,
    checkGastronomyCanView
} from './gastronomy.permissions';

// Types
export type { GastronomyHookState } from './gastronomy.types';
