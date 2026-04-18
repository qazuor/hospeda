/**
 * Valid event types for billing_subscription_events.event_type column.
 * Use this constant instead of raw strings to prevent typos.
 *
 * @see SPEC-064 Phase 3.5
 *
 * @example
 * ```ts
 * import { BILLING_EVENT_TYPES } from '@repo/service-core';
 *
 * await db.insert(billingSubscriptionEventsTable).values({
 *   subscriptionId: sub.id,
 *   eventType: BILLING_EVENT_TYPES.ADDON_RECALC_COMPLETED,
 * });
 * ```
 */
export const BILLING_EVENT_TYPES = {
    /** Marks a completed addon limit recalculation (Phase 4 dedup) */
    ADDON_RECALC_COMPLETED: 'ADDON_RECALC_COMPLETED',
    /** Marks pending QZPay revocations awaiting local DB confirmation (Phase 3 OP-1) */
    ADDON_REVOCATIONS_PENDING: 'ADDON_REVOCATIONS_PENDING',
    /** Marks QZPay plan change succeeded but local transaction failed (Phase 3 OP-2) */
    PLAN_CHANGE_LOCAL_FAILED: 'PLAN_CHANGE_LOCAL_FAILED',
    /** Fired when an addon reaches its configured expiry date */
    ADDON_EXPIRED: 'ADDON_EXPIRED',
    /** Fired when addon usage limits are recalculated (e.g. after a plan change or add-on upgrade) */
    ADDON_LIMIT_RECALCULATED: 'ADDON_LIMIT_RECALCULATED',
    /** Fired when a new dunning attempt record is created for a past-due subscription */
    DUNNING_ATTEMPT_CREATED: 'DUNNING_ATTEMPT_CREATED',
    /** Fired when a dunning retry payment succeeds and the subscription is recovered */
    DUNNING_ATTEMPT_SUCCEEDED: 'DUNNING_ATTEMPT_SUCCEEDED',
    /** Fired when a dunning retry payment fails and the attempt is exhausted or deferred */
    DUNNING_ATTEMPT_FAILED: 'DUNNING_ATTEMPT_FAILED',
    /** Fired when a promo code is successfully redeemed against a subscription or checkout */
    PROMO_CODE_REDEEMED: 'PROMO_CODE_REDEEMED',
    /** Fired when a promo code passes its expiry date and is automatically invalidated */
    PROMO_CODE_EXPIRED: 'PROMO_CODE_EXPIRED',
    /** Fired when a billing notification (e.g. upcoming renewal, trial ending) is scheduled */
    NOTIFICATION_SCHEDULED: 'NOTIFICATION_SCHEDULED',
    /** Fired when a trial subscription is blocked due to expiry (idempotency dedup guard) */
    TRIAL_BLOCKED: 'TRIAL_BLOCKED',
    /** Fired when the reactivation audit-log insert fails; used by Sentry and reconciliation jobs */
    REACTIVATION_AUDIT_FAILED: 'REACTIVATION_AUDIT_FAILED'
} as const;

/**
 * Union type of all valid billing event type values.
 *
 * @example
 * ```ts
 * import type { BillingEventType } from '@repo/service-core';
 *
 * function recordEvent(eventType: BillingEventType): void { ... }
 * ```
 */
export type BillingEventType = (typeof BILLING_EVENT_TYPES)[keyof typeof BILLING_EVENT_TYPES];
