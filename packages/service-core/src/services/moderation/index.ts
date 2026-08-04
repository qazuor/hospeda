/**
 * Moderation aggregation service exports.
 *
 * @module services/moderation
 */
export type { AuthorEditLockInput } from './author-edit-lock';
export { isAuthorEditLockedByModeration } from './author-edit-lock';
export { ModerationAggregationService } from './moderation.aggregation.service';
export type {
    ResolveInitialModerationStateInput,
    ReviewEntityType,
    ReviewVerificationLevel
} from './review-moderation.helpers';
export {
    MODERATION_PENDING_THRESHOLD,
    resolveInitialModerationState
} from './review-moderation.helpers';
