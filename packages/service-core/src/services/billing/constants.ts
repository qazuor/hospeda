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
     * Fired when a Hospeda-owned trial reaches its `trial_end` and is expired
     * locally: status to `expired`, listings unpublished, data left intact
     * (HOS-1012 D-3). Doubles as the idempotency dedup guard for that job.
     *
     * Deliberately NOT a reuse of `TRIAL_BLOCKED`, whose own docblock defines it
     * as "we cancelled this customer" — the pre-HOS-171 no-card trial cut off
     * access outright. D-3 does the opposite: the listing leaves the site and
     * everything loaded stays editable in the panel, coming back online the
     * moment they pay. Two different things happening to the customer deserve
     * two different events, for the same reason `TRIAL_RECONCILED` was not
     * folded into `TRIAL_BLOCKED`.
     *
     * Also distinct from `TRIAL_RECONCILED`, which means "the provider told us
     * how this trial ended". Nobody tells us this one: there is no provider.
     */
    TRIAL_EXPIRED: 'TRIAL_EXPIRED',
    /**
     * Fired when a Hospeda-owned trial is superseded by the customer's own
     * newly-activated paid subscription, inside the SAME transaction as that
     * activation (HOS-1012 T-022).
     *
     * Deliberately NOT a reuse of `TRIAL_EXPIRED`, and the distinction is
     * load-bearing rather than cosmetic: `findPostExpiryCohorts`
     * (`services/billing/trial-series-cohort.ts`) selects the win-back series
     * cohort by INNER JOINing on a `TRIAL_EXPIRED` row. Stamping a converted
     * trial with that event would enrol the customer who just paid into the
     * six-send "tu publicación salió del sitio" series — the single worst mail
     * this system can send. This event says the opposite thing: the trial ended
     * because it succeeded.
     *
     * Also distinct from `REACTIVATION_SUPERSESSION_COMPLETED`, which records
     * HOS-114's provider-mediated supersession (a preapproval is cancelled at
     * MercadoPago, after the transaction, with a reconcile cron behind it).
     * This one is a purely local write on a row that never had a preapproval,
     * and it commits or rolls back with the activation itself.
     */
    TRIAL_SUPERSEDED_BY_PAID: 'TRIAL_SUPERSEDED_BY_PAID',
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
    /*
     * REMOVED, HOS-1012 T-027: `TRIAL_NOT_GRANTED_BY_PROVIDER`.
     *
     * It recorded a settled charge that proved MercadoPago had never granted
     * the free trial Hospeda promised at checkout (H-137, observed in
     * production 2026-08-14: ARS 18.000 charged 118 seconds after the promise).
     * Hospeda no longer promises a trial at checkout at all, so the event has
     * become unreachable. Historical rows in `billing_subscription_events` keep
     * the literal string — the column is free text, so they are unaffected —
     * but nothing in code may write it again. Do NOT reintroduce the key to
     * "support" those rows: reading them needs the string, not the constant.
     */
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
     * The nine durable dedup guards of the Hospeda-owned trial email series
     * (HOS-1012 §4) — one per send, replacing the two-variant D3/D1 pair above.
     *
     * NINE event types rather than one carrying the offset in `metadata`, for a
     * mechanical reason: dedup is a check-then-insert on
     * `(subscription_id, event_type)`, backed at the DB level by a partial
     * UNIQUE index on exactly that pair. An offset that lived in `metadata`
     * could not be part of that index, so the atomic backstop would collapse to
     * "at most one email of the whole series per subscription" — the ledger
     * would silently swallow eight of the nine sends.
     *
     * It also makes the pre-1-day and post-1-day sends impossible to conflate.
     * Both talk about a distance of one day in opposite directions, and both
     * previously produced the idempotency suffix `:d1` (HOS-1012 T-019); here
     * they are two different strings and no refactor can collapse them.
     *
     * `TRIAL_PRE_END_NOTIF_D3`/`_D1` are deliberately NOT reused. Audit rows
     * carrying them already exist on staging and production for the two-reminder
     * scheme, and reusing either would make an existing row read as "the T−10
     * mail already went out" for a trial that never received it.
     */
    TRIAL_SERIES_NOTIF_PRE_10D: 'TRIAL_SERIES_NOTIF_PRE_10D',
    /** Dedup guard for the T−5 warning. */
    TRIAL_SERIES_NOTIF_PRE_5D: 'TRIAL_SERIES_NOTIF_PRE_5D',
    /** Dedup guard for the T−1 warning. */
    TRIAL_SERIES_NOTIF_PRE_1D: 'TRIAL_SERIES_NOTIF_PRE_1D',
    /**
     * Dedup guard for the expiry-day mail. Distinct from `TRIAL_EXPIRED`, which
     * records that the trial WAS expired and the listings came down: this one
     * records that the customer was TOLD. The expiry must be able to succeed
     * with the mail still pending, and a retry of the mail must not read as a
     * second expiry.
     */
    TRIAL_SERIES_NOTIF_EXPIRY: 'TRIAL_SERIES_NOTIF_EXPIRY',
    /** Dedup guard for the +1 day win-back. */
    TRIAL_SERIES_NOTIF_POST_1D: 'TRIAL_SERIES_NOTIF_POST_1D',
    /** Dedup guard for the +5 day win-back. */
    TRIAL_SERIES_NOTIF_POST_5D: 'TRIAL_SERIES_NOTIF_POST_5D',
    /** Dedup guard for the +10 day win-back. */
    TRIAL_SERIES_NOTIF_POST_10D: 'TRIAL_SERIES_NOTIF_POST_10D',
    /** Dedup guard for the +30 day win-back. */
    TRIAL_SERIES_NOTIF_POST_30D: 'TRIAL_SERIES_NOTIF_POST_30D',
    /** Dedup guard for the +60 day win-back, the last send of the series. */
    TRIAL_SERIES_NOTIF_POST_60D: 'TRIAL_SERIES_NOTIF_POST_60D',
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
     * Fired when an admin gifts N free billing cycles to a paying subscriber
     * (HOS-180). Distinct from {@link BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_PAUSED}
     * even though both pause the MercadoPago preapproval: the audit trail must
     * be able to tell "we suspended this subscriber" from "we gave them
     * something", and the two carry opposite entitlement consequences.
     */
    ADMIN_SUBSCRIPTION_COURTESY_GRANTED: 'ADMIN_SUBSCRIPTION_COURTESY_GRANTED',
    /**
     * Fired by the expiry cron when a courtesy window closes and the
     * preapproval is resumed (HOS-180). Distinct from
     * {@link BILLING_EVENT_TYPES.ADMIN_SUBSCRIPTION_RESUMED} for the same
     * reason its sibling is: a gift ending is not an admin action.
     */
    COURTESY_WINDOW_ENDED: 'COURTESY_WINDOW_ENDED',
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
     * Fired when MercadoPago REFUSED to pause a preapproval (HOS-995), by any
     * of the flows that pause one: the host's self-serve pause and the courtesy
     * grant, distinguished via `triggerSource`.
     *
     * The odd one out among the pause events: every sibling records something
     * that HAPPENED, this one records something that did not. It exists because
     * all those flows are fail-closed — a refused pause changes nothing locally,
     * so there is no status transition, no row anywhere, and the only trace was
     * a log line.
     *
     * That mattered the moment HOS-995 retired the guard refusing to pause
     * annual subscriptions. The guard's premise died with HOS-171 (card-first
     * made an annual subscription a recurring preapproval, MP `frequency: 12,
     * frequency_type: 'months'`), but whether MercadoPago's pause endpoint
     * behaves identically on a twelve-month preapproval is a manual sandbox
     * observation no test can make. This event is the standing tripwire in the
     * meantime: `metadata` carries `billingInterval` and the provider's own
     * message, so "does MP refuse annual pauses?" is one GROUP BY away instead
     * of a customer complaint.
     *
     * Deliberately NOT a status-transition row: `previousStatus`/`newStatus`
     * stay null because the subscription is exactly where it was.
     */
    SUBSCRIPTION_PAUSE_PROVIDER_REFUSED: 'SUBSCRIPTION_PAUSE_PROVIDER_REFUSED',
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
