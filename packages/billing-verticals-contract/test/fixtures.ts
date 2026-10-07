/**
 * Shared fixtures of the contract's own tests: valid sources and responses,
 * and the harnesses that run the shared case sets against the simulators.
 */
import type { Clock, CoverageResponse, CoverageSource } from '../src/index';
import {
    BillingForVerticalsSimulator,
    type CoverageCaseHarness,
    type InverseCaseHarness,
    VerticalsForBillingSimulator
} from '../src/testing/index';

export const NOW = new Date('2026-10-07T12:00:00.000Z');
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A clock frozen at `NOW`. */
export const FIXED_CLOCK: Clock = { now: () => new Date(NOW.getTime()) };

/** The BASE floor: every person has it in every vertical (contract §2.5). */
export const BASE_SOURCE: CoverageSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-floor' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-01-01T00:00:00.000Z'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
};

/** The trial source of someone in PRE_TRIAL: its clock did not start (contract §2.4). */
export const PRE_TRIAL_SOURCE: CoverageSource = {
    type: 'TRIAL',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-pre-trial' },
    scope: 'VERTICAL',
    target: null,
    since: 'NOT_STARTED',
    until: 'NOT_STARTED',
    charged: null,
    floor: null
};

/** A running trial source. */
export const RUNNING_TRIAL_SOURCE: CoverageSource = {
    type: 'TRIAL',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-sellable' },
    scope: 'VERTICAL',
    target: null,
    since: new Date(NOW.getTime() - 3 * DAY_MS),
    until: new Date(NOW.getTime() + 27 * DAY_MS),
    charged: null,
    floor: null
};

/** An ACTIVE subscription source. */
export const SUBSCRIPTION_SOURCE: CoverageSource = {
    type: 'SUBSCRIPTION',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-premium' },
    scope: 'VERTICAL',
    target: null,
    since: new Date(NOW.getTime() - 40 * DAY_MS),
    until: 'NO_KNOWN_DATE',
    charged: true,
    floor: null
};

/** A permanent grant source, with its ratchet floor. */
export const GRANT_SOURCE: CoverageSource = {
    type: 'GRANT',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'pv-grant' },
    scope: 'VERTICAL',
    target: null,
    since: new Date(NOW.getTime() - 100 * DAY_MS),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: 'pv-grant'
};

/** A LISTING addon source. */
export const LISTING_ADDON_SOURCE: CoverageSource = {
    type: 'ADDON',
    reference: { kind: 'ADDON_VERSION', addonVersionId: 'av-feature' },
    scope: 'LISTING',
    target: 'listing-1',
    since: new Date(NOW.getTime() - DAY_MS),
    until: new Date(NOW.getTime() + 29 * DAY_MS),
    charged: null,
    floor: null
};

export const PRE_TRIAL_RESPONSE: CoverageResponse = {
    covered: false,
    sources: [PRE_TRIAL_SOURCE, BASE_SOURCE]
};
export const RUNNING_TRIAL_RESPONSE: CoverageResponse = {
    covered: true,
    sources: [RUNNING_TRIAL_SOURCE, BASE_SOURCE]
};
export const EXPIRED_TRIAL_RESPONSE: CoverageResponse = { covered: false, sources: [BASE_SOURCE] };

/** A counter-based id factory, unique within one harness. */
function idFactory({ prefix }: { readonly prefix: string }): () => string {
    let next = 0;
    return () => {
        next += 1;
        return `${prefix}-${next}`;
    };
}

/** Runs the forward case set against the billing simulator, programmed as a correct implementation answers. */
export async function makeSimulatorCoverageHarness(): Promise<CoverageCaseHarness> {
    const billing = new BillingForVerticalsSimulator();
    return {
        subject: billing,
        arrange: {
            preTrial: async (who) => billing.setCoverage({ ...who, response: PRE_TRIAL_RESPONSE }),
            trialRunning: async (who) =>
                billing.setCoverage({ ...who, response: RUNNING_TRIAL_RESPONSE }),
            trialExpired: async (who) =>
                billing.setCoverage({ ...who, response: EXPIRED_TRIAL_RESPONSE })
        },
        act: {
            startTrial: async (who) => {
                billing.setCoverage({ ...who, response: RUNNING_TRIAL_RESPONSE });
                await billing.emitCoverageChanged({
                    event: { ...who, sourceType: 'TRIAL', change: 'CHANGED' }
                });
            }
        },
        newUserId: idFactory({ prefix: 'user' })
    };
}

/** Runs the inverse case set against the verticals simulator. */
export async function makeSimulatorInverseHarness(): Promise<InverseCaseHarness> {
    const verticals = new VerticalsForBillingSimulator({ clock: FIXED_CLOCK });
    const newId = idFactory({ prefix: 'id' });
    return {
        subject: verticals,
        arrangePlanVersion: async ({ policy }) => {
            const planVersionId = newId();
            verticals.setPlanPolicy({ planVersionId, policy });
            return { planVersionId };
        },
        arrangeChange: async ({ lowersSomething }) => {
            const pair = { fromPlanVersionId: newId(), toPlanVersionId: newId() };
            verticals.setChangeDirection({ ...pair, direction: lowersSomething ? 'DOWN' : 'UP' });
            return pair;
        },
        arrangeListing: async ({ vertical, ownerId, state }) => {
            const listingId = newId();
            verticals.setListing({
                listingId,
                listing: { vertical, ownerId, acceptsFeature: state === 'PUBLISHED' }
            });
            return { listingId };
        },
        purgeListing: async ({ listingId }) => verticals.purgeListing({ listingId }),
        unknownListingId: () => `never-${newId()}`,
        arrangeAddonVersion: async ({ policy }) => {
            const addonVersionId = newId();
            verticals.setAddonPolicy({ addonVersionId, policy });
            return { addonVersionId };
        },
        arrangeRunningTrial: async ({ remainingExtensionDays, ...who }) =>
            verticals.setTrial({
                ...who,
                endsAt: new Date(NOW.getTime() + 10 * DAY_MS),
                remainingExtensionDays
            }),
        arrangeEndedTrial: async (who) =>
            verticals.setTrial({
                ...who,
                endsAt: new Date(NOW.getTime() - DAY_MS),
                remainingExtensionDays: 30
            }),
        trialEndsAt: async (who) => {
            const endsAt = verticals.trialEndsAt(who);
            if (!endsAt) throw new Error('no trial arranged');
            return endsAt;
        },
        newUserId: idFactory({ prefix: 'user' }),
        newRedemptionKey: idFactory({ prefix: 'key' })
    };
}
