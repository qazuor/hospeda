/**
 * --- BASE ---
 * Exports the foundational abstract `BaseService` class.
 */
export * from './base';

/**
 * --- TYPES ---
 * Exports all shared types for the service layer, including `Actor`, `ServiceError`,
 * `ServiceOutput`, and permission-related types.
 */
export * from './types';

/**
 * --- UTILS ---
 * Exports utility functions for logging and validation.
 */
export * from './utils';

/**
 * --- SERVICES ---
 * Exports all concrete service implementations.
 */
export * from './services/accommodation/accommodation.service';
export * from './services/accommodationReview/accommodationReview.service';
export * from './services/amenity/amenity.service';
export * from './services/attraction/attraction.service';
export * from './services/destination/destination.service';
export * from './services/destinationReview/destinationReview.service';
export * from './services/event/event.service';
export * from './services/eventLocation/eventLocation.service';
export * from './services/eventOrganizer/eventOrganizer.service';
export * from './services/feature/feature.service';
export * from './services/post/post.service';
export * from './services/postSponsor/postSponsor.service';
export * from './services/postSponsorship/postSponsorship.service';
export * from './services/tag/tag.service';
export * from './services/user/user.service';
export * from './services/userBookmark/userBookmark.service';

/**
 * --- ENUMS (re-exported to prevent warnings and expose them to consumers) ---
 */
export {
    EntityPermissionReasonEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
