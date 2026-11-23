import { type AnalyticsEventName, AnalyticsEvents } from '@repo/analytics';
import type { AddonFact } from '@repo/service-core';

/** A catalog event prepared from one add-on fact. */
export interface TranslatedAddonEvent {
    readonly event: AnalyticsEventName;
    readonly dedupeKey: string;
    readonly properties: Record<string, unknown>;
    readonly timestamp: Date;
}

/** Spreads a property only when it is present (P-11): no `undefined` keys reach the payload. */
function optional(key: string, value: unknown): Record<string, unknown> {
    return value === undefined ? {} : { [key]: value };
}

/**
 * Translates one add-on fact into its `addon_*` catalog event (HOS-1883 §4, §5.4). Add-on facts
 * never become `billing_*` events (P-10). The dedupe key is §4's (`addon_instance_id`, or
 * `payment_id` for charges), hashed with the event name into `data.event_uuid` by the caller.
 *
 * @param fact - A committed add-on fact
 * @returns The prepared event
 */
export function translateAddonFact(fact: AddonFact): TranslatedAddonEvent {
    const common = {
        addon_instance_id: fact.addonInstanceId,
        addon_id: fact.addonId,
        addon_version_id: fact.addonVersionId,
        addon_product_id: fact.addonProductId,
        charge_kind: fact.chargeKind,
        scope_type: fact.scopeType,
        actor_kind: fact.actorKind,
        ...optional('vertical', fact.vertical),
        ...optional('subscription_id', fact.subscriptionId)
    };
    const byInstance = { dedupeKey: fact.addonInstanceId, timestamp: fact.occurredAt };
    switch (fact.kind) {
        case 'ADDON_CHECKOUT_STARTED':
            return {
                event: AnalyticsEvents.addonCheckoutStarted,
                ...byInstance,
                properties: {
                    ...common,
                    amount_minor: fact.amountMinor,
                    currency: fact.currency,
                    ...optional('cycle', fact.cycle)
                }
            };
        case 'ADDON_CHECKOUT_ABANDONED':
            return {
                event: AnalyticsEvents.addonCheckoutAbandoned,
                ...byInstance,
                properties: {
                    ...common,
                    reason: fact.reason,
                    ...optional('seconds_in_pending', fact.secondsInPending)
                }
            };
        case 'ADDON_ACTIVATED':
            return {
                event: AnalyticsEvents.addonActivated,
                ...byInstance,
                properties: {
                    ...common,
                    amount_minor: fact.amountMinor,
                    currency: fact.currency,
                    ...optional('cycle', fact.cycle),
                    ...optional('seconds_in_pending', fact.secondsInPending)
                }
            };
        case 'ADDON_CHARGE_CREDITED':
            return {
                event: AnalyticsEvents.addonChargeSucceeded,
                dedupeKey: fact.paymentId,
                timestamp: fact.occurredAt,
                properties: {
                    ...common,
                    payment_id: fact.paymentId,
                    amount_minor: fact.amountMinor,
                    currency: fact.currency,
                    ...optional('is_first_charge', fact.isFirstCharge),
                    ...optional('cycle', fact.cycle),
                    ...optional('promo_applied', fact.promoApplied)
                }
            };
        case 'ADDON_CHARGE_REJECTED':
            return {
                event: AnalyticsEvents.addonChargeDeclined,
                dedupeKey: fact.paymentId,
                timestamp: fact.occurredAt,
                properties: {
                    ...common,
                    payment_id: fact.paymentId,
                    amount_minor: fact.amountMinor,
                    currency: fact.currency,
                    is_first_charge: fact.isFirstCharge,
                    ...optional('has_retry_window', fact.hasRetryWindow)
                }
            };
        case 'ADDON_CANCELLED':
            return {
                event: AnalyticsEvents.addonCancelled,
                ...byInstance,
                properties: {
                    ...common,
                    path: fact.path,
                    was_scheduled: fact.wasScheduled,
                    ...optional('lifetime_days', fact.lifetimeDays)
                }
            };
        case 'ADDON_GRANTED_FREE':
            return {
                event: AnalyticsEvents.addonGrantedFree,
                ...byInstance,
                properties: {
                    ...common,
                    source: fact.source,
                    ...optional('previous_amount_minor', fact.previousAmountMinor),
                    ...optional('previous_cycle', fact.previousCycle),
                    ...optional('previous_subscription_id', fact.previousSubscriptionId)
                }
            };
        default: {
            const exhaustive: never = fact;
            return exhaustive;
        }
    }
}
