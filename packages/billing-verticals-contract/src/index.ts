/**
 * Entry point of `@repo/billing-verticals-contract`: the production surface.
 *
 * What it holds (contract §7.1):
 * - the two interfaces (`BillingForVerticals`, `VerticalsForBilling`), item 1;
 * - their validation schemas and the gate that refuses to deliver a value that
 *   does not validate, item 2;
 * - the `Clock` interface, item 5 (B1, AC:B1:17).
 *
 * The simulators and the shared case sets (items 3 and 4) are NOT here: they
 * live under `@repo/billing-verticals-contract/testing`, which no production
 * build imports. No implementation lives in this package.
 */
export type { Clock } from './clock';
export type {
    CoverageArgs,
    CoverageResponse,
    CoverageScope,
    CoverageSource,
    CoverageSourceClass,
    CoverageSourceType
} from './coverage.schema';
export {
    CoverageArgsSchema,
    CoverageReferenceSchema,
    CoverageResponseSchema,
    CoverageScopeSchema,
    CoverageSinceSchema,
    CoverageSourceSchema,
    CoverageSourceTypeSchema,
    CoverageUntilSchema,
    coverageSourceClassOf
} from './coverage.schema';
export type {
    CanChargeArgs,
    CanChargeResponse,
    CoverageChange,
    CoverageChangedEvent,
    RetentionStoppedArgs,
    RetentionStoppedResponse
} from './forward.schema';
export {
    CanChargeArgsSchema,
    CanChargeResponseSchema,
    CoverageChangedEventSchema,
    CoverageChangeSchema,
    RetentionStoppedArgsSchema,
    RetentionStoppedResponseSchema
} from './forward.schema';
export type {
    BillingForVerticals,
    ContractListener,
    Unsubscribe,
    VerticalsForBilling
} from './interfaces';
export type {
    AddonPolicyArgs,
    AddonPolicyResponse,
    ChangeDirectionArgs,
    ChangeDirectionResponse,
    ExtendTrialArgs,
    ExtendTrialResponse,
    ListingArgs,
    ListingPurgedEvent,
    ListingPurgedResponse,
    ListingResponse,
    PlanPolicyArgs,
    PlanPolicyResponse
} from './inverse.schema';
export {
    AddonPolicyArgsSchema,
    AddonPolicyResponseSchema,
    ChangeDirectionArgsSchema,
    ChangeDirectionResponseSchema,
    ExtendTrialArgsSchema,
    ExtendTrialResponseSchema,
    ListingArgsSchema,
    ListingPurgedEventSchema,
    ListingPurgedResponseSchema,
    ListingResponseSchema,
    PlanPolicyArgsSchema,
    PlanPolicyResponseSchema
} from './inverse.schema';
export type { UserVerticalArgs } from './primitives.schema';
export {
    AddonIdSchema,
    AddonVersionIdSchema,
    InstantSchema,
    ListingIdSchema,
    PlanVersionIdSchema,
    UserIdSchema,
    UserVerticalArgsSchema,
    VerticalSchema
} from './primitives.schema';
export type { ContractValidationIssue, ContractValueKind } from './validation';
export {
    ContractValidationError,
    validateBillingForVerticals,
    validateVerticalsForBilling
} from './validation';
