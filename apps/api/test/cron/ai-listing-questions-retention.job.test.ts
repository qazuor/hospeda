/**
 * ai-listing-questions-retention cron (HOS-2101): metadata, dry run, the
 * purge call with the run's reference instant, and failure reporting. The SQL
 * itself is exercised against a real database in
 * `test/integration/ai/listing-questions.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockPurge } = vi.hoisted(() => ({ mockPurge: vi.fn() }));

vi.mock('../../src/services/ai-listing-questions-retention.js', () => ({
    purgeExpiredChatQuestions: mockPurge
}));

import { aiListingQuestionsRetentionJob } from '../../src/cron/jobs/ai-listing-questions-retention.job';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

function makeContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-11-10T06:45:00.000Z'),
        runId: 'run-test',
        correlationId: '00000000-0000-4000-8000-00000000c0de',
        dryRun: false,
        ...overrides
    };
}

describe('aiListingQuestionsRetentionJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is registered in the manifest with the same schedule', () => {
        const entry = CRON_SCHEDULES.find(
            (job) => job.name === aiListingQuestionsRetentionJob.name
        );
        expect(entry?.schedule).toBe(aiListingQuestionsRetentionJob.schedule);
        expect(aiListingQuestionsRetentionJob.enabled).toBe(true);
    });

    it('purges nothing on a dry run', async () => {
        const result = await aiListingQuestionsRetentionJob.handler(makeContext({ dryRun: true }));

        expect(result.success).toBe(true);
        expect(mockPurge).not.toHaveBeenCalled();
    });

    it('purges with the run instant and reports the counts', async () => {
        // Arrange
        const ctx = makeContext();
        mockPurge.mockResolvedValue({
            deletedMessages: 8,
            deletedConversations: 2,
            cutoff: new Date('2025-11-10T06:45:00.000Z')
        });

        // Act
        const result = await aiListingQuestionsRetentionJob.handler(ctx);

        // Assert
        expect(mockPurge).toHaveBeenCalledWith({ now: ctx.startedAt });
        expect(result.success).toBe(true);
        expect(result.processed).toBe(10);
    });

    it('reports a failure instead of throwing', async () => {
        mockPurge.mockRejectedValue(new Error('db down'));

        const result = await aiListingQuestionsRetentionJob.handler(makeContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
    });
});
