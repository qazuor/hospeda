import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockExpire, mockPorts, mockClock } = vi.hoisted(() => ({
    mockExpire: vi.fn(),
    mockPorts: { unitOfWork: {}, scanner: {}, afterCommit: {} },
    mockClock: { now: vi.fn(() => new Date('2026-10-08T20:00:00.000Z')) }
}));
vi.mock('@repo/verticals', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/verticals')>()),
    expireDueTrials: mockExpire
}));
vi.mock('../../src/utils/trial/trial-machine-ports', () => ({
    getTrialMachinePorts: () => mockPorts
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));

import { VerticalEnum } from '@repo/schemas';
import { trialMachineExpiryJob } from '../../src/cron/jobs/trial-machine-expiry.job';
import {
    resetAnalyticsFactSinkForTests,
    setAnalyticsFactSinkForTests
} from '../../src/utils/analytics/analytics-facts';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-08T19:00:00.000Z'),
    runId: 'trial-machine-expiry-run',
    correlationId: '00000000-0000-4000-8000-00000000c0de',
    dryRun
});

beforeEach(() => {
    vi.clearAllMocks();
    mockExpire.mockResolvedValue({ expired: 2, skipped: 1, failed: 0 });
});
afterEach(resetAnalyticsFactSinkForTests);

describe('trial-machine-expiry T3 cron', () => {
    it('dry run makes no machine call', async () => {
        const result = await trialMachineExpiryJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0 });
        expect(mockExpire).not.toHaveBeenCalled();
    });

    it('TEST:1878:14 runs a 100-row batch and emits trial expiry at endsAt', async () => {
        expect(trialMachineExpiryJob).toMatchObject({
            name: 'trial-machine-expiry',
            schedule: '*/15 * * * *',
            enabled: true,
            timeoutMs: 120_000
        });
        const result = await trialMachineExpiryJob.handler(context());
        expect(mockExpire).toHaveBeenCalledWith({
            ...mockPorts,
            clock: mockClock,
            batchSize: 100,
            onTrialExpired: expect.any(Function)
        });
        const emit = vi.fn();
        setAnalyticsFactSinkForTests({ emit });
        const callback = mockExpire.mock.calls[0]?.[0].onTrialExpired as (trial: {
            userId: string;
            vertical: typeof VerticalEnum.ACCOMMODATION;
            trialId: string;
            startedAt: Date;
            endsAt: Date;
        }) => void;
        const startedAt = new Date('2026-10-01T00:00:00.000Z');
        const endsAt = new Date('2026-10-08T00:00:00.000Z');
        callback({
            userId: 'user-1',
            vertical: VerticalEnum.ACCOMMODATION,
            trialId: 'trial-1',
            startedAt,
            endsAt
        });
        expect(emit).toHaveBeenCalledWith({
            kind: 'TRIAL_EXPIRED',
            userId: 'user-1',
            vertical: VerticalEnum.ACCOMMODATION,
            actorKind: 'SYSTEM',
            trialId: 'trial-1',
            trialDays: 7,
            occurredAt: endsAt
        });
        expect(result).toMatchObject({
            success: true,
            processed: 2,
            errors: 0,
            details: { expired: 2, skipped: 1, failed: 0 }
        });
    });

    it('reports row failures', async () => {
        mockExpire.mockResolvedValue({ expired: 2, skipped: 1, failed: 1 });
        expect(await trialMachineExpiryJob.handler(context())).toMatchObject({
            success: false,
            processed: 2,
            errors: 1
        });
    });

    it('reports an exception without throwing', async () => {
        mockExpire.mockRejectedValue(new Error('database unavailable'));
        expect(await trialMachineExpiryJob.handler(context())).toMatchObject({
            success: false,
            message: 'Trial expiry failed: database unavailable'
        });
    });
});
