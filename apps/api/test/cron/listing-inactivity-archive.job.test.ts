import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runInactivityArchive, getListingArchivePorts } = vi.hoisted(() => ({
    runInactivityArchive: vi.fn(),
    getListingArchivePorts: vi.fn(() => ({}))
}));
vi.mock('@repo/verticals', () => ({
    INACTIVITY_ARCHIVE_JOB: 'listing-inactivity-archive',
    runInactivityArchive
}));
vi.mock('../../src/utils/listing-publication/archive-ports.js', () => ({
    getListingArchivePorts
}));

import { listingInactivityArchiveJob } from '../../src/cron/jobs/listing-inactivity-archive.job';

function context(dryRun: boolean) {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-10-11T05:30:00Z'),
        runId: 'run',
        correlationId: 'corr',
        dryRun
    };
}

describe('listing inactivity archive cron', () => {
    beforeEach(() => runInactivityArchive.mockReset());

    it('TEST:V6:8/9 dry run skips the archive runner', async () => {
        const result = await listingInactivityArchiveJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(runInactivityArchive).not.toHaveBeenCalled();
    });

    it('TEST:V6:8/9 reports incomplete runs and only failed listing ids', async () => {
        runInactivityArchive.mockResolvedValueOnce({
            read: 3,
            archived: 2,
            archivedByTransition: { PB4: 1, PB5: 1 },
            skipped: { RETENTION_STOPPED: 1 },
            failures: [
                { vertical: 'accommodation', listingId: 'failed-id', error: new Error('private') }
            ],
            complete: false
        });
        const result = await listingInactivityArchiveJob.handler(context(false));
        expect(result).toMatchObject({ success: false, processed: 3, errors: 1 });
        expect(result.details).toMatchObject({ failures: ['failed-id'], archived: 2 });
        expect(JSON.stringify(result.details)).not.toContain('private');
        expect(getListingArchivePorts).toHaveBeenCalledOnce();
    });
});
