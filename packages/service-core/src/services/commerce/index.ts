/**
 * Commerce services barrel export (SPEC-239).
 *
 * Exports all public APIs from the commerce service layer:
 * - `BaseCommerceListingService` — abstract base for entity services
 * - `CommerceLeadService` — lead submission, listing, and handling
 * - `CommerceOwnerProvisioningService` — COMMERCE_OWNER user creation
 * - Permission helpers, junction-sync utilities, visibility reconciler, and types
 */

export {
    BaseCommerceListingService,
    type CommerceCatalogModel,
    type CommerceJunctionModel,
    type CommerceListingEntity
} from './base-commerce-listing.service';
export {
    type SyncCommerceAmenityJunctionInput,
    type SyncCommerceFeatureJunctionInput,
    syncCommerceAmenityJunction,
    syncCommerceFeatureJunction
} from './commerce.junction-sync';
export {
    checkCanAdminListCommerce,
    checkCanCreateCommerce,
    checkCanDeleteCommerce,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanModerateReview,
    checkCanViewAll
} from './commerce.permissions';
export type { CommerceEntityType, CommerceListingHookState } from './commerce.types';
export {
    type CommerceListingCompletenessListing,
    type ResolveListingCompletenessInput,
    type ResolveListingCompletenessResult,
    resolveListingCompleteness
} from './commerce-completeness';
export {
    CommerceLeadService,
    type LeadNotificationPort,
    type ListLeadsInput,
    type MarkLeadHandledInput
} from './commerce-lead.service';
export {
    CommerceOwnerProvisioningService,
    type CreateUserPort,
    type CreateUserPortResult,
    type ProvisionCommerceOwnerInput,
    type ProvisionCommerceOwnerResult,
    type ProvisioningNotificationPort
} from './commerce-owner-provisioning.service';
export {
    type CommerceEntityModel,
    getCommerceListingSubscriptionStatus,
    type ReconcileCommerceListingVisibilityInput,
    type ReconcileCommerceListingVisibilityResult,
    reconcileCommerceListingVisibility
} from './commerce-visibility';
