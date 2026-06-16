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
    CommerceLeadService,
    type LeadNotificationPort,
    type ListLeadsInput,
    type MarkLeadHandledInput
} from './commerce-lead.service';

export {
    CommerceOwnerProvisioningService,
    type CreateUserPort,
    type CreateUserPortResult,
    type ProvisioningNotificationPort,
    type ProvisionCommerceOwnerInput,
    type ProvisionCommerceOwnerResult
} from './commerce-owner-provisioning.service';

export {
    reconcileCommerceListingVisibility,
    getCommerceListingSubscriptionStatus,
    type ReconcileCommerceListingVisibilityInput,
    type ReconcileCommerceListingVisibilityResult,
    type CommerceEntityModel
} from './commerce-visibility';

export {
    syncCommerceAmenityJunction,
    syncCommerceFeatureJunction,
    type SyncCommerceAmenityJunctionInput,
    type SyncCommerceFeatureJunctionInput
} from './commerce.junction-sync';

export {
    checkCanCreateCommerce,
    checkCanEditAll,
    checkCanEditOwn,
    checkCanDeleteCommerce,
    checkCanViewAll,
    checkCanAdminListCommerce,
    checkCanModerateReview
} from './commerce.permissions';

export type { CommerceListingHookState } from './commerce.types';
