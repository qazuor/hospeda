/**
 * Entry point of `@repo/verticals`, the verticals half of the HOS-1352
 * program. It talks to billing only through `@repo/billing-verticals-contract`
 * (GUARD:G14 lists `packages/verticals` as the verticals half).
 */

export {
    ContradictoryStrategyError,
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
    type KeyResolution,
    resolveKeyScope
} from './effective-set/scope';
export {
    resolveTrialSet,
    type TrialFloorReferences,
    type TrialInProgress,
    type TrialSet
} from './effective-set/trial-ratchet';
export type { FoldableSource, SourceGrant } from './effective-set/types';
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
