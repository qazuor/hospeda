/**
 * Subscription Status Transitions
 *
 * Defines the valid state machine for billing subscription statuses and
 * exports a guard helper that all subscription status writes should route
 * through. Rejecting illegal transitions at this layer prevents silent
 * data corruption from free-form `UPDATE ... SET status` calls.
 *
 * Spelling note: subscriptions use British spelling ('cancelled', 2 L's)
 * to match the MercadoPago/QZPay API convention and the
 * `billing_subscriptions.status` column constraint. Contrast with addon
 * purchases which use American 'canceled' (1 L) per their DB column.
 *
 * ABANDONED vocab (GAP-13 / T-194-13):
 * The abandoned-pending-subs cron currently writes the qzpay-vocabulary
 * value `incomplete_expired` to the DB. The canonical Hospeda enum value
 * is `abandoned`. T-194-13 will fold the vocabulary into one canonical
 * value; until that migration runs BOTH values must be treated as
 * equivalent source states by call sites. The transition table here uses
 * only `abandoned` (the enum value); the cron shim is responsible for the
 * `incomplete_expired` → `abandoned` normalisation at read time.
 *
 * @module services/subscription-status-transitions
 */

import { SubscriptionStatusEnum } from '@repo/schemas';

/**
 * Union type of all subscription status strings derived from the full enum.
 * Covers all 8 lifecycle states including PENDING_PROVIDER, ABANDONED,
 * PAST_DUE, and EXPIRED that are absent from the narrower {@link SubscriptionStatus}
 * exported by `subscription-status-constants.ts`.
 *
 * Named with the `Full` suffix to avoid shadowing the existing narrower
 * `SubscriptionStatus` type which is used by callers that only handle the
 * subset of states relevant to active subscriptions.
 */
export type SubscriptionStatusFull = `${SubscriptionStatusEnum}`;

/**
 * Valid state transitions for billing subscriptions.
 *
 * Each entry maps a `from` status to the set of `to` statuses that are
 * legitimate. Terminal states have an empty set. Every edge is annotated
 * with the flow(s) that legitimately perform it.
 *
 * State machine diagram:
 * ```
 * pending_provider ──── active ────────────────────────────────────► active
 *       │                 │  ▲                                          │
 *       │                 │  │ reactivation                              │
 *       ▼                 ▼  │ (paused/past_due/cancelled → active)      │
 *    abandoned         past_due ◄──────────────────────────────────────── │
 *  (terminal)            │                                              │
 *                        │                                              │
 *                        ▼                                              ▼
 *                    cancelled ◄──────────────────────────────────── expired
 *                  (terminal)                                       (terminal)
 *
 * trialing ──► active
 *     │ └────► cancelled
 *     └──────► expired
 *
 * active ──────► paused ──► active (resume)
 * trialing ─────┘
 * ```
 */
const VALID_TRANSITIONS: ReadonlyMap<
    SubscriptionStatusFull,
    ReadonlySet<SubscriptionStatusFull>
> = new Map([
    [
        SubscriptionStatusEnum.PENDING_PROVIDER,
        new Set<SubscriptionStatusFull>([
            SubscriptionStatusEnum.ACTIVE, // webhook/poll: payment confirmed (payment-logic.ts confirmAnnualSubscription)
            SubscriptionStatusEnum.ABANDONED // abandoned-pending-subs cron: TTL elapsed (abandoned-pending-subs.job.ts)
        ])
    ],
    [
        SubscriptionStatusEnum.TRIALING,
        new Set<SubscriptionStatusFull>([
            SubscriptionStatusEnum.ACTIVE, // trial conversion: user pays (trial.service.ts blockExpiredTrials via QZPay cancel+reactivate, subscription-logic.ts webhook)
            SubscriptionStatusEnum.CANCELLED, // trial expiry: cron cancels via QZPay (trial.service.ts blockExpiredTrials)
            SubscriptionStatusEnum.EXPIRED, // trial-expiry cron: direct status expiry without QZPay cancel (trial-expiry.ts)
            SubscriptionStatusEnum.PAUSED // self-serve pause while trialing (subscription-pause.ts handleSelfServePause)
        ])
    ],
    [
        SubscriptionStatusEnum.ACTIVE,
        new Set<SubscriptionStatusFull>([
            SubscriptionStatusEnum.PAST_DUE, // payment failure webhook (subscription-logic.ts processSubscriptionUpdated)
            SubscriptionStatusEnum.PAUSED, // self-serve pause / admin pause (subscription-pause.ts, qzpay-admin-hooks.ts)
            SubscriptionStatusEnum.CANCELLED, // user cancel / admin cancel / refund (subscription-logic.ts, qzpay-admin-hooks.ts, payment-logic.ts T-194-03)
            SubscriptionStatusEnum.EXPIRED // MP 'finished' webhook: subscription period ended (subscription-logic.ts QZPAY_TO_HOSPEDA_STATUS)
        ])
    ],
    [
        SubscriptionStatusEnum.PAST_DUE,
        new Set<SubscriptionStatusFull>([
            SubscriptionStatusEnum.ACTIVE, // payment retry succeeded (subscription-logic.ts: past_due → active recovery)
            SubscriptionStatusEnum.CANCELLED // dunning: non-payment cancellation (dunning.job.ts subscription.canceled_nonpayment)
        ])
    ],
    [
        SubscriptionStatusEnum.PAUSED,
        new Set<SubscriptionStatusFull>([
            SubscriptionStatusEnum.ACTIVE, // self-serve resume (subscription-pause.ts handleSelfServeResume, subscription-logic.ts webhook)
            SubscriptionStatusEnum.CANCELLED // admin cancel while paused (qzpay-admin-hooks.ts)
        ])
    ],
    [
        SubscriptionStatusEnum.CANCELLED,
        new Set<SubscriptionStatusFull>([
            SubscriptionStatusEnum.ACTIVE // reactivation: user re-subscribes or admin reactivates (subscription-logic.ts shouldSendReactivationEmail path)
        ])
    ],
    [
        SubscriptionStatusEnum.EXPIRED,
        new Set<SubscriptionStatusFull>() // terminal state — no outgoing transitions
    ],
    [
        SubscriptionStatusEnum.ABANDONED,
        new Set<SubscriptionStatusFull>() // terminal state — user must restart checkout flow
    ]
]);

// ─── Error class ──────────────────────────────────────────────────────────────

/**
 * Thrown when a subscription status transition is not permitted by the
 * state machine.
 *
 * @example
 * ```ts
 * catch (err) {
 *   if (err instanceof InvalidSubscriptionTransitionError) {
 *     console.error(err.from, '->', err.to, err.subscriptionId);
 *   }
 * }
 * ```
 */
export class InvalidSubscriptionTransitionError extends Error {
    /** The status the subscription was in before the attempted transition. */
    public readonly from: string;
    /** The status that was requested but not permitted. */
    public readonly to: string;
    /** The subscription ID, if provided at the call site. */
    public readonly subscriptionId: string | undefined;

    constructor({
        from,
        to,
        subscriptionId
    }: {
        from: string;
        to: string;
        subscriptionId?: string;
    }) {
        super(
            `Invalid subscription status transition: ${from} → ${to}${subscriptionId ? ` (subscription: ${subscriptionId})` : ''}`
        );
        this.name = 'InvalidSubscriptionTransitionError';
        this.from = from;
        this.to = to;
        this.subscriptionId = subscriptionId;
    }
}

// ─── Input types ──────────────────────────────────────────────────────────────

/**
 * Input for {@link validateSubscriptionStatusTransition}.
 */
export interface ValidateSubscriptionStatusTransitionInput {
    /** The current status of the subscription. */
    readonly from: SubscriptionStatusFull;
    /** The target status to transition to. */
    readonly to: SubscriptionStatusFull;
    /** Optional subscription ID for more descriptive error messages. */
    readonly subscriptionId?: string;
}

/**
 * Success result for {@link checkSubscriptionStatusTransition}.
 */
export interface SubscriptionTransitionValid {
    readonly valid: true;
}

/**
 * Failure result for {@link checkSubscriptionStatusTransition}.
 */
export interface SubscriptionTransitionInvalid {
    readonly valid: false;
    /** Human-readable reason the transition was rejected. */
    readonly reason: string;
}

/** Union result type returned by {@link checkSubscriptionStatusTransition}. */
export type SubscriptionTransitionResult =
    | SubscriptionTransitionValid
    | SubscriptionTransitionInvalid;

// ─── Guards ───────────────────────────────────────────────────────────────────

/**
 * Checks whether a subscription status transition is allowed by the state
 * machine. Returns a discriminated-union result — never throws.
 *
 * Use this when you need to handle the invalid case gracefully (e.g. log
 * and continue). Use {@link validateSubscriptionStatusTransition} when you
 * want an immediate assertion that throws on failure.
 *
 * @param input - The `from` status, `to` status, and an optional subscription ID.
 * @returns `{ valid: true }` or `{ valid: false, reason: string }`.
 *
 * @example
 * ```ts
 * const result = checkSubscriptionStatusTransition({ from: 'trialing', to: 'active' });
 * if (!result.valid) {
 *   logger.warn({ reason: result.reason }, 'Skipping illegal transition');
 *   return;
 * }
 * ```
 */
export function checkSubscriptionStatusTransition(
    input: ValidateSubscriptionStatusTransitionInput
): SubscriptionTransitionResult {
    const { from, to, subscriptionId } = input;
    const allowed = VALID_TRANSITIONS.get(from);
    if (allowed === undefined) {
        return {
            valid: false,
            reason: `Unknown source status '${from}'${subscriptionId ? ` (subscription: ${subscriptionId})` : ''}`
        };
    }
    if (!allowed.has(to)) {
        return {
            valid: false,
            reason: `Transition ${from} → ${to} is not permitted by the subscription state machine${subscriptionId ? ` (subscription: ${subscriptionId})` : ''}`
        };
    }
    return { valid: true };
}

/**
 * Asserts that a subscription status transition is allowed by the state
 * machine. Throws {@link InvalidSubscriptionTransitionError} if it is not.
 *
 * Use this as a pre-condition guard before performing an
 * `UPDATE billing_subscriptions SET status = ...` write. It ensures every
 * status mutation is explicitly acknowledged against the state machine.
 *
 * @param input - The `from` status, `to` status, and an optional subscription ID.
 * @throws {InvalidSubscriptionTransitionError} When `from → to` is invalid.
 *
 * @example
 * ```ts
 * // Valid transition — no error thrown
 * validateSubscriptionStatusTransition({ from: 'pending_provider', to: 'active' });
 *
 * // Invalid transition — throws InvalidSubscriptionTransitionError
 * validateSubscriptionStatusTransition({
 *   from: 'abandoned',
 *   to: 'active',
 *   subscriptionId: 'sub-abc-123',
 * });
 * ```
 */
export function validateSubscriptionStatusTransition(
    input: ValidateSubscriptionStatusTransitionInput
): void {
    const { from, to, subscriptionId } = input;
    const result = checkSubscriptionStatusTransition(input);
    if (!result.valid) {
        throw new InvalidSubscriptionTransitionError({ from, to, subscriptionId });
    }
}

/**
 * Returns all valid target statuses for a given source status.
 *
 * Useful for documentation, admin tooling, and error messages.
 *
 * @param from - The current subscription status.
 * @returns A readonly set of permitted target statuses. Empty set for terminal
 *   states. `undefined` when `from` is not a recognised status value.
 *
 * @example
 * ```ts
 * getAllowedTransitions('trialing');
 * // => Set { 'active', 'cancelled', 'expired', 'paused' }
 * ```
 */
export function getAllowedTransitions(
    from: SubscriptionStatusFull
): ReadonlySet<SubscriptionStatusFull> | undefined {
    return VALID_TRANSITIONS.get(from);
}
