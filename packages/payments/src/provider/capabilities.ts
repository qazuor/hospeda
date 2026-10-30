/**
 * The eight capabilities the billing domain asks of a payment provider, and
 * nothing more (`B/06` §1, AC:B1:1).
 *
 * The list is what the DOMAIN needs, never what one provider happens to offer:
 * defined the other way round, a second provider would not fit and nobody would
 * notice.
 */

/**
 * The eight capabilities, in the order of `B/06` §1.
 *
 * - `authorize`: obtain the customer's permission to charge them periodically.
 * - `charge`: execute one charge of the cycle.
 * - `changeAmount`: change the amount of a live authorization.
 * - `pauseAndResume`: stop and restart the charges without losing the authorization.
 * - `cancel`: end the authorization.
 * - `refund`: give money back from a charge.
 * - `read`: the state of an authorization and of its charges.
 * - `notify`: tell us that something changed.
 */
export const PAYMENT_CAPABILITIES = [
    'authorize',
    'charge',
    'changeAmount',
    'pauseAndResume',
    'cancel',
    'refund',
    'read',
    'notify'
] as const;

/** One of the eight capabilities. */
export type PaymentCapability = (typeof PAYMENT_CAPABILITIES)[number];

/**
 * What the domain deliberately does NOT ask of a provider (`B/06` §1): prorating,
 * scheduling a cancellation, applying a discount, granting a trial and ordering
 * events are all resolved on our side. Listed so that "and nothing more" is a
 * checked fact rather than a sentence: no provider method may carry one of these
 * names.
 */
export const NOT_ASKED_OF_THE_PROVIDER = [
    'prorate',
    'scheduleCancellation',
    'applyDiscount',
    'grantTrial',
    'orderEvents'
] as const;

/**
 * How our side handles a part of a capability that a provider does not offer.
 *
 * - `emulate`: we build it on our side (for example, our own pause clock).
 * - `degrade`: we offer less than the capability promises, on purpose.
 * - `block`: the domain never uses that part with this provider.
 */
export type CapabilityGapHandling = 'emulate' | 'degrade' | 'block';

/** One measured gap of a capability, and what our side does about it. */
export interface CapabilityGap {
    /** What the provider does not do, with the measurement it comes from. */
    readonly gap: string;
    /** How our side handles it. */
    readonly handling: CapabilityGapHandling;
    /** Where the handling lives (decision, chapter or unit). */
    readonly how: string;
}

/**
 * How much of one capability a provider offers. A provider never claims parity
 * it does not have: a partial capability names each gap and its handling.
 */
export type CapabilitySupport =
    | {
          readonly level: 'full';
          /** The exact shape, when it matters to a caller. */
          readonly note?: string;
      }
    | {
          readonly level: 'partial';
          /** At least one gap: a partial capability without a gap is a full one. */
          readonly gaps: readonly [CapabilityGap, ...CapabilityGap[]];
      }
    | {
          readonly level: 'none';
          readonly handling: CapabilityGapHandling;
          readonly how: string;
      };

/** The support declaration of a provider: one entry per capability, no more, no less. */
export type CapabilitySupportMap = { readonly [C in PaymentCapability]: CapabilitySupport };
