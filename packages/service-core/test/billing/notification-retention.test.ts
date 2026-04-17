import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    billingNotificationLog: {
        createdAt: 'createdAt',
        expiredAt: 'expiredAt'
    },
    getDb: vi.fn(),
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    isNotNull: vi.fn((col: unknown) => ({ type: 'isNotNull', col })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            type: 'sql',
            strings,
            values
        })),
        {
            raw: vi.fn((s: string) => ({ type: 'sql.raw', s }))
        }
    )
}));

vi.mock('drizzle-orm', () => ({
    lt: vi.fn((col: unknown, val: unknown) => ({ type: 'lt', col, val }))
}));

import * as dbModule from '@repo/db';
import type { QueryContext } from '@repo/db';
import {
    NotificationRetentionService,
    type RetentionSummary
} from '../../src/services/billing/notification/notification-retention.service.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a chainable Drizzle-style `update()` mock that resolves with the
 * given rowCount.
 */
function makeUpdateMock(rowCount: number): ReturnType<typeof vi.fn> {
    return vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ rowCount })
        })
    });
}

/**
 * Builds a chainable Drizzle-style `delete()` mock that resolves with the
 * given rowCount.
 */
function makeDeleteMock(rowCount: number): ReturnType<typeof vi.fn> {
    return vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount })
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationRetentionService', () => {
    let service: NotificationRetentionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new NotificationRetentionService();
    });

    // ──────────────────────────────────────────────────────────────────────────
    // markExpired — basic behaviour
    // ──────────────────────────────────────────────────────────────────────────

    describe('markExpired', () => {
        it('should return the count of records marked as expired', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ update: makeUpdateMock(7) });

            // Act
            const count = await service.markExpired();

            // Assert
            expect(count).toBe(7);
        });

        it('should use DEFAULT_RETENTION_DAYS (90) when no argument is supplied', async () => {
            // Arrange
            const updateFn = makeUpdateMock(0);
            mockGetDb.mockReturnValue({ update: updateFn });

            // Act
            await service.markExpired();

            // Assert — update was called once (days validation passes for 90)
            expect(updateFn).toHaveBeenCalledTimes(1);
        });

        it('should return 0 when rowCount is null/undefined', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue({ rowCount: null })
                    })
                })
            });

            // Act
            const count = await service.markExpired();

            // Assert
            expect(count).toBe(0);
        });

        it('should throw when retentionDays is not a positive integer', async () => {
            await expect(service.markExpired(0)).rejects.toThrow('retentionDays');
            await expect(service.markExpired(-5)).rejects.toThrow('retentionDays');
            await expect(service.markExpired(3651)).rejects.toThrow('retentionDays');
        });

        // ctx threading
        it('should use ctx.tx instead of getDb() when ctx with tx is provided', async () => {
            // Arrange
            const txMock = { update: makeUpdateMock(3) };
            const ctx = { tx: txMock } as unknown as QueryContext;

            // Act
            const count = await service.markExpired(90, ctx);

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(txMock.update).toHaveBeenCalledTimes(1);
            expect(count).toBe(3);
        });

        it('should fall back to getDb() when ctx is undefined', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ update: makeUpdateMock(2) });

            // Act
            await service.markExpired(90, undefined);

            // Assert
            expect(mockGetDb).toHaveBeenCalled();
        });

        it('should fall back to getDb() when ctx has no tx property', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ update: makeUpdateMock(2) });

            // Act
            await service.markExpired(90, {});

            // Assert
            expect(mockGetDb).toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // purgeExpired — basic behaviour
    // ──────────────────────────────────────────────────────────────────────────

    describe('purgeExpired', () => {
        it('should return the count of records permanently deleted', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ delete: makeDeleteMock(5) });

            // Act
            const count = await service.purgeExpired();

            // Assert
            expect(count).toBe(5);
        });

        it('should use DEFAULT_GRACE_DAYS (30) when no argument is supplied', async () => {
            // Arrange
            const deleteFn = makeDeleteMock(0);
            mockGetDb.mockReturnValue({ delete: deleteFn });

            // Act
            await service.purgeExpired();

            // Assert
            expect(deleteFn).toHaveBeenCalledTimes(1);
        });

        it('should return 0 when rowCount is null/undefined', async () => {
            // Arrange
            mockGetDb.mockReturnValue({
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue({ rowCount: undefined })
                })
            });

            // Act
            const count = await service.purgeExpired();

            // Assert
            expect(count).toBe(0);
        });

        it('should throw when graceDays is not a positive integer', async () => {
            await expect(service.purgeExpired(0)).rejects.toThrow('graceDays');
            await expect(service.purgeExpired(-1)).rejects.toThrow('graceDays');
            await expect(service.purgeExpired(3651)).rejects.toThrow('graceDays');
        });

        // ctx threading
        it('should use ctx.tx instead of getDb() when ctx with tx is provided', async () => {
            // Arrange
            const txMock = { delete: makeDeleteMock(4) };
            const ctx = { tx: txMock } as unknown as QueryContext;

            // Act
            const count = await service.purgeExpired(30, ctx);

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(txMock.delete).toHaveBeenCalledTimes(1);
            expect(count).toBe(4);
        });

        it('should fall back to getDb() when ctx is undefined', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ delete: makeDeleteMock(1) });

            // Act
            await service.purgeExpired(30, undefined);

            // Assert
            expect(mockGetDb).toHaveBeenCalled();
        });

        it('should fall back to getDb() when ctx has no tx property', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ delete: makeDeleteMock(1) });

            // Act
            await service.purgeExpired(30, {});

            // Assert
            expect(mockGetDb).toHaveBeenCalled();
        });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // runRetentionPolicy
    // ──────────────────────────────────────────────────────────────────────────

    describe('runRetentionPolicy', () => {
        it('should return a summary combining marked and purged counts', async () => {
            // Arrange — two sequential calls: update then delete
            let callCount = 0;
            mockGetDb.mockImplementation(() => {
                callCount += 1;
                if (callCount === 1) return { update: makeUpdateMock(10) };
                return { delete: makeDeleteMock(3) };
            });

            // Act
            const summary: RetentionSummary = await service.runRetentionPolicy();

            // Assert
            expect(summary.markedExpired).toBe(10);
            expect(summary.purged).toBe(3);
        });

        it('should propagate ctx to markExpired and purgeExpired', async () => {
            // Arrange
            const updateFn = makeUpdateMock(6);
            const deleteFn = makeDeleteMock(2);
            const txMock = { update: updateFn, delete: deleteFn };
            const ctx = { tx: txMock } as unknown as QueryContext;

            // Act
            const summary = await service.runRetentionPolicy(90, 30, ctx);

            // Assert — getDb() never called; both operations used the tx mock
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(updateFn).toHaveBeenCalledTimes(1);
            expect(deleteFn).toHaveBeenCalledTimes(1);
            expect(summary.markedExpired).toBe(6);
            expect(summary.purged).toBe(2);
        });

        it('should fall back to getDb() for both operations when no ctx is provided', async () => {
            // Arrange
            let callCount = 0;
            mockGetDb.mockImplementation(() => {
                callCount += 1;
                if (callCount === 1) return { update: makeUpdateMock(0) };
                return { delete: makeDeleteMock(0) };
            });

            // Act
            await service.runRetentionPolicy();

            // Assert
            expect(mockGetDb).toHaveBeenCalledTimes(2);
        });

        it('should propagate custom retentionDays and graceDays to inner calls', async () => {
            // Arrange
            const updateFn = makeUpdateMock(0);
            const deleteFn = makeDeleteMock(0);
            const txMock = { update: updateFn, delete: deleteFn };
            const ctx = { tx: txMock } as unknown as QueryContext;

            // Act — custom days (should not throw)
            await expect(service.runRetentionPolicy(180, 60, ctx)).resolves.toMatchObject({
                markedExpired: 0,
                purged: 0
            });
        });
    });
});
