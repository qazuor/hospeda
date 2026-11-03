import { planCatalogModel } from '@repo/db';
import {
    createAmountComparison,
    createGraceExpiryCheck,
    createLostFirstRejectionCheck,
    createNextChargeSync,
    createPaymentReconciliationMarkPayments,
    createPendingFirstChargeDeclineCheck,
    createPeriodChargesComparison,
    createPersistedReconciliationDailySummary,
    createPromoChargePolicy,
    createPromoExhaustion,
    createProviderPauseCheck,
    createRecordedAmountMutationDecisions,
    createStateComparison,
    createSuccessorGraceCheck,
    createSweepPacedProvider,
    creditedPaymentsFromLedger,
    noDeterminableRetainedPaymentBranch,
    providerLinkCancellationSeen,
    RECONCILIATION_SWEEP_PROVIDER_PACING,
    retainedPaymentsFromLedger,
    runReconciliationSweep
} from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { touristVipInheritance } from '../../routes/billing-subscription/tourist-vip-inheritance.js';
import { getAnalyticsFactSink } from '../../utils/analytics/analytics-facts.js';
import { buildComplementPolicyPorts } from '../../utils/billing-complement-ports.js';
import { getClock } from '../../utils/clock.js';
import { createSentryCronMonitorPing } from '../../utils/cron-monitor-ping.js';
import { buildBillingCoveragePorts } from '../../utils/listing-access/billing-coverage.js';
import { createBootstrapCoverageReader } from '../../utils/listing-access/bootstrap-coverage-reader.js';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices.js';
import { createApiListingInverse } from '../../utils/listing-publication/listing-inverse.js';
import { isMercadoPagoGovernorEnforcing } from '../../utils/mp-traffic-governor.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import { isLastSlot } from '../last-slot.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1602, AC:B11:1: reconcile the owned billing inventory every day. */
export const billingReconciliationSweepJob: CronJobDefinition = {
    name: 'billing-reconciliation-sweep',
    description:
        'Read owned billing inventory by provider id and open marks for divergences (HOS-1602, AC:B11:1)',
    schedule: '10 2,3,4 * * *',
    exclusive: true,
    acceptsNewCycle: true,
    budgetMs: 2_700_000,
    enabled: true,
    timeoutMs: 3_000_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;
        if (dryRun) {
            logger.info('Dry run mode - skipping billing reconciliation sweep');
            return {
                success: true,
                message: 'Dry run - no billing inventory reconciled',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { dryRun: true }
            };
        }
        try {
            // HOS-1737 gives this sweep run its own paced provider instance.
            const provider = createSweepPacedProvider({
                provider: getPaymentProvider(),
                pacing: RECONCILIATION_SWEEP_PROVIDER_PACING,
                retryOwnership: isMercadoPagoGovernorEnforcing() ? 'governor' : 'legacy'
            });
            const clock = getClock().clock;
            const lastSlot = isLastSlot({
                schedule: billingReconciliationSweepJob.schedule,
                now: new Date(),
                newCycle: ctx.newCycle === true
            });
            const { planPolicy } = createPlanCatalogInverse({ reader: planCatalogModel });
            const { addonPolicy, listing } = buildBillingCoveragePorts({
                reader: createBootstrapCoverageReader()
            }).ports;
            const complements = buildComplementPolicyPorts();
            const summary = await runReconciliationSweep(
                {
                    correlationId: ctx.correlationId,
                    signal: ctx.signal,
                    newCycle: ctx.newCycle,
                    lastSlot,
                    deadlineAt: ctx.deadlineAt,
                    budgetClock: () => new Date()
                },
                {
                    provider,
                    clock,
                    comparisons: [
                        createStateComparison(),
                        createPeriodChargesComparison({
                            provider,
                            dailySummary: createPersistedReconciliationDailySummary({
                                correlationId: ctx.correlationId,
                                clock
                            })
                        }),
                        createAmountComparison({
                            provider,
                            clock,
                            mutations: createRecordedAmountMutationDecisions()
                        })
                    ],
                    rowChecks: [
                        // AC:B7:9 (DEC-MP-008): grace never outlasts a provider pause.
                        createProviderPauseCheck({
                            provider,
                            clock,
                            beforeCancelNotice,
                            payments: creditedPaymentsFromLedger,
                            planPolicy,
                            coverageNotices: getCoverageNotices(),
                            billingFacts: getAnalyticsFactSink(),
                            touristVipInheritance,
                            complements
                        }),
                        createLostFirstRejectionCheck({
                            provider,
                            clock,
                            payments: creditedPaymentsFromLedger,
                            planPolicy,
                            billingFacts: getAnalyticsFactSink()
                        }),
                        createPendingFirstChargeDeclineCheck({
                            provider,
                            clock,
                            beforeCancelNotice,
                            payments: creditedPaymentsFromLedger,
                            coverageNotices: getCoverageNotices(),
                            cancellationSeen: providerLinkCancellationSeen
                        }),
                        // AC:B7:4 (DEC-SUB-022): the successor of a paying predecessor that
                        // entered grace has its preapproval re-read every day; `cancelled` or
                        // `paused` ends that grace by S6 (fifth / second event). Before the
                        // expiry check, which takes the row once its clock ran out (D-12).
                        createSuccessorGraceCheck({
                            provider,
                            clock,
                            beforeCancelNotice,
                            payments: creditedPaymentsFromLedger,
                            coverageNotices: getCoverageNotices(),
                            billingFacts: getAnalyticsFactSink(),
                            complements
                        }),
                        // AC:B7:7/AC:B7:8: S6 when the grace clock ran out, or P1 + S5 when the
                        // period charged. The coverage notice goes to the process-wide registry
                        // (HOS-1533). S6's S19 guard is its real default (an open retention of
                        // the row, HOS-1561); cancellation-seen and the DEC-OBS-001 channel stay
                        // on their defaults until B11/B13a wire them.
                        createGraceExpiryCheck({
                            provider,
                            clock,
                            beforeCancelNotice,
                            payments: creditedPaymentsFromLedger,
                            planPolicy,
                            billingFacts: getAnalyticsFactSink(),
                            coverageNotices: getCoverageNotices(),
                            // AC:B7:31: a charged period settled on a SUSPENDED row runs S7, whose
                            // clause cancels a paid Tourist VIP the restored plan grants again.
                            touristVipInheritance,
                            complements,
                            promoCharges: createPromoChargePolicy(),
                            promoExhaustion: createPromoExhaustion({ provider, clock })
                        }),
                        // HOS-1685, CRIT:1685:2: copy the provider's next payment date onto the ACTIVE card row. Last, so no check above sees a value this run moved (H4).
                        createNextChargeSync()
                    ],
                    // B11.8's second zero-call check (Coord-74, HOS-1561 H11): the open S19
                    // retentions and a resolver that never finds a branch, so a retention
                    // whose succession ended without its act opens PAGO_PENDIENTE_SIN_RAMA.
                    zeroCallChecks: {
                        retainedPayments: retainedPaymentsFromLedger,
                        retainedPaymentBranches: noDeterminableRetainedPaymentBranch,
                        // B10 registers A6; until then the unimplemented boundary opens the red mark.
                        addonOrphanhood: {
                            addonPolicy,
                            listing,
                            listingPurged: createApiListingInverse().listingPurged
                        }
                    },
                    // The mark opened for a retained payment hangs it (AC:B5:32); without
                    // the real ledger port each one fails as "not registered". The sweep
                    // hands it to the comparisons and the zero-call checks.
                    markPayments: createPaymentReconciliationMarkPayments(clock),
                    // AC:B11:6: retry our decided cancellations for 3 days, then mark 16.
                    cancellationRetry: { beforeCancelNotice },
                    cancellationSeen: providerLinkCancellationSeen,
                    terminalReturn: { beforeCancelNotice },
                    // AC:B11:12, AC:B11:27: re-read credited payments with the real defaults.
                    creditedPayments: {},
                    // AC:B11:13: zero population until B10 writes order keys.
                    paidOrders: {},
                    markEscalation: { notice: {} },
                    pauseGifts: {},
                    livenessPing: createSentryCronMonitorPing()
                }
            );
            if (summary.leaseLost) {
                // Another slice closed this one after it had worked: never green, keep the evidence.
                const lostFailedIds = summary.failures.map(({ subscriptionId }) => subscriptionId);
                logger.error(
                    'reconciliation slice lost its lease',
                    {
                        runId: summary.runId,
                        cycleId: summary.cycleId,
                        sliceIndex: summary.sliceIndex,
                        rowsRead: summary.rowsRead,
                        rowsFailed: summary.rowsFailed,
                        failedSubscriptionIds: lostFailedIds
                    },
                    { capture: true }
                );
                return {
                    success: false,
                    message: 'Reconciliation slice lost its lease',
                    processed: summary.rowsRead,
                    errors: Math.max(summary.rowsFailed, 1),
                    durationMs: Date.now() - startedAt.getTime(),
                    details: {
                        leaseLost: true,
                        outcome: summary.outcome,
                        failedSubscriptionIds: lostFailedIds
                    }
                };
            }
            if (summary.skipped) {
                return {
                    success: true,
                    message: `Reconciliation sweep skipped: ${summary.skipped}`,
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { skipped: summary.skipped, outcome: summary.outcome }
                };
            }
            const { failures, ...details } = summary;
            const outcome =
                summary.outcome ?? (summary.stoppedOnBudget ? 'TIMED_OUT' : 'CYCLE_DONE');
            const zeroCallFailures = summary.zeroCallChecks?.failures ?? [];
            const { failures: _zeroCallFailures, ...zeroCallDetails } = summary.zeroCallChecks ?? {
                results: [],
                failures: []
            };
            // HOS-1885 (F1): the alert the retired `dunning` job carried. Billing rows
            // that fail the daily read, or a zero-call check that fails, page Sentry
            // at error level; the bootstrap soft-failure only covers `rowsFailed`.
            // HOS-1995: a provider cancel that failed is an error too, not a silent outcome.
            const cancelCallFailed = summary.cancellationRetry?.callFailed ?? 0;
            const cancellationRowsFailed = summary.cancellationRetry?.rowsFailed ?? 0;
            const cycleFailedIds =
                summary.cycle?.failedSubscriptionIds ??
                failures.map(({ subscriptionId }) => subscriptionId);
            if (
                outcome === 'CYCLE_DONE' &&
                (cycleFailedIds.length > 0 || zeroCallFailures.length > 0 || cancelCallFailed > 0)
            ) {
                logger.error(
                    'Billing reconciliation sweep had failures',
                    {
                        rowsFailed: summary.rowsFailed,
                        cancelCallFailed,
                        failedSubscriptionIds:
                            cycleFailedIds.length > 0
                                ? cycleFailedIds
                                : failures.map(({ subscriptionId }) => subscriptionId),
                        failedChecks: zeroCallFailures.map(({ check }) => check)
                    },
                    { capture: cycleFailedIds.length > 0 || zeroCallFailures.length > 0 }
                );
            }
            const incomplete = summary.incomplete ?? false;
            if (incomplete) {
                logger.error(
                    'reconciliation cycle incomplete',
                    { cycleId: summary.cycleId, sliceIndex: summary.sliceIndex },
                    { capture: true }
                );
            } else if (outcome === 'CYCLE_DONE' && lastSlot && (summary.sliceIndex ?? 0) > 0) {
                logger.warn('reconciliation cycle near capacity', {
                    cycleId: summary.cycleId,
                    slices: summary.cycle?.slices
                });
            }
            return {
                success:
                    !incomplete &&
                    outcome !== 'FAILED' &&
                    cancelCallFailed === 0 &&
                    cancellationRowsFailed === 0,
                message: `Processed ${summary.rowsRead} billing subscriptions`,
                processed: summary.rowsRead,
                errors: summary.rowsFailed + zeroCallFailures.length + cancelCallFailed,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    ...details,
                    stoppedOnBudget: summary.stoppedOnBudget,
                    failedSubscriptionIds: cycleFailedIds,
                    ...(summary.zeroCallChecks
                        ? {
                              zeroCallChecks: {
                                  ...zeroCallDetails,
                                  failedChecks: zeroCallFailures.map(({ check }) => check)
                              }
                          }
                        : {})
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(
                'Billing reconciliation sweep failed',
                { error: message },
                { capture: true }
            );
            return {
                success: false,
                message: `Billing reconciliation sweep failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: {}
            };
        }
    }
};
