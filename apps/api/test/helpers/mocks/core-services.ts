/**
 * Re-exports for core domain service mocks.
 *
 * This file provides a single import point for all core domain mock services.
 * Individual implementations live in their dedicated files.
 *
 * @module test/helpers/mocks/core-services
 */

export { PostService, TagService } from './content-services';
export {
    AccommodationService,
    AmenityService,
    AccommodationReviewService
} from './accommodation-services';
export {
    DestinationService,
    DestinationReviewService,
    AttractionService,
    FeatureService
} from './destination-services';
