import { planCatalogModel } from '@repo/db';
import {
    createAmountComparison,
    createGraceExpiryCheck,
    createLostFirstRejectionCheck,
    createNextChargeSync,
    createPaymentReconciliationMarkPayments,
    createPeriodChargesComparison,
    createProviderPauseCheck,
    createStateComparison,
    createSuccessorGraceCheck,
    creditedPaymentsFromLedger,
    noDeterminableRetainedPaymentBranch,
    retainedPaymentsFromLedger,
    runReconciliationSweep
} from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { beforeCancelNotice } from '../../routes/billing-subscription/before-cancel-notice.js';
import { touristVipInheritance } from '../../routes/billing-subscription/tourist-vip-inheritance.js';
import { getClock } from '../../utils/clock.js';
import { createSentryCronMonitorPing } from '../../utils/cron-monitor-ping.js';
import { buildBillingCoveragePorts } from '../../utils/listing-access/billing-coverage.js';
import { createBootstrapCoverageReader } from '../../utils/listing-access/bootstrap-coverage-reader.js';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices.js';
import { getPaymentProvider } from '../../utils/payment-provider.js';
import type { CronJobDefinition } from '../types.js';

/** HOS-1602, AC:B11:1: reconcile the owned billing inventory every day. */
export const billingReconciliationSweepJob: CronJobDefinition = {
    name: 'billing-reconciliation-sweep',
    description:
        'Read owned billing inventory by provider id and open marks for divergences (HOS-1602, AC:B11:1)',
    schedule: '0 6 * * *',
    enabled: true,
    timeoutMs: 600_000,

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
            const provider = getPaymentProvider();
            const clock = getClock().clock;
            const { planPolicy } = createPlanCatalogInverse({ reader: planCatalogModel });
            const { addonPolicy, listing } = buildBillingCoveragePorts({
                reader: createBootstrapCoverageReader()
            }).ports;
            const summary = await runReconciliationSweep(
                { correlationId: ctx.correlationId },
                {
                    provider,
                    clock,
                    comparisons: [
                        createStateComparison(),
                        createPeriodChargesComparison({ provider }),
                        createAmountComparison({ provider, clock })
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
                            touristVipInheritance
                        }),
                        createLostFirstRejectionCheck({
                            provider,
                            clock,
                            payments: creditedPaymentsFromLedger,
                            planPolicy
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
                            coverageNotices: getCoverageNotices()
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
                            coverageNotices: getCoverageNotices(),
                            // AC:B7:31: a charged period settled on a SUSPENDED row runs S7, whose
                            // clause cancels a paid Tourist VIP the restored plan grants again.
                            touristVipInheritance
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
                        addonOrphanhood: { addonPolicy, listing }
                    },
                    // The mark opened for a retained payment hangs it (AC:B5:32); without
                    // the real ledger port each one fails as "not registered". The sweep
                    // hands it to the comparisons and the zero-call checks.
                    markPayments: createPaymentReconciliationMarkPayments(clock),
                    // AC:B11:6: retry our decided cancellations for 3 days, then mark 16.
                    cancellationRetry: { beforeCancelNotice },
                    // AC:B11:12, AC:B11:27: re-read credited payments with the real defaults.
                    creditedPayments: {},
                    // AC:B11:13: zero population until B10 writes order keys.
                    paidOrders: {},
                    livenessPing: createSentryCronMonitorPing()
                }
            );
            const { failures, ...details } = summary;
            const zeroCallFailures = summary.zeroCallChecks?.failures ?? [];
            const { failures: _zeroCallFailures, ...zeroCallDetails } = summary.zeroCallChecks ?? {
                results: [],
                failures: []
            };
            return {
                success: summary.rowsFailed === 0,
                message: `Processed ${summary.rowsRead} billing subscriptions`,
                processed: summary.rowsRead,
                errors: summary.rowsFailed + zeroCallFailures.length,
                durationMs: Date.now() - startedAt.getTime(),
                details: {
                    ...details,
                    failedSubscriptionIds: failures.map(({ subscriptionId }) => subscriptionId),
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
            logger.error('Billing reconciliation sweep failed', { error: message });
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
