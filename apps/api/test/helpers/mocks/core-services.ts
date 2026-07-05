/**
 * Re-exports for core domain service mocks.
 *
 * This file provides a single import point for all core domain mock services.
 * Individual implementations live in their dedicated files.
 *
 * @module test/helpers/mocks/core-services
 */

export {
    AccommodationReviewService,
    AccommodationService,
    AmenityService
} from './accommodation-services';
export { PostService, TagService } from './content-services';
export {
    AttractionService,
    DestinationReviewService,
    DestinationService,
    FeatureService
} from './destination-services';
