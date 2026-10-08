/**
 * Entry point of `@repo/verticals`, the verticals half of the HOS-1352
 * program. It talks to billing only through `@repo/billing-verticals-contract`
 * (GUARD:G14 lists `packages/verticals` as the verticals half).
 */

export { ContradictoryStrategyError } from './effective-set/errors';
export { foldPlegableSet } from './effective-set/fold';
export { hasLiveNonTrialTitle, selectPlegableSources } from './effective-set/plegable';
export type { FoldableSource, SourceGrant } from './effective-set/types';
export type {
    AddonVersionPolicyRow,
    PlanCatalogReader,
    PlanVersionEffectsRow,
    PlanVersionEntitlementRow,
    PlanVersionLimitRow,
    PlanVersionPolicyRow
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
