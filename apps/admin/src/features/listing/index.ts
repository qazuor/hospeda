/**
 * @file index.ts
 * Public barrel for the generic listing admin config-layer.
 *
 * Concrete listing entities (gastronomy, experiences, …) import from here
 * to access config builders, section factories, and hook factories WITHOUT
 * depending on the internal file paths of this feature.
 *
 * DO NOT export gastronomy-specific or experience-specific symbols here.
 * This module is the reusable shared layer only.
 */

export type { ListingGalleryManagerProps } from './components/ListingGalleryManager';

// Relational gallery manager UI (HOS-382)
export { ListingGalleryManager } from './components/ListingGalleryManager';
export type { ListingPurgeOnRequestCardProps } from './components/ListingPurgeOnRequestCard';
// Administrative action 23: purge at the owner's request (HOS-1493)
export { ListingPurgeOnRequestCard } from './components/ListingPurgeOnRequestCard';
// List config factory
export { createListingListConfig } from './config/createListingListConfig';
// Shared section builders
export {
    createListingIdentitySection,
    createListingOperationalSection
} from './config/listingSections';
export type {
    AssignOwnerInput,
    ListingEntityHooks,
    ListingEntityHooksConfig,
    ModerateReviewInput,
    PendingReviewsQueryParams,
    ReviewModerationDecision
} from './hooks/createListingEntityHooks';

// Hooks factory + related types
export { createListingEntityHooks } from './hooks/createListingEntityHooks';
export type {
    ListingMedia,
    ListingMediaAddPayload,
    ListingMediaVertical
} from './hooks/useListingMedia';
// Relational media gallery hooks (HOS-382)
export {
    listingMediaQueryKeys,
    useListingMediaAdd,
    useListingMediaList,
    useListingMediaRemove,
    useListingMediaSetFeatured
} from './hooks/useListingMedia';
export type {
    PurgeListingOnRequestInput,
    PurgeListingOnRequestResult,
    PurgeListingVertical
} from './hooks/usePurgeListingOnRequestMutation';
export { usePurgeListingOnRequestMutation } from './hooks/usePurgeListingOnRequestMutation';
// Types
export type {
    ColumnTFunction,
    ListingConsolidatedConfigParams,
    ListingEntityConfigParams
} from './types';
