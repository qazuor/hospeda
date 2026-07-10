/**
 * Reactivation Supersession Reconciliation Cron Job (HOS-114 T-016).
 *
 * Backstop for the webhook-driven "complete the deferred reactivation
 * supersession" step
 * (`routes/webhooks/mercadopago/subscription-logic.ts::completeReactivationSupersession`).
 * That step cancels the OLD subscription a paid reactivation supersedes and
 * writes its audit row once the NEW subscription's `PENDING_PROVIDER ->
 * ACTIVE` transition is confirmed by MercadoPago. It can leave a pairing
 * unfinished — most notably the T-015a hardening deliberately declines to
 * write the audit row when a transient provider cancel failure is detected,
 * so the old preapproval could otherwise keep charging indefinitely with no
 * automated retry path.
 *
 * ### Orphan definition (corrected — second adversarial pass)
 *
 * A `(N, S)` pairing — new subscription `N`, superseded subscription `S` — is
 * an orphan when:
 * 1. `N` is `active` and carries `S`'s id in its
 *    `metadata.supersedesSubscriptionId` (single id or comma-joined list).
 * 2. No `billing_subscription_events` completion audit row exists yet for
 *    the exact `(N.id, S.id)` pairing.
 *
 * The FIRST version of this cron additionally required `S`'s LOCAL status to
 * be `active`/`trialing` before even attempting a reconcile — this was a
 * real bug: the `subscription-reactivation` (lapsed) flow supersedes a
 * subscription that is `canceled` LOCALLY by definition (it is the canceled
 * sub the user reactivated FROM), so every lapsed-flow orphan was silently
 * skipped forever — exactly the double-charge scenario this cron exists to
 * prevent. Candidate selection is now based ONLY on (1) and (2) above; the
 * shared {@link completeSupersessionPairing} decides per-pairing whether the
 * superseded subscription is genuinely terminal, and — critically — it
 * checks the PROVIDER's live status (not the local row) whenever `S` has a
 * known `mpSubscriptionId`, so a "live-preapproval-but-locally-canceled" `S`
 * is genuinely reconciled instead of trusting a possibly-stale local read.
 * See that module's JSDoc for the full rationale.
 *
 * ### Bounding the scan (performance, not correctness)
 *
 * `N.metadata.supersedesSubscriptionId` is stamped once at creation and never
 * cleared, so without a cheap pre-filter EVERY historical reactivation would
 * stay a permanent per-tick candidate, each now costing a provider API call
 * once fully reconciled. To avoid that, the per-pairing loop below peeks at
 * audit-row existence (a single indexed SELECT, mirroring
 * {@link completeSupersessionPairing}'s own idempotency check) and skips the
 * expensive provider-consulting `completeSupersessionPairing` call entirely
 * for pairings already known to be done — the working set of EXPENSIVE work
 * is therefore proportional to genuinely open orphans, not lifetime
 * reactivations, even though the outer candidate query itself does not
 * (yet) filter on completion. A SQL-level `NOT EXISTS` filter on the outer
 * query would shrink the candidate query too; deferred alongside the
 * partial-unique-index follow-up (see the shared module's TODO) as a
 * non-blocking optimization.
 *
 * ### Shared implementation (AC-7 single-source discipline)
 *
 * The actual cancel-attempt + re-verify + audit-insert logic is NOT
 * duplicated here — both this cron and the webhook call the same
 * {@link completeSupersessionPairing} (`services/billing/reactivation-supersession-complete.ts`).
 * This cron's own job is limited to: finding candidate `(N, S)` pairs,
 * skipping already-audited ones cheaply, and calling the shared function for
 * the rest.
 *
 * ### `clearEntitlementCache` (INV-1)
 *
 * The webhook path already clears the customer's entitlement cache once per
 * activation (`subscription-logic.ts`, unconditionally, before the
 * supersession step even runs). This cron is a DIFFERENT code path that can
 * also mutate a subscription's cancellation state via a successful
 * `completeSupersessionPairing` call, so per `apps/api/CLAUDE.md` INV-1 it
 * must clear the cache itself after a successful reconcile-cancel — NOT
 * inside the shared function (which would double-clear on the webhook path).
 *
 * ### Schedule choice
 *
 * Hourly (`0 * * * *`), NOT the 6-hourly cadence used by the (display-only)
 * `featured-by-entitlement-reconcile` backstop. This job protects MONEY
 * correctness — an orphaned pairing means the OLD MercadoPago preapproval
 * can keep charging the customer in parallel with the new one — so it
 * mirrors `abandoned-pending-subs`'s hourly billing-correctness cadence
 * instead, minimizing the window a stuck pairing can double-charge before
 * an automated retry.
 *
 * @module cron/jobs/reactivation-supersession-reconcile
 */

import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createMercadoPagoAdapter } from '@repo/billing';
import { billingSubscriptionEvents, billingSubscriptions, getDb, isNull } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { and, eq, sql } from 'drizzle-orm';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { completeSupersessionPairing } from '../../services/billing/reactivation-supersession-complete.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Stable `providerEventId` sentinel written to audit rows completed by this
 * cron, distinguishing them from webhook-completed rows (which carry the
 * real MercadoPago event id).
 */
const RECONCILE_PROVIDER_EVENT_ID = 'reactivation-supersession-reconcile-cron';

/** Job/log identifier, also used as the `source` tag on completed audit rows. */
const JOB_NAME = 'reactivation-supersession-reconcile';

/**
 * Infers the reactivation flavor from the markers `TrialService`'s two
 * reactivate methods stamp on the NEW subscription's metadata — mirrors the
 * identical inference in `subscription-logic.ts::completeReactivationSupersession`.
 */
function inferTriggerSource(
    metadata: Record<string, unknown>
): 'trial-reactivation' | 'subscription-reactivation' {
    return metadata.convertedFromTrial === 'true'
        ? 'trial-reactivation'
        : 'subscription-reactivation';
}

/** Parses the (possibly comma-joined) `supersedesSubscriptionId` metadata value. */
function parseSupersededIds(metadata: Record<string, unknown>): string[] {
    const raw = metadata.supersedesSubscriptionId;
    if (typeof raw !== 'string' || raw.trim() === '') {
        return [];
    }
    return raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
}

/**
 * Reactivation supersession reconciliation cron job (HOS-114 T-016).
 *
 * Timeout: 10 minutes — generous; every check is a fast indexed-PK lookup
 * or the shared pairing-completion routine, which itself makes at most one
 * provider `cancel` call and one provider status read per genuinely open
 * orphan (already-audited pairings are skipped before reaching it).
 */
export const reactivationSupersessionReconcileJob: CronJobDefinition = {
    name: JOB_NAME,
    description:
        'Backstop for HOS-114 paid reactivations: cancels + audits any superseded subscription the webhook left orphaned (e.g. a transient provider cancel failure), covering both the trial and lapsed-reactivation flows regardless of the superseded subscription local status.',
    schedule: '0 * * * *',
    enabled: true,
    timeoutMs: 600_000, // 10 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('reactivation-supersession-reconcile: starting', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        let checkedPairs = 0;
        let corrected = 0;
        let errors = 0;

        try {
            const billing = getQZPayBilling();
            if (!billing) {
                logger.info(
                    'reactivation-supersession-reconcile: billing not configured, skipping'
                );
                return {
                    success: true,
                    message: 'Billing not configured — skipped',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            // The cron creates its own MP adapter (same pattern as
            // subscription-poll.job.ts / webhook-retry.job.ts) — required so
            // completeSupersessionPairing can consult the PROVIDER's live
            // status for a superseded subscription with a known
            // mpSubscriptionId, not just the (potentially stale) local row.
            let paymentAdapter: QZPayMercadoPagoAdapter;
            try {
                paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });
            } catch (adapterError) {
                logger.warn(
                    'reactivation-supersession-reconcile: failed to construct MercadoPago adapter, skipping run',
                    {
                        error:
                            adapterError instanceof Error
                                ? adapterError.message
                                : String(adapterError)
                    }
                );
                return {
                    success: true,
                    message: 'MercadoPago adapter unavailable — skipped',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            const db = getDb();

            // Step 1: candidate `active` subscriptions carrying a
            // `supersedesSubscriptionId` marker (single id or comma-joined
            // list). Deliberately NOT filtered on the superseded
            // subscription's local status — see the module JSDoc's "Orphan
            // definition" section for why that used to be a bug.
            const candidateRows = await db
                .select({
                    id: billingSubscriptions.id,
                    customerId: billingSubscriptions.customerId,
                    planId: billingSubscriptions.planId,
                    metadata: billingSubscriptions.metadata
                })
                .from(billingSubscriptions)
                .where(
                    and(
                        eq(billingSubscriptions.status, SubscriptionStatusEnum.ACTIVE),
                        isNull(billingSubscriptions.deletedAt),
                        sql`${billingSubscriptions.metadata}->>'supersedesSubscriptionId' IS NOT NULL`
                    )
                );

            logger.info('reactivation-supersession-reconcile: candidate subscriptions found', {
                count: candidateRows.length
            });

            for (const row of candidateRows) {
                const metadata = (row.metadata ?? {}) as Record<string, unknown>;
                const supersededIds = parseSupersededIds(metadata);
                if (supersededIds.length === 0) {
                    continue;
                }

                const triggerSource = inferTriggerSource(metadata);

                for (const supersededId of supersededIds) {
                    checkedPairs++;

                    try {
                        // Cheap pre-filter: skip pairings already audited
                        // (by the webhook OR a prior cron run) BEFORE paying
                        // for a provider call — bounds the expensive work to
                        // genuinely open orphans (see module JSDoc).
                        const [existingAuditRow] = await db
                            .select({ id: billingSubscriptionEvents.id })
                            .from(billingSubscriptionEvents)
                            .where(
                                and(
                                    eq(billingSubscriptionEvents.subscriptionId, row.id),
                                    sql`${billingSubscriptionEvents.metadata}->>'supersededSubscriptionId' = ${supersededId}`
                                )
                            )
                            .limit(1);

                        if (existingAuditRow) {
                            // Already correctly superseded — left alone.
                            continue;
                        }

                        if (dryRun) {
                            corrected++;
                            logger.info(
                                'reactivation-supersession-reconcile: dry-run — orphaned pairing detected',
                                { newSubscriptionId: row.id, supersededId }
                            );
                            continue;
                        }

                        const outcome = await completeSupersessionPairing({
                            billing,
                            paymentAdapter,
                            db,
                            newSubscription: {
                                id: row.id,
                                customerId: row.customerId,
                                planId: row.planId
                            },
                            supersededId,
                            triggerSource,
                            providerEventId: RECONCILE_PROVIDER_EVENT_ID,
                            source: JOB_NAME
                        });

                        if (outcome === 'completed') {
                            corrected++;

                            // INV-1: this cron just cancelled a superseded
                            // subscription — a money-mutating lifecycle
                            // event. The webhook path clears this cache
                            // unconditionally elsewhere; this is a DIFFERENT
                            // path (cron-driven), so it must clear it too, or
                            // the customer keeps seeing stale entitlements
                            // until the in-memory cache TTL expires.
                            clearEntitlementCache(row.customerId);

                            // Finding (and fixing) an orphan here is itself the
                            // actionable signal: the webhook path left this
                            // pairing unfinished (most likely a transient
                            // provider cancel failure).
                            logger.error(
                                'reactivation-supersession-reconcile: completed an orphaned pairing the webhook left unfinished (indicates a webhook cancel failure upstream)',
                                { newSubscriptionId: row.id, supersededId },
                                { capture: true }
                            );
                        } else if (outcome === 'error' || outcome === 'cancel-did-not-take') {
                            errors++;
                        }
                    } catch (pairError) {
                        errors++;
                        logger.warn(
                            'reactivation-supersession-reconcile: error processing pairing (skipping)',
                            {
                                newSubscriptionId: row.id,
                                supersededId,
                                error:
                                    pairError instanceof Error
                                        ? pairError.message
                                        : String(pairError)
                            }
                        );
                    }
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('reactivation-supersession-reconcile: completed', {
                totalCandidates: candidateRows.length,
                checkedPairs,
                corrected,
                errors,
                durationMs,
                dryRun
            });

            return {
                success: true,
                message: dryRun
                    ? `Dry run — ${corrected} orphaned pairing(s) would be corrected out of ${checkedPairs} checked`
                    : `Corrected ${corrected} orphaned pairing(s) out of ${checkedPairs} checked`,
                processed: checkedPairs,
                errors,
                durationMs,
                details: {
                    totalCandidates: candidateRows.length,
                    checkedPairs,
                    corrected,
                    errors,
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            // Fatal failure (e.g. DB not initialized, initial query threw) →
            // forward to Sentry so it is actionable.
            logger.error(
                'reactivation-supersession-reconcile: fatal error',
                { error: errorMessage, stack: errorStack },
                { capture: true }
            );

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Reconciliation failed: ${errorMessage}`,
                processed: checkedPairs,
                errors,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};
