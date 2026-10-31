import { beforeEach, describe, expect, it, vi } from 'vitest';
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

import {
    createAmountComparison,
    createPeriodChargesComparison,
    createStateComparison,
    creditedPaymentsFromLedger,
    noAmountMutationDecisions,
    noDeterminableRetainedPaymentBranch,
    providerLinkCancellationSeen,
    retainedPaymentsFromLedger,
    unregisteredPromoChargePolicy,
    unregisteredPromoExhaustion
} from '@repo/service-core';
import { billingReconciliationSweepJob } from '../../src/cron/jobs/billing-reconciliation-sweep.job';
import { beforeCancelNotice } from '../../src/routes/billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../src/routes/billing-subscription/tourist-vip-inheritance';
import { getAnalyticsFactSink } from '../../src/utils/analytics/analytics-facts';
import { getCoverageNotices } from '../../src/utils/listing-access/coverage-notices';

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
    });

    it('TEST:HOS-1589:2 wires promo services and the recorded amount decision reader', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'r',
            complete: true,
            pinged: false,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        await billingReconciliationSweepJob.handler(context());
        const gracePorts = mockGraceExpiryCheck.mock.calls[0]?.[0] as {
            promoCharges: unknown;
            promoExhaustion: unknown;
        };
        expect(gracePorts.promoCharges).toBeDefined();
        expect(gracePorts.promoCharges).not.toBe(unregisteredPromoChargePolicy);
        expect(gracePorts.promoExhaustion).toBeDefined();
        expect(gracePorts.promoExhaustion).not.toBe(unregisteredPromoExhaustion);
        const amountPorts = mockAmountComparison.mock.calls[0]?.[0] as { mutations: unknown };
        expect(amountPorts.mutations).toBeDefined();
        expect(amountPorts.mutations).not.toBe(noAmountMutationDecisions);
    });

    it('registers the daily job metadata', () => {
        expect(billingReconciliationSweepJob).toMatchObject({
            name: 'billing-reconciliation-sweep',
            schedule: '0 6 * * *',
            enabled: true,
            timeoutMs: 600_000
        });
    });

    it('wires pause gifts and the persisted undercharge summary (TEST:1607:7)', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'r',
            complete: true,
            pinged: false,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const ctx = context();
        await billingReconciliationSweepJob.handler(ctx);
        expect(mockSweep.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ pauseGifts: {} }));
        expect(mockPeriodChargesComparison).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: mockProvider,
                dailySummary: expect.objectContaining({ addUndercharge: expect.any(Function) })
            })
        );
    });

    it('TEST:1731:9 injects provider and clock and maps summary counters', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 8,
            runId: 'run-id',
            complete: false,
            pinged: false,
            rowsFailed: 2,
            divergences: 1,
            marksOpened: 1,
            marksAccumulated: 0,
            failures: [{ subscriptionId: 'failed-id', message: 'read failed' }],
            zeroCallChecks: { results: [], failures: [] },
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const result = await billingReconciliationSweepJob.handler(context());
        expect(mockSweep).toHaveBeenCalledWith(
            { correlationId: expect.any(String) },
            expect.objectContaining({
                provider: mockProvider,
                clock: mockClock,
                rowChecks: [
                    expect.any(Function),
                    expect.any(Function),
                    expect.any(Function),
                    expect.any(Function),
                    expect.any(Function),
                    expect.any(Function)
                ],
                zeroCallChecks: {
                    retainedPayments: retainedPaymentsFromLedger,
                    retainedPaymentBranches: noDeterminableRetainedPaymentBranch,
                    addonOrphanhood: {
                        addonPolicy: expect.any(Function),
                        listing: expect.any(Function),
                        listingPurged: expect.any(Function)
                    }
                },
                livenessPing: expect.any(Object)
            })
        );
        // AC:B7:4: the successor grace check runs S6 with the real ledger and coverage registry.
        expect(mockSuccessorGraceCheck).toHaveBeenCalledTimes(1);
        expect(mockSuccessorGraceCheck).toHaveBeenCalledWith({
            provider: mockProvider,
            clock: mockClock,
            beforeCancelNotice,
            payments: creditedPaymentsFromLedger,
            coverageNotices: getCoverageNotices(),
            billingFacts: getAnalyticsFactSink(),
            complements: mockComplementPorts
        });
        // I-3: the successor grace check runs before the expiry check.
        const rowChecks = mockSweep.mock.calls[0]?.[1]?.rowChecks;
        expect(rowChecks?.[0]).toBe(mockProviderPauseCheck.mock.results[0]?.value);
        expect(rowChecks?.[1]).toBe(mockLostFirstRejectionCheck.mock.results[0]?.value);
        expect(rowChecks?.[2]).toBe(mockPendingFirstChargeDeclineCheck.mock.results[0]?.value);
        expect(rowChecks?.[3]).toBe(mockSuccessorGraceCheck.mock.results[0]?.value);
        expect(rowChecks?.[4]).toBe(mockGraceExpiryCheck.mock.results[0]?.value);
        // HOS-1685: the next charge date copy runs last.
        expect(rowChecks?.[5]).toBe(mockNextChargeSync.mock.results[0]?.value);
        expect(mockLostFirstRejectionCheck).toHaveBeenCalledWith({
            provider: mockProvider,
            clock: mockClock,
            payments: creditedPaymentsFromLedger,
            planPolicy: mockPlanPolicy,
            billingFacts: getAnalyticsFactSink()
        });
        expect(mockPendingFirstChargeDeclineCheck).toHaveBeenCalledWith({
            provider: mockProvider,
            clock: mockClock,
            beforeCancelNotice,
            payments: creditedPaymentsFromLedger,
            coverageNotices: getCoverageNotices(),
            cancellationSeen: providerLinkCancellationSeen
        });
        expect(mockProviderPauseCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                planPolicy: mockPlanPolicy,
                billingFacts: getAnalyticsFactSink(),
                payments: creditedPaymentsFromLedger,
                coverageNotices: getCoverageNotices(),
                complements: mockComplementPorts
            })
        );
        // AC:B7:8: the grace expiry check settles a charged period with the real ledger and plan policy.
        expect(mockGraceExpiryCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: mockProvider,
                clock: mockClock,
                beforeCancelNotice: expect.objectContaining({ beforeCancel: expect.any(Function) }),
                payments: creditedPaymentsFromLedger,
                planPolicy: mockPlanPolicy,
                billingFacts: getAnalyticsFactSink(),
                complements: mockComplementPorts
            })
        );
        // HOS-1533: S6 and P1 notify the ONE process-wide coverage registry, never the unwired default.
        expect(
            (mockGraceExpiryCheck.mock.calls[0]?.[0] as { coverageNotices?: unknown })
                .coverageNotices
        ).toBe(getCoverageNotices());
        // AC:B7:31: S7, reached by settling a charged period, gets the real inheritance port.
        expect(
            (mockGraceExpiryCheck.mock.calls[0]?.[0] as { touristVipInheritance?: unknown })
                .touristVipInheritance
        ).toBe(touristVipInheritance);
        expect(mockGraceExpiryCheck.mock.calls[0]?.[0]).not.toHaveProperty(
            'unresolvedPeriodCharges'
        );
        expect(result).toMatchObject({ processed: 8, errors: 2, success: false });
        expect(result.details).toHaveProperty('failedSubscriptionIds', ['failed-id']);
        expect(result.details).toMatchObject({ runId: 'run-id', complete: false, pinged: false });
        expect(result.details).toHaveProperty('zeroCallChecks', { results: [], failedChecks: [] });
        expect(result.details).not.toHaveProperty('failures');
    });

    it('wires mark escalation into the sweep (TEST:1607:4)', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'run-id',
            complete: true,
            pinged: false,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        await billingReconciliationSweepJob.handler(context());
        expect(mockSweep).toHaveBeenCalledWith(
            { correlationId: expect.any(String) },
            expect.objectContaining({ markEscalation: { notice: {} } })
        );
    });

    it('TEST:1685:7 the sweep copies the provider next payment date, last', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'run-id',
            complete: true,
            pinged: true,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });

        await billingReconciliationSweepJob.handler(context());

        const rowChecks = mockSweep.mock.calls[0]?.[1]?.rowChecks;
        expect(mockNextChargeSync).toHaveBeenCalledTimes(1);
        expect(rowChecks?.[5]).toBe(mockNextChargeSync.mock.results[0]?.value);
        expect(rowChecks?.[0]).toBe(mockProviderPauseCheck.mock.results[0]?.value);
        expect(rowChecks?.[1]).toBe(mockLostFirstRejectionCheck.mock.results[0]?.value);
        expect(rowChecks?.[2]).toBe(mockPendingFirstChargeDeclineCheck.mock.results[0]?.value);
        expect(rowChecks?.[3]).toBe(mockSuccessorGraceCheck.mock.results[0]?.value);
        expect(rowChecks?.[4]).toBe(mockGraceExpiryCheck.mock.results[0]?.value);
    });

    it('TEST:B11:7 / TEST:B11:9 / TEST:B11:8 wiring passes three comparisons in order', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'run-id',
            complete: true,
            pinged: true,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });

        await billingReconciliationSweepJob.handler(context());

        const comparisons = mockSweep.mock.calls[0]?.[1]?.comparisons;
        expect(comparisons).toEqual([
            mockStateComparison.mock.results[0]?.value,
            mockPeriodChargesComparison.mock.results[0]?.value,
            mockAmountComparison.mock.results[0]?.value
        ]);
        expect(comparisons?.[0]).toBe(mockStateComparison.mock.results[0]?.value);
        expect(comparisons?.[1]).toBe(mockPeriodChargesComparison.mock.results[0]?.value);
        expect(comparisons?.[2]).toBe(mockAmountComparison.mock.results[0]?.value);
        expect(mockPeriodChargesComparison).toHaveBeenCalledWith({
            provider: mockProvider,
            dailySummary: expect.objectContaining({ addUndercharge: expect.any(Function) })
        });
        expect(mockAmountComparison).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: mockProvider,
                clock: mockClock,
                mutations: expect.objectContaining({ findLatest: expect.any(Function) })
            })
        );
        expect(createStateComparison).toBe(mockStateComparison);
        expect(createPeriodChargesComparison).toBe(mockPeriodChargesComparison);
        expect(createAmountComparison).toBe(mockAmountComparison);
    });

    it('TEST:B7:10 l wires the S19 retention ports into the zero-call check (HOS-1561 H11, Coord-74)', async () => {
        // Arrange
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'run-id',
            complete: true,
            pinged: true,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });

        // Act
        await billingReconciliationSweepJob.handler(context());

        // Assert
        const ports = mockSweep.mock.calls[0]?.[1] as {
            zeroCallChecks?: { retainedPayments?: unknown; retainedPaymentBranches?: unknown };
            markPayments?: unknown;
        };
        expect(ports.zeroCallChecks?.retainedPayments).toBe(retainedPaymentsFromLedger);
        expect(ports.zeroCallChecks?.retainedPaymentBranches).toBe(
            noDeterminableRetainedPaymentBranch
        );
        // The mark opened for a retained payment hangs it through the real ledger port.
        expect(ports.markPayments).toEqual({
            hang: expect.any(Function),
            countUnresolved: expect.any(Function)
        });
    });

    it('counts zero-call check failures in the job result', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 4,
            runId: 'run-id',
            complete: false,
            pinged: false,
            rowsFailed: 1,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [{ subscriptionId: 'row', message: 'failed' }],
            zeroCallChecks: {
                results: [],
                failures: [
                    {
                        check: 'PAYMENT_PENDING_WITHOUT_BRANCH',
                        subjectId: null,
                        message: 'port absent'
                    }
                ]
            },
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const result = await billingReconciliationSweepJob.handler(context());
        expect(result).toMatchObject({ success: false, processed: 4, errors: 2 });
        expect(result.details).toMatchObject({
            zeroCallChecks: { failedChecks: ['PAYMENT_PENDING_WITHOUT_BRANCH'] }
        });
        expect(result.details?.zeroCallChecks).not.toHaveProperty('failures');
    });

    it('preserves existing counters when the summary omits zero-call checks', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 3,
            runId: 'run-id',
            complete: true,
            pinged: true,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const result = await billingReconciliationSweepJob.handler(context());
        expect(result).toMatchObject({ success: true, processed: 3, errors: 0 });
        expect(result.details).not.toHaveProperty('zeroCallChecks');
    });

    it('hands the cancellation retry port to the sweep (HOS-1603, AC:B11:6)', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 1,
            runId: 'run-id',
            complete: true,
            pinged: true,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        await billingReconciliationSweepJob.handler(context());
        const ports = mockSweep.mock.calls[0]?.[1] as {
            cancellationRetry?: { beforeCancelNotice?: unknown };
        };
        expect(ports.cancellationRetry?.beforeCancelNotice).toBe(beforeCancelNotice);
    });

    it('hands the B4 cancellation-seen annotator to the sweep (TEST:1606:4)', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'run-id',
            complete: true,
            pinged: true,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        await billingReconciliationSweepJob.handler(context());
        const ports = mockSweep.mock.calls[0]?.[1] as { cancellationSeen?: unknown };
        expect(ports.cancellationSeen).toBe(providerLinkCancellationSeen);
    });

    it('hands the terminal return port the cancellation notice without adding a row check (TEST:1606:6)', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 0,
            runId: 'run-id',
            complete: true,
            pinged: true,
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        await billingReconciliationSweepJob.handler(context());
        const ports = mockSweep.mock.calls[0]?.[1] as {
            cancellationRetry?: { beforeCancelNotice?: unknown };
            terminalReturn?: { beforeCancelNotice?: unknown };
            rowChecks?: readonly unknown[];
        };
        expect(ports.terminalReturn?.beforeCancelNotice).toBe(
            ports.cancellationRetry?.beforeCancelNotice
        );
        expect(ports.terminalReturn?.beforeCancelNotice).toBe(beforeCancelNotice);
        expect(ports.rowChecks).toHaveLength(6);
    });

    it('fails the job when the cancellation retry failed a row (HOS-1603, AC:B11:6)', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 2,
            runId: 'run-id',
            complete: false,
            pinged: false,
            rowsFailed: 1,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [{ subscriptionId: 'retried-row', message: 'read failed' }],
            cancellationRetry: {
                stopped: 0,
                confirmed: 0,
                marked: 0,
                noticePending: 0,
                callFailed: 0,
                sentUnconfirmed: 0,
                rowsRead: 0,
                rowsFailed: 1
            },
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const result = await billingReconciliationSweepJob.handler(context());
        expect(result).toMatchObject({ success: false, errors: 1 });
        expect(result.details).toHaveProperty('failedSubscriptionIds', ['retried-row']);
        expect(result.details).toMatchObject({ cancellationRetry: { rowsFailed: 1 } });
    });

    it('runs the credited payments check and maps its counters (HOS-1605, AC:B11:12, AC:B11:27)', async () => {
        // Arrange
        mockSweep.mockResolvedValue({
            rowsRead: 4,
            runId: 'run-id',
            complete: false,
            pinged: false,
            rowsFailed: 1,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [{ subscriptionId: 'paid-row', message: 'charge not found' }],
            creditedPayments: {
                examined: 3,
                chargebacks: 1,
                outOfFlowRefunds: 1,
                alreadyOpen: 0,
                failures: [
                    { paymentId: 'payment-id', subscriptionId: 'paid-row', message: 'not found' }
                ]
            },
            startedAt: new Date(),
            finishedAt: new Date()
        });

        // Act
        const result = await billingReconciliationSweepJob.handler(context());

        // Assert
        expect(mockSweep).toHaveBeenCalledWith(
            { correlationId: expect.any(String) },
            expect.objectContaining({ creditedPayments: {}, paidOrders: {} })
        );
        expect(result).toMatchObject({ success: false, processed: 4, errors: 1 });
        expect(result.details).toHaveProperty('failedSubscriptionIds', ['paid-row']);
        expect(result.details).toMatchObject({
            creditedPayments: { examined: 3, chargebacks: 1, outOfFlowRefunds: 1 }
        });
    });

    it('does not call the service during dry run', async () => {
        const result = await billingReconciliationSweepJob.handler(context(true));
        expect(result).toMatchObject({
            success: true,
            processed: 0,
            errors: 0,
            details: { dryRun: true }
        });
        expect(mockSweep).not.toHaveBeenCalled();
    });

    it('reports a thrown service error as one failed job', async () => {
        mockSweep.mockRejectedValue(new Error('service failed'));
        const result = await billingReconciliationSweepJob.handler(context());
        expect(result).toMatchObject({ success: false, processed: 0, errors: 1 });
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
