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
    /**
     * Fired when a plan change applied successfully to the local DB but the
     * push to MercadoPago `auto_recurring.transaction_amount` failed
     * (SPEC-126 D7). The webhook reconciliation path is expected to recover
     * the drift on the next MP event; this event lets ops spot the
     * intermediate inconsistency.
     */
    PLAN_CHANGE_MP_PROPAGATION_FAILED: 'PLAN_CHANGE_MP_PROPAGATION_FAILED',
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
    /**
     * Fired when the trial reconciler settles an elapsed card-first trial against
     * the provider (HOS-171), recording the outcome it reconciled the local row
     * to — converted to active, mirrored to cancelled/paused, or routed to
     * past_due after a failed first charge.
     *
     * Acts as the per-subscription idempotency dedup guard for
     * `reconcileExpiredTrials`, the role `TRIAL_BLOCKED` played for the
     * cancel-at-expiry cron this replaced. Deliberately a NEW event type rather
     * than a reuse: `TRIAL_BLOCKED` means "we cancelled this customer", which is
     * the opposite of what the reconciler does, and conflating them would make
     * the audit trail lie about which behavior ran.
     */
    TRIAL_RECONCILED: 'TRIAL_RECONCILED',
    /**
     * Fired when a settled charge proves the provider never granted the free
     * trial Hospeda promised at checkout (H-137).
     *
     * MercadoPago grants a preapproval's `free_trial` once per
     * `(payer, preapproval_plan)`, while Hospeda decides trial eligibility per
     * billing customer. A payer who already spent the trial on a shared plan is
     * therefore shown a trial offer and charged the first cycle minutes later —
     * observed in production on 2026-08-14, $18.000 charged 118 seconds after
     * the promise.
     *
     * Deliberately a NEW event type rather than a `TRIAL_RECONCILED` with
     * different metadata, for the same reason `TRIAL_RECONCILED` was not folded
     * into `TRIAL_BLOCKED`: this one means "we sold a free period the customer
     * never received", which is a broken commercial promise and not a lifecycle
     * transition. Conflating them would hide every occurrence inside the normal
     * conversion traffic, which is precisely how this went unnoticed until a
     * manual smoke found it.
     */
    TRIAL_NOT_GRANTED_BY_PROVIDER: 'TRIAL_NOT_GRANTED_BY_PROVIDER',
    /** Fired when the reactivation audit-log insert fails; used by Sentry and reconciliation jobs */
    REACTIVATION_AUDIT_FAILED: 'REACTIVATION_AUDIT_FAILED',
    /**
     * Fired when a QZPay addon revocation fails during subscription cancellation cleanup.
     *
     * Inserted as a non-rethrowing side-effect so the main error path (HTTP 500 to
     * MercadoPago) is not affected. The event records the purchase ID, error message,
     * whether the failure is retryable, and a timestamp for operational observability.
     *
     * @see SPEC-064 T-047
     */
    ADDON_REVOCATION_FAILED: 'ADDON_REVOCATION_FAILED',
    /**
     * Fired when the D-3 (primary, skip-tolerant "trial ends soon") reminder
     * email is dispatched. Acts as the durable per-subscription dedup guard for
     * `notification-schedule.job.ts`'s trial-reminder block (HOS-121; originally
     * minted for the now-deleted `trial-pre-end-notif` cron, SPEC-126 D5) so a
     * single trial does not receive the same variant on consecutive daily runs.
     */
    TRIAL_PRE_END_NOTIF_D3: 'TRIAL_PRE_END_NOTIF_D3',
    /**
     * Fired when the D-1 (one day remaining) trial-ending reminder email is
     * dispatched by `notification-schedule.job.ts`. The D-1 variant is
     * independent from D-3 — a trial gets both reminders, but never the same
     * variant twice (HOS-121; originally SPEC-126 D5).
     */
    TRIAL_PRE_END_NOTIF_D1: 'TRIAL_PRE_END_NOTIF_D1',
    /**
     * Fired when a user explicitly requests cancellation of their subscription
     * via the self-service cancellation flow (SPEC-147). Persisted immediately
     * at cancellation request time so the intent is auditable even if the
     * subsequent finalization step fails.
     */
    USER_CANCELED: 'USER_CANCELED',
    /**
     * Fired when a user reverses a soft-cancel while still in the access window
     * via the self-service un-cancel flow (HOS-232): `cancelAtPeriodEnd` is
     * cleared and the MercadoPago preapproval re-authorized, with no new
     * checkout and no charge. The mirror of {@link USER_CANCELED}.
     */
    USER_UNCANCELED: 'USER_UNCANCELED',
    /**
     * Fired when a cancelled subscription's end-of-period finalization job
     * runs and completes the transition to the cancelled state (SPEC-147).
     * Written by the cron/job that processes subscriptions past their
     * current_period_end while in a pending-cancellation status.
     */
    FINALIZE_CANCELLED_SUB: 'FINALIZE_CANCELLED_SUB',
    /**
     * Fired when the D3 "access ending soon" reminder email is dispatched for
     * a soft-cancelled subscription (SPEC-147 T-010). Acts as the per-subscription
     * dedup guard in the `finalize-cancelled-subs` cron so a single sub does not
     * receive the same reminder on consecutive daily runs.
     */
    SUBSCRIPTION_ACCESS_ENDING_NOTIF: 'SUBSCRIPTION_ACCESS_ENDING_NOTIF',
    /**
     * Fired once per admin disable action when a billing plan is marked as
     * disabled by an admin (SPEC-148). Carries the acting admin user ID and
     * the count of subscriptions affected by the disable, enabling operational
     * audit of bulk plan-retirement events.
     */
    PLAN_DISABLED_BY_ADMIN: 'PLAN_DISABLED_BY_ADMIN',
    /**
     * Fired once per affected subscription when a plan is disabled/retired
     * and the subscription is flagged for cancel-at-period-end (SPEC-148).
     * Distinct from PLAN_DISABLED_BY_ADMIN (the admin action); this event
     * tracks the per-subscription migration side-effect so individual sub
     * histories remain auditable without inspecting admin-level event rows.
     */
    PLAN_DISABLED_MIGRATION: 'PLAN_DISABLED_MIGRATION',
    /**
     * Fired when a partial refund is recorded on a payment and the
     * subscription is kept active (HOS-657). The accumulated refunded
     * amount has not yet reached the payment total, so no status
     * transition happens — see {@link BILLING_EVENT_TYPES.PAYMENT_FULL_REFUND}
     * for what fires once the accumulation reaches the full amount.
     */
    PAYMENT_PARTIAL_REFUND: 'PAYMENT_PARTIAL_REFUND',
    /**
     * Fired when a full refund (direct, or an accumulation of partials that
     * reached the payment total) successfully transitions the subscription
     * to `cancelled` (HOS-657).
     */
    PAYMENT_FULL_REFUND: 'PAYMENT_FULL_REFUND',
    /**
     * Fired when a full refund is recorded on `billing_payments` but the
     * subscription is already in a terminal state and cannot transition
     * (HOS-657). The refund itself is still persisted (HOS-235); this event
     * makes that fact auditable even though no status change accompanies it.
     */
    PAYMENT_FULL_REFUND_NO_TRANSITION: 'PAYMENT_FULL_REFUND_NO_TRANSITION',
    /**
     * Fired when an admin cancels a subscription via the admin panel
     * (HOS-657). Mirrors {@link BILLING_EVENT_TYPES.USER_CANCELED} for the
     * admin-initiated path.
     */
    ADMIN_SUBSCRIPTION_CANCELLED: 'ADMIN_SUBSCRIPTION_CANCELLED',
    /**
     * Fired by the `preapproval-less-expiry` cron (H-21) when it expires a
     * subscription that has no MercadoPago preapproval and whose period has
     * elapsed (HOS-657). Such rows are invisible to every other reconciler,
     * so this is the only writer that ever produces this event.
     */
    SUBSCRIPTION_EXPIRED_WITHOUT_PREAPPROVAL: 'SUBSCRIPTION_EXPIRED_WITHOUT_PREAPPROVAL',
    /**
     * Fired when an admin changes a subscription's plan via the admin panel
     * (HOS-657). Mirrors the self-service plan-change flow's audit shape but
     * for the admin-initiated path (`onAfterSubscriptionPlanChanged` hook in
     * `qzpay-admin-hooks.ts`).
     */
    ADMIN_PLAN_CHANGED: 'ADMIN_PLAN_CHANGED',
    /**
     * Fired when an admin extends a subscription's trial via the admin panel
     * (HOS-657, `onAfterSubscriptionTrialExtended` hook).
     */
    ADMIN_TRIAL_EXTENDED: 'ADMIN_TRIAL_EXTENDED',
    /**
     * Fired when an admin pauses a subscription via the admin panel (HOS-657).
     * Mirrors {@link BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_PAUSED} for the
     * admin-initiated path.
     */
    ADMIN_SUBSCRIPTION_PAUSED: 'ADMIN_SUBSCRIPTION_PAUSED',
    /**
     * Fired when an admin resumes a paused subscription via the admin panel
     * (HOS-657). Mirrors {@link BILLING_EVENT_TYPES.HOST_SUBSCRIPTION_RESUMED}
     * for the admin-initiated path.
     */
    ADMIN_SUBSCRIPTION_RESUMED: 'ADMIN_SUBSCRIPTION_RESUMED',
    /**
     * Fired when a host pauses their OWN subscription via the self-service
     * `/me/subscription-pause` route (HOS-657). Mirrors
     * {@link BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_PAUSED} for the
     * host-initiated path.
     */
    HOST_SUBSCRIPTION_PAUSED: 'HOST_SUBSCRIPTION_PAUSED',
    /**
     * Fired when a host resumes their OWN paused subscription via the
     * self-service `/me/subscription-resume` route (HOS-657). Mirrors
     * {@link BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_RESUMED} for the
     * host-initiated path.
     */
    HOST_SUBSCRIPTION_RESUMED: 'HOST_SUBSCRIPTION_RESUMED',
    /**
     * Fired by the generic MercadoPago `subscription_preapproval.updated`
     * status mapper (`subscription-logic.ts::processSubscriptionUpdated`,
     * HOS-657) when the provider-reported status resolves to `active`. This
     * is the highest-volume writer of `billing_subscription_events` — it is
     * shared by the live webhook, the `subscription-poll` backup cron, and
     * the `webhook-retry` cron (distinguished via `triggerSource`, not
     * `eventType`). One event type per destination status ({@link
     * BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_TRIALING},
     * {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_PAUSED},
     * {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_CANCELLED},
     * {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_EXPIRED},
     * {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_PAST_DUE}) rather than
     * one generic value — `newStatus` on the row already carries the exact
     * destination, but a single flat "webhook fired" event type would still
     * force every reader back to decoding `newStatus` by hand, which is
     * exactly the ambiguity HOS-657 set out to remove. Covers a dunning
     * recovery, a provider-side resume, and a fresh activation alike — those
     * are distinguished by `previousStatus`, not by a separate event type.
     */
    WEBHOOK_SUBSCRIPTION_ACTIVATED: 'WEBHOOK_SUBSCRIPTION_ACTIVATED',
    /**
     * Same mapper as {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_ACTIVATED}
     * (HOS-657), fired when `deriveTrialingStatus` resolves the destination
     * to `trialing` — a card-first trial preapproval MercadoPago reports as
     * `active` but whose local `trialEnd` is still in the future.
     */
    WEBHOOK_SUBSCRIPTION_TRIALING: 'WEBHOOK_SUBSCRIPTION_TRIALING',
    /**
     * Same mapper as {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_ACTIVATED}
     * (HOS-657), fired when the provider reports `paused`. Never fired for
     * the intentional soft-cancel grace carve-out (a `paused` transition on a
     * `cancelAtPeriodEnd=true` row is skipped before the audit insert is
     * reached — see the comment above it in `subscription-logic.ts`).
     */
    WEBHOOK_SUBSCRIPTION_PAUSED: 'WEBHOOK_SUBSCRIPTION_PAUSED',
    /**
     * Same mapper as {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_ACTIVATED}
     * (HOS-657), fired when the provider reports `canceled`. Distinct from
     * {@link BILLING_EVENT_TYPES.USER_CANCELED} /
     * {@link BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_CANCELLED}: those record
     * the LOCAL intent at request time, while this records MercadoPago
     * independently confirming the preapproval is cancelled (which can also
     * happen for a cancellation initiated directly in the MP dashboard, or as
     * the provider-side echo of a local cancel request).
     */
    WEBHOOK_SUBSCRIPTION_CANCELLED: 'WEBHOOK_SUBSCRIPTION_CANCELLED',
    /**
     * Same mapper as {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_ACTIVATED}
     * (HOS-657), fired when the provider reports `finished`.
     */
    WEBHOOK_SUBSCRIPTION_EXPIRED: 'WEBHOOK_SUBSCRIPTION_EXPIRED',
    /**
     * Same mapper as {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_ACTIVATED}
     * (HOS-657), fired when the provider reports `past_due` — the signal that
     * routes the subscription into the dunning cron's grace window.
     */
    WEBHOOK_SUBSCRIPTION_PAST_DUE: 'WEBHOOK_SUBSCRIPTION_PAST_DUE',
    /**
     * Defensive fallback for {@link BILLING_EVENT_TYPES.WEBHOOK_SUBSCRIPTION_ACTIVATED}'s
     * mapper (HOS-657): the six statuses above are the only ones
     * `QZPAY_TO_HOSPEDA_STATUS` + `deriveTrialingStatus` can currently
     * produce, so this should never actually be written. Exists so a future
     * upstream status this mapper doesn't yet enumerate still gets an
     * `eventType` instead of silently reverting to `NULL` (the exact bug
     * HOS-657 fixes) — never remove without also making the mapper's switch
     * exhaustive over the full {@link SubscriptionStatusEnum}.
     */
    WEBHOOK_SUBSCRIPTION_STATUS_OTHER: 'WEBHOOK_SUBSCRIPTION_STATUS_OTHER',
    /**
     * Fired when a deferred reactivation supersession pairing completes
     * (HOS-114, audited via HOS-657): the superseded subscription was
     * confirmed cancelled and the new subscription's activation is now the
     * audited record of that pairing. Covers both flavors —
     * `trial-reactivation` (trial → paid conversion) and
     * `subscription-reactivation` (lapsed subscription reactivated) — kept as
     * ONE event type because `triggerSource` on the same row already
     * distinguishes them (see `completeSupersessionPairing` in
     * `reactivation-supersession-complete.ts`); splitting the event type too
     * would duplicate that distinction across two columns.
     */
    REACTIVATION_SUPERSESSION_COMPLETED: 'REACTIVATION_SUPERSESSION_COMPLETED'
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
