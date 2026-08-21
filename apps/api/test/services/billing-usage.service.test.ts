/**
 * Tests for BillingUsageService
 *
 * Covers `getSystemUsage`'s aggregate counts, focused on the HOS-736
 * regression: the per-plan `customer_count` query must derive its status
 * filter from the canonical `ENTITLEMENT_GRANTING_STATUSES` constant (which
 * includes `comp`), never a hand-rolled `IN ('active', 'trialing')` literal.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database execute function
const mockExecute = vi.fn();

// Mock @repo/db - MUST be before imports
vi.mock('@repo/db', () => {
    const mockSql = Object.assign(
        vi.fn((...args: unknown[]) => ({
            // Return a mock SQL object capturing the tagged-template args
            queryChunks: args
        })),
        {
            raw: vi.fn((str: string) => str),
            // HOS-736: mirrors the real `sql.join` used to build parametrized
            // `IN (...)` clauses from ENTITLEMENT_GRANTING_STATUSES.
            join: vi.fn((chunks: unknown[], _separator: unknown) => ({
                queryChunks: ['JOIN', chunks]
            }))
        }
    );

    return {
        getDb: vi.fn(() => ({
            execute: mockExecute
        })),
        sql: mockSql
    };
});

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Import after mocks
import { sql } from '@repo/db';
import { getSystemUsage } from '../../src/services/billing-usage.service';

/** Default resolved value shared by the three parallel queries in getSystemUsage. */
function mockDefaultExecuteResults(): void {
    mockExecute
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // totalCustomers
        .mockResolvedValueOnce({ rows: [] }) // customersByCategory
        .mockResolvedValueOnce({ rows: [] }); // planStats
}

describe('BillingUsageService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getSystemUsage', () => {
        it('should derive the plan-stats status filter from ENTITLEMENT_GRANTING_STATUSES, including comp (HOS-736)', async () => {
            // Arrange
            mockDefaultExecuteResults();

            // Act
            const result = await getSystemUsage(true);

            // Assert
            expect(result.success).toBe(true);
            // The customer_count-per-plan query must be built from the canonical
            // ENTITLEMENT_GRANTING_STATUSES constant via `sql.join`, never a
            // hand-rolled `IN ('active', 'trialing')` literal — regression test
            // for HOS-736 (comp subscribers were undercounted in admin usage
            // metrics).
            const joinCalls = (sql.join as unknown as { mock: { calls: unknown[][] } }).mock.calls;
            expect(joinCalls.length).toBeGreaterThan(0);
            const sawCompInAnyJoin = joinCalls.some(([chunks]) =>
                (chunks as Array<{ queryChunks?: unknown[] }>).some(
                    (chunk) => chunk?.queryChunks?.[1] === 'comp'
                )
            );
            expect(sawCompInAnyJoin).toBe(true);
        });

        it('should return successful stats with correct totals', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '25' }] })
                .mockResolvedValueOnce({
                    rows: [{ category: 'owner', count: '20' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ plan_slug: 'plan-a', plan_name: 'plan-a', customer_count: '7' }]
                });

            // Act
            const result = await getSystemUsage(true);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.totalCustomers).toBe(25);
            expect(result.data?.customersByCategory.owner).toBe(20);
            expect(result.data?.planStats).toEqual([
                { planSlug: 'plan-a', planName: 'plan-a', customerCount: 7, averageUsage: {} }
            ]);
        });

        it('should return error result on database failure', async () => {
            // Arrange
            mockExecute.mockRejectedValueOnce(new Error('Syntax error in query'));

            // Act
            const result = await getSystemUsage(true);

            // Assert
            expect(result.success).toBe(false);
            if (result.success) return;
            expect(result.error.message).toContain('Failed to get system usage stats');
        });
    });
});
