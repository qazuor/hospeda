/**
 * Unit tests for the abandoned-pending-subs cron job (SPEC-126 D6).
 *
 * Covers:
 * - Constants (TTL, lock key, status sets) so they don't drift from the
 *   `/start-paid` route's expiresAt and from sibling cron lock keys.
 * - Job definition shape (name, schedule, enabled, timeout).
 * - Transition guard: illegal guard result skips the bulk write (SPEC-194 T-002).
 *
 * @module test/cron/abandoned-pending-subs
 */

import * as serviceCore from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    _internals,
    abandonedPendingSubsJob
} from '../../src/cron/jobs/abandoned-pending-subs.job';

// ─── DB mock ──────────────────────────────────────────────────────────────────
// Minimal mock for @repo/db so the handler can acquire the advisory lock and
// conditionally execute the bulk UPDATE.

const mockTx = {
    execute: vi.fn(),
    select: vi.fn(),
    update: vi.fn()
};

const mockUpdateReturning = {
    where: vi.fn().mockResolvedValue([])
};
const _mockUpdateSet = {
    set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(mockUpdateReturning) })
};
// Expose returning() on the mock chain for the actual UPDATE path.
mockUpdateReturning.where = vi.fn().mockResolvedValue([]);

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        billingSubscriptions: {
            id: 'ID',
            status: 'STATUS',
            createdAt: 'CREATED_AT',
            deletedAt: 'DELETED_AT',
            updatedAt: 'UPDATED_AT'
        },
        sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        }),
        withTransaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx))
    };
});

/** Builds a minimal CronJobContext for the handler */
function makeCronCtx(dryRun = false) {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date(),
        dryRun
    };
}

describe('abandoned-pending-subs internals', () => {
    it('reserves advisory lock key 1006 (no overlap with sibling crons)', () => {
        // Sibling keys: 1003 dunning, 1004 trial-expiry, 1005 trial-pre-end-notif.
        // Drift would let two jobs share a lock and starve each other.
        expect(_internals.ADVISORY_LOCK_KEY).toBe(1006);
    });

    it('uses a 30-minute TTL matching the start-paid route expiresAt', () => {
        // The /start-paid response advertises a 30min expiresAt window;
        // this cron must use the same value or the front and the reaper
        // disagree about when a sub is abandoned.
        expect(_internals.PENDING_PROVIDER_TTL_MS).toBe(30 * 60 * 1000);
    });

    it('matches both qzpay-vocabulary and Hospeda-vocabulary pending statuses', () => {
        expect(_internals.PENDING_STATUSES).toContain('incomplete');
        expect(_internals.PENDING_STATUSES).toContain('pending_provider');
    });

    it('writes incomplete_expired (qzpay vocabulary) as the terminal status', () => {
        // The polling endpoint maps incomplete_expired -> Hospeda ABANDONED
        // at the response boundary, so we keep the qzpay vocabulary at
        // rest to stay consistent with rows written by qzpay-core.
        expect(_internals.ABANDONED_STATUS).toBe('incomplete_expired');
    });
});

describe('abandonedPendingSubsJob definition', () => {
    it('is registered with the expected name', () => {
        expect(abandonedPendingSubsJob.name).toBe('abandoned-pending-subs');
    });

    it('runs hourly at minute 0', () => {
        expect(abandonedPendingSubsJob.schedule).toBe('0 * * * *');
    });

    it('is enabled by default', () => {
        expect(abandonedPendingSubsJob.enabled).toBe(true);
    });

    it('uses a 2-minute timeout (single bulk UPDATE)', () => {
        expect(abandonedPendingSubsJob.timeoutMs).toBe(2 * 60 * 1000);
    });
});

// ─── Transition guard tests (SPEC-194 T-002) ──────────────────────────────────

describe('abandonedPendingSubsJob handler — transition guard (SPEC-194 T-002)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default tx.execute: lock acquired, UPDATE path proceeds.
        // Row 1: pg_try_advisory_xact_lock result
        mockTx.execute.mockResolvedValue({ rows: [{ acquired: true }] });
        // Default tx.select: empty (used in dryRun path only)
        const selectChain = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([])
        };
        mockTx.select.mockReturnValue(selectChain);
        // Default tx.update chain: returning([]) — no rows abandoned
        const returningChain = {
            where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) })
        };
        const setChain = { set: vi.fn().mockReturnValue(returningChain) };
        mockTx.update.mockReturnValue(setChain);
    });

    it('skips bulk UPDATE and logs error when guard returns invalid (spy)', async () => {
        // Arrange: force checkSubscriptionStatusTransition to report invalid
        const guardSpy = vi
            .spyOn(serviceCore, 'checkSubscriptionStatusTransition')
            .mockReturnValue({
                valid: false,
                reason: 'Transition pending_provider → abandoned is not permitted (test override)'
            });

        const ctx = makeCronCtx(false);

        // Act
        const result = await abandonedPendingSubsJob.handler(ctx);

        // Assert: job completes with 0 processed, no UPDATE executed, error logged
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(mockTx.update).not.toHaveBeenCalled();
        expect(ctx.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('invalid transition guard'),
            expect.objectContaining({
                from: 'pending_provider',
                to: 'abandoned'
            })
        );

        guardSpy.mockRestore();
    });

    it('legal transition (pending_provider → abandoned): guard passes and update proceeds', async () => {
        // Arrange: real guard — should always return valid for this edge
        // (no spy, uses actual checkSubscriptionStatusTransition)
        const returningChain = {
            where: vi
                .fn()
                .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'sub-1' }]) })
        };
        const setChain = { set: vi.fn().mockReturnValue(returningChain) };
        mockTx.update.mockReturnValue(setChain);

        const ctx = makeCronCtx(false);

        // Act
        const result = await abandonedPendingSubsJob.handler(ctx);

        // Assert: guard passes → UPDATE executed → 1 row abandoned
        expect(result.success).toBe(true);
        expect(mockTx.update).toHaveBeenCalled();
        expect(ctx.logger.error).not.toHaveBeenCalled();
        expect(result.processed).toBe(1);
    });
});
