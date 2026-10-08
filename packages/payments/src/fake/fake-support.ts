/**
 * What the fake provider is built from that tells no lie: its support map, its
 * stored records, its refusals, and the two simulated network cases.
 */
import type { CapabilitySupportMap, PaymentCapability } from '../provider/capabilities';
import { PaymentProviderError } from '../provider/errors';
import type { AuthorizationSnapshot, ChargeSnapshot, Money } from '../provider/payment-provider';

/** The fake offers every capability whole: it is the reference, not a provider. */
export const FAKE_CAPABILITY_SUPPORT: CapabilitySupportMap = Object.freeze({
    authorize: { level: 'full' },
    charge: { level: 'full' },
    changeAmount: { level: 'full' },
    pauseAndResume: { level: 'full' },
    cancel: { level: 'full' },
    refund: { level: 'full' },
    read: { level: 'full' },
    notify: { level: 'full' }
});

/**
 * How long an approval link lives when a test turns M11 off. Not measured: the
 * real provider's link never expires (EX-1); this is only the honest path a
 * test asks for, a day on the injected clock.
 */
export const FAKE_HONEST_LINK_LIFETIME_MS = 24 * 60 * 60_000;

/** The refusal of M13, in the provider's own words (RF-8). */
export const NOT_REFUNDABLE_MESSAGE = 'This transaction does not support to be refunded (2084)';

/** Where the fake sends a customer to approve; a reserved, never-resolving host. */
export const APPROVAL_BASE_URL = 'https://payments-fake.invalid/approve/';

/** An authorization as the fake keeps it. */
export interface StoredAuthorization {
    snapshot: AuthorizationSnapshot;
    version: number;
    readonly approvalUrl: string;
    readonly createdAt: number;
}

/** A charge as the fake keeps it. */
export interface StoredCharge {
    snapshot: ChargeSnapshot;
    version: number;
    /** When a late charge lands (M8); `null` once it landed. */
    settleAt: number | null;
    refundAttempts: number;
    /** Refunds by their idempotency key, with the amount each moved (RP5). */
    readonly refundsByReference: Map<string, number>;
}

/** A refusal: the provider will not do this in this state. */
export function rejected(args: {
    readonly capability: PaymentCapability;
    readonly reason: string;
}): PaymentProviderError {
    return new PaymentProviderError({
        code: 'REJECTED',
        capability: args.capability,
        message: args.reason
    });
}

/** A refusal: no resource with that id. */
export function notFound(args: {
    readonly capability: PaymentCapability;
    readonly id: string;
}): PaymentProviderError {
    return new PaymentProviderError({
        code: 'NOT_FOUND',
        capability: args.capability,
        message: `no resource with id ${args.id}`
    });
}

/**
 * Refuses an amount in another currency than the one it applies to.
 *
 * @throws PaymentProviderError with code `REJECTED`
 */
export function assertSameCurrency(args: {
    readonly expected: Money;
    readonly actual: Money;
    readonly capability: PaymentCapability;
}): void {
    if (args.expected.currency !== args.actual.currency) {
        throw rejected({
            capability: args.capability,
            reason: `currency ${args.actual.currency} differs from ${args.expected.currency}`
        });
    }
}

/**
 * Runs one request through the two unmeasured network cases, when a test
 * turned them on: the request never arrives (`networkCut`), or it does its
 * work and the answer is lost (`lostResponse`). Either way the caller gets
 * `UNAVAILABLE`. They are simulations, not lies (DEC-TEST-003).
 *
 * @param args.simulating - The simulations this fake was built with
 * @param args.capability - The capability asked for
 * @param args.run - The request's work
 * @returns What the work returned
 * @throws PaymentProviderError with code `UNAVAILABLE` under a simulation
 */
export async function throughNetwork<T>(args: {
    readonly simulating: ReadonlySet<string>;
    readonly capability: PaymentCapability;
    readonly run: () => T;
}): Promise<T> {
    const unavailable = (message: string) =>
        new PaymentProviderError({ code: 'UNAVAILABLE', capability: args.capability, message });
    if (args.simulating.has('networkCut')) throw unavailable('simulated: the network is cut');
    const result = args.run();
    if (args.simulating.has('lostResponse')) {
        throw unavailable('simulated: the answer was lost; the request may have landed');
    }
    return result;
}
