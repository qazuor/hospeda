/**
 * Tests for the entity-views-purge cron job (SPEC-159 T-011).
 *
 * Verifies:
 *  - Job metadata (name, schedule, enabled flag).
 *  - Dry-run path skips the model call.
 *  - Normal path calls purgeOlderThan with days: 95 and surfaces the deleted count.
 *  - Zero-deletion (no-op) still records a successful result.
 *  - Model errors produce a failed CronJobResult (no unhandled rejection).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockPurgeOlderThan, mockPurgeClicks } = vi.hoisted(() => ({
    mockPurgeOlderThan: vi.fn(),
    mockPurgeClicks: vi.fn()
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        entityViewModel: { purgeOlderThan: mockPurgeOlderThan },
        // `partner_logo_clicks` is purged by this same job on the same horizon
        // (HOS-1063 A-3). Leaving it out of the mock does not skip it: the job
        // reaches the REAL singleton through `...actual` and the run fails with
        // no database, which is how this test broke.
        partnerLogoClickModel: { purgeOlderThan: mockPurgeClicks }
    };
});

// ─── Import under test (after mocks are in place) ────────────────────────────

import { entityViewsPurgeJob } from '../../src/cron/jobs/entity-views-purge.job';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCronContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        dryRun: false,
        ...overrides
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('entityViewsPurgeJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Metadata ──────────────────────────────────────────────────────────────

    it('is registered with the expected name, 3:30 UTC nightly schedule, and enabled flag', () => {
        expect(entityViewsPurgeJob.name).toBe('entity-views-purge');
        expect(entityViewsPurgeJob.schedule).toBe('30 3 * * *');
        expect(entityViewsPurgeJob.enabled).toBe(true);
    });

    // ── Dry-run ───────────────────────────────────────────────────────────────

    it('skips the purge in dry-run mode and does not call the model', async () => {
        const result = await entityViewsPurgeJob.handler(makeCronContext({ dryRun: true }));

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mockPurgeOlderThan).not.toHaveBeenCalled();
        expect(mockPurgeClicks).not.toHaveBeenCalled();
    });

    // ── Normal path ───────────────────────────────────────────────────────────

    it('calls purgeOlderThan with days: 95 and reports the deleted count', async () => {
        mockPurgeOlderThan.mockResolvedValue(42);
        mockPurgeClicks.mockResolvedValue(7);

        const result = await entityViewsPurgeJob.handler(makeCronContext());

        expect(mockPurgeOlderThan).toHaveBeenCalledOnce();
        expect(mockPurgeOlderThan).toHaveBeenCalledWith({ days: 95 });
        // Both tables carry `visitor_hash`, so both are purged on the same
        // horizon by the same job — asserted with DIFFERENT counts so a
        // `processed` that dropped one of them cannot still add up.
        expect(mockPurgeClicks).toHaveBeenCalledOnce();
        expect(mockPurgeClicks).toHaveBeenCalledWith({ days: 95 });

        expect(result.success).toBe(true);
        expect(result.processed).toBe(49);
        expect(result.errors).toBe(0);
        expect(result.details).toMatchObject({
            deleted: 42,
            deletedClicks: 7,
            retentionDays: 95
        });
    });

    // ── Zero-deletion (no-op) ─────────────────────────────────────────────────

    it('records a successful result when 0 rows are deleted (no-op run)', async () => {
        mockPurgeOlderThan.mockResolvedValue(0);
        mockPurgeClicks.mockResolvedValue(0);

        const result = await entityViewsPurgeJob.handler(makeCronContext());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(mockPurgeOlderThan).toHaveBeenCalledWith({ days: 95 });
        expect(mockPurgeClicks).toHaveBeenCalledWith({ days: 95 });
    });

    // ── Error path ────────────────────────────────────────────────────────────

    it('returns a failed result (no unhandled rejection) when the model throws', async () => {
        mockPurgeOlderThan.mockRejectedValue(new Error('connection refused'));
        mockPurgeClicks.mockResolvedValue(0);

        const result = await entityViewsPurgeJob.handler(makeCronContext());

        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(0);
        expect(result.message).toContain('connection refused');
    });

    it('logs the error when the model throws', async () => {
        mockPurgeOlderThan.mockRejectedValue(new Error('timeout'));
        mockPurgeClicks.mockResolvedValue(0);

        const ctx = makeCronContext();
        await entityViewsPurgeJob.handler(ctx);

        expect(ctx.logger.error).toHaveBeenCalledOnce();
        const [, logData] = (ctx.logger.error as ReturnType<typeof vi.fn>).mock.calls[0] as [
            string,
            Record<string, unknown>
        ];
        expect(logData?.error).toBe('timeout');
    });
});
