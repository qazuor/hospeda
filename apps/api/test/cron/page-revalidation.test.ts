/**
 * Unit Tests: Page Revalidation Cron Job Handler
 *
 * Tests the page-revalidation job handler that triggers ISR revalidation
 * for entity types based on configured cron intervals and stale detection.
 *
 * Test Coverage:
 * - Early return when RevalidationService is not initialized
 * - Interval check: skips entity types not yet due
 * - Interval check: revalidates entity types past due
 * - First run (no previous log entry) triggers revalidation
 * - Stale detection triggers revalidation for autoRevalidateOnChange entities
 * - Stale detection skips disabled entities (autoRevalidateOnChange = false)
 * - Log cleanup calls deleteOlderThan with 30-day cutoff
 * - Dry run mode: revalidateByEntityType NOT called but counters still work
 * - Correct CronJobResult structure is always returned
 *
 * Mocking strategy:
 * - `@repo/service-core`: mock getRevalidationService()
 * - `@repo/db`: mock RevalidationConfigModel and RevalidationLogModel classes
 *
 * @module test/cron/page-revalidation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pageRevalidationJob } from '../../src/cron/jobs/page-revalidation.job';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Mock: @repo/service-core — getRevalidationService singleton getter
// ---------------------------------------------------------------------------
const mockRevalidateByEntityType = vi.fn();
const mockRevalidationService = {
    revalidateByEntityType: mockRevalidateByEntityType
};

vi.mock('@repo/service-core', () => ({
    getRevalidationService: vi.fn()
}));

// ---------------------------------------------------------------------------
// Mock: @repo/db — RevalidationConfigModel and RevalidationLogModel
// ---------------------------------------------------------------------------
const mockFindAllEnabled = vi.fn();
const mockFindLastCronEntry = vi.fn();
const mockDeleteOlderThan = vi.fn();

vi.mock('@repo/db', () => ({
    RevalidationConfigModel: vi.fn().mockImplementation(() => ({
        findAllEnabled: mockFindAllEnabled
    })),
    RevalidationLogModel: vi.fn().mockImplementation(() => ({
        findLastCronEntry: mockFindLastCronEntry,
        deleteOlderThan: mockDeleteOlderThan
    }))
}));

import { getRevalidationService } from '@repo/service-core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal CronJobContext for testing.
 */
function createMockContext(overrides?: Partial<CronJobContext>): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date('2024-06-15T10:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

/**
 * Creates a mock revalidation config row.
 */
function makeConfig(
    entityType: string,
    cronIntervalMinutes: number,
    autoRevalidateOnChange = false
) {
    return {
        id: `cfg-${entityType}`,
        entityType,
        cronIntervalMinutes,
        autoRevalidateOnChange,
        enabled: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Creates a mock revalidation log entry with the given createdAt date.
 */
function makeLogEntry(createdAt: Date) {
    return {
        id: 'log-1',
        entityType: 'accommodation',
        triggeredBy: 'cron',
        success: true,
        createdAt,
        updatedAt: createdAt
    };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Page Revalidation Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: service is initialized, log model returns nothing, cleanup deletes 0
        vi.mocked(getRevalidationService).mockReturnValue(mockRevalidationService as never);
        mockFindAllEnabled.mockResolvedValue([]);
        mockFindLastCronEntry.mockResolvedValue(undefined);
        mockDeleteOlderThan.mockResolvedValue(0);
        mockRevalidateByEntityType.mockResolvedValue(undefined);
    });

    // -------------------------------------------------------------------------
    describe('Job Definition', () => {
        it('should have correct job metadata', () => {
            expect(pageRevalidationJob.name).toBe('page-revalidation');
            expect(pageRevalidationJob.description).toContain('ISR revalidation');
            expect(pageRevalidationJob.enabled).toBe(true);
            expect(pageRevalidationJob.timeoutMs).toBe(120000);
            // Schedule is configurable but must be a non-empty string
            expect(typeof pageRevalidationJob.schedule).toBe('string');
            expect(pageRevalidationJob.schedule.length).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    describe('Service Not Initialized', () => {
        it('should return early with skipped result when getRevalidationService returns undefined', async () => {
            // Arrange
            vi.mocked(getRevalidationService).mockReturnValue(undefined);
            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('not initialized');
            expect(result.details?.skipped).toBe(true);
            expect(result.details?.reason).toBe('service_not_initialized');
            // DB methods must not be called
            expect(mockFindAllEnabled).not.toHaveBeenCalled();
            expect(mockFindLastCronEntry).not.toHaveBeenCalled();
            expect(mockRevalidateByEntityType).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('Interval-Based Revalidation', () => {
        it('should skip an entity type whose interval has not yet elapsed', async () => {
            // Arrange — last run was 30 minutes ago, interval is 60 minutes
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            const config = makeConfig('accommodation', 60);

            mockFindAllEnabled.mockResolvedValue([config]);
            mockFindLastCronEntry.mockResolvedValue(makeLogEntry(thirtyMinutesAgo));

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRevalidateByEntityType).not.toHaveBeenCalled();
            expect(result.details?.revalidated).toBe(0);
        });

        it('should revalidate an entity type whose interval has elapsed', async () => {
            // Arrange — last run was 2 hours ago, interval is 60 minutes
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const config = makeConfig('accommodation', 60);

            mockFindAllEnabled.mockResolvedValue([config]);
            mockFindLastCronEntry.mockResolvedValue(makeLogEntry(twoHoursAgo));

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRevalidateByEntityType).toHaveBeenCalledOnce();
            expect(mockRevalidateByEntityType).toHaveBeenCalledWith('accommodation');
            expect(result.details?.revalidated).toBe(1);
        });

        it('should trigger revalidation on first run when there is no previous log entry', async () => {
            // Arrange — no prior log entry
            const config = makeConfig('destination', 60);

            mockFindAllEnabled.mockResolvedValue([config]);
            mockFindLastCronEntry.mockResolvedValue(undefined); // no previous entry

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRevalidateByEntityType).toHaveBeenCalledOnce();
            expect(mockRevalidateByEntityType).toHaveBeenCalledWith('destination');
            expect(result.details?.revalidated).toBe(1);
        });

        it('should process multiple entity types and revalidate each one that is past due', async () => {
            // Arrange — two configs; accommodation past due, destination not yet due
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

            const accommodationConfig = makeConfig('accommodation', 60);
            const destinationConfig = makeConfig('destination', 60);

            mockFindAllEnabled.mockResolvedValue([accommodationConfig, destinationConfig]);
            mockFindLastCronEntry
                .mockResolvedValueOnce(makeLogEntry(twoHoursAgo))    // accommodation: past due
                .mockResolvedValueOnce(makeLogEntry(thirtyMinutesAgo)); // destination: not yet due

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRevalidateByEntityType).toHaveBeenCalledOnce();
            expect(mockRevalidateByEntityType).toHaveBeenCalledWith('accommodation');
            expect(result.details?.revalidated).toBe(1);
        });
    });

    // -------------------------------------------------------------------------
    describe('Stale Detection', () => {
        it('should trigger stale revalidation when autoRevalidateOnChange is true and last log is older than 48h', async () => {
            // Arrange — last log is 72 hours ago (stale)
            const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
            // cronIntervalMinutes also elapsed so interval revalidation fires as well;
            // we use a short interval to keep it simple, but stale detection is the focus.
            const config = makeConfig('accommodation', 10080, true); // 1 week interval

            mockFindAllEnabled.mockResolvedValue([config]);
            // interval check call → not past due (last entry 30 min ago would skip, but here
            // we set it to 72h ago so interval IS past due too — we test stale separately
            // by using a 1-week interval and a 72h-old entry: interval NOT elapsed, stale IS elapsed)
            mockFindLastCronEntry
                .mockResolvedValueOnce(makeLogEntry(seventyTwoHoursAgo)) // interval check call
                .mockResolvedValueOnce(makeLogEntry(seventyTwoHoursAgo)); // stale check call

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert — staleRevalidated should be 1
            expect(result.success).toBe(true);
            expect(mockRevalidateByEntityType).toHaveBeenCalled();
            expect(result.details?.staleRevalidated).toBe(1);
        });

        it('should trigger stale revalidation when there is no log entry at all', async () => {
            // Arrange — no log entry yet (treated as stale)
            const config = makeConfig('accommodation', 10080, true); // 1 week interval, auto-revalidate on

            mockFindAllEnabled.mockResolvedValue([config]);
            // Both interval check and stale check return undefined (no entry → epoch, so both fire)
            mockFindLastCronEntry.mockResolvedValue(undefined);

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert — revalidated (interval) and staleRevalidated should each be 1
            expect(result.success).toBe(true);
            expect(result.details?.staleRevalidated).toBe(1);
        });

        it('should skip stale detection when autoRevalidateOnChange is false', async () => {
            // Arrange — autoRevalidateOnChange disabled, last log is 72h ago (stale window)
            const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
            const config = makeConfig('accommodation', 10080, false); // stale detection OFF

            mockFindAllEnabled.mockResolvedValue([config]);
            mockFindLastCronEntry.mockResolvedValue(makeLogEntry(seventyTwoHoursAgo));

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert — stale revalidation must NOT have been triggered
            expect(result.success).toBe(true);
            expect(result.details?.staleRevalidated).toBe(0);
        });

        it('should NOT trigger stale revalidation when last log is within the 48h window', async () => {
            // Arrange — last log is 24 hours ago (within stale window)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const config = makeConfig('accommodation', 10080, true); // 1 week interval, auto on

            mockFindAllEnabled.mockResolvedValue([config]);
            mockFindLastCronEntry
                .mockResolvedValueOnce(makeLogEntry(twentyFourHoursAgo)) // interval check
                .mockResolvedValueOnce(makeLogEntry(twentyFourHoursAgo)); // stale check

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert — no stale revalidation
            expect(result.success).toBe(true);
            expect(result.details?.staleRevalidated).toBe(0);
            expect(mockRevalidateByEntityType).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('Log Cleanup', () => {
        it('should call deleteOlderThan with a date approximately 30 days in the past', async () => {
            // Arrange
            const ctx = createMockContext();
            mockFindAllEnabled.mockResolvedValue([]);

            const beforeCall = Date.now();

            // Act
            await pageRevalidationJob.handler(ctx);

            const afterCall = Date.now();

            // Assert
            expect(mockDeleteOlderThan).toHaveBeenCalledOnce();
            const [cutoff] = vi.mocked(mockDeleteOlderThan).mock.calls[0]!;
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const expectedCutoffMin = beforeCall - thirtyDaysMs;
            const expectedCutoffMax = afterCall - thirtyDaysMs;

            expect(cutoff).toBeInstanceOf(Date);
            expect((cutoff as Date).getTime()).toBeGreaterThanOrEqual(expectedCutoffMin);
            expect((cutoff as Date).getTime()).toBeLessThanOrEqual(expectedCutoffMax);
        });

        it('should include deleted count in the result details', async () => {
            // Arrange
            mockDeleteOlderThan.mockResolvedValue(15);
            mockFindAllEnabled.mockResolvedValue([]);

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(result.details?.deleted).toBe(15);
        });
    });

    // -------------------------------------------------------------------------
    describe('Dry Run Mode', () => {
        it('should NOT call revalidateByEntityType when dryRun is true', async () => {
            // Arrange — two configs, both past due
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const configA = makeConfig('accommodation', 60);
            const configB = makeConfig('destination', 60, true); // stale detection ON

            mockFindAllEnabled.mockResolvedValue([configA, configB]);
            // All findLastCronEntry calls return entries from 72h ago (past due + stale)
            const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
            mockFindLastCronEntry.mockResolvedValue(makeLogEntry(seventyTwoHoursAgo));

            const ctx = createMockContext({ dryRun: true });

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert — revalidation service must NOT be called
            expect(mockRevalidateByEntityType).not.toHaveBeenCalled();
            // Result still reflects what would have been done
            expect(result.success).toBe(true);
            expect(result.details?.dryRun).toBe(true);
        });

        it('should NOT call deleteOlderThan when dryRun is true', async () => {
            // Arrange
            mockFindAllEnabled.mockResolvedValue([]);
            const ctx = createMockContext({ dryRun: true });

            // Act
            await pageRevalidationJob.handler(ctx);

            // Assert — cleanup must be skipped in dry run
            expect(mockDeleteOlderThan).not.toHaveBeenCalled();
        });

        it('should still count revalidated and staleRevalidated in dry run mode', async () => {
            // Arrange — one config past due, one config stale
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const config = makeConfig('accommodation', 60, true);

            mockFindAllEnabled.mockResolvedValue([config]);
            mockFindLastCronEntry.mockResolvedValue(makeLogEntry(twoHoursAgo));

            const ctx = createMockContext({ dryRun: true });

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert — counters incremented, but service not called
            expect(result.success).toBe(true);
            expect(result.details?.revalidated).toBeGreaterThanOrEqual(1);
            expect(mockRevalidateByEntityType).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('Error Handling', () => {
        it('should catch and count per-entity errors without aborting remaining entities', async () => {
            // Arrange — two configs; first throws, second succeeds
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const configA = makeConfig('accommodation', 60);
            const configB = makeConfig('destination', 60);

            mockFindAllEnabled.mockResolvedValue([configA, configB]);
            mockFindLastCronEntry.mockResolvedValue(makeLogEntry(twoHoursAgo));
            mockRevalidateByEntityType
                .mockRejectedValueOnce(new Error('Revalidation failed for accommodation'))
                .mockResolvedValueOnce(undefined);

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert — job returns success=true (partial failure), errors counted
            expect(result.success).toBe(true);
            expect(result.errors).toBeGreaterThan(0);
            // Second entity should still have been attempted
            expect(mockRevalidateByEntityType).toHaveBeenCalledTimes(2);
        });

        it('should return success=false and capture error message when findAllEnabled throws', async () => {
            // Arrange — DB is unavailable at the config fetch step
            mockFindAllEnabled.mockRejectedValue(new Error('DB connection refused'));

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('DB connection refused');
            expect(result.details?.error).toBe('DB connection refused');
            expect(result.errors).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    describe('Result Structure', () => {
        it('should always return a valid CronJobResult shape', async () => {
            // Arrange
            const ctx = createMockContext();
            mockFindAllEnabled.mockResolvedValue([]);

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result).toMatchObject({
                success: expect.any(Boolean),
                message: expect.any(String),
                processed: expect.any(Number),
                errors: expect.any(Number),
                durationMs: expect.any(Number)
            });
        });

        it('should include details with revalidated, staleRevalidated, deleted, and dryRun fields', async () => {
            // Arrange
            const ctx = createMockContext();
            mockFindAllEnabled.mockResolvedValue([]);
            mockDeleteOlderThan.mockResolvedValue(3);

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            expect(result.details).toMatchObject({
                revalidated: expect.any(Number),
                staleRevalidated: expect.any(Number),
                deleted: expect.any(Number),
                dryRun: false
            });
        });

        it('should set processed to revalidated + staleRevalidated', async () => {
            // Arrange — one config past due with autoRevalidateOnChange
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const config = makeConfig('accommodation', 60, true);

            mockFindAllEnabled.mockResolvedValue([config]);
            const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
            mockFindLastCronEntry.mockResolvedValue(makeLogEntry(seventyTwoHoursAgo));

            const ctx = createMockContext();

            // Act
            const result = await pageRevalidationJob.handler(ctx);

            // Assert
            const expected =
                (result.details?.revalidated as number) +
                (result.details?.staleRevalidated as number);
            expect(result.processed).toBe(expected);
        });
    });
});
