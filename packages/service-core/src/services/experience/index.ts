/**
 * Experience services barrel export (SPEC-240).
 *
 * Public API surface for the experience service layer:
 * - {@link ExperienceService} — main CRUD + operational-update + search service
 * - {@link ExperienceReviewService} — review create / moderate / list / rating recompute
 * - FAQ helpers — addExperienceFaq / updateExperienceFaq / removeExperienceFaq /
 *   listExperienceFaqs / reorderExperienceFaqs
 * - Projection utilities — projectExperiencePublic / projectExperienceOwnerAvatar
 * - Permission helpers — granular COMMERCE_* gate wrappers
 * - Types — ExperienceHookState
 */

// FAQ helpers
export {
    addExperienceFaq,
    listExperienceFaqs,
    removeExperienceFaq,
    reorderExperienceFaqs,
    updateExperienceFaq
} from './experience.faq';
// Permission helpers
export {
    checkExperienceCanAdminList,
    checkExperienceCanCreate,
    checkExperienceCanDelete,
    checkExperienceCanEditAll,
    checkExperienceCanEditFaqs,
    checkExperienceCanEditOwn,
    checkExperienceCanHardDelete,
    checkExperienceCanModerateReview,
    checkExperienceCanRestore,
    checkExperienceCanView
} from './experience.permissions';
// Projection utilities
export {
    projectExperienceOwnerAvatar,
    projectExperienceOwnerAvatarList,
    projectExperiencePublic,
    projectExperiencePublicList
} from './experience.projections';
// Review service
export {
    type ExperienceReviewModerateInput,
    ExperienceReviewService
} from './experience.review.service';
// Main service
export { ExperienceService } from './experience.service';

// Types
export type { ExperienceHookState } from './experience.types';
