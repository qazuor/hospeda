import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runRemoteDeletionRetry } = vi.hoisted(() => ({ runRemoteDeletionRetry: vi.fn() }));
vi.mock('@repo/verticals', () => ({
    REMOTE_DELETION_RETRY_JOB: 'listing-remote-deletion-retry',
    runRemoteDeletionRetry
}));
vi.mock('../../src/utils/listing-publication/remote-deletion-retry-ports.js', () => ({
    getRemoteDeletionRetryPorts: vi.fn(() => ({}))
}));

import { listingRemoteDeletionRetryJob } from '../../src/cron/jobs/listing-remote-deletion-retry.job';

function context(dryRun: boolean) {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-10-11T05:45:00Z'),
        runId: 'run',
        correlationId: 'corr',
        dryRun
    };
}

function summary(overrides: Record<string, unknown> = {}) {
    return {
        mediaRead: 2,
        mediaDeleted: 2,
        calendarRead: 1,
        calendarDeleted: 1,
        failures: [],
        complete: true,
        pinged: true,
        ...overrides
    };
}

describe('AC:V6:30 listing remote deletion retry cron', () => {
    beforeEach(() => runRemoteDeletionRetry.mockReset());

    it('is scheduled daily at 05:45 under the shared job name', () => {
        expect(listingRemoteDeletionRetryJob).toMatchObject({
            name: 'listing-remote-deletion-retry',
            schedule: '45 5 * * *',
            enabled: true,
            timeoutMs: 600_000
        });
    });

    it('dry run skips the retry', async () => {
        const result = await listingRemoteDeletionRetryJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(runRemoteDeletionRetry).not.toHaveBeenCalled();
    });

    it('logs one error per surviving pending deletion and fails the run', async () => {
        runRemoteDeletionRetry.mockResolvedValueOnce(
            summary({
                mediaDeleted: 1,
                calendarDeleted: 0,
                failures: [
                    {
                        kind: 'media',
                        id: 'media-1',
                        vertical: 'accommodation',
                        error: new Error('storage down')
                    },
                    { kind: 'calendar', id: 'conn-1', error: new Error('provider down') }
                ]
            })
        );
        const ctx = context(false);
        const result = await listingRemoteDeletionRetryJob.handler(ctx);
        expect(result).toMatchObject({ success: false, processed: 3, errors: 2 });
        expect(ctx.logger.error).toHaveBeenCalledTimes(2);
        expect(ctx.logger.error).toHaveBeenCalledWith('Listing remote deletion still pending', {
            kind: 'media',
            id: 'media-1',
            vertical: 'accommodation',
            error: 'storage down'
        });
        expect(ctx.logger.error).toHaveBeenCalledWith('Listing remote deletion still pending', {
            kind: 'calendar',
            id: 'conn-1',
            vertical: null,
            error: 'provider down'
        });
        expect(ctx.logger.info).toHaveBeenCalledOnce();
    });

    it('succeeds when the run is complete and nothing is left pending', async () => {
        runRemoteDeletionRetry.mockResolvedValueOnce(summary());
        const ctx = context(false);
        const result = await listingRemoteDeletionRetryJob.handler(ctx);
        expect(result).toMatchObject({ success: true, processed: 3, errors: 0 });
        expect(ctx.logger.error).not.toHaveBeenCalled();
    });

    it('fails an incomplete run', async () => {
        runRemoteDeletionRetry.mockResolvedValueOnce(
            summary({
                complete: false,
                pinged: false,
                failures: [{ kind: 'population', id: null, error: new Error('db down') }]
            })
        );
        const result = await listingRemoteDeletionRetryJob.handler(context(false));
        expect(result).toMatchObject({ success: false, errors: 1 });
    });

    it('fails an incomplete run even when it recorded no row failure', async () => {
        runRemoteDeletionRetry.mockResolvedValueOnce(summary({ complete: false, pinged: false }));
        const result = await listingRemoteDeletionRetryJob.handler(context(false));
        expect(result.success).toBe(false);
    });

    it('reports a thrown orchestration error', async () => {
        runRemoteDeletionRetry.mockRejectedValueOnce(new Error('failed'));
        expect(await listingRemoteDeletionRetryJob.handler(context(false))).toMatchObject({
            success: false,
            errors: 1
        });
    });
});
