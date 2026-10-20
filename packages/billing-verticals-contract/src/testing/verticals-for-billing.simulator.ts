/**
 * The simulator of the verticals side (contract §7.1, item 3): a programmable
 * in-memory fake of `VerticalsForBilling`, so billing is tested whole without
 * verticals.
 *
 * Every answer crosses the validation gate: a programmed answer that does not
 * validate is NOT delivered (the call rejects with `ContractValidationError`).
 *
 * Unprogrammed queries, with one exception, reject with
 * `SimulatorNotProgrammedError`: there is no safe default for a policy or a
 * verdict. The exception is `listingPurged`, whose contract answers yes for a
 * listing whose row does not exist (contract §4.1).
 *
 * `extendTrial` follows the rules of contract §4.1 and AC:V4:8 over the trials
 * programmed with `setTrial`: an already applied redemption key answers
 * ACCEPTED without extending again; an ended trial, or an extension that does
 * not fit under the ceiling, is REJECTED whole (never truncated) and moves
 * nothing.
 */
import type { Clock } from '../clock';
import type { ContractListener, Unsubscribe, VerticalsForBilling } from '../interfaces';
import type {
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
} from '../inverse.schema';
import type { UserVerticalArgs } from '../primitives.schema';
import { validateVerticalsForBilling } from '../validation';
import { createListenerRegistry } from './listeners';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A query the simulator was not programmed to answer. */
export class SimulatorNotProgrammedError extends Error {
    constructor(args: { readonly operation: string; readonly key: string }) {
        super(`VerticalsForBillingSimulator: ${args.operation} is not programmed for ${args.key}`);
        this.name = 'SimulatorNotProgrammedError';
    }
}

/** The reasons the simulator's `extendTrial` gives when it rejects. */
export const SIMULATED_EXTEND_TRIAL_REJECTIONS = {
    noTrial: 'NO_TRIAL',
    trialEnded: 'TRIAL_ENDED',
    ceilingReached: 'CEILING_REACHED'
} as const;

/** A trial the simulator holds. */
interface SimulatedTrial {
    endsAt: Date;
    remainingExtensionDays: number;
}

const userVerticalKey = ({ userId, vertical }: UserVerticalArgs): string =>
    `${userId}\u0000${vertical}`;

const pairKey = ({ fromPlanVersionId, toPlanVersionId }: ChangeDirectionArgs): string =>
    `${fromPlanVersionId}\u0000${toPlanVersionId}`;

/**
 * Programmable fake of the verticals side.
 *
 * @example
 * const verticals = new VerticalsForBillingSimulator({ clock });
 * verticals.setPlanPolicy({ planVersionId: 'pv-1', policy });
 * await verticals.planPolicy({ planVersionId: 'pv-1' });
 */
export class VerticalsForBillingSimulator implements VerticalsForBilling {
    readonly #clock: Clock;
    readonly #planPolicies = new Map<string, PlanPolicyResponse>();
    readonly #directions = new Map<string, ChangeDirectionResponse>();
    readonly #listings = new Map<string, ListingResponse>();
    readonly #purged = new Set<string>();
    readonly #addonPolicies = new Map<string, AddonPolicyResponse>();
    readonly #trials = new Map<string, SimulatedTrial>();
    readonly #appliedKeys = new Set<string>();
    readonly #listingPurgedListeners = createListenerRegistry<ListingPurgedEvent>().registry;
    readonly #gate: VerticalsForBilling;

    /**
     * @param args.clock - The clock `extendTrial` reads "now" from (an ended trial is rejected)
     */
    constructor(args: { readonly clock: Clock }) {
        this.#clock = args.clock;
        const lookup = <T>(map: ReadonlyMap<string, T>, operation: string, key: string): T => {
            const value = map.get(key);
            if (value === undefined) throw new SimulatorNotProgrammedError({ operation, key });
            return value;
        };
        const raw: VerticalsForBilling = {
            planPolicy: async ({ planVersionId }) =>
                lookup(this.#planPolicies, 'planPolicy', planVersionId),
            changeDirection: async (args) =>
                lookup(this.#directions, 'changeDirection', pairKey(args)),
            listingPurged: async ({ listingId }) => ({
                purged: this.#purged.has(listingId) || !this.#listings.has(listingId)
            }),
            listing: async ({ listingId }) => lookup(this.#listings, 'listing', listingId),
            addonPolicy: async ({ addonVersionId }) =>
                lookup(this.#addonPolicies, 'addonPolicy', addonVersionId),
            extendTrial: async (args) => this.#extend(args),
            onListingPurged: (listener) => this.#listingPurgedListeners.add(listener)
        };
        this.#gate = validateVerticalsForBilling({ implementation: raw }).validated;
    }

    /** Programs `planPolicy` for a plan version. Not validated here: the gate does it on delivery. */
    setPlanPolicy(args: {
        readonly planVersionId: string;
        readonly policy: PlanPolicyResponse;
    }): void {
        this.#planPolicies.set(args.planVersionId, args.policy);
    }

    /** Programs the `changeDirection` verdict for one ordered pair. */
    setChangeDirection(
        args: ChangeDirectionArgs & { readonly direction: ChangeDirectionResponse['direction'] }
    ): void {
        this.#directions.set(pairKey(args), { direction: args.direction });
    }

    /** Programs a live listing: `listing` answers it and `listingPurged` answers no. */
    setListing(args: { readonly listingId: string; readonly listing: ListingResponse }): void {
        this.#listings.set(args.listingId, args.listing);
        this.#purged.delete(args.listingId);
    }

    /**
     * Takes a listing to PURGED, then emits the PURGED push and waits for the
     * listeners: the state changes first, so a listener that re-reads
     * `listingPurged` sees yes (the after-commit rule, contract §3.1).
     */
    async purgeListing(args: { readonly listingId: string }): Promise<void> {
        this.#purged.add(args.listingId);
        const listing = this.#listings.get(args.listingId);
        if (listing) this.#listings.set(args.listingId, { ...listing, acceptsFeature: false });
        await this.#listingPurgedListeners.deliver({ event: { listingId: args.listingId } });
    }

    /** Emits a raw PURGED push without touching any state (to test a listener, or the gate). */
    async emitListingPurged(args: { readonly event: ListingPurgedEvent }): Promise<void> {
        await this.#listingPurgedListeners.deliver({ event: args.event });
    }

    /** Programs `addonPolicy` for an addon version. */
    setAddonPolicy(args: {
        readonly addonVersionId: string;
        readonly policy: AddonPolicyResponse;
    }): void {
        this.#addonPolicies.set(args.addonVersionId, args.policy);
    }

    /** Programs a trial `extendTrial` can extend: its end and the days left under the ceiling. */
    setTrial(
        args: UserVerticalArgs & {
            readonly endsAt: Date;
            readonly remainingExtensionDays: number;
        }
    ): void {
        this.#trials.set(userVerticalKey(args), {
            endsAt: new Date(args.endsAt.getTime()),
            remainingExtensionDays: args.remainingExtensionDays
        });
    }

    /** The current end of a programmed trial, or `null` when there is none. */
    trialEndsAt(args: UserVerticalArgs): Date | null {
        const trial = this.#trials.get(userVerticalKey(args));
        return trial ? new Date(trial.endsAt.getTime()) : null;
    }

    #extend(args: ExtendTrialArgs): ExtendTrialResponse {
        if (this.#appliedKeys.has(args.redemptionKey)) return { outcome: 'ACCEPTED' };
        const trial = this.#trials.get(userVerticalKey(args));
        if (!trial)
            return { outcome: 'REJECTED', reason: SIMULATED_EXTEND_TRIAL_REJECTIONS.noTrial };
        if (trial.endsAt.getTime() <= this.#clock.now().getTime()) {
            return { outcome: 'REJECTED', reason: SIMULATED_EXTEND_TRIAL_REJECTIONS.trialEnded };
        }
        if (args.days > trial.remainingExtensionDays) {
            return {
                outcome: 'REJECTED',
                reason: SIMULATED_EXTEND_TRIAL_REJECTIONS.ceilingReached
            };
        }
        trial.endsAt = new Date(trial.endsAt.getTime() + args.days * DAY_MS);
        trial.remainingExtensionDays -= args.days;
        this.#appliedKeys.add(args.redemptionKey);
        return { outcome: 'ACCEPTED' };
    }

    /** @see VerticalsForBilling.planPolicy */
    planPolicy(args: PlanPolicyArgs): Promise<PlanPolicyResponse> {
        return this.#gate.planPolicy(args);
    }

    /** @see VerticalsForBilling.changeDirection */
    changeDirection(args: ChangeDirectionArgs): Promise<ChangeDirectionResponse> {
        return this.#gate.changeDirection(args);
    }

    /** @see VerticalsForBilling.listingPurged */
    listingPurged(args: ListingArgs): Promise<ListingPurgedResponse> {
        return this.#gate.listingPurged(args);
    }

    /** @see VerticalsForBilling.listing */
    listing(args: ListingArgs): Promise<ListingResponse> {
        return this.#gate.listing(args);
    }

    /** @see VerticalsForBilling.addonPolicy */
    addonPolicy(args: AddonPolicyArgs): Promise<AddonPolicyResponse> {
        return this.#gate.addonPolicy(args);
    }

    /** @see VerticalsForBilling.extendTrial */
    extendTrial(args: ExtendTrialArgs): Promise<ExtendTrialResponse> {
        return this.#gate.extendTrial(args);
    }

    /** @see VerticalsForBilling.onListingPurged */
    onListingPurged(listener: ContractListener<ListingPurgedEvent>): Unsubscribe {
        return this.#gate.onListingPurged(listener);
    }
}
