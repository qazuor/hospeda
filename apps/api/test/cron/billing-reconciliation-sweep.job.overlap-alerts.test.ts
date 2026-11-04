import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const {
    mockSweep,
    mockClock,
    mockProvider,
    mockPlanPolicy,
    mockComplementPorts,
    mockGraceExpiryCheck,
    mockProviderPauseCheck,
    mockLostFirstRejectionCheck,
    mockPendingFirstChargeDeclineCheck,
    mockSuccessorGraceCheck,
    mockNextChargeSync,
    mockStateComparison,
    mockPeriodChargesComparison,
    mockAmountComparison
} = vi.hoisted(() => ({
    mockSuccessorGraceCheck: vi.fn((_ports: unknown) => async () => undefined),
    mockNextChargeSync: vi.fn((_ports?: unknown) => async () => undefined),
    mockSweep: vi.fn(),
    mockClock: { now: vi.fn(() => new Date('2026-10-11T12:00:00.000Z')) },
    mockProvider: { readAuthorization: vi.fn() },
    mockPlanPolicy: vi.fn(),
    mockComplementPorts: {
        addonPolicy: vi.fn(),
        listing: vi.fn(),
        liveAnchors: { hasLiveAnchor: vi.fn() }
    },
    mockGraceExpiryCheck: vi.fn((_ports: unknown) => async () => undefined),
    mockStateComparison: vi.fn(() => ({ kind: 'state-comparison' })),
    mockPeriodChargesComparison: vi.fn((_ports: unknown) => ({
        kind: 'period-charges-comparison'
    })),
    mockAmountComparison: vi.fn((_ports: unknown) => ({ kind: 'amount-comparison' })),
    mockProviderPauseCheck: vi.fn((_ports: unknown) => async () => undefined),
    mockLostFirstRejectionCheck: vi.fn((_ports: unknown) => async () => undefined),
    mockPendingFirstChargeDeclineCheck: vi.fn((_ports: unknown) => async () => undefined)
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    runReconciliationSweep: mockSweep,
    createSweepPacedProvider: (input: { readonly provider: unknown }) => input.provider,
    createGraceExpiryCheck: mockGraceExpiryCheck,
    createNextChargeSync: mockNextChargeSync,
    createProviderPauseCheck: mockProviderPauseCheck,
    createLostFirstRejectionCheck: mockLostFirstRejectionCheck,
    createPendingFirstChargeDeclineCheck: mockPendingFirstChargeDeclineCheck,
    createSuccessorGraceCheck: mockSuccessorGraceCheck,
    createStateComparison: mockStateComparison,
    createPeriodChargesComparison: mockPeriodChargesComparison,
    createAmountComparison: mockAmountComparison
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));
vi.mock('../../src/utils/billing-complement-ports.js', () => ({
    buildComplementPolicyPorts: () => mockComplementPorts
}));
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return { ...createDbMock(), planCatalogModel: {} };
});
vi.mock('@repo/verticals', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/verticals')>()),
    createPlanCatalogInverse: () => ({ planPolicy: mockPlanPolicy, addonPolicy: mockPlanPolicy })
}));

import { billingReconciliationSweepJob } from '../../src/cron/jobs/billing-reconciliation-sweep.job';

function context(dryRun = false): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-10-11T12:00:00.000Z'),
        runId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        dryRun
    };
}

describe('billing reconciliation sweep cron', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // The job reads the wall clock to decide the last slot: pin it after the final slot so
        // the suite does not depend on the hour it runs at (02:10-04:10 market time is not last).
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('HOS-1885 F1: the alert the retired dunning job carried', () => {
        const base = {
            rowsRead: 5,
            runId: 'r',
            complete: true,
            pinged: false,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            startedAt: new Date(),
            finishedAt: new Date()
        };

        it('captures to Sentry when billing rows fail the sweep', async () => {
            mockSweep.mockResolvedValue({
                ...base,
                rowsFailed: 2,
                failures: [{ subscriptionId: 'sub-1' }, { subscriptionId: 'sub-2' }]
            });
            const ctx = context();
            await billingReconciliationSweepJob.handler(ctx);
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'Billing reconciliation sweep had failures',
                expect.objectContaining({
                    rowsFailed: 2,
                    failedSubscriptionIds: ['sub-1', 'sub-2']
                }),
                { capture: true }
            );
        });

        it('HOS-1999 AC-24: three slices of one cycle emit exactly one failure alert, from the DONE slice', async () => {
            const slice = (overrides: Record<string, unknown>) => ({
                ...base,
                failures: [],
                rowsFailed: 0,
                skippedPasses: [],
                stoppedOnBudget: false,
                ...overrides
            });
            const ctxs = [context(), context(), context()];
            mockSweep
                .mockResolvedValueOnce(
                    slice({
                        outcome: 'TIMED_OUT',
                        stoppedOnBudget: true,
                        rowsFailed: 1,
                        failures: [{ subscriptionId: 'sub-a' }],
                        sliceIndex: 0
                    })
                )
                .mockResolvedValueOnce(
                    slice({ outcome: 'TIMED_OUT', stoppedOnBudget: true, sliceIndex: 1 })
                )
                .mockResolvedValueOnce(
                    slice({
                        outcome: 'CYCLE_DONE',
                        rowsFailed: 1,
                        failures: [{ subscriptionId: 'sub-c' }],
                        sliceIndex: 2,
                        rowsComplete: true,
                        cycle: {
                            cycleId: 'c',
                            slices: 3,
                            rowsRead: 9,
                            rowsFailed: 2,
                            failedSubscriptionIds: ['sub-a', 'sub-c']
                        }
                    })
                );
            const results = [];
            for (const ctx of ctxs) results.push(await billingReconciliationSweepJob.handler(ctx));
            const alerts = ctxs.flatMap((ctx) =>
                vi
                    .mocked(ctx.logger.error)
                    .mock.calls.filter(
                        ([message]) => message === 'Billing reconciliation sweep had failures'
                    )
            );
            expect(alerts).toHaveLength(1);
            expect(alerts[0]?.[1]).toMatchObject({ failedSubscriptionIds: ['sub-a', 'sub-c'] });
            expect(alerts[0]?.[2]).toEqual({ capture: true });
            expect(results[0]?.success).toBe(true);
            expect(results[1]?.success).toBe(true);
        });

        it('HOS-1999: a cycle closing with failed rows that carry no subscription id still alerts and is never green', async () => {
            mockSweep.mockResolvedValue({
                ...base,
                outcome: 'CYCLE_DONE',
                rowsFailed: 2,
                failures: [],
                stoppedOnBudget: false,
                skippedPasses: [],
                cycle: {
                    cycleId: 'c',
                    slices: 3,
                    rowsRead: 9,
                    rowsFailed: 2,
                    failedSubscriptionIds: []
                }
            });
            const ctx = context();
            const result = await billingReconciliationSweepJob.handler(ctx);
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'Billing reconciliation sweep had failures',
                expect.objectContaining({ rowsFailed: 2 }),
                { capture: true }
            );
            expect(result.success).toBe(false);
        });

        it('HOS-1999: a skipped last slot says the cycle may be unfinished', async () => {
            mockSweep.mockResolvedValue({
                ...base,
                skipped: 'lease_held',
                rowsRead: 0,
                rowsFailed: 0,
                failures: []
            });
            const ctx = { ...context(), newCycle: true };
            const result = await billingReconciliationSweepJob.handler(ctx);
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'reconciliation last slot skipped: another slice holds the lease',
                expect.anything(),
                { capture: true }
            );
            expect(result.details).toMatchObject({ skipped: 'lease_held', outcome: null });
        });

        it('HOS-1999: captures an orphaned cycle with failed rows and warns when it has no failures', async () => {
            mockSweep.mockResolvedValue({
                ...base,
                rowsFailed: 0,
                failures: [],
                orphanedCycle: {
                    cycleId: 'orphan-with-failures',
                    cycleDate: '2026-11-04',
                    slices: 1,
                    rowsRead: 3,
                    rowsFailed: 1,
                    failedSubscriptionIds: ['sub-failed']
                }
            });
            const failedContext = context();
            const failedResult = await billingReconciliationSweepJob.handler(failedContext);
            expect(failedContext.logger.error).toHaveBeenCalledWith(
                'forced newCycle abandoned unfinished cycle orphan-with-failures',
                expect.objectContaining({
                    failedSubscriptionIds: ['sub-failed'],
                    forcedNewCycle: true
                }),
                { capture: true }
            );
            expect(failedResult.success).toBe(true);

            mockSweep.mockResolvedValue({
                ...base,
                rowsFailed: 0,
                failures: [],
                orphanedCycle: {
                    cycleId: 'orphan-clean',
                    cycleDate: '2026-11-04',
                    slices: 1,
                    rowsRead: 3,
                    rowsFailed: 0,
                    failedSubscriptionIds: []
                }
            });
            const cleanContext = context();
            const cleanResult = await billingReconciliationSweepJob.handler(cleanContext);
            expect(cleanContext.logger.warn).toHaveBeenCalledWith(
                'forced newCycle abandoned unfinished cycle orphan-clean',
                expect.objectContaining({ rowsFailed: 0, forcedNewCycle: true })
            );
            expect(cleanContext.logger.error).not.toHaveBeenCalledWith(
                expect.stringContaining('orphan-clean'),
                expect.anything(),
                { capture: true }
            );
            expect(cleanResult.success).toBe(true);
        });

        it('HOS-1999: the overlap hook alerts only at the last slot', () => {
            const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
            billingReconciliationSweepJob.onOverlapSkipped?.({
                logger,
                startedAt: new Date('2026-11-04T07:10:00.000Z'),
                holderRunId: 'holder',
                holderStartedAt: null,
                holderExecutionMode: null
            });
            expect(logger.error).toHaveBeenCalledWith(
                'reconciliation last slot skipped: another run still holds the lock',
                expect.objectContaining({ holderRunId: 'holder', holderAgeMs: null }),
                { capture: true }
            );
            logger.error.mockClear();
            billingReconciliationSweepJob.onOverlapSkipped?.({
                logger,
                startedAt: new Date('2026-11-04T07:10:00.000Z'),
                holderRunId: 'stale-holder',
                holderStartedAt: new Date('2026-11-04T06:00:00.000Z'),
                holderExecutionMode: 'scheduled'
            });
            expect(logger.error).toHaveBeenCalledWith(
                'reconciliation last slot skipped: another run still holds the lock',
                expect.objectContaining({ holderRunId: 'stale-holder', holderAgeMs: 70 * 60_000 }),
                { capture: true }
            );
            logger.error.mockClear();
            billingReconciliationSweepJob.onOverlapSkipped?.({
                logger,
                startedAt: new Date('2026-11-04T07:10:00.000Z'),
                holderRunId: 'same-slot',
                holderStartedAt: new Date('2026-11-04T07:09:30.000Z'),
                holderExecutionMode: 'scheduled'
            });
            expect(logger.error).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalled();
            billingReconciliationSweepJob.onOverlapSkipped?.({
                logger,
                startedAt: new Date('2026-11-04T05:10:00.000Z'),
                holderRunId: null,
                holderStartedAt: null,
                holderExecutionMode: null
            });
            expect(logger.error).not.toHaveBeenCalled();
        });

        it('HOS-1999: a MANUAL holder near the last slot still alerts (it may stop on budget unfinished)', () => {
            const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
            for (const holderExecutionMode of ['manual', null] as const) {
                logger.error.mockClear();
                billingReconciliationSweepJob.onOverlapSkipped?.({
                    logger,
                    startedAt: new Date('2026-11-04T07:10:00.000Z'),
                    holderRunId: 'manual-run',
                    holderStartedAt: new Date('2026-11-04T07:05:00.000Z'),
                    holderExecutionMode
                });
                expect(logger.error).toHaveBeenCalledWith(
                    'reconciliation last slot skipped: another run still holds the lock',
                    expect.objectContaining({ holderRunId: 'manual-run', holderExecutionMode }),
                    { capture: true }
                );
            }
            expect(logger.info).not.toHaveBeenCalled();
        });

        it('captures to Sentry when only a zero-call check fails', async () => {
            mockSweep.mockResolvedValue({
                ...base,
                rowsFailed: 0,
                failures: [],
                zeroCallChecks: { results: [], failures: [{ check: 'addon-orphanhood' }] }
            });
            const ctx = context();
            await billingReconciliationSweepJob.handler(ctx);
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'Billing reconciliation sweep had failures',
                expect.objectContaining({ failedChecks: ['addon-orphanhood'] }),
                { capture: true }
            );
        });

        it('stays silent on a clean sweep', async () => {
            mockSweep.mockResolvedValue({ ...base, rowsFailed: 0, failures: [] });
            const ctx = context();
            await billingReconciliationSweepJob.handler(ctx);
            expect(ctx.logger.error).not.toHaveBeenCalled();
        });

        it('captures a thrown sweep to Sentry', async () => {
            mockSweep.mockRejectedValue(new Error('service failed'));
            const ctx = context();
            await billingReconciliationSweepJob.handler(ctx);
            expect(ctx.logger.error).toHaveBeenCalledWith(
                'Billing reconciliation sweep failed',
                { error: 'service failed' },
                { capture: true }
            );
        });
    });
});
