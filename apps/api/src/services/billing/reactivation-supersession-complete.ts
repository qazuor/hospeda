/**
 * Shared "complete one reactivation supersession pairing" step (HOS-114
 * T-015/T-016).
 *
 * Cancels ONE superseded subscription and writes its reactivation audit row,
 * for exactly one `(new subscription, superseded subscription)` pairing.
 * This is the substantial, risk-bearing logic previously duplicated between
 * the webhook handler
 * (`routes/webhooks/mercadopago/subscription-logic.ts::completeReactivationSupersession`)
 * and the T-016 reconcile-backstop cron
 * (`cron/jobs/reactivation-supersession-reconcile.job.ts`) — extracted here
 * so there is exactly ONE implementation, mirroring the AC-7 single-source
 * discipline already established for the paid-checkout-create helper
 * (`paid-subscription-create.ts`).
 *
 * ### T-015a hardening (adversarial-review MEDIUM finding, then corrected
 * again by a second adversarial pass — see below)
 *
 * The pre-hardening version wrote the audit row UNCONDITIONALLY after any
 * cancel attempt, swallowing every provider error (5xx, timeout, "already
 * cancelled") identically as "possibly already cancelled". Idempotency is
 * keyed off audit-row EXISTENCE (see the JSDoc on
 * {@link completeSupersessionPairing} below), so a transient cancel failure
 * used to permanently mark the pairing "done" — the old preapproval could
 * keep charging with no automated retry path, since a webhook redelivery of
 * the SAME activation event short-circuits before ever reaching this step
 * once the new subscription is already `active`.
 *
 * **First hardening pass (superseded)**: re-fetched the superseded
 * subscription via `billing.subscriptions.get()` after the cancel attempt.
 * A second adversarial review caught two real bugs in that version, both
 * fixed here:
 *
 * 1. **`billing.subscriptions.get()` reads LOCAL STORAGE ONLY** (confirmed
 *    against the `@qazuor/qzpay-core` source — `get: async (id) => storage.subscriptions.findById(id)`,
 *    the exact same table `cancel()` itself just wrote to, or didn't). For a
 *    subscription that had a REAL MercadoPago preapproval (the
 *    `subscription-reactivation` / lapsed flow — the superseded subscription
 *    was previously `active`/`trialing` with a live preapproval before its
 *    original cancellation), re-reading the LOCAL row after a THIS-run cancel
 *    attempt tells us nothing about the PROVIDER's true current state — it is
 *    the same row we already read moments earlier. This function now
 *    consults the PROVIDER directly via `paymentAdapter.subscriptions.retrieve()`
 *    whenever the superseded row has a known `mpSubscriptionId` (i.e. it once
 *    had a real preapproval) — see Step 4 below. A subscription with NO
 *    `mpSubscriptionId` (the `trial-reactivation` flow's superseded trial sub
 *    — created with `mode: 'trial'`, never linked to a provider preapproval —
 *    see HOS-114 spec §2) has no live preapproval to leak money through, so
 *    the local-storage read remains correct and sufficient for that case.
 * 2. **Deny-list misclassified unknown/paused/past_due as terminal.** The
 *    superseded check was `!NON_TERMINAL.has(status)` with
 *    `NON_TERMINAL = {active, trialing}` — so `paused`, `past_due`, or any
 *    unrecognized string was (wrongly) treated as confirmed-terminal and the
 *    audit row was written. `paused`/`past_due` preapprovals can both still
 *    resume and charge. Inverted to an ALLOW-list of KNOWN-terminal statuses
 *    ({@link CONFIRMED_TERMINAL_STATUSES}) — everything else, including any
 *    unrecognized status, falls through to `'cancel-did-not-take'`.
 *
 * @module services/billing/reactivation-supersession-complete
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { billingSubscriptionEvents, billingSubscriptions, type getDb } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { normalizeStoredSubscriptionStatus, resolveIntendedInterval } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, sql } from 'drizzle-orm';
import { getPostHogClient } from '../../lib/posthog.js';
import { apiLogger } from '../../utils/logger.js';
import { resolveOwnerUserId } from '../subscription-pause.service.js';

/**
 * KNOWN-terminal statuses (an ALLOW-list, not a deny-list — see the T-015a
 * JSDoc above). A superseded subscription's re-verified status must match
 * one of these EXACTLY to be treated as confirmed-terminal; every other
 * value (including `paused`, `past_due`, `pending`, `unpaid`, `incomplete`,
 * `trialing`, `active`, or any unrecognized string) is conservatively
 * treated as "not confirmed" — never falsely mark a pairing done.
 *
 * Sourced from, in order:
 * - `@qazuor/qzpay-core`'s `QZPAY_SUBSCRIPTION_STATUS.CANCELED` (`'canceled'`,
 *   1 L) and `.INCOMPLETE_EXPIRED` (`'incomplete_expired'`) — verified
 *   against the package's own type declarations (`QZPAY_SUBSCRIPTION_STATUS`
 *   / `qzpayIsTerminalStatus`).
 * - MercadoPago's own pass-through status `'finished'` (see
 *   `QZPAY_TO_HOSPEDA_STATUS` in
 *   `routes/webhooks/mercadopago/subscription-logic.ts`, which maps it to
 *   `SubscriptionStatusEnum.EXPIRED` — not re-imported here to avoid a
 *   circular ESM import, since that module imports FROM this one).
 * - Hospeda's own 2-L vocabulary (`'cancelled'`, `'expired'`) — the LOCAL
 *   `billing.subscriptions.get()` fallback branch (Step 4, no-provider-mapping
 *   case) reads whatever vocabulary the stored row happens to be in, which
 *   can be EITHER qzpay's or Hospeda's depending on write path (HOS-108).
 */
const CONFIRMED_TERMINAL_STATUSES: ReadonlySet<string> = new Set([
    'canceled', // qzpay-core / MercadoPago raw vocabulary (1 L)
    'cancelled', // Hospeda vocabulary (2 L's) — SubscriptionStatusEnum.CANCELLED
    'incomplete_expired', // qzpay-core vocabulary — abandoned mode:'paid' preapproval
    'finished', // MercadoPago pass-through (see QZPAY_TO_HOSPEDA_STATUS)
    'expired' // Hospeda vocabulary — SubscriptionStatusEnum.EXPIRED
]);

/**
 * Outcome of {@link completeSupersessionPairing} — lets callers (webhook,
 * reconcile cron) log/count without re-deriving what happened internally.
 */
export type CompleteSupersessionPairingOutcome =
    | 'completed'
    | 'already-audited'
    | 'superseded-not-found'
    | 'cancel-did-not-take'
    | 'error';

/**
 * Minimal identity of the new (superseding) subscription needed to write the
 * audit row and query for idempotency.
 */
export interface SupersessionNewSubscription {
    /** The new, real `mode: 'paid'` subscription id. */
    readonly id: string;
    /** Billing customer id (both reactivation flows keep the same customer). */
    readonly customerId: string;
    /** The new subscription's plan id. */
    readonly planId: string;
}

/**
 * Input for {@link completeSupersessionPairing}.
 */
export interface CompleteSupersessionPairingInput {
    /** Resolved qzpay billing client. */
    readonly billing: QZPayBilling;
    /**
     * MercadoPago payment adapter, used to consult the PROVIDER'S live
     * status for a superseded subscription that has a known
     * `mpSubscriptionId` (see Step 4) — required so the re-verify step
     * cannot be fooled by a stale/never-updated LOCAL row.
     */
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    /** DB handle. Never called while a lock-holding transaction is open. */
    readonly db: ReturnType<typeof getDb>;
    /** The new subscription that supersedes `supersededId`. */
    readonly newSubscription: SupersessionNewSubscription;
    /** The old subscription this reactivation supersedes. */
    readonly supersededId: string;
    /** Which reactivation flavor this was — preserved verbatim on the audit row. */
    readonly triggerSource: 'trial-reactivation' | 'subscription-reactivation';
    /**
     * MP webhook event id when called from the webhook, or a stable sentinel
     * (e.g. `'reactivation-supersession-reconcile-cron'`) when called from
     * the T-016 reconcile cron.
     */
    readonly providerEventId: string;
    /** Caller identifier for logs (`'webhook'`, `'reactivation-supersession-reconcile'`, ...). */
    readonly source: string;
}

/**
 * Cancels one superseded subscription and writes its reactivation audit row.
 * Fully idempotent and safe to call repeatedly for the same pairing.
 *
 * Steps:
 * 1. **Idempotency guard** — skip (`'already-audited'`) if a
 *    `billing_subscription_events` row already exists for this exact
 *    `(newSubscription.id, supersededId)` pairing. Keyed off audit-row
 *    EXISTENCE, not the superseded subscription's status — the
 *    `subscription-reactivation` (lapsed) flow supersedes a subscription
 *    that is ALREADY `cancelled` by definition, so a status-based guard
 *    would permanently skip that flow's audit. This SELECT is a fast-path
 *    only — the real uniqueness guarantee is the DB-level partial unique
 *    index (`packages/db/src/migrations/extras/029-hos114-supersession-audit-unique.index.sql`),
 *    which Step 5's `.onConflictDoNothing()` insert relies on to stay
 *    atomic against a concurrent webhook/cron race on the same pairing.
 * 2. **Superseded row lookup** — skip (`'superseded-not-found'`) if
 *    `supersededId` does not resolve to a row (bad/stale metadata). Also
 *    reads `mpSubscriptionId`, which decides the Step 4 verification source.
 * 3. **Cancel attempt** — calls `billing.subscriptions.cancel(supersededId)`,
 *    swallowing the error (logged only) since "already cancelled" is the
 *    expected, normal outcome for the lapsed-reactivation flow.
 * 4. **Re-verify against the PROVIDER, not local storage** — see the module
 *    JSDoc for the full rationale. If the superseded row has a known
 *    `mpSubscriptionId` (it once had a real preapproval), calls
 *    `paymentAdapter.subscriptions.retrieve(mpSubscriptionId)` for the LIVE
 *    status; a failed retrieve is treated as "not confirmed" (conservative).
 *    Otherwise (no provider mapping — e.g. a superseded TRIAL subscription,
 *    which never had a preapproval to leak money through) falls back to
 *    `billing.subscriptions.get(supersededId)` (local storage). Either way,
 *    the resolved status must match {@link CONFIRMED_TERMINAL_STATUSES}
 *    EXACTLY (an ALLOW-list) to count as confirmed-terminal; anything else —
 *    including `paused`, `past_due`, or an unresolved read — returns
 *    `'cancel-did-not-take'` WITHOUT writing the audit row, Sentry-captured,
 *    so the pairing stays eligible for a future retry (webhook redelivery or
 *    the T-016 reconcile cron).
 * 5. **Audit insert** — once confirmed terminal, writes the
 *    `billing_subscription_events` row and returns `'completed'`. The insert
 *    carries `.onConflictDoNothing()`, backed by the partial unique index on
 *    `(subscription_id, metadata->>'supersededSubscriptionId')`
 *    (`packages/db/src/migrations/extras/029-hos114-supersession-audit-unique.index.sql`),
 *    so a webhook/cron race that both pass the Step 1 fast-path SELECT can
 *    never write two audit rows for the same pairing — the DB itself is now
 *    the source of truth for "at most one", not just the SELECT guard.
 * 6. **HOS-130 conversion analytics (trial flow only)** — after a genuine new
 *    completion, emits a non-blocking `trial_converted_to_paid` PostHog event
 *    (skipped entirely when PostHog is unconfigured, gated on
 *    `triggerSource === 'trial-reactivation'`, every failure swallowed). It
 *    never affects the return value or the already-committed audit row.
 *
 * Never throws — any unexpected error is caught, logged, Sentry-captured,
 * and reported as `'error'` so a failure on one pairing can never abort a
 * caller's loop over multiple pairings.
 *
 * @param input - Billing client, payment adapter, DB handle, the pairing,
 *   and logging context.
 * @returns The outcome of processing this single pairing.
 */
export async function completeSupersessionPairing(
    input: CompleteSupersessionPairingInput
): Promise<CompleteSupersessionPairingOutcome> {
    const {
        billing,
        paymentAdapter,
        db,
        newSubscription,
        supersededId,
        triggerSource,
        providerEventId,
        source
    } = input;

    try {
        // ── Step 1: idempotency guard (fast path only — see Step 5 for the
        // DB-level atomic backstop) ─────────────────────────────────────────
        const [existingAuditRow] = await db
            .select({ id: billingSubscriptionEvents.id })
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, newSubscription.id),
                    sql`${billingSubscriptionEvents.metadata}->>'supersededSubscriptionId' = ${supersededId}`
                )
            )
            .limit(1);

        if (existingAuditRow) {
            apiLogger.debug(
                { subscriptionId: newSubscription.id, supersededId, source },
                'HOS-114: reactivation supersession already audited for this pairing — skipping (idempotent)'
            );
            return 'already-audited';
        }

        // ── Step 2: superseded row lookup ──────────────────────────────────
        const [supersededRow] = await db
            .select({
                id: billingSubscriptions.id,
                status: billingSubscriptions.status,
                mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
                // HOS-130: the superseded trial row carries `intendedInterval`
                // (the interval the user chose at trial creation) — the
                // attribution key for the conversion analytics event below.
                metadata: billingSubscriptions.metadata
            })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, supersededId))
            .limit(1);

        if (!supersededRow) {
            apiLogger.warn(
                { subscriptionId: newSubscription.id, supersededId, source },
                'HOS-114: superseded subscription not found — skipping supersession step'
            );
            return 'superseded-not-found';
        }

        const normalizedSupersededStatus =
            normalizeStoredSubscriptionStatus(supersededRow.status) ??
            (triggerSource === 'trial-reactivation'
                ? SubscriptionStatusEnum.TRIALING
                : SubscriptionStatusEnum.CANCELLED);

        // ── Step 3: cancel attempt (swallow — "already cancelled" is the
        // expected, normal outcome for the lapsed-reactivation flow) ───────
        try {
            await billing.subscriptions.cancel(supersededId);
        } catch (cancelError) {
            apiLogger.warn(
                {
                    subscriptionId: newSubscription.id,
                    supersededId,
                    source,
                    error: cancelError instanceof Error ? cancelError.message : String(cancelError)
                },
                'HOS-114: cancel of superseded subscription failed on first attempt — verifying current status before deciding whether this is a genuine transient failure'
            );
        }

        // ── Step 4: re-verify against the PROVIDER, not local storage ──────
        // See the module JSDoc for why `billing.subscriptions.get()` alone is
        // insufficient: it reads the SAME local row `cancel()` just wrote to
        // (or didn't). A subscription with a known `mpSubscriptionId` once
        // had a real preapproval — consult MercadoPago directly. A
        // subscription with none (a superseded TRIAL, `mode: 'trial'`) never
        // had a preapproval to leak money through, so the local read is fine.
        let refreshedStatus: string | undefined;
        if (supersededRow.mpSubscriptionId) {
            try {
                const liveProviderSubscription = await paymentAdapter.subscriptions.retrieve(
                    supersededRow.mpSubscriptionId
                );
                refreshedStatus = liveProviderSubscription?.status;
            } catch (retrieveError) {
                // Cannot confirm the provider's live state at all — conservative:
                // treated as unresolved (not confirmed terminal) below, exactly
                // like a `get()` that returns nothing.
                apiLogger.warn(
                    {
                        subscriptionId: newSubscription.id,
                        supersededId,
                        mpSubscriptionId: supersededRow.mpSubscriptionId,
                        source,
                        error:
                            retrieveError instanceof Error
                                ? retrieveError.message
                                : String(retrieveError)
                    },
                    'HOS-114: failed to retrieve superseded subscription from the provider — treating as unresolved'
                );
                refreshedStatus = undefined;
            }
        } else {
            const refreshedSuperseded = await billing.subscriptions.get(supersededId);
            refreshedStatus = refreshedSuperseded?.status;
        }

        const confirmedTerminal =
            refreshedStatus !== undefined && CONFIRMED_TERMINAL_STATUSES.has(refreshedStatus);

        if (!confirmedTerminal) {
            const hardeningError = new Error(
                `HOS-114: superseded subscription ${supersededId} is still '${refreshedStatus ?? 'unresolved'}' after a cancel attempt — the cancel did not take effect (suspected transient provider failure)`
            );
            apiLogger.error(
                {
                    subscriptionId: newSubscription.id,
                    supersededId,
                    refreshedStatus: refreshedStatus ?? null,
                    verifiedAgainst: supersededRow.mpSubscriptionId ? 'provider' : 'local',
                    source
                },
                'HOS-114: superseded subscription cancel did not take effect — leaving pairing un-done for retry (webhook redelivery or T-016 reconcile cron)'
            );
            Sentry.captureException(hardeningError, {
                extra: {
                    subscriptionId: newSubscription.id,
                    supersededId,
                    providerEventId,
                    source
                }
            });
            // Do NOT write the audit row: a false "done" here would
            // permanently skip this pairing (idempotency is keyed off
            // audit-row existence), leaving the old preapproval able to keep
            // charging forever with no automated retry.
            return 'cancel-did-not-take';
        }

        // ── Step 5: audit insert (atomic backstop via onConflictDoNothing —
        // see the partial unique index at
        // packages/db/src/migrations/extras/029-hos114-supersession-audit-unique.index.sql) ──
        await db
            .insert(billingSubscriptionEvents)
            .values({
                subscriptionId: newSubscription.id,
                previousStatus: normalizedSupersededStatus,
                newStatus: SubscriptionStatusEnum.ACTIVE,
                triggerSource,
                providerEventId,
                metadata: {
                    supersededSubscriptionId: supersededId,
                    customerId: newSubscription.customerId,
                    planId: newSubscription.planId,
                    ...(triggerSource === 'trial-reactivation'
                        ? { convertedFromTrial: 'true' }
                        : { reactivatedFromCanceled: 'true' })
                }
            })
            .onConflictDoNothing();

        apiLogger.info(
            { subscriptionId: newSubscription.id, supersededId, triggerSource, source },
            'HOS-114: completed deferred reactivation supersession'
        );

        // ── HOS-130: trial→paid conversion analytics ───────────────────────
        // A confirmed trial→paid conversion just landed (audit row written,
        // triggerSource is the trial flow). Emit a non-blocking PostHog event
        // attributing the conversion to the interval the user ORIGINALLY chose
        // at trial creation (`intendedInterval`, from the superseded trial's
        // metadata) alongside the interval it ACTUALLY converted to
        // (`convertedInterval`, from the new sub's `billing_interval` column),
        // so "annual trial → converted to annual/monthly paid" is a clean
        // cross-tab. Stitches to HOS-122's `checkout_completed` via
        // `supersededSubscriptionId` (that event's `localSubscriptionId` for a
        // trial outcome IS this superseded trial sub). Fires for BOTH the
        // monthly (preapproval) and annual (one-time payment) conversion paths,
        // since both funnel through this single choke point (HOS-123). Never
        // blocks or breaks the supersession — the audit row is already
        // committed and analytics failure is swallowed (mirrors the
        // `subscription_payment_succeeded` capture in payment-logic.ts).
        if (triggerSource === 'trial-reactivation') {
            const posthog = getPostHogClient();
            if (posthog) {
                try {
                    const intendedInterval = resolveIntendedInterval(
                        (supersededRow.metadata as Record<string, unknown> | null | undefined)
                            ?.intendedInterval
                    );

                    // Converted interval from the NEW sub's `billing_interval`
                    // column (source of truth: 'month'/'year'). A dedicated
                    // typed SELECT sidesteps the qzpay object-vs-drizzle-row
                    // `.interval` / `.billingInterval` ambiguity at the call
                    // sites; it only runs on a real, confirmed conversion
                    // (rare), so the extra PK read is negligible.
                    const [newSubRow] = await db
                        .select({ billingInterval: billingSubscriptions.billingInterval })
                        .from(billingSubscriptions)
                        .where(eq(billingSubscriptions.id, newSubscription.id))
                        .limit(1);
                    const convertedInterval: 'monthly' | 'annual' | null =
                        newSubRow?.billingInterval === 'year'
                            ? 'annual'
                            : newSubRow?.billingInterval === 'month'
                              ? 'monthly'
                              : null;

                    // Plan slug + price (amount/currency) for the converted
                    // interval. qzpay plans expose the label as `name` (there is
                    // no `slug`); the matching price row carries `unitAmount`
                    // (centavos) and `currency` (ISO). Amount is emitted in
                    // MAJOR units to match HOS-122's checkout_* events. All
                    // best-effort — a failed lookup degrades to nulls, never
                    // throws.
                    const plan = await billing.plans.get(newSubscription.planId).catch(() => null);
                    // When the converted interval couldn't be resolved, leave
                    // amount/currency null rather than falsely matching the
                    // monthly price — "unknown" must never be conflated with
                    // "monthly".
                    const price =
                        convertedInterval === null
                            ? null
                            : (plan?.prices?.find(
                                  (candidate) =>
                                      candidate.active &&
                                      candidate.billingInterval ===
                                          (convertedInterval === 'annual' ? 'year' : 'month') &&
                                      candidate.intervalCount === 1
                              ) ?? null);

                    // Distinct id = owner's Better Auth user id (stitches to the
                    // web-side identity and to checkout_completed), falling back
                    // to the billing customer id (mirrors
                    // resolveAnalyticsDistinctId in payment-logic.ts).
                    const distinctId =
                        (await resolveOwnerUserId({
                            customerId: newSubscription.customerId,
                            db
                        }).catch(() => null)) ?? newSubscription.customerId;

                    posthog.capture({
                        distinctId,
                        event: 'trial_converted_to_paid',
                        properties: {
                            intendedInterval, // original choice (attribution) | null
                            convertedInterval, // actual converted interval | null
                            planSlug: plan?.name ?? null,
                            amount: price ? price.unitAmount / 100 : null, // major units
                            currency: price?.currency ?? null,
                            supersededSubscriptionId: supersededId, // join → checkout_completed
                            newSubscriptionId: newSubscription.id, // forward correlation
                            triggerSource,
                            source,
                            $set: {
                                converted_from_trial: true,
                                last_conversion_interval: convertedInterval
                            }
                        }
                    });
                } catch (phErr) {
                    apiLogger.warn(
                        {
                            subscriptionId: newSubscription.id,
                            supersededId,
                            err: phErr instanceof Error ? phErr.message : String(phErr)
                        },
                        'HOS-130: PostHog capture failed for trial_converted_to_paid (non-blocking)'
                    );
                }
            }
        }

        return 'completed';
    } catch (err) {
        apiLogger.error(
            {
                subscriptionId: newSubscription.id,
                supersededId,
                source,
                error: err instanceof Error ? err.message : String(err)
            },
            'HOS-114: failed to complete reactivation supersession for superseded subscription'
        );
        Sentry.captureException(err, {
            extra: {
                subscriptionId: newSubscription.id,
                supersededId,
                providerEventId,
                source
            }
        });
        // Non-blocking: any caller (webhook post-commit side effects, or the
        // reconcile cron's per-pairing loop) must never abort on one failure.
        return 'error';
    }
}
