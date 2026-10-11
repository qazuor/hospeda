import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { sweep, clock, provider } = vi.hoisted(() => ({
    sweep: vi.fn(),
    clock: { now: vi.fn(() => new Date()) },
    provider: { searchAuthorizations: vi.fn() }
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    runCreationsSweep: sweep
}));
vi.mock('../../src/utils/clock.js', () => ({ getClock: () => ({ clock }) }));
vi.mock('../../src/utils/payment-provider.js', () => ({ getPaymentProvider: () => provider }));
vi.mock('../../src/utils/env.js', () => ({
    env: { HOSPEDA_SITE_URL: 'https://site.example.test' }
}));

import { billingCreationsSweepJob } from '../../src/cron/jobs/billing-creations-sweep.job';

function context(dryRun = false): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        runId: 'run',
        correlationId: 'corr',
        dryRun
    };
}
describe('billing creations sweep cron', () => {
    beforeEach(() => vi.clearAllMocks());
    it('declares its schedule', () =>
        expect(billingCreationsSweepJob).toMatchObject({
            name: 'billing-creations-sweep',
            schedule: '*/5 * * * *',
            enabled: true,
            timeoutMs: 120_000
        }));
    it('injects ports and maps the summary', async () => {
        sweep.mockResolvedValue({
            rowsExamined: 4,
            rowsFailed: 1,
            failures: [{ subscriptionId: 'x', message: 'bad' }],
            startedAt: new Date(),
            finishedAt: new Date(),
            linked: 1,
            duplicatesCancelled: 2
        });
        const result = await billingCreationsSweepJob.handler(context());
        expect(sweep).toHaveBeenCalledWith(
            { correlationId: 'corr' },
            { provider, clock, returnUrl: 'https://site.example.test' }
        );
        expect(result).toMatchObject({ success: false, processed: 4, errors: 1 });
        expect(result.details).toHaveProperty('failedSubscriptionIds', ['x']);
        expect(result.details).not.toHaveProperty('failures');
    });
    it('supports dry run and translates thrown errors', async () => {
        expect(await billingCreationsSweepJob.handler(context(true))).toMatchObject({
            success: true,
            details: { dryRun: true }
        });
        sweep.mockRejectedValue(new Error('sweep failed'));
        expect(await billingCreationsSweepJob.handler(context())).toMatchObject({
            success: false,
            errors: 1,
            message: expect.stringContaining('sweep failed')
        });
    });
});
