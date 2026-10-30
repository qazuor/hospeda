/**
 * `@repo/billing-verticals-contract/testing`: the test-only subpath (contract
 * §7.1, items 3 and 4). No production build imports it:
 * `test/testing-never-in-production.test.ts` checks it.
 *
 * - The simulators of each side: programmable in-memory fakes of the two
 *   interfaces, behind the validation gate.
 * - The shared case sets: the forward one (`coverageCaseSet`, contract §6.2)
 *   and the inverse one (`inverseCaseSet` and its five groups). They receive
 *   `describe`, `it` and `expect` as parameters.
 */
export {
    BillingForVerticalsSimulator,
    type BillingSimulatorCall
} from './billing-for-verticals.simulator';
export type {
    CaseAssertion,
    CaseDescribe,
    CaseExpect,
    CaseIt,
    CaseRunner
} from './case-set.types';
export { type CoverageCaseHarness, coverageCaseSet } from './coverage.case-set';
export {
    type AddonPolicyCaseHarness,
    addonPolicyCaseSet,
    type ChangeDirectionCaseHarness,
    changeDirectionCaseSet,
    type ExtendTrialCaseHarness,
    extendTrialCaseSet,
    type InverseCaseHarness,
    inverseCaseSet,
    type ListingCaseHarness,
    listingCaseSet,
    type PlanPolicyCaseHarness,
    planPolicyCaseSet
} from './inverse.case-set';
export {
    SIMULATED_EXTEND_TRIAL_REJECTIONS,
    SimulatorNotProgrammedError,
    VerticalsForBillingSimulator
} from './verticals-for-billing.simulator';
