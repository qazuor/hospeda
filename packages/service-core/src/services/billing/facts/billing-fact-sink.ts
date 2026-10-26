import { createLogger } from '@repo/logger';
import type { VerticalEnum } from '@repo/schemas';

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
          path: 'SERVICE_END' | 'DIRECT_FROM_GRACE' | 'DIRECT_FROM_SUSPENDED' | 'REVOKED';
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

export interface BillingFactSink {
    /** Receives one committed billing fact. */
    emit(fact: BillingFact): void;
}
/** Default sink that logs when billing facts have no configured consumer. */
export const unwiredBillingFacts: BillingFactSink = {
    emit(fact) {
        logger.error(
            { kind: fact.kind, subscriptionId: fact.subscriptionId },
            'Billing fact has no sink'
        );
    }
};
/** Emits a billing fact and logs sink failures without interrupting the transition.
 * @param input.sink - Optional fact sink; defaults to the unwired logger.
 * @param input.fact - Committed billing fact to emit.
 */
export function emitBillingFact(input: { sink?: BillingFactSink; fact: BillingFact }): void {
    try {
        (input.sink ?? unwiredBillingFacts).emit(input.fact);
    } catch (error) {
        logger.error(
            { kind: input.fact.kind, subscriptionId: input.fact.subscriptionId, error },
            'Billing fact sink failed'
        );
    }
}
