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
    mockSuccessorGraceCheck,
    mockStateComparison,
    mockPeriodChargesComparison,
    mockAmountComparison
} = vi.hoisted(() => ({
    mockSuccessorGraceCheck: vi.fn((_ports: unknown) => async () => undefined),
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
    mockLostFirstRejectionCheck: vi.fn((_ports: unknown) => async () => undefined)
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    runReconciliationSweep: mockSweep,
    createGraceExpiryCheck: mockGraceExpiryCheck,
    createProviderPauseCheck: mockProviderPauseCheck,
    createLostFirstRejectionCheck: mockLostFirstRejectionCheck,
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
    createPlanCatalogInverse: () => ({ planPolicy: mockPlanPolicy })
}));

import {
    createAmountComparison,
    createPeriodChargesComparison,
    createStateComparison,
    creditedPaymentsFromLedger,
    noDeterminableRetainedPaymentBranch,
    retainedPaymentsFromLedger
} from '@repo/service-core';
import { billingReconciliationSweepJob } from '../../src/cron/jobs/billing-reconciliation-sweep.job';
import { beforeCancelNotice } from '../../src/routes/billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../src/routes/billing-subscription/tourist-vip-inheritance';
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

    it('registers the daily job metadata', () => {
        expect(billingReconciliationSweepJob).toMatchObject({
            name: 'billing-reconciliation-sweep',
            schedule: '0 6 * * *',
            enabled: true,
            timeoutMs: 600_000
        });
    });

    it('injects provider and clock and maps summary counters', async () => {
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
                    expect.any(Function)
                ],
                zeroCallChecks: {
                    retainedPayments: retainedPaymentsFromLedger,
                    retainedPaymentBranches: noDeterminableRetainedPaymentBranch
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
            complements: mockComplementPorts
        });
        // I-3: the successor grace check runs before the expiry check.
        const rowChecks = mockSweep.mock.calls[0]?.[1]?.rowChecks;
        expect(rowChecks?.[0]).toBe(mockProviderPauseCheck.mock.results[0]?.value);
        expect(rowChecks?.[1]).toBe(mockLostFirstRejectionCheck.mock.results[0]?.value);
        expect(rowChecks?.[2]).toBe(mockSuccessorGraceCheck.mock.results[0]?.value);
        expect(rowChecks?.[3]).toBe(mockGraceExpiryCheck.mock.results[0]?.value);
        expect(mockProviderPauseCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                planPolicy: mockPlanPolicy,
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
        expect(result.details).not.toHaveProperty('failures');
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
        expect(mockPeriodChargesComparison).toHaveBeenCalledWith({ provider: mockProvider });
        expect(mockAmountComparison).toHaveBeenCalledWith({
            provider: mockProvider,
            clock: mockClock
        });
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
});
