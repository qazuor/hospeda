/**
 * Unit tests for AI usage reporting (SPEC-173 T-018).
 *
 * Coverage:
 *   - getUtcMonthRange: pure function — Jan, Jun, Dec (year rollover), half-open boundaries.
 *   - getMonthlyUsage: stubs storage, asserts correct filters forwarded, rows returned.
 *   - getUsageByUser: stubs storage, asserts month range computed correctly, feature forwarded.
 *   - getUsageByFeature: stubs storage, asserts month range computed correctly, userId forwarded.
 *
 * The storage layer (`../../src/storage/index.js`) is stubbed entirely via
 * `vi.mock` so NO real database connection is required.
 *
 * @module test/reporting
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock storage BEFORE importing the modules under test
// ---------------------------------------------------------------------------

vi.mock('../src/storage/index.js', () => ({
    aggregateAiUsageByMonth: vi.fn(),
    aggregateAiUsageByUser: vi.fn(),
    aggregateAiUsageByFeature: vi.fn(),
    // Pass-through re-exports from original module that reporting doesn't use:
    insertAiUsage: vi.fn(),
    insertAiRequestLog: vi.fn(),
    readAiSettings: vi.fn(),
    writeAiSettings: vi.fn(),
    getActivePrompt: vi.fn(),
    AiSettingsParseError: class AiSettingsParseError extends Error {}
}));

import * as storageModule from '../src/storage/index.js';
import { getUtcMonthRange } from '../src/usage/reporting/month-range.js';
import {
    getMonthlyUsage,
    getUsageByFeature,
    getUsageByUser
} from '../src/usage/reporting/usage-reporting.js';

const mockAggregateByMonth = storageModule.aggregateAiUsageByMonth as ReturnType<typeof vi.fn>;
const mockAggregateByUser = storageModule.aggregateAiUsageByUser as ReturnType<typeof vi.fn>;
const mockAggregateByFeature = storageModule.aggregateAiUsageByFeature as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// getUtcMonthRange — pure function
// ---------------------------------------------------------------------------

describe('getUtcMonthRange', () => {
    describe('when given January 2026', () => {
        it('should set monthStart to 2026-01-01T00:00:00.000Z', () => {
            // Arrange + Act
            const { monthStart } = getUtcMonthRange({ year: 2026, month: 1 });

            // Assert
            expect(monthStart.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        });

        it('should set monthEnd to 2026-02-01T00:00:00.000Z', () => {
            // Arrange + Act
            const { monthEnd } = getUtcMonthRange({ year: 2026, month: 1 });

            // Assert
            expect(monthEnd.toISOString()).toBe('2026-02-01T00:00:00.000Z');
        });
    });

    describe('when given June 2026', () => {
        it('should set monthStart to 2026-06-01T00:00:00.000Z', () => {
            // Arrange + Act
            const { monthStart } = getUtcMonthRange({ year: 2026, month: 6 });

            // Assert
            expect(monthStart.toISOString()).toBe('2026-06-01T00:00:00.000Z');
        });

        it('should set monthEnd to 2026-07-01T00:00:00.000Z', () => {
            // Arrange + Act
            const { monthEnd } = getUtcMonthRange({ year: 2026, month: 6 });

            // Assert
            expect(monthEnd.toISOString()).toBe('2026-07-01T00:00:00.000Z');
        });
    });

    describe('when given December 2026 (year-rollover)', () => {
        it('should set monthStart to 2026-12-01T00:00:00.000Z', () => {
            // Arrange + Act
            const { monthStart } = getUtcMonthRange({ year: 2026, month: 12 });

            // Assert
            expect(monthStart.toISOString()).toBe('2026-12-01T00:00:00.000Z');
        });

        it('should set monthEnd to 2027-01-01T00:00:00.000Z (rolls over to next year)', () => {
            // Arrange + Act
            const { monthEnd } = getUtcMonthRange({ year: 2026, month: 12 });

            // Assert
            expect(monthEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
        });
    });

    describe('half-open boundary semantics', () => {
        it('should have monthEnd strictly after monthStart', () => {
            // Arrange + Act
            const { monthStart, monthEnd } = getUtcMonthRange({ year: 2026, month: 6 });

            // Assert
            expect(monthEnd.getTime()).toBeGreaterThan(monthStart.getTime());
        });

        it('should span exactly 30 days for June (30-day month)', () => {
            // Arrange + Act
            const { monthStart, monthEnd } = getUtcMonthRange({ year: 2026, month: 6 });
            const spanMs = monthEnd.getTime() - monthStart.getTime();
            const spanDays = spanMs / (1000 * 60 * 60 * 24);

            // Assert
            expect(spanDays).toBe(30);
        });

        it('should span exactly 31 days for January (31-day month)', () => {
            // Arrange + Act
            const { monthStart, monthEnd } = getUtcMonthRange({ year: 2026, month: 1 });
            const spanMs = monthEnd.getTime() - monthStart.getTime();
            const spanDays = spanMs / (1000 * 60 * 60 * 24);

            // Assert
            expect(spanDays).toBe(31);
        });
    });

    describe('when given invalid inputs', () => {
        it('should throw RangeError for month 0', () => {
            // Arrange + Act + Assert
            expect(() => getUtcMonthRange({ year: 2026, month: 0 })).toThrow(RangeError);
        });

        it('should throw RangeError for month 13', () => {
            expect(() => getUtcMonthRange({ year: 2026, month: 13 })).toThrow(RangeError);
        });

        it('should throw RangeError for non-integer year', () => {
            expect(() => getUtcMonthRange({ year: 2026.5, month: 6 })).toThrow(RangeError);
        });

        it('should throw RangeError for zero year', () => {
            expect(() => getUtcMonthRange({ year: 0, month: 6 })).toThrow(RangeError);
        });
    });
});

// ---------------------------------------------------------------------------
// getMonthlyUsage — delegates to aggregateAiUsageByMonth
// ---------------------------------------------------------------------------

describe('getMonthlyUsage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('when the storage returns rows', () => {
        it('should pass since/until/userId/feature through to storage', async () => {
            // Arrange
            const since = new Date('2026-01-01T00:00:00Z');
            const until = new Date('2026-07-01T00:00:00Z');
            mockAggregateByMonth.mockResolvedValue([]);

            // Act
            await getMonthlyUsage({ since, until, userId: 'user-1', feature: 'chat' });

            // Assert
            expect(mockAggregateByMonth).toHaveBeenCalledOnce();
            expect(mockAggregateByMonth).toHaveBeenCalledWith({
                since,
                until,
                userId: 'user-1',
                feature: 'chat'
            });
        });

        it('should return the rows as-is (pass-through)', async () => {
            // Arrange
            const stubRows = [
                { month: '2026-06', calls: 10, tokensIn: 2000, tokensOut: 1000, costMicroUsd: 600 }
            ];
            mockAggregateByMonth.mockResolvedValue(stubRows);

            // Act
            const result = await getMonthlyUsage({});

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                month: '2026-06',
                calls: 10,
                tokensIn: 2000,
                tokensOut: 1000,
                costMicroUsd: 600
            });
        });

        it('should return an empty array when storage returns no rows', async () => {
            // Arrange
            mockAggregateByMonth.mockResolvedValue([]);

            // Act
            const result = await getMonthlyUsage({});

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('when called with no filters', () => {
        it('should call storage with an empty input object', async () => {
            // Arrange
            mockAggregateByMonth.mockResolvedValue([]);

            // Act
            await getMonthlyUsage({});

            // Assert
            expect(mockAggregateByMonth).toHaveBeenCalledWith({});
        });
    });
});

// ---------------------------------------------------------------------------
// getUsageByUser — computes month range then delegates
// ---------------------------------------------------------------------------

describe('getUsageByUser', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('when given year=2026, month=6', () => {
        it('should call aggregateAiUsageByUser with the correct UTC month range', async () => {
            // Arrange
            mockAggregateByUser.mockResolvedValue([]);

            // Act
            await getUsageByUser({ year: 2026, month: 6 });

            // Assert
            expect(mockAggregateByUser).toHaveBeenCalledOnce();
            const callArg = mockAggregateByUser.mock.calls[0][0] as {
                monthStart: Date;
                monthEnd: Date;
                feature?: string;
            };
            expect(callArg.monthStart.toISOString()).toBe('2026-06-01T00:00:00.000Z');
            expect(callArg.monthEnd.toISOString()).toBe('2026-07-01T00:00:00.000Z');
        });

        it('should forward the feature filter to storage', async () => {
            // Arrange
            mockAggregateByUser.mockResolvedValue([]);

            // Act
            await getUsageByUser({ year: 2026, month: 6, feature: 'text_improve' });

            // Assert
            const callArg = mockAggregateByUser.mock.calls[0][0] as { feature?: string };
            expect(callArg.feature).toBe('text_improve');
        });
    });

    describe('when given year=2026, month=12 (year rollover)', () => {
        it('should compute monthEnd as 2027-01-01T00:00:00.000Z', async () => {
            // Arrange
            mockAggregateByUser.mockResolvedValue([]);

            // Act
            await getUsageByUser({ year: 2026, month: 12 });

            // Assert
            const callArg = mockAggregateByUser.mock.calls[0][0] as { monthEnd: Date };
            expect(callArg.monthEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
        });
    });

    describe('when storage returns rows', () => {
        it('should return rows with correct costMicroUsd value', async () => {
            // Arrange
            const stubRows = [
                {
                    userId: '550e8400-e29b-41d4-a716-446655440000',
                    calls: 5,
                    tokensIn: 500,
                    tokensOut: 200,
                    costMicroUsd: 250
                }
            ];
            mockAggregateByUser.mockResolvedValue(stubRows);

            // Act
            const result = await getUsageByUser({ year: 2026, month: 6 });

            // Assert
            expect(result[0]?.costMicroUsd).toBe(250);
            expect(result[0]?.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should return rows with userId null for anonymised rows', async () => {
            // Arrange
            const stubRows = [
                { userId: null, calls: 1, tokensIn: 50, tokensOut: 20, costMicroUsd: 10 }
            ];
            mockAggregateByUser.mockResolvedValue(stubRows);

            // Act
            const result = await getUsageByUser({ year: 2026, month: 6 });

            // Assert
            expect(result[0]?.userId).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// getUsageByFeature — computes month range then delegates
// ---------------------------------------------------------------------------

describe('getUsageByFeature', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('when given year=2026, month=6', () => {
        it('should call aggregateAiUsageByFeature with the correct UTC month range', async () => {
            // Arrange
            mockAggregateByFeature.mockResolvedValue([]);

            // Act
            await getUsageByFeature({ year: 2026, month: 6 });

            // Assert
            expect(mockAggregateByFeature).toHaveBeenCalledOnce();
            const callArg = mockAggregateByFeature.mock.calls[0][0] as {
                monthStart: Date;
                monthEnd: Date;
                userId?: string;
            };
            expect(callArg.monthStart.toISOString()).toBe('2026-06-01T00:00:00.000Z');
            expect(callArg.monthEnd.toISOString()).toBe('2026-07-01T00:00:00.000Z');
        });

        it('should forward the userId filter to storage', async () => {
            // Arrange
            mockAggregateByFeature.mockResolvedValue([]);

            // Act
            await getUsageByFeature({
                year: 2026,
                month: 6,
                userId: '550e8400-e29b-41d4-a716-446655440000'
            });

            // Assert
            const callArg = mockAggregateByFeature.mock.calls[0][0] as { userId?: string };
            expect(callArg.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
        });
    });

    describe('when storage returns rows', () => {
        it('should return feature rows with correct token and cost sums', async () => {
            // Arrange
            const stubRows = [
                {
                    feature: 'chat',
                    calls: 30,
                    tokensIn: 6_000,
                    tokensOut: 3_000,
                    costMicroUsd: 1_800
                },
                {
                    feature: 'text_improve',
                    calls: 10,
                    tokensIn: 2_000,
                    tokensOut: 1_000,
                    costMicroUsd: 600
                }
            ];
            mockAggregateByFeature.mockResolvedValue(stubRows);

            // Act
            const result = await getUsageByFeature({ year: 2026, month: 6 });

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]?.feature).toBe('chat');
            expect(result[0]?.costMicroUsd).toBe(1_800);
            expect(result[1]?.feature).toBe('text_improve');
            expect(result[1]?.tokensIn).toBe(2_000);
        });

        it('should return an empty array when storage returns no rows', async () => {
            // Arrange
            mockAggregateByFeature.mockResolvedValue([]);

            // Act
            const result = await getUsageByFeature({ year: 2026, month: 1 });

            // Assert
            expect(result).toEqual([]);
        });
    });
});
