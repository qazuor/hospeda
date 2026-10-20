import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    runRetentionPass: vi.fn(),
    getRetentionPassPorts: vi.fn(() => ({ ports: true })),
    findPreviousRunStartedAt: vi.fn()
}));
vi.mock('@repo/verticals', () => ({
    RETENTION_PASS_JOB: 'listing-retention-pass',
    runRetentionPass: mocks.runRetentionPass
}));
vi.mock('@repo/db', () => ({
    cronRunModel: { findPreviousRunStartedAt: mocks.findPreviousRunStartedAt }
}));
vi.mock('../../src/utils/listing-publication/retention-pass-ports.js', () => ({
    getRetentionPassPorts: mocks.getRetentionPassPorts
}));

import { listingRetentionPassJob } from '../../src/cron/jobs/listing-retention-pass.job';

const startedAt = new Date('2026-10-17T06:00:00Z');
function context(dryRun = false) {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt,
        runId: 'run',
        correlationId: 'corr',
        dryRun
    };
}
function summary(failures: readonly unknown[] = []) {
    return {
        runCorrelationId: 'run-corr',
        read: { notices: 2, purges: 1 },
        notices: { sent: 1, enqueued: 1, skipped: {} },
        purged: 0,
        purgeSkipped: {},
        purgeWarnings: 0,
        failures,
        complete: failures.length === 0
    };
}

describe('listing retention pass cron', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findPreviousRunStartedAt.mockResolvedValue(null);
        mocks.runRetentionPass.mockResolvedValue(summary());
    });

    it('TEST:V9b:13 dry run does not inspect history or execute the pass', async () => {
        const result = await listingRetentionPassJob.handler(context(true));
        expect(result).toMatchObject({ success: true, processed: 0, details: { dryRun: true } });
        expect(mocks.findPreviousRunStartedAt).not.toHaveBeenCalled();
        expect(mocks.runRetentionPass).not.toHaveBeenCalled();
    });

    it('uses startedAt as the strict history bound and passes the previous run to production ports', async () => {
        const previous = new Date('2026-10-16T06:00:00Z');
        mocks.findPreviousRunStartedAt.mockResolvedValue(previous);
        await listingRetentionPassJob.handler(context());
        expect(mocks.findPreviousRunStartedAt).toHaveBeenCalledWith({
            jobName: 'listing-retention-pass',
            before: startedAt
        });
        expect(mocks.getRetentionPassPorts).toHaveBeenCalledWith({
            previousPassStartedAt: previous
        });
        expect(mocks.runRetentionPass).toHaveBeenCalledWith({ ports: { ports: true } });
    });

    it('reports each listing failure without putting raw errors in details', async () => {
        mocks.runRetentionPass.mockResolvedValue(
            summary([
                {
                    step: 'NOTICE',
                    vertical: 'accommodation',
                    listingId: 'one',
                    error: new Error('secret')
                },
                {
                    step: 'PURGE',
                    vertical: 'experience',
                    listingId: 'two',
                    error: new Error('private')
                }
            ])
        );
        const ctx = context();
        const result = await listingRetentionPassJob.handler(ctx);
        expect(result).toMatchObject({ success: false, errors: 2, processed: 3 });
        expect(ctx.logger.error).toHaveBeenCalledTimes(2);
        expect(JSON.stringify(result.details)).not.toMatch(/secret|private/);
    });

    it('catches a pass-level failure', async () => {
        mocks.runRetentionPass.mockRejectedValueOnce(new Error('boom'));
        const ctx = context();
        const result = await listingRetentionPassJob.handler(ctx);
        expect(result).toMatchObject({ success: false, errors: 1 });
        expect(ctx.logger.error).toHaveBeenCalledOnce();
    });

    it('uses the production schedule and irreversible-pass enablement', () => {
        expect(listingRetentionPassJob).toMatchObject({
            name: 'listing-retention-pass',
            schedule: '0 6 * * *',
            enabled: true,
            timeoutMs: 600_000
        });
    });
});
