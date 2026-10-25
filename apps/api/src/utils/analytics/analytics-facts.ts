import { type AnalyticsEventName, AnalyticsEvents } from '@repo/analytics';
import { createLogger } from '@repo/logger';
import type { BillingFact, BillingFactSink } from '@repo/service-core';
import { deriveAnalyticsEventUuid } from '../../lib/analytics-event-uuid.js';
import { captureServerAnalyticsEvent } from '../../lib/posthog.js';

const logger = createLogger('analytics-facts');
/** A persisted trial fact translated into a catalog analytics event. */
export type TrialFact =
    | {
          kind: 'TRIAL_STARTED';
          userId: string;
          vertical: string;
          actorKind: 'USER' | 'ADMIN' | 'SYSTEM';
          trialId: string;
          trialDays?: number;
          activationEvent: 'listing_published' | 'start_button_pressed';
          occurredAt: Date;
      }
    | {
          kind: 'TRIAL_CONVERTED';
          userId: string;
          vertical: string;
          actorKind: 'USER' | 'ADMIN' | 'SYSTEM';
          trialId: string;
          transition: 'T2' | 'T5' | 'T8';
          trialStateBefore: 'ACTIVE' | 'EXPIRED' | 'NONE';
          daysIntoTrial?: number;
          daysSinceExpiry?: number;
          occurredAt: Date;
      }
    | {
          kind: 'TRIAL_EXPIRED';
          userId: string;
          vertical: string;
          actorKind: 'USER' | 'ADMIN' | 'SYSTEM';
          trialId: string;
          trialDays: number;
          hadPaidIntent?: boolean;
          occurredAt: Date;
      };
type Fact = BillingFact | TrialFact;
type Capture = (input: {
    distinctId: string;
    name: AnalyticsEventName;
    properties: Record<string, unknown>;
    uuid: string;
    timestamp: Date;
}) => void;
type AnyFactSink = { emit(fact: Fact): void };

function toEvent(fact: Fact): {
    event: AnalyticsEventName;
    dedupeKey: string;
    properties: Record<string, unknown>;
    timestamp: Date;
} | null {
    const common =
        'subscriptionId' in fact
            ? {
                  vertical: fact.vertical,
                  subscription_class: fact.subscriptionClass,
                  actor_kind: fact.actorKind,
                  subscription_id: fact.subscriptionId
              }
            : { vertical: fact.vertical, actor_kind: fact.actorKind };
    switch (fact.kind) {
        case 'CHECKOUT_ABANDONED':
            return {
                event: AnalyticsEvents.billingCheckoutAbandoned,
                dedupeKey: fact.subscriptionId,
                properties: {
                    ...common,
                    reason: fact.reason,
                    seconds_in_pending: fact.secondsInPending
                },
                timestamp: fact.occurredAt
            };
        case 'SUBSCRIPTION_ACTIVATED': {
            const activated = {
                event: AnalyticsEvents.billingSubscriptionActivated,
                dedupeKey: fact.subscriptionId,
                properties: {
                    ...common,
                    plan_version_id: fact.planVersionId,
                    billing_option_id: fact.billingOptionId,
                    cycle: fact.cycle,
                    amount_minor: fact.amountMinor,
                    currency: fact.currency,
                    trial_active_at_activation: fact.trialActiveAtActivation
                },
                timestamp: fact.occurredAt
            };
            if (!fact.predecessor) return activated;
            // S2 carries predecessor data on the activation fact; emit plan_changed alongside activation.
            return activated;
        }
        case 'CHARGE_CREDITED':
            return {
                event: AnalyticsEvents.billingChargeSucceeded,
                dedupeKey: fact.paymentId,
                properties: {
                    ...common,
                    payment_id: fact.paymentId,
                    amount_minor: fact.amountMinor,
                    currency: fact.currency,
                    is_first_charge: fact.isFirstCharge,
                    cycle: fact.cycle,
                    plan_version_id: fact.planVersionId,
                    promo_applied: fact.promoApplied
                },
                timestamp: fact.occurredAt
            };
        case 'CHARGE_REJECTED':
            return {
                event: AnalyticsEvents.billingChargeDeclined,
                dedupeKey: fact.paymentId,
                properties: {
                    ...common,
                    payment_id: fact.paymentId,
                    amount_minor: fact.amountMinor,
                    currency: fact.currency,
                    is_first_charge: fact.isFirstCharge,
                    next_state: fact.nextState,
                    has_retry_window: fact.hasRetryWindow
                },
                timestamp: fact.occurredAt
            };
        case 'GRACE_STARTED':
            return {
                event: AnalyticsEvents.billingGraceEntered,
                dedupeKey: `${fact.subscriptionId}:${fact.graceStartedAt.toISOString()}`,
                properties: {
                    ...common,
                    grace_ends_at: fact.graceEndsAt.toISOString(),
                    days_of_grace: fact.daysOfGrace
                },
                timestamp: fact.occurredAt
            };
        case 'SUSPENDED_FOR_ARREARS':
            return {
                event: AnalyticsEvents.billingSubscriptionSuspended,
                dedupeKey: `${fact.subscriptionId}:${fact.occurrenceId}`,
                properties: { ...common, trigger: fact.trigger, days_in_grace: fact.daysInGrace },
                timestamp: fact.occurredAt
            };
        case 'RECOVERED':
            return {
                event: AnalyticsEvents.billingSubscriptionRecovered,
                dedupeKey: `${fact.subscriptionId}:${fact.paymentId}`,
                properties: {
                    ...common,
                    recovered_from: fact.recoveredFrom,
                    payment_id: fact.paymentId,
                    days_in_state: fact.daysInState
                },
                timestamp: fact.occurredAt
            };
        case 'CANCEL_SCHEDULED':
            return {
                event: AnalyticsEvents.billingCancelScheduled,
                dedupeKey: `${fact.subscriptionId}:${fact.serviceEndsAt.toISOString()}`,
                properties: {
                    ...common,
                    service_ends_at: fact.serviceEndsAt.toISOString(),
                    basis: fact.basis,
                    reason: fact.reason
                },
                timestamp: fact.occurredAt
            };
        case 'SUBSCRIPTION_CANCELLED':
            return {
                event: AnalyticsEvents.billingSubscriptionCancelled,
                dedupeKey: fact.subscriptionId,
                properties: {
                    ...common,
                    cancelled_by: fact.cancelledBy,
                    path: fact.path,
                    was_scheduled: fact.wasScheduled,
                    lifetime_days: fact.lifetimeDays,
                    reason: fact.reason
                },
                timestamp: fact.occurredAt
            };
        case 'TRIAL_STARTED':
            return {
                event: AnalyticsEvents.trialStarted,
                dedupeKey: `${fact.userId}:${fact.vertical}`,
                properties: {
                    ...common,
                    activation_event: fact.activationEvent,
                    trial_days: fact.trialDays
                },
                timestamp: fact.occurredAt
            };
        case 'TRIAL_CONVERTED':
            return {
                event: AnalyticsEvents.trialConverted,
                dedupeKey: `${fact.userId}:${fact.vertical}`,
                properties: {
                    ...common,
                    transition: fact.transition,
                    trial_state_before: fact.trialStateBefore,
                    days_into_trial: fact.daysIntoTrial,
                    days_since_expiry: fact.daysSinceExpiry
                },
                timestamp: fact.occurredAt
            };
        case 'TRIAL_EXPIRED':
            return {
                event: AnalyticsEvents.trialExpired,
                dedupeKey: `${fact.userId}:${fact.vertical}`,
                properties: {
                    ...common,
                    trial_days: fact.trialDays,
                    had_paid_intent: fact.hadPaidIntent
                },
                timestamp: fact.occurredAt
            };
        default: {
            const neverFact: never = fact;
            return neverFact;
        }
    }
}

/** Creates an analytics sink that converts domain facts to catalog events.
 * @param options.capture - Transport used to submit the prepared event.
 * @returns A sink that does not propagate transport failures.
 */
export function createAnalyticsFactSink(options: { capture: Capture }): AnyFactSink {
    return {
        emit(fact) {
            if (
                ('subscriptionClass' in fact &&
                    (fact.subscriptionClass !== 'PRINCIPAL' || !fact.userId)) ||
                ('kind' in fact && !('subscriptionClass' in fact) && !fact.userId)
            ) {
                logger.debug(
                    {
                        kind: fact.kind,
                        subscriptionId: 'subscriptionId' in fact ? fact.subscriptionId : undefined
                    },
                    'Analytics fact excluded'
                );
                return;
            }
            const translated = toEvent(fact);
            if (!translated) return;
            try {
                options.capture({
                    distinctId: fact.userId,
                    name: translated.event,
                    properties: translated.properties,
                    uuid: deriveAnalyticsEventUuid({
                        event: translated.event,
                        dedupeKey: translated.dedupeKey
                    }),
                    timestamp: translated.timestamp
                });
                if (fact.kind === 'SUBSCRIPTION_ACTIVATED' && fact.predecessor) {
                    const event = AnalyticsEvents.billingPlanChanged;
                    const dedupeKey = fact.subscriptionId;
                    options.capture({
                        distinctId: fact.userId,
                        name: event,
                        properties: {
                            vertical: fact.vertical,
                            subscription_class: fact.subscriptionClass,
                            actor_kind: fact.actorKind,
                            subscription_id: fact.subscriptionId,
                            from_plan_version_id: fact.predecessor.planVersionId,
                            to_plan_version_id: fact.planVersionId,
                            from_cycle: fact.predecessor.cycle,
                            to_cycle: fact.cycle,
                            direction: fact.predecessor.direction,
                            from_amount_minor: fact.predecessor.amountMinor,
                            to_amount_minor: fact.amountMinor
                        },
                        uuid: deriveAnalyticsEventUuid({ event, dedupeKey }),
                        timestamp: translated.timestamp
                    });
                }
            } catch (error) {
                logger.warn(
                    { kind: fact.kind, error },
                    'Analytics fact capture failed (non-blocking)'
                );
            }
        }
    };
}

let testSink: AnyFactSink | undefined;
const productionSink = createAnalyticsFactSink({ capture: captureServerAnalyticsEvent });
/** Returns the active billing analytics sink.
 * @returns The test sink when installed, otherwise the production sink.
 */
export function getAnalyticsFactSink(): BillingFactSink {
    return testSink ?? (productionSink as BillingFactSink);
}
/** Installs an analytics sink for tests.
 * @param sink - Sink to use until reset.
 */
export function setAnalyticsFactSinkForTests(sink: AnyFactSink): void {
    testSink = sink;
}
/** Restores the production analytics sink after a test override.
 */
export function resetAnalyticsFactSinkForTests(): void {
    testSink = undefined;
}

/** Emits the S1 checkout fact directly from its API edge; the route wires this in the next rollout. */
export function captureBillingCheckoutStarted(input: {
    distinctId: string;
    properties: {
        vertical: string;
        subscription_class: 'PRINCIPAL' | 'COMPLEMENTO';
        actor_kind: 'USER' | 'ADMIN' | 'SYSTEM';
        subscription_id: string;
        plan_version_id: string;
        billing_option_id: string;
        cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
        amount_minor: number;
        currency: 'ARS';
        is_succession?: boolean;
    };
    occurredAt: Date;
}): void {
    const event = AnalyticsEvents.billingCheckoutStarted;
    try {
        captureServerAnalyticsEvent({
            distinctId: input.distinctId,
            name: event,
            properties: input.properties as never,
            uuid: deriveAnalyticsEventUuid({ event, dedupeKey: input.properties.subscription_id }),
            timestamp: input.occurredAt
        });
    } catch (error) {
        logger.warn({ error }, 'Analytics checkout capture failed (non-blocking)');
    }
}
