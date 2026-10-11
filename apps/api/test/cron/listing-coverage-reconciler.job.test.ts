import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runDailyCoverageReconciler } = vi.hoisted(() => ({ runDailyCoverageReconciler: vi.fn() }));
vi.mock('@repo/verticals', () => ({
    DAILY_COVERAGE_RECONCILER_JOB: 'listing-coverage-reconciler',
    runDailyCoverageReconciler
}));
vi.mock('../../src/utils/listing-publication/reconciler-ports.js', () => ({
    getListingReconcilerPorts: vi.fn(() => ({}))
}));

import { listingCoverageReconcilerJob } from '../../src/cron/jobs/listing-coverage-reconciler.job';

function context(dryRun: boolean) {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-10-11T05:00:00Z'),
        runId: 'run',
        correlationId: 'corr',
        dryRun
    };
}

describe('listing coverage reconciler cron', () => {
    beforeEach(() => runDailyCoverageReconciler.mockReset());

    it('dry run skips the reconciler', async () => {
        const result = await listingCoverageReconcilerJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(runDailyCoverageReconciler).not.toHaveBeenCalled();
    });

    it('reports complete and incomplete runs with failure user ids only', async () => {
        runDailyCoverageReconciler
            .mockResolvedValueOnce({
                pairsRead: 4,
                ran: 2,
                lowered: 1,
                restored: 1,
                partnerChecked: 1,
                partnerInvalidated: 1,
                failures: [],
                complete: true,
                pinged: true
            })
            .mockResolvedValueOnce({
                pairsRead: 4,
                ran: 1,
                lowered: 0,
                restored: 0,
                partnerChecked: 0,
                partnerInvalidated: 0,
                failures: [
                    { userId: 'u-failed', vertical: 'accommodation', error: new Error('private') }
                ],
                complete: false,
                pinged: false
            });
        const good = await listingCoverageReconcilerJob.handler(context(false));
        const partial = await listingCoverageReconcilerJob.handler(context(false));
        expect(good.success).toBe(true);
        expect(partial).toMatchObject({
            success: false,
            errors: 1,
            details: { failures: ['u-failed'] }
        });
        expect(JSON.stringify(partial.details)).not.toContain('private');
    });

    it('reports a thrown orchestration error', async () => {
        runDailyCoverageReconciler.mockRejectedValueOnce(new Error('failed'));
        expect(await listingCoverageReconcilerJob.handler(context(false))).toMatchObject({
            success: false,
            errors: 1
        });
    });
});
