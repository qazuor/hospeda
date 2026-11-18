/**
 * mcp-audit-retention cron (HOS-2335 D-13, AC-C56a): manifest entry and file
 * name, dry run, the purge call with the run's instant, and failure
 * reporting. The scoped delete itself runs against a real database in
 * `packages/db/test/integration/mcp-activity.model.integration.test.ts`; the
 * 12-month cutoff and batching in the McpActivityService unit tests.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockPurge } = vi.hoisted(() => ({ mockPurge: vi.fn() }));

vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    McpActivityService: class {
        purgeExpired = mockPurge;
    }
}));

import { mcpAuditRetentionJob } from '../../src/cron/jobs/mcp-audit-retention.job';
import { cronJobs } from '../../src/cron/registry';
import { CRON_SCHEDULES } from '../../src/cron/schedules.manifest';

const CUTOFF = new Date('2025-11-18T07:20:00.000Z');

function makeContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-11-18T07:20:00.000Z'),
        runId: 'run-test',
        correlationId: '00000000-0000-4000-8000-00000000c0de',
        dryRun: false,
        ...overrides
    };
}

describe('mcpAuditRetentionJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is in the manifest and the registry with the same schedule, in a file named after it (AC-C56a)', () => {
        const entry = CRON_SCHEDULES.find((job) => job.name === 'mcp-audit-retention');

        expect(mcpAuditRetentionJob.name).toBe('mcp-audit-retention');
        expect(entry?.schedule).toBe(mcpAuditRetentionJob.schedule);
        expect(entry?.category).toBe('system');
        expect(cronJobs).toContain(mcpAuditRetentionJob);
        expect(mcpAuditRetentionJob.enabled).toBe(true);
        expect(
            existsSync(resolve(__dirname, '../../src/cron/jobs/mcp-audit-retention.job.ts'))
        ).toBe(true);
    });

    it('a dry run reports what it would delete and deletes nothing', async () => {
        // Arrange
        const ctx = makeContext({ dryRun: true });
        mockPurge.mockResolvedValue({ cutoff: CUTOFF, deleted: 0, wouldDelete: 42 });

        // Act
        const result = await mcpAuditRetentionJob.handler(ctx);

        // Assert
        expect(mockPurge).toHaveBeenCalledWith({ now: ctx.startedAt, dryRun: true });
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.details).toMatchObject({ dryRun: true, wouldDelete: 42, deleted: 0 });
        expect(result.message).toContain('would delete 42');
    });

    it('purges with the run instant and reports the count', async () => {
        // Arrange
        const ctx = makeContext();
        mockPurge.mockResolvedValue({ cutoff: CUTOFF, deleted: 9, wouldDelete: 0 });

        // Act
        const result = await mcpAuditRetentionJob.handler(ctx);

        // Assert
        expect(mockPurge).toHaveBeenCalledWith({ now: ctx.startedAt, dryRun: false });
        expect(result.success).toBe(true);
        expect(result.processed).toBe(9);
        expect(result.details).toMatchObject({
            cutoff: CUTOFF.toISOString(),
            retentionMonths: 12
        });
    });

    it('hands the run signal and deadline to the purge, and reports an early stop (L2)', async () => {
        // Arrange
        const controller = new AbortController();
        const deadlineAt = new Date('2026-11-18T07:22:00.000Z');
        const ctx = makeContext({ signal: controller.signal, deadlineAt });
        mockPurge.mockResolvedValue({
            cutoff: CUTOFF,
            deleted: 1000,
            wouldDelete: 0,
            stoppedEarly: true
        });

        // Act
        const result = await mcpAuditRetentionJob.handler(ctx);

        // Assert
        expect(mockPurge).toHaveBeenCalledWith({
            now: ctx.startedAt,
            dryRun: false,
            signal: controller.signal,
            deadlineAt
        });
        expect(result.details).toMatchObject({ stoppedEarly: true });
    });

    it('reports a failure instead of throwing', async () => {
        mockPurge.mockRejectedValue(new Error('db down'));

        const result = await mcpAuditRetentionJob.handler(makeContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
    });
});
