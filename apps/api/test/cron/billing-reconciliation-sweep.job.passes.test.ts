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

import {
    createAmountComparison,
    createPeriodChargesComparison,
    createStateComparison,
    noDeterminableRetainedPaymentBranch,
    retainedPaymentsFromLedger
} from '@repo/service-core';
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
            expect.objectContaining({ correlationId: expect.any(String), lastSlot: true }),
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
        expect(mockPeriodChargesComparison).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: mockProvider,
                dailySummary: expect.objectContaining({ addUndercharge: expect.any(Function) })
            })
        );
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

    it('HOS-1999 AC-20: a budget stop with failed rows stays successful and does not page', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 5,
            runId: 'run-id',
            complete: false,
            pinged: false,
            stoppedOnBudget: true,
            skippedPasses: ['paidOrders', 'markEscalation'],
            rowsFailed: 2,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const result = await billingReconciliationSweepJob.handler(context());
        expect(result).toMatchObject({ success: true, details: { stoppedOnBudget: true } });
    });

    it('HOS-1999 AC-20: a clean budget stop stays green without paging', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 5,
            runId: 'run-id',
            complete: false,
            pinged: false,
            stoppedOnBudget: true,
            skippedPasses: ['creditedPayments', 'paidOrders', 'zeroCallChecks'],
            rowsFailed: 0,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const ctx = context();
        const result = await billingReconciliationSweepJob.handler(ctx);
        expect(result).toMatchObject({ success: true, details: { stoppedOnBudget: true } });
        expect(ctx.logger.error).not.toHaveBeenCalled();
    });
});
