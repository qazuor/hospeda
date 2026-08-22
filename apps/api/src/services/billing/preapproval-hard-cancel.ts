/**
 * MercadoPago preapproval hard-cancel — the single canonical implementation
 * (HOS-753, extracted from `finalize-cancelled-subs.ts` where HOS-237 first
 * wrote it inline).
 *
 * ---
 * WHY THIS IS ITS OWN MODULE
 *
 * A local `billing_subscriptions` row reaching `cancelled` is a TERMINAL state,
 * and a terminal local state with a live provider preapproval is the worst
 * failure mode this subsystem has: MercadoPago keeps charging a card on a
 * schedule that no local row explains any more, because the row that used to
 * explain it is cancelled.
 *
 * Until HOS-753 the only code that closed the provider side lived inline inside
 * the `finalize-cancelled-subs` cron, and that cron selects on
 * `status IN ('active','past_due','trialing')`. Any OTHER path that wrote
 * `cancelled` directly was therefore not merely skipping the provider call — it
 * was also excluding its own row from the one sweep that would have caught the
 * omission later. The refund path did exactly that (HOS-751: preapproval
 * `275b27a37f6f4e94bc1ab7543c6bd092` stayed authorized and charged again).
 *
 * Keeping the implementation here, with both callers consuming it, is the point
 * of the module: a second copy would drift, and a private copy is invisible to
 * the next path that needs one.
 *
 * ---
 * PAUSE IS NOT CANCEL
 *
 * Do not reach for `billing.subscriptions.cancel()` (qzpay-core) to do this job.
 * With `cancelAtPeriodEnd: true` that call maps to preapproval
 * `status: 'paused'` — REVERSIBLE, and correct for the user-initiated
 * "cancel at period end" flow in `subscription-cancel.service.ts`, where the
 * user keeps access until the period ends. It is the wrong verb for a state
 * that is already terminal. This module issues the irreversible
 * `status: 'cancelled'` through the payment adapter directly.
 *
 * @module services/billing/preapproval-hard-cancel
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import * as Sentry from '@sentry/node';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { apiLogger } from '../../utils/logger.js';

/**
 * Logger shape accepted by {@link hardCancelPreapprovalBestEffort}.
 *
 * Deliberately **message-first** (`info(message, data)`), matching the shape the
 * cron context passes. Note this is the OPPOSITE argument order from `apiLogger`
 * (pino: `info(data, message)`); {@link defaultHardCancelLogger} adapts between
 * the two so callers holding either one can pass it without rewriting call sites.
 */
export type HardCancelPreapprovalLogger = {
    readonly info: (message: string, data?: Record<string, unknown>) => void;
    readonly warn: (message: string, data?: Record<string, unknown>) => void;
    readonly error: (message: string, data?: Record<string, unknown>) => void;
};

/**
 * Adapter that exposes the app's pino `apiLogger` under the message-first
 * {@link HardCancelPreapprovalLogger} shape.
 */
const defaultHardCancelLogger: HardCancelPreapprovalLogger = {
    info: (message, data) => apiLogger.info(data ?? {}, message),
    warn: (message, data) => apiLogger.warn(data ?? {}, message),
    error: (message, data) => apiLogger.error(data ?? {}, message)
};

/**
 * What {@link hardCancelPreapprovalBestEffort} did.
 *
 * Returned rather than thrown: every outcome here is non-fatal to the caller by
 * design (see the function's "best-effort" contract), but callers that want to
 * count or branch on outcomes should not have to parse log lines to do it.
 */
export type HardCancelPreapprovalOutcome =
    /** The provider accepted the irreversible cancel. */
    | { readonly kind: 'cancelled' }
    /** Nothing to cancel — no linked preapproval, or no payment adapter configured. */
    | { readonly kind: 'skipped'; readonly reason: 'no-preapproval' | 'adapter-unavailable' }
    /** The provider call threw. Logged and captured; NOT rethrown. */
    | { readonly kind: 'failed'; readonly error: string };

/** Which code path asked for the hard-cancel. */
export type HardCancelPreapprovalSource = 'finalize-cancelled-subs' | 'refund-lifecycle';

/**
 * Sentry `action` tag per source.
 *
 * Mapped explicitly rather than derived from the source string: the cron's tag
 * predates this module (HOS-237) and ops alerting keys off it, so extracting the
 * helper must not silently rename it.
 */
const SENTRY_ACTION_BY_SOURCE: Readonly<Record<HardCancelPreapprovalSource, string>> = {
    'finalize-cancelled-subs': 'finalize_hard_cancel_preapproval',
    'refund-lifecycle': 'refund_hard_cancel_preapproval'
};

/**
 * Input for {@link hardCancelPreapprovalBestEffort}.
 */
export interface HardCancelPreapprovalInput {
    /** Local subscription id — for logs, Sentry context and correlation. */
    readonly subscriptionId: string;
    /**
     * The MercadoPago preapproval id. `null` is an expected, non-error input:
     * `comp` subscriptions are direct DB inserts with no preapproval at all
     * (SPEC-262), and so are any rows whose checkout never linked one.
     */
    readonly mpSubscriptionId: string | null;
    /**
     * The QZPay billing instance. Optional: callers that already hold one (the
     * cron holds the instance for its whole tick) pass it to avoid re-resolving;
     * callers that do not fall back to `getQZPayBilling()`, which returns `null`
     * when billing is disabled for the environment.
     */
    readonly billing?: QZPayBilling | null;
    /** Logger from the calling context. Defaults to the app logger. */
    readonly logger?: HardCancelPreapprovalLogger;
    /**
     * Which caller this is — used as the log-line prefix and to pick the Sentry
     * `action` tag, so a failed hard-cancel is attributable to the path that
     * triggered it without reading a stack trace.
     */
    readonly source: HardCancelPreapprovalSource;
}

/**
 * Best-effort irreversible cancel of the MercadoPago preapproval behind a
 * subscription whose local row is (or is about to be) terminal.
 *
 * **Never throws.** That is the contract every caller depends on, for two
 * different reasons:
 *
 * - the cron's local finalization is already the authoritative user-facing
 *   outcome, and a provider hiccup must not fail the tick;
 * - the refund path has already MOVED MONEY, and money returned to a customer
 *   cannot be un-returned. Failing the refund because the provider cancel
 *   failed would leave the caller retrying an operation whose expensive half
 *   already succeeded.
 *
 * **Idempotent** in the only sense that matters here: calling it twice is safe.
 * The provider verb is `PUT status: 'cancelled'`, so a preapproval that is
 * already cancelled is either accepted again or answers an error that this
 * function swallows into a `failed` outcome. Either way the second call neither
 * throws nor changes provider state. Failures are deliberately NOT classified by
 * parsing the provider's error text: a regex over a third-party error message is
 * exactly the kind of predicate that silently reclassifies a real failure the
 * day the wording changes.
 *
 * There is **no automated retry**. On failure the preapproval stays open until a
 * manual admin hard-cancel clears it, and the Sentry capture is the signal ops
 * watch for that sweep.
 *
 * @param input - Subscription id, preapproval id, optional billing/logger, and source.
 * @returns The outcome — `cancelled`, `skipped` (with a reason), or `failed`.
 *
 * @example
 * ```ts
 * // After writing a terminal status locally:
 * await hardCancelPreapprovalBestEffort({
 *     subscriptionId: row.id,
 *     mpSubscriptionId: row.mpSubscriptionId,
 *     source: 'refund-lifecycle'
 * });
 * ```
 */
export async function hardCancelPreapprovalBestEffort(
    input: HardCancelPreapprovalInput
): Promise<HardCancelPreapprovalOutcome> {
    const { subscriptionId, mpSubscriptionId, source } = input;
    const logger = input.logger ?? defaultHardCancelLogger;

    if (!mpSubscriptionId) {
        // Expected for `comp` subscriptions (no preapproval exists) — a clean
        // no-op, not a failure.
        logger.warn(`${source}: no mpSubscriptionId — skipping MP preapproval hard-cancel`, {
            subscriptionId
        });
        return { kind: 'skipped', reason: 'no-preapproval' };
    }

    const billing = input.billing ?? getQZPayBilling();
    const paymentAdapter = billing?.getPaymentAdapter();
    if (!paymentAdapter) {
        logger.warn(
            `${source}: payment adapter unavailable — skipping MP preapproval hard-cancel`,
            { subscriptionId, mpSubscriptionId }
        );
        return { kind: 'skipped', reason: 'adapter-unavailable' };
    }

    try {
        // cancelAtPeriodEnd=false → PUT { status: 'cancelled' } (irreversible).
        await paymentAdapter.subscriptions.cancel(mpSubscriptionId, false);
        logger.info(`${source}: MP preapproval hard-cancelled`, {
            subscriptionId,
            mpSubscriptionId
        });
        return { kind: 'cancelled' };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`${source}: MP preapproval hard-cancel failed (non-blocking)`, {
            subscriptionId,
            mpSubscriptionId,
            error: message
        });
        Sentry.captureException(err instanceof Error ? err : new Error(message), {
            tags: {
                subsystem: 'billing-subscription-lifecycle',
                action: SENTRY_ACTION_BY_SOURCE[source]
            },
            extra: { subscriptionId, mpSubscriptionId }
        });
        return { kind: 'failed', error: message };
    }
}
