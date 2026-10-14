import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockEnd, mockClock, mockProvider, mockReader, mockCoveragePorts, mockBuildPorts } =
    vi.hoisted(() => {
        const coveragePorts = { addonPolicy: vi.fn(), listing: vi.fn() };
        return {
            mockEnd: vi.fn(),
            mockReader: { findTrial: vi.fn() },
            mockCoveragePorts: coveragePorts,
            mockBuildPorts: vi.fn(() => ({ ports: coveragePorts })),
            mockClock: { now: vi.fn(() => new Date('2026-10-14T20:00:00.000Z')) },
            mockProvider: { readAuthorization: vi.fn() }
        };
    });

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    endScheduledServices: mockEnd
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock: mockClock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => mockProvider }));
// The real reader and coverage ports read `@repo/db`, which the API test setup mocks whole.
vi.mock('../../src/utils/listing-access/bootstrap-coverage-reader.js', () => ({
    createBootstrapCoverageReader: () => mockReader
}));
vi.mock('../../src/utils/listing-access/billing-coverage.js', () => ({
    buildBillingCoveragePorts: mockBuildPorts
}));

import { providerLinkCancellationSeen } from '@repo/service-core';
import { subscriptionServiceEndJob } from '../../src/cron/jobs/subscription-service-end.job';
import { beforeCancelNotice } from '../../src/routes/billing-subscription/before-cancel-notice';
import { getCoverageNotices } from '../../src/utils/listing-access/coverage-notices';

const context = (dryRun = false): CronJobContext => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    startedAt: new Date('2026-10-14T19:00:00.000Z'),
    runId: 'run-b8a-service-end',
    correlationId: '00000000-0000-4000-8000-00000000b8a2',
    dryRun
});

beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue({
        principals: { cancelled: 3, failed: 1 },
        complements: { cancelled: 2, failed: 0 },
        rows: []
    });
});

describe('HOS-1569 subscription-service-end cron (AC:B8a:5)', () => {
    it('(a) registers its name, cadence, enabled flag and timeout', () => {
        expect(subscriptionServiceEndJob).toMatchObject({
            name: 'subscription-service-end',
            schedule: '*/15 * * * *',
            enabled: true,
            timeoutMs: 120_000
        });
    });

    it('(b) calls endScheduledServices with limit 100 and the production ports', async () => {
        await subscriptionServiceEndJob.handler(context());

        expect(mockEnd).toHaveBeenCalledTimes(1);
        const [input, ports] = mockEnd.mock.calls[0] ?? [];
        expect(input).toStrictEqual({ limit: 100 });
        expect(ports.clock).toBe(mockClock);
        expect(ports.provider).toBe(mockProvider);
        // the ONE process-wide registry and the real notice adapter (identity, not shape)
        expect(ports.coverageNotices).toBe(getCoverageNotices());
        expect(ports.beforeCancelNotice).toBe(beforeCancelNotice);
        expect(ports.cancellationSeen).toBe(providerLinkCancellationSeen);
        expect(typeof ports.addonPolicy).toBe('function');
        expect(typeof ports.listing).toBe('function');
        // políticaDeAddon and ficha come from the production coverage ports over the real reader
        expect(mockBuildPorts).toHaveBeenCalledWith({ reader: mockReader });
        expect(ports.addonPolicy).toBe(mockCoveragePorts.addonPolicy);
        expect(ports.listing).toBe(mockCoveragePorts.listing);
        expect(ports.successionCloser).toBeUndefined();
    });

    it('(c) processed and errors come from the run summary', async () => {
        const result = await subscriptionServiceEndJob.handler(context());

        expect(result).toMatchObject({
            success: true,
            processed: 5,
            errors: 1,
            details: {
                principals: { cancelled: 3, failed: 1 },
                complements: { cancelled: 2, failed: 0 }
            }
        });
    });

    it('(d) a service throw is success: false with one error', async () => {
        mockEnd.mockRejectedValueOnce(new Error('database down'));

        const result = await subscriptionServiceEndJob.handler(context());

        expect(result).toMatchObject({
            success: false,
            processed: 0,
            errors: 1,
            details: { error: 'database down' }
        });
    });

    it('(e) does not call the service in dry run', async () => {
        const result = await subscriptionServiceEndJob.handler(context(true));

        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(mockEnd).not.toHaveBeenCalled();
    });
});
