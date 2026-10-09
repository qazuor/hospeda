/**
 * Entry point of `@repo/verticals`, the verticals half of the HOS-1352
 * program. It talks to billing only through `@repo/billing-verticals-contract`
 * (GUARD:G14 lists `packages/verticals` as the verticals half).
 */

export { NonBaseKeyError, resolveEntitlementStep } from './authorization/entitlement-step';
export { readListingAccessFacts } from './authorization/listing-facts';
export {
    FOREIGN_ADMITTING_STATES,
    LISTING_OPERATIONS,
    type ListingOperation,
    OPERATION_STEP6_KEY,
    OWNER_ADMITTING_STATES,
    RECOVER_OWN_LISTING_KEY
} from './authorization/listing-operation';
export {
    EMAIL_UNVERIFIED_ALLOWED_OPERATIONS,
    type EmailUnverifiedAllowedOperation,
    resolvePersonStateStep
} from './authorization/person-state-step';
export { resolveListingAccess } from './authorization/resolve-listing-access';
export {
    type ListingAccessFacts,
    resolveResourceStep,
    type StepOutcome
} from './authorization/resource-step';
export { resolveResourceVertical } from './authorization/resource-vertical';
export {
    type BootstrapBillingForVerticals,
    createBootstrapBillingForVerticals
} from './coverage/bootstrap-billing-for-verticals';
export {
    type BootstrapCoverageReader,
    type BootstrapTrialRow,
    resolveTrialAndBaseSources
} from './coverage/trial-and-base-sources';
export {
    ContradictoryStrategyError,
    GrantFloorPlanMismatchError,
    GrantReferenceVerticalMismatchError,
    GrantWithoutFloorError,
    MeteredKeyGlobalScopeError,
    MissingVerticalForVerticalKeyError,
    TrialPlanEntitlementOverrideError
} from './effective-set/errors';
export { foldPlegableSet } from './effective-set/fold';
export {
    type GrantSet,
    resolveGrantSet,
    selectGrantForVertical
} from './effective-set/grant-ratchet';
export { hasLiveNonTrialTitle, selectPlegableSources } from './effective-set/plegable';
export {
    assertMeteredKeyIsVertical,
    isMeteredEntitlement,
    type KeyResolution,
    resolveKeyScope,
    type ScopedKeyValues,
    scopeKeyValues
} from './effective-set/scope';
export {
    resolveTrialSet,
    type TrialFloorReferences,
    type TrialInProgress,
    type TrialSet
} from './effective-set/trial-ratchet';
export type { FoldableSource, SourceGrant } from './effective-set/types';
export { createEffectiveSetCache } from './effective-set-cache/cache';
export { subscribeCoverageInvalidation } from './effective-set-cache/coverage-invalidation';
export { decodeFiniteOrInfinite, encodeFiniteOrInfinite } from './effective-set-cache/number-codec';
export type {
    EffectiveSetCacheLogger,
    EffectiveSetCodec,
    RedisLike
} from './effective-set-cache/types';
export type {
    AddonVersionPolicyRow,
    PlanCatalogReader,
    PlanVersionEffectsRow,
    PlanVersionEntitlementRow,
    PlanVersionLimitRow,
    PlanVersionPolicyRow,
    PlanVersionSummaryRow
} from './plan-catalog/catalog-reader';
export { decideChangeDirection } from './plan-catalog/change-direction';
export {
    type CatalogVersionKind,
    CatalogVersionNotFoundError,
    UndecidableKeyError
} from './plan-catalog/errors';
export {
    createPlanCatalogInverse,
    type PlanCatalogInverse
} from './plan-catalog/plan-catalog-inverse';
