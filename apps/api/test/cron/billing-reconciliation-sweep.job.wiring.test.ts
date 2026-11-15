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
        // The job reads the wall clock to decide the last slot: pin it after the final slot so
        // the suite does not depend on the hour it runs at (02:10-04:10 market time is not last).
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
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
            schedule: '10 2,3,4 * * *',
            enabled: true,
            timeoutMs: 3_000_000,
            budgetMs: 2_700_000,
            exclusive: true
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
            expect.objectContaining({
                correlationId: expect.any(String),
                newCycle: undefined,
                lastSlot: true,
                deadlineAt: undefined
            }),
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
                        listingPurged: expect.any(Function),
                        listingPurgedAddons: {
                            cancelPurgedListingAddon: expect.any(Function)
                        }
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
        expect(mockLostFirstRejectionCheck).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: mockProvider,
                clock: mockClock,
                payments: creditedPaymentsFromLedger,
                planPolicy: mockPlanPolicy,
                billingFacts: getAnalyticsFactSink()
            })
        );
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
});
