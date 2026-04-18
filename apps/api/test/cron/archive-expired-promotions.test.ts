/**
 * Unit Tests: Archive Expired Promotions Cron Job Handler
 *
 * Tests the archive-expired-promotions job that transitions OwnerPromotions
 * with lifecycleState=ACTIVE and expired validUntil to ARCHIVED (SPEC-063
 * AC-007-01).
 *
 * Test Coverage:
 * - Job definition metadata (name, schedule, enabled, timeoutMs)
 * - Dry run: reports count without mutation
 * - Production run: batch UPDATE with correct mutation payload
 * - Empty batch: no UPDATE invoked
 * - Advisory lock not acquired: skipped result + apiLogger.warn
 * - Top-level error: Sentry.captureException invoked + error result
 * - updatedAt timestamp freshness (guards against regressions that drop
 *   the timestamp or swap to sql`NOW()` without updating the mock pattern)
 *
 * Mocking strategy: mirrors addon-expiry.test.ts — mocks `@repo/db` with a
 * chainable tx stub injected through `withTransaction`. `drizzle-orm` is NOT
 * mocked; `inArray(...)` returns a real SQL object that the tx.update.where
 * mock accepts without interpretation.
 *
 * @module test/cron/archive-expired-promotions
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveExpiredPromotionsJob } from '../../src/cron/jobs/archive-expired-promotions.job';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Chainable query builder mocks for the tx stub
// ---------------------------------------------------------------------------
const mockSelectLimit = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn((_payload: Record<string, unknown>) => ({
    where: mockUpdateWhere
}));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

// execute() is used for (a) the advisory lock probe and (b) SET LOCAL statement_timeout.
// The default acquired=true path returns { rows: [{ acquired: true }] } for the first
// call and a noop result for subsequent calls.
const mockTxExecute = vi.fn();

// ---------------------------------------------------------------------------
// Mock: @repo/db — provides getDb (unused here but exported for safety),
// withTransaction (runs callback with tx stub), table placeholder, operators
// ---------------------------------------------------------------------------
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockSelect,
        update: mockUpdate,
        execute: mockTxExecute
    })),
    /**
     * Default passthrough: invokes the callback with a tx stub that simulates
     * pg_try_advisory_xact_lock(43010) returning acquired=true.
     *
     * Tests that need to override lock behavior (e.g. lock not acquired) use
     * `vi.mocked(withTransaction).mockImplementationOnce(...)` before arranging.
     */
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const txStub = {
            select: mockSelect,
            update: mockUpdate,
            execute: mockTxExecute
        };
        return callback(txStub);
    }),
    ownerPromotions: {
        id: 'id',
        lifecycleState: 'lifecycle_state',
        validUntil: 'valid_until',
        deletedAt: 'deleted_at',
        updatedAt: 'updated_at',
        updatedById: 'updated_by_id'
    },
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
    isNotNull: vi.fn((...args: unknown[]) => ({ op: 'isNotNull', args })),
    isNull: vi.fn((...args: unknown[]) => ({ op: 'isNull', args })),
    lt: vi.fn((...args: unknown[]) => ({ op: 'lt', args })),
    sql: vi.fn((...args: unknown[]) => ({ op: 'sql', args }))
}));

// Mock apiLogger so we can assert on the lock-skip warn
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock Sentry to capture top-level error reporting
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    init: vi.fn(),
    withScope: vi.fn()
}));

import { withTransaction } from '@repo/db';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../../src/utils/logger';

/**
 * Helper to create mock CronJobContext
 */
function createMockContext(overrides?: Partial<CronJobContext>): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date('2026-04-18T14:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

/**
 * Configure the chainable mocks for the default "acquired=true" path so each
 * test arranges only the SELECT payload.
 */
function arrangeDefaultTx(selectResult: ReadonlyArray<{ id: string }>): void {
    mockTxExecute
        .mockResolvedValueOnce({ rows: [{ acquired: true }] }) // advisory lock probe
        .mockResolvedValueOnce({ rows: [] }); // SET LOCAL statement_timeout
    mockSelectLimit.mockResolvedValueOnce([...selectResult]);
    mockUpdateWhere.mockResolvedValueOnce(undefined);
}

describe('Archive Expired Promotions Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Job Definition', () => {
        it('should have correct job metadata', () => {
            expect(archiveExpiredPromotionsJob.name).toBe('archive-expired-promotions');
            expect(archiveExpiredPromotionsJob.description).toBe(
                'Archive OwnerPromotions with lifecycleState=ACTIVE whose validUntil has passed'
            );
            expect(archiveExpiredPromotionsJob.schedule).toBe('0 * * * *');
            expect(archiveExpiredPromotionsJob.enabled).toBe(true);
            expect(archiveExpiredPromotionsJob.timeoutMs).toBe(60_000);
        });
    });

    describe('Dry run mode', () => {
        it('reports the count of expired promotions without invoking UPDATE', async () => {
            const expired = [{ id: 'uuid-1' }, { id: 'uuid-2' }, { id: 'uuid-3' }];
            arrangeDefaultTx(expired);
            const ctx = createMockContext({ dryRun: true });

            const result = await archiveExpiredPromotionsJob.handler(ctx);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(result.errors).toBe(0);
            expect(result.details).toMatchObject({ dryRun: true, wouldArchive: 3 });
            expect(mockUpdate).not.toHaveBeenCalled();
            expect(mockUpdateSet).not.toHaveBeenCalled();
            expect(mockUpdateWhere).not.toHaveBeenCalled();
        });
    });

    describe('Production run', () => {
        it('archives expired promotions and returns processed count', async () => {
            const expired = [{ id: 'uuid-1' }, { id: 'uuid-2' }];
            arrangeDefaultTx(expired);
            const ctx = createMockContext({ dryRun: false });

            const result = await archiveExpiredPromotionsJob.handler(ctx);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(result.errors).toBe(0);
            expect(result.details).toMatchObject({ archived: 2 });
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockUpdateSet).toHaveBeenCalledTimes(1);
            expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
        });

        it('passes the correct mutation payload to .set()', async () => {
            const expired = [{ id: 'uuid-1' }];
            arrangeDefaultTx(expired);
            const ctx = createMockContext({ dryRun: false });

            await archiveExpiredPromotionsJob.handler(ctx);

            expect(mockUpdateSet).toHaveBeenCalledTimes(1);
            const setPayload = mockUpdateSet.mock.calls[0]?.[0];
            expect(setPayload).toBeDefined();
            expect(setPayload?.lifecycleState).toBe('ARCHIVED');
            expect(setPayload?.updatedById).toBeNull();
            expect(setPayload?.updatedAt).toBeInstanceOf(Date);
        });

        it('sets updatedAt to a timestamp after the job started and before it returned', async () => {
            const expired = [{ id: 'uuid-1' }];
            arrangeDefaultTx(expired);
            const startedAt = new Date();
            const ctx = createMockContext({ startedAt, dryRun: false });

            await archiveExpiredPromotionsJob.handler(ctx);
            const now = Date.now();

            expect(mockUpdateSet).toHaveBeenCalledTimes(1);
            const setPayload = mockUpdateSet.mock.calls[0]?.[0];
            const updatedAt = setPayload?.updatedAt as Date;
            expect(updatedAt).toBeInstanceOf(Date);
            expect(updatedAt.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
            expect(updatedAt.getTime()).toBeLessThanOrEqual(now);
        });
    });

    describe('Empty batch', () => {
        it('returns processed=0 without invoking UPDATE when no promotions are expired', async () => {
            arrangeDefaultTx([]);
            const ctx = createMockContext({ dryRun: false });

            const result = await archiveExpiredPromotionsJob.handler(ctx);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.details).toMatchObject({ archived: 0 });
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('Advisory lock not acquired', () => {
        it('returns skipped result, logs a warning, and does not query the table', async () => {
            // Override withTransaction so the tx.execute for the lock probe returns acquired=false
            vi.mocked(withTransaction).mockImplementationOnce((async (
                callback: (tx: unknown) => Promise<unknown>
            ) => {
                const txStub = {
                    select: mockSelect,
                    update: mockUpdate,
                    execute: vi.fn().mockResolvedValueOnce({ rows: [{ acquired: false }] })
                };
                return callback(txStub);
            }) as never);
            const ctx = createMockContext({ dryRun: false });

            const result = await archiveExpiredPromotionsJob.handler(ctx);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(result.details).toMatchObject({
                skipped: true,
                reason: 'lock_not_acquired'
            });
            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('previous run still holds advisory lock')
            );
            expect(mockSelect).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('Top-level error handling', () => {
        it('captures the exception in Sentry and returns error result', async () => {
            // Advisory lock acquired successfully, but the SELECT query throws
            mockTxExecute
                .mockResolvedValueOnce({ rows: [{ acquired: true }] })
                .mockResolvedValueOnce({ rows: [] });
            const dbError = new Error('connection reset');
            mockSelectLimit.mockRejectedValueOnce(dbError);
            const ctx = createMockContext({ dryRun: false });

            const result = await archiveExpiredPromotionsJob.handler(ctx);

            expect(result.success).toBe(false);
            expect(result.errors).toBe(1);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Failed to archive expired promotions');
            expect(result.details).toMatchObject({ error: expect.any(String) });
            expect(Sentry.captureException).toHaveBeenCalledTimes(1);
            expect(Sentry.captureException).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    tags: expect.objectContaining({
                        cronJob: 'archive-expired-promotions',
                        phase: 'top-level'
                    })
                })
            );
        });
    });
});
