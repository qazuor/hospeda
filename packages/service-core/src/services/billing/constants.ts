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
    PLAN_CHANGE_LOCAL_FAILED: 'PLAN_CHANGE_LOCAL_FAILED'
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
