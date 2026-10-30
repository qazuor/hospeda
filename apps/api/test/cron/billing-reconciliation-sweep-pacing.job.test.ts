import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockProvider, pacedProvider, mockPaced, mockSweep, factories } = vi.hoisted(() => {
    const provider = { sentinel: 'original' };
    const paced = { sentinel: 'paced' };
    return {
        mockProvider: provider,
        pacedProvider: paced,
        mockPaced: vi.fn(() => paced),
        mockSweep: vi.fn(),
        factories: {
            period: vi.fn((ports: unknown) => ({ kind: 'period', ports })),
            amount: vi.fn((ports: unknown) => ({ kind: 'amount', ports })),
            pause: vi.fn((_ports: unknown) => async () => undefined),
            lost: vi.fn((_ports: unknown) => async () => undefined),
            pending: vi.fn((_ports: unknown) => async () => undefined),
            successor: vi.fn((_ports: unknown) => async () => undefined),
            grace: vi.fn((_ports: unknown) => async () => undefined),
            promo: vi.fn((ports: unknown) => ({ kind: 'promo', ports }))
        }
    };
});

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    createSweepPacedProvider: mockPaced,
    runReconciliationSweep: mockSweep,
    createPeriodChargesComparison: factories.period,
    createAmountComparison: factories.amount,
    createProviderPauseCheck: factories.pause,
    createLostFirstRejectionCheck: factories.lost,
    createPendingFirstChargeDeclineCheck: factories.pending,
    createSuccessorGraceCheck: factories.successor,
    createGraceExpiryCheck: factories.grace,
    createPromoExhaustion: factories.promo
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: { now: vi.fn() } }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));
vi.mock('../../src/utils/billing-complement-ports.js', () => ({
    buildComplementPolicyPorts: () => ({ addonPolicy: {}, listing: {}, liveAnchors: {} })
}));
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return { ...createDbMock(), planCatalogModel: {} };
});
vi.mock('@repo/verticals', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/verticals')>()),
    createPlanCatalogInverse: () => ({ planPolicy: {}, addonPolicy: {} })
}));

import { RECONCILIATION_SWEEP_PROVIDER_PACING } from '@repo/service-core';
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

function summary() {
    return {
        rowsRead: 0,
        runId: 'run',
        complete: true,
        pinged: false,
        rowsFailed: 0,
        divergences: 0,
        marksOpened: 0,
        marksAccumulated: 0,
        failures: [],
        startedAt: new Date(),
        finishedAt: new Date()
    };
}

describe('TEST:1737 reconciliation sweep job pacing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPaced.mockReturnValue(pacedProvider);
        mockSweep.mockResolvedValue(summary());
    });

    it('TEST:1737:18 passes one paced provider to the sweep and every provider factory', async () => {
        await billingReconciliationSweepJob.handler(context());
        expect(mockPaced).toHaveBeenCalledTimes(1);
        expect(mockPaced).toHaveBeenCalledWith({
            provider: mockProvider,
            pacing: RECONCILIATION_SWEEP_PROVIDER_PACING
        });
        const ports = mockSweep.mock.calls[0]?.[1] as { provider: unknown };
        expect(ports.provider).toBe(pacedProvider);

        for (const factory of Object.values(factories)) {
            const providerPorts = factory.mock.calls.map(
                ([value]) => value as { provider?: unknown }
            );
            expect(providerPorts.some((value) => value.provider === pacedProvider)).toBe(true);
            expect(providerPorts.some((value) => value.provider === mockProvider)).toBe(false);
        }
    });

    it('TEST:1737:19 creates one budget per run and skips it in dry-run mode', async () => {
        await billingReconciliationSweepJob.handler(context());
        await billingReconciliationSweepJob.handler(context());
        expect(mockPaced).toHaveBeenCalledTimes(2);
        mockPaced.mockClear();
        await billingReconciliationSweepJob.handler(context(true));
        expect(mockPaced).not.toHaveBeenCalled();
    });
});
