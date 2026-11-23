import { createLogger } from '@repo/logger';
import type { VerticalEnum } from '@repo/schemas';
import type { AddonFact } from './addon-fact';

const logger = createLogger('billing-fact-sink');
type Vertical = VerticalEnum;
type ActorKind = 'USER' | 'ADMIN' | 'SYSTEM';
type Common = {
    userId: string;
    vertical: Vertical;
    subscriptionId: string;
    subscriptionClass: 'PRINCIPAL' | 'COMPLEMENTO';
    actorKind: ActorKind;
    occurredAt: Date;
};

/** A committed billing transition that can be forwarded to analytics. */
export type BillingFact =
    | (Common & {
          kind: 'CHECKOUT_STARTED';
          planVersionId: string;
          billingOptionId: string;
          cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
          amountMinor: number;
          currency: 'ARS';
          isSuccession?: boolean;
      })
    | (Common & {
          kind: 'CHECKOUT_ABANDONED';
          reason: 'WINDOW_EXPIRED' | 'USER_CANCELLED';
          secondsInPending?: number;
      })
    | (Common & {
          kind: 'SUBSCRIPTION_ACTIVATED';
          planVersionId: string;
          billingOptionId: string;
          cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
          amountMinor: number;
          currency: 'ARS';
          trialActiveAtActivation?: boolean;
          predecessor?: {
              planVersionId: string;
              cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
              amountMinor?: number;
              direction: 'UPGRADE' | 'DOWNGRADE' | 'LATERAL';
          };
      })
    | (Common & {
          kind: 'CHARGE_CREDITED';
          paymentId: string;
          amountMinor: number;
          currency: 'ARS';
          isFirstCharge: boolean;
          cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
          planVersionId?: string;
          promoApplied?: boolean;
      })
    | (Common & {
          kind: 'CHARGE_REJECTED';
          paymentId: string;
          amountMinor: number;
          currency: 'ARS';
          isFirstCharge: boolean;
          nextState: 'GRACE_PERIOD' | 'CHARGE_DECLINED' | 'UNCHANGED';
          hasRetryWindow?: boolean;
      })
    | (Common & {
          kind: 'GRACE_STARTED';
          graceEndsAt: Date;
          daysOfGrace?: number;
          graceStartedAt: Date;
      })
    | (Common & {
          kind: 'SUSPENDED_FOR_ARREARS';
          trigger: 'GRACE_EXPIRED' | 'PROVIDER_PAUSE_OBSERVED' | 'SUCCESSOR_PROVIDER_CANCELLED';
          daysInGrace?: number;
          occurrenceId: string;
      })
    | (Common & {
          kind: 'RECOVERED';
          recoveredFrom: 'GRACE_PERIOD' | 'SUSPENDED';
          paymentId: string;
          daysInState?: number;
      })
    | (Common & {
          kind: 'CANCEL_SCHEDULED';
          serviceEndsAt: Date;
          basis: 'PAID_PERIOD' | 'CREDIT' | 'NOW';
          reason?:
              | 'TOO_EXPENSIVE'
              | 'NOT_ENOUGH_RESULTS'
              | 'MISSING_FEATURES'
              | 'SEASONAL_PAUSE'
              | 'CLOSING_BUSINESS'
              | 'SWITCHING_PLATFORM'
              | 'TECHNICAL_PROBLEMS'
              | 'OTHER';
      })
    | (Common & {
          kind: 'SUBSCRIPTION_CANCELLED';
          cancelledBy: ActorKind;
          path:
              | 'SERVICE_END'
              | 'DIRECT_FROM_GRACE'
              | 'DIRECT_FROM_SUSPENDED'
              | 'DIRECT_FROM_PAUSED'
              | 'REVOKED'
              | 'INHERITED_BY_PLAN';
          wasScheduled: boolean;
          lifetimeDays?: number;
          reason?:
              | 'TOO_EXPENSIVE'
              | 'NOT_ENOUGH_RESULTS'
              | 'MISSING_FEATURES'
              | 'SEASONAL_PAUSE'
              | 'CLOSING_BUSINESS'
              | 'SWITCHING_PLATFORM'
              | 'TECHNICAL_PROBLEMS'
              | 'OTHER';
      });

/** Every fact a {@link BillingFactSink} accepts: HOS-1878's and the add-on facts (HOS-1883). */
export type SinkFact = BillingFact | AddonFact;

/** Where a fact's log line points: its subscription, or its add-on instance when it has none. */
function factSubject(fact: SinkFact): {
    readonly subscriptionId?: string;
    readonly addonInstanceId?: string;
} {
    if (fact.subscriptionId) return { subscriptionId: fact.subscriptionId };
    return 'addonInstanceId' in fact ? { addonInstanceId: fact.addonInstanceId } : {};
}

export interface BillingFactSink {
    /** Receives one committed billing or add-on fact (HOS-1883 widened it to add-on facts). */
    emit(fact: SinkFact): void;
}
/** Default sink that logs when billing facts have no configured consumer. */
export const unwiredBillingFacts: BillingFactSink = {
    emit(fact) {
        logger.error({ kind: fact.kind, ...factSubject(fact) }, 'Billing fact has no sink');
    }
};
/** Emits a billing fact and logs sink failures without interrupting the transition.
 * @param input.sink - Optional fact sink; defaults to the unwired logger.
 * @param input.fact - Committed billing fact to emit.
 */
export function emitBillingFact(input: { sink?: BillingFactSink; fact: SinkFact }): void {
    try {
        (input.sink ?? unwiredBillingFacts).emit(input.fact);
    } catch (error) {
        logger.error(
            { kind: input.fact.kind, ...factSubject(input.fact), error },
            'Billing fact sink failed'
        );
    }
}
