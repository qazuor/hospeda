/**
 * Unit tests for `getMonthlyCallCount` (SPEC-173 T-031).
 *
 * Coverage:
 *   - Resolves the correct UTC month range from `now`.
 *   - Passes `statuses: ['success', 'fallback']` to `countAiUsageForUserFeatureMonth`.
 *   - Returns the count returned by the storage layer.
 *   - Returns 0 when the storage layer returns 0 (no usage).
 *   - Correctly derives year/month from a UTC `now` value (handles month boundaries
 *     and year rollovers).
 *
 * The storage layer (`countAiUsageForUserFeatureMonth`) is fully mocked via
 * `vi.mock` — no real database connection is required.
 *
 * @module test/monthly-call-count
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock storage BEFORE importing modules under test (Vitest requirement)
// ---------------------------------------------------------------------------

vi.mock('../src/storage/index.js', () => ({
    countAiUsageForUserFeatureMonth: vi.fn()
}));

import * as storageModule from '../src/storage/index.js';
import { getMonthlyCallCount } from '../src/usage/reporting/monthly-call-count.js';

const mockCountAiUsageForUserFeatureMonth =
    storageModule.countAiUsageForUserFeatureMonth as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getMonthlyCallCount', () => {
    const USER_ID = 'user-abc-123';
    const FEATURE = 'text_improve';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when usage exists for the current month', () => {
        it('should return the count from the storage layer', async () => {
            // Arrange
            mockCountAiUsageForUserFeatureMonth.mockResolvedValue(7);
            const now = new Date('2026-06-15T10:30:00Z');

            // Act
            const result = await getMonthlyCallCount({ userId: USER_ID, feature: FEATURE, now });

            // Assert
            expect(result).toBe(7);
        });

        it('should pass only success and fallback statuses to the storage layer', async () => {
            // Arrange
            mockCountAiUsageForUserFeatureMonth.mockResolvedValue(3);
            const now = new Date('2026-06-15T10:30:00Z');

            // Act
            await getMonthlyCallCount({ userId: USER_ID, feature: FEATURE, now });

            // Assert: storage layer is called with the correct status filter
            expect(mockCountAiUsageForUserFeatureMonth).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: USER_ID,
                    feature: FEATURE,
                    statuses: ['success', 'fallback']
                })
            );
        });
    });

    describe('when no usage exists for the current month', () => {
        it('should return 0', async () => {
            // Arrange
            mockCountAiUsageForUserFeatureMonth.mockResolvedValue(0);
            const now = new Date('2026-06-01T00:00:00Z');

            // Act
            const result = await getMonthlyCallCount({ userId: USER_ID, feature: FEATURE, now });

            // Assert
            expect(result).toBe(0);
        });
    });

    describe('UTC month boundary resolution', () => {
        it('should derive the correct month window for June 2026', async () => {
            // Arrange
            mockCountAiUsageForUserFeatureMonth.mockResolvedValue(0);
            const now = new Date('2026-06-15T12:00:00Z');

            // Act
            await getMonthlyCallCount({ userId: USER_ID, feature: FEATURE, now });

            // Assert: the window passed to storage is June 2026
            expect(mockCountAiUsageForUserFeatureMonth).toHaveBeenCalledWith(
                expect.objectContaining({
                    monthStart: new Date('2026-06-01T00:00:00.000Z'),
                    monthEnd: new Date('2026-07-01T00:00:00.000Z')
                })
            );
        });

        it('should handle December (year rollover) correctly', async () => {
            // Arrange
            mockCountAiUsageForUserFeatureMonth.mockResolvedValue(0);
            const now = new Date('2026-12-20T00:00:00Z');

            // Act
            await getMonthlyCallCount({ userId: USER_ID, feature: FEATURE, now });

            // Assert: monthEnd should be January 2027, not December 2026
            expect(mockCountAiUsageForUserFeatureMonth).toHaveBeenCalledWith(
                expect.objectContaining({
                    monthStart: new Date('2026-12-01T00:00:00.000Z'),
                    monthEnd: new Date('2027-01-01T00:00:00.000Z')
                })
            );
        });

        it('should derive month from UTC (not local time) of now', async () => {
            // Arrange: choose a UTC timestamp at the end-of-month boundary
            mockCountAiUsageForUserFeatureMonth.mockResolvedValue(0);
            // 2026-06-30T23:59:59Z is still June UTC
            const now = new Date('2026-06-30T23:59:59Z');

            // Act
            await getMonthlyCallCount({ userId: USER_ID, feature: FEATURE, now });

            // Assert: still June 2026 window (not July)
            expect(mockCountAiUsageForUserFeatureMonth).toHaveBeenCalledWith(
                expect.objectContaining({
                    monthStart: new Date('2026-06-01T00:00:00.000Z'),
                    monthEnd: new Date('2026-07-01T00:00:00.000Z')
                })
            );
        });
    });

    describe('forwarding userId and feature to storage', () => {
        it('should forward userId and feature unchanged', async () => {
            // Arrange
            mockCountAiUsageForUserFeatureMonth.mockResolvedValue(2);
            const now = new Date('2026-06-15T00:00:00Z');

            // Act
            await getMonthlyCallCount({ userId: 'specific-user-id', feature: 'chat', now });

            // Assert
            expect(mockCountAiUsageForUserFeatureMonth).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'specific-user-id',
                    feature: 'chat'
                })
            );
        });
    });
});
