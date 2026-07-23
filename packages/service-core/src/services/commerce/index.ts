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
// NOTE (HOS-166 R-5): `resolveListingCompleteness` and its types moved to
// `@repo/schemas` (`packages/schemas/src/common/commerce-completeness.ts`) —
// it is a PURE function with no DB/service-core-specific imports, and the web
// app needs to call it without pulling in service-core's DB dependency.
// Import it directly from `@repo/schemas` instead of re-exporting it here.
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
    getCommerceListingSubscriptionStatuses,
    type ReconcileCommerceListingVisibilityInput,
    type ReconcileCommerceListingVisibilityResult,
    type ResolveCommerceListingCompleteness,
    reconcileCommerceListingVisibility
} from './commerce-visibility';
