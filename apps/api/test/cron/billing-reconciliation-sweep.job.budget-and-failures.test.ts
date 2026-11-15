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

import { providerLinkCancellationSeen } from '@repo/service-core';
import { billingReconciliationSweepJob } from '../../src/cron/jobs/billing-reconciliation-sweep.job';
import { beforeCancelNotice } from '../../src/routes/billing-subscription/before-cancel-notice';

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

    it('fails closed and captures a slice that lost its lease after failed work', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 3,
            runId: 'run-id',
            cycleId: 'cycle-id',
            sliceIndex: 1,
            complete: false,
            leaseLost: true,
            pinged: false,
            rowsFailed: 1,
            divergences: 0,
            marksOpened: 0,
            marksAccumulated: 0,
            failures: [{ subscriptionId: 'failed-subscription', message: 'provider failure' }],
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const ctx = context();
        const result = await billingReconciliationSweepJob.handler(ctx);
        expect(result).toMatchObject({ success: false, processed: 3, errors: 1 });
        expect(result.details).toMatchObject({
            leaseLost: true,
            failedSubscriptionIds: ['failed-subscription']
        });
        expect(ctx.logger.error).toHaveBeenCalledWith(
            'reconciliation slice lost its lease',
            expect.objectContaining({
                rowsFailed: 1,
                failedSubscriptionIds: ['failed-subscription']
            }),
            { capture: true }
        );
    });

    it('does not report a budget stop when the sweep finished', async () => {
        mockSweep.mockResolvedValue({
            rowsRead: 1,
            runId: 'run-id',
            complete: true,
            pinged: true,
            stoppedOnBudget: false,
            skippedPasses: [],
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
        expect(ctx.logger.error).not.toHaveBeenCalledWith(
            'Billing reconciliation sweep stopped on its budget',
            expect.anything(),
            expect.anything()
        );
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

    it('counts failed provider cancellations as errors (HOS-1995)', async () => {
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
            cancellationRetry: {
                stopped: 0,
                confirmed: 0,
                marked: 0,
                noticePending: 0,
                callFailed: 3,
                sentUnconfirmed: 0,
                rowsRead: 3,
                rowsFailed: 0
            },
            startedAt: new Date(),
            finishedAt: new Date()
        });
        const ctx = context();
        const result = await billingReconciliationSweepJob.handler(ctx);
        expect(result).toMatchObject({ errors: 3, success: false });
        // The per-row capture carries the detail; the job must not add a second Sentry event.
        expect(ctx.logger.error).toHaveBeenCalledWith(
            'Billing reconciliation sweep had failures',
            expect.anything(),
            { capture: false }
        );
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
            expect.objectContaining({ correlationId: expect.any(String), lastSlot: true }),
            expect.objectContaining({
                creditedPayments: expect.objectContaining({
                    chargebacks: expect.objectContaining({ detect: expect.any(Function) })
                }),
                paidOrders: {}
            })
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
