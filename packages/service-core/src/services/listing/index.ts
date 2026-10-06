/**
 * Listing services barrel export (SPEC-239).
 *
 * Exports all public APIs from the listing service layer shared by the
 * gastronomy and experience verticals:
 * - `BaseListingService` — abstract base for entity services
 * - Permission helpers, junction-sync utilities, media composition and types
 *
 * HOS-693 §6.2 removed the admin owner-provisioning service that used to be
 * exported here (owner account creation from an approved lead) —
 * owners now grant themselves the role by creating their own listing
 * (HOS-687). HOS-695 (release C) removed the lead service itself: the
 * lead-intake funnel accepts no new submissions (its public form and admin
 * provisioning flow were already gone), and its admin list/mark-handled
 * surface only ever served three smoke-test fixtures. Its table was
 * dropped in the same release.
 */

export {
    BaseListingService,
    type ListingCatalogModel,
    type ListingEntity,
    type ListingJunctionModel
} from './base-listing.service';
export {
    type SyncListingAmenityJunctionInput,
    type SyncListingFeatureJunctionInput,
    syncListingAmenityJunction,
    syncListingFeatureJunction
} from './listing.junction-sync';
export type { GastronomyOrExperience } from './listing.permissions';
export {
    checkCanAdminListListings,
    checkCanCreateListing,
    checkCanDeleteListing,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanModerateListing,
    checkCanModerateReview,
    checkCanViewAll
} from './listing.permissions';
export type { ListingHookState } from './listing.types';
// NOTE (HOS-166 R-5): `resolveListingCompleteness` and its types moved to
// `@repo/schemas` (`packages/schemas/src/common/listing-completeness.ts`) —
// it is a PURE function with no DB/service-core-specific imports, and the web
// app needs to call it without pulling in service-core's DB dependency.
// Import it directly from `@repo/schemas` instead of re-exporting it here.
export {
    type ComposeListingMediaInput,
    composeListingMedia
} from './listing-media-compose';
