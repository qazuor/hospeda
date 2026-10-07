/**
 * The payment provider interface: the only way the billing domain talks to a
 * payment gateway (DEC-ARCH-004, US:B1:1).
 *
 * Every name here is a DOMAIN name. Not one provider concept appears (no
 * provider resource names, no hosted-page link field, no provider URL path): a
 * compile-time check in `provider-concepts.ts` fails the build if one does, and
 * a test scans this folder and the fake for the same terms (TEST:B1:1). Changing gateway changes the adapter, never the code that uses
 * this interface.
 *
 * Two rules every caller inherits:
 * - An acknowledgement is NOT a confirmation. A provider can answer success to a
 *   mutation and not apply it (INV:D5); the caller re-reads by id and compares
 *   field by field (`confirmAuthorizationMutation`).
 * - A read by id carries its instant, and only an implementation builds it
 *   (`ProviderRead`); a decision refuses a read older than its own start
 *   (`assertFreshForAct`, INV:D17).
 * - A notice says only WHAT changed (kind, id, version), never the new state:
 *   the state comes from a read by id (GUARD:G17).
 */
import type { CapabilitySupportMap } from './capabilities';
import type { ProviderRead } from './provider-read';

/** An amount of money in integer minor units (centavos), never a float. */
export interface Money {
    /** Integer, minor units (centavos). */
    readonly amountMinor: number;
    /** ISO 4217 code, upper case. */
    readonly currency: string;
}

/** How often an authorization is charged, in whole months (1 = monthly, 12 = annual). */
export interface BillingCadence {
    readonly everyMonths: number;
}

/** Lifecycle of an authorization, as the domain reads it. */
export type AuthorizationStatus = 'pending' | 'active' | 'paused' | 'cancelled';

/** Lifecycle of a charge, as the domain reads it. */
export type ChargeStatus = 'pending' | 'approved' | 'rejected';

/** What a notice is about. */
export type NoticeResourceKind = 'authorization' | 'charge' | 'refund';

/** Capability 1 input: ask for the customer's permission to charge periodically. */
export interface AuthorizeInput {
    /** Our own identifier for this authorization, echoed back on reads. */
    readonly reference: string;
    readonly amount: Money;
    readonly cadence: BillingCadence;
    /** Customer-facing text shown by the provider (copy, never an identifier: INV:D9). */
    readonly reason: string;
    /** Where the customer lands after deciding. */
    readonly returnUrl: string;
    readonly payerEmail?: string;
}

/** Capability 1 output. */
export interface AuthorizeResult {
    readonly authorizationId: string;
    /** Where the customer goes to grant the permission. */
    readonly approvalUrl: string;
}

/** Capability 2 input: execute one charge of the cycle. */
export interface ChargeInput {
    readonly authorizationId: string;
    readonly amount: Money;
    /** Our own identifier for this cycle's charge. */
    readonly reference: string;
}

/** Capability 2 output. */
export interface ChargeResult {
    readonly chargeId: string;
}

/** Identifies one authorization. */
export interface AuthorizationRef {
    readonly authorizationId: string;
}

/** Identifies one charge. */
export interface ChargeRef {
    readonly chargeId: string;
}

/** Capability 3 input: change the amount of a live authorization. */
export interface ChangeAmountInput {
    readonly authorizationId: string;
    readonly amount: Money;
}

/** Capability 6 input: give money back from a charge (total or partial). */
export interface RefundInput {
    readonly chargeId: string;
    readonly amount: Money;
    /** Our own identifier for this refund. */
    readonly reference: string;
}

/** Capability 6 output. */
export interface RefundResult {
    readonly refundId: string;
}

/**
 * What a provider answers to a mutation. It says the request was ACCEPTED, and
 * nothing about whether it was APPLIED: confirm by re-reading.
 */
export interface MutationAcknowledgement {
    readonly accepted: true;
    readonly resourceId: string;
}

/** Capability 7 output: an authorization as read by id. */
export interface AuthorizationSnapshot {
    readonly authorizationId: string;
    readonly reference: string;
    readonly status: AuthorizationStatus;
    readonly amount: Money;
    readonly cadence: BillingCadence;
}

/** Capability 7 output: a charge as read by id. */
export interface ChargeSnapshot {
    readonly chargeId: string;
    readonly authorizationId: string;
    readonly reference: string;
    readonly status: ChargeStatus;
    readonly amount: Money;
    /** Cumulative amount refunded so far. */
    readonly refundedAmount: Money;
}

/** Capability 8 input: one delivery as it reached our receiver. */
export interface NoticeDelivery {
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
}

/**
 * Capability 8 output: WHAT changed, never the new state. The version is what
 * discards an old notice; it is not state.
 */
export interface ProviderNotice {
    readonly resourceKind: NoticeResourceKind;
    readonly resourceId: string;
    readonly version: string;
}

/**
 * The eight capabilities as methods. `pauseAndResume` is two methods and `read`
 * is two (an authorization and a charge); `CAPABILITY_METHODS` maps each method
 * to its capability. Every method receives one object and resolves one object;
 * a refusal rejects with `PaymentProviderError`.
 */
export interface PaymentProvider {
    /** How much of each capability this provider offers, gap by gap. */
    readonly capabilitySupport: CapabilitySupportMap;

    /** Capability 1 · authorize. */
    authorize(input: AuthorizeInput): Promise<AuthorizeResult>;
    /** Capability 2 · charge. */
    charge(input: ChargeInput): Promise<ChargeResult>;
    /** Capability 3 · change the amount. Accepted is not applied: re-read. */
    changeAmount(input: ChangeAmountInput): Promise<MutationAcknowledgement>;
    /** Capability 4 · pause. Accepted is not applied: re-read. */
    pause(input: AuthorizationRef): Promise<MutationAcknowledgement>;
    /** Capability 4 · resume. Accepted is not applied: re-read. */
    resume(input: AuthorizationRef): Promise<MutationAcknowledgement>;
    /** Capability 5 · cancel. Accepted is not applied: re-read. */
    cancel(input: AuthorizationRef): Promise<MutationAcknowledgement>;
    /** Capability 6 · refund. */
    refund(input: RefundInput): Promise<RefundResult>;
    /**
     * Capability 7 · read an authorization by id. The read carries its instant
     * (AC:B1:4): a decision takes it through `assertFreshForAct`.
     */
    readAuthorization(input: AuthorizationRef): Promise<ProviderRead<AuthorizationSnapshot>>;
    /**
     * Capability 7 · read a charge by id. The read carries its instant
     * (AC:B1:4): a decision takes it through `assertFreshForAct`.
     */
    readCharge(input: ChargeRef): Promise<ProviderRead<ChargeSnapshot>>;
    /** Capability 8 · turn a delivery into a notice (kind, id, version only). */
    decodeNotice(input: NoticeDelivery): Promise<ProviderNotice>;
}

/** The name of every method of the interface (everything but the support map). */
export type PaymentProviderMethod = Exclude<keyof PaymentProvider, 'capabilitySupport'>;
