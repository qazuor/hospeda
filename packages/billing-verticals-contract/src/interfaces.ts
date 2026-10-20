/**
 * The two interfaces of the contract (contract §7.1, item 1). Each one is what
 * ONE half provides: its queries, its write, and the event it emits. The
 * implementations do not live here: the real forward one in billing, the
 * inverse one and the bootstrap one in verticals (contract §7.1); the only
 * place that joins the two halves is the composition root of `apps/api`.
 */

import type { CoverageArgs, CoverageResponse } from './coverage.schema';
import type {
    CanChargeArgs,
    CanChargeResponse,
    CoverageChangedEvent,
    RetentionStoppedArgs,
    RetentionStoppedResponse
} from './forward.schema';
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
} from './inverse.schema';

/** Removes a listener registered with an `on…` method. */
export type Unsubscribe = () => void;

/**
 * Receives one event. The emitter calls it after the commit of the write that
 * produced the event (contract §3, "se emite después del commit").
 */
export type ContractListener<TEvent> = (event: TEvent) => void | Promise<void>;

/**
 * What verticals asks billing: the forward direction (contract §7.1, item 1).
 * Billing implements it; verticals consumes it.
 */
export interface BillingForVerticals {
    /**
     * Which sources cover this person in this vertical.
     *
     * @see contract §2, `cobertura(user, vertical)`
     */
    coverage(args: CoverageArgs): Promise<CoverageResponse>;

    /**
     * Whether a pause asked by the person stops the retention clock.
     *
     * @see contract §4.1, `retenciónDetenida(user, vertical)`
     */
    retentionStopped(args: RetentionStoppedArgs): Promise<RetentionStoppedResponse>;

    /**
     * Whether anything left can still charge this account, in any vertical.
     *
     * @see contract §4.1, `puedeCobrarle(user)`
     */
    canCharge(args: CanChargeArgs): Promise<CanChargeResponse>;

    /**
     * Subscribes to the coverage-changed notice, emitted after the commit.
     *
     * @see contract §3, "la cobertura de (user, vertical) cambió"
     */
    onCoverageChanged(listener: ContractListener<CoverageChangedEvent>): Unsubscribe;
}

/**
 * What billing reads from verticals: the inverse direction (contract §4.1).
 * Verticals implements it; billing consumes it.
 */
export interface VerticalsForBilling {
    /**
     * How a plan version behaves: grace days, pause, current, sellable.
     *
     * @see contract §4.1, `políticaDePlan(versiónDePlan)`
     */
    planPolicy(args: PlanPolicyArgs): Promise<PlanPolicyResponse>;

    /**
     * The verdict on a plan change: up or down.
     *
     * @see contract §4.1, `direcciónDeCambio(versiónOrigen, versiónDestino)`
     */
    changeDirection(args: ChangeDirectionArgs): Promise<ChangeDirectionResponse>;

    /**
     * Whether a listing is gone (PURGED, or its row does not exist).
     *
     * @see contract §4.1, `fichaPurgada(ficha)`
     */
    listingPurged(args: ListingArgs): Promise<ListingPurgedResponse>;

    /**
     * Which vertical a listing belongs to, whose it is, and whether it accepts a feature.
     *
     * @see contract §4.1, `ficha(idDeFicha)`
     */
    listing(args: ListingArgs): Promise<ListingResponse>;

    /**
     * How an addon version behaves.
     *
     * @see contract §4.1, `políticaDeAddon(versiónDeAddon)`
     */
    addonPolicy(args: AddonPolicyArgs): Promise<AddonPolicyResponse>;

    /**
     * The only write billing makes in verticals: extend a trial, idempotent by
     * its redemption key.
     *
     * @see contract §4.1, `extenderTrial(user, vertical, días, claveDeCanje)`
     */
    extendTrial(args: ExtendTrialArgs): Promise<ExtendTrialResponse>;

    /**
     * Subscribes to the PURGED push, emitted after the commit of PB9 or PB12.
     *
     * @see contract §3.1, "la ficha F llegó a PURGED"
     */
    onListingPurged(listener: ContractListener<ListingPurgedEvent>): Unsubscribe;
}
