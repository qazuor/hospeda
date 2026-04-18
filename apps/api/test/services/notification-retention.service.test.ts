/**
 * NotificationRetentionService - Input Validation Tests
 *
 * Focused tests for the SQL injection fix (T-008):
 * - Validates that days parameters are positive integers within bounds
 * - Ensures sql.raw() is not used (parameterized queries instead)
 *
 * @module test/services/notification-retention.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationRetentionService } from '../../src/services/notification-retention.service';

// Hoist mock variables
const { _mockDb, mockGetDb } = vi.hoisted(() => {
    const mockResult = { rowCount: 0 };
    const _mockDb = {
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockResult),
        execute: vi.fn().mockResolvedValue({ rows: [] })
    };

    return {
        _mockDb,
        mockGetDb: vi.fn(() => _mockDb)
    };
});

// Mock @repo/db
vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    // SPEC-064: withTransaction is used by service-core services for atomic operations
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(mockGetDb())
    ),
    billingNotificationLog: {
        createdAt: 'createdAt',
        expiredAt: 'expiredAt'
    },
    and: vi.fn((...args: unknown[]) => args),
    isNull: vi.fn((col: unknown) => ({ isNull: col })),
    isNotNull: vi.fn((col: unknown) => ({ isNotNull: col })),
    sql: Object.assign(
        (strings: TemplateStringsArray, ...values: unknown[]) => ({
            strings,
            values,
            type: 'parameterized'
        }),
        {
            raw: vi.fn((value: string) => ({
                value,
                type: 'raw_unsafe'
            }))
        }
    )
}));

vi.mock('drizzle-orm', () => ({
    lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
    sql: Object.assign(
        (strings: TemplateStringsArray, ...values: unknown[]) => ({
            strings,
            values,
            type: 'parameterized'
        }),
        {
            raw: vi.fn((value: string) => ({
                value,
                type: 'raw_unsafe'
            }))
        }
    )
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('NotificationRetentionService - Input Validation', () => {
    let service: NotificationRetentionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new NotificationRetentionService();
    });

    describe('markExpired - input validation', () => {
        it('should reject negative retention days', async () => {
            await expect(service.markExpired(-1)).rejects.toThrow(
                'retentionDays must be a positive integer between 1 and 3650'
            );
        });

        it('should reject zero retention days', async () => {
            await expect(service.markExpired(0)).rejects.toThrow(
                'retentionDays must be a positive integer between 1 and 3650'
            );
        });

        it('should reject non-integer retention days', async () => {
            await expect(service.markExpired(3.5)).rejects.toThrow(
                'retentionDays must be a positive integer between 1 and 3650'
            );
        });

        it('should reject retention days exceeding maximum', async () => {
            await expect(service.markExpired(3651)).rejects.toThrow(
                'retentionDays must be a positive integer between 1 and 3650'
            );
        });

        it('should accept valid retention days at lower bound', async () => {
            await expect(service.markExpired(1)).resolves.not.toThrow();
        });

        it('should accept valid retention days at upper bound', async () => {
            await expect(service.markExpired(3650)).resolves.not.toThrow();
        });

        it('should accept default retention days', async () => {
            await expect(service.markExpired()).resolves.not.toThrow();
        });
    });

    describe('purgeExpired - input validation', () => {
        it('should reject negative grace days', async () => {
            await expect(service.purgeExpired(-5)).rejects.toThrow(
                'graceDays must be a positive integer between 1 and 3650'
            );
        });

        it('should reject zero grace days', async () => {
            await expect(service.purgeExpired(0)).rejects.toThrow(
                'graceDays must be a positive integer between 1 and 3650'
            );
        });

        it('should reject non-integer grace days', async () => {
            await expect(service.purgeExpired(2.7)).rejects.toThrow(
                'graceDays must be a positive integer between 1 and 3650'
            );
        });

        it('should reject grace days exceeding maximum', async () => {
            await expect(service.purgeExpired(5000)).rejects.toThrow(
                'graceDays must be a positive integer between 1 and 3650'
            );
        });

        it('should accept valid grace days', async () => {
            await expect(service.purgeExpired(30)).resolves.not.toThrow();
        });

        it('should accept default grace days', async () => {
            await expect(service.purgeExpired()).resolves.not.toThrow();
        });
    });

    describe('runRetentionPolicy - input validation', () => {
        it('should reject invalid retention days', async () => {
            await expect(service.runRetentionPolicy(-1, 30)).rejects.toThrow(
                'retentionDays must be a positive integer between 1 and 3650'
            );
        });

        it('should reject invalid grace days', async () => {
            await expect(service.runRetentionPolicy(90, -1)).rejects.toThrow(
                'graceDays must be a positive integer between 1 and 3650'
            );
        });

        it('should accept valid parameters', async () => {
            await expect(service.runRetentionPolicy(90, 30)).resolves.not.toThrow();
        });
    });

    describe('sql.raw is not used', () => {
        it('should not call sql.raw when marking expired', async () => {
            const { sql } = await import('@repo/db');

            await service.markExpired(90);

            expect(sql.raw).not.toHaveBeenCalled();
        });

        it('should not call sql.raw when purging expired', async () => {
            const { sql } = await import('@repo/db');

            await service.purgeExpired(30);

            expect(sql.raw).not.toHaveBeenCalled();
        });
    });
});
