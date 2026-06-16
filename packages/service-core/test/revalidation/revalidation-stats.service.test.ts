/**
 * Unit tests for RevalidationStatsService
 *
 * Covers:
 * - getStats(): success path with data
 * - getStats(): success path with no rows (zero values)
 * - getStats(): byEntityType breakdown aggregation
 * - getStats(): byTrigger breakdown aggregation
 * - getStats(): successRate calculation
 * - getStats(): avgDurationMs rounding
 *
 * All DB calls are mocked via vi.mock — no real database needed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockGetDb } = vi.hoisted(() => ({
    mockGetDb: vi.fn()
}));

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    revalidationLog: {
        status: 'status',
        entityType: 'entityType',
        trigger: 'trigger',
        createdAt: 'createdAt',
        durationMs: 'durationMs'
    }
}));

// drizzle-orm is imported directly in the source file — mock it too
vi.mock('drizzle-orm', () => ({
    avg: vi.fn((col: unknown) => ({ _avg: col })),
    count: vi.fn((col?: unknown) => ({ _count: col ?? '*' })),
    gt: vi.fn((col: unknown, val: unknown) => ({ _gt: { col, val } })),
    max: vi.fn((col: unknown) => ({ _max: col })),
    sql: Object.assign(
        vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        })),
        { raw: vi.fn() }
    )
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { RevalidationStatsService } from '../../src/revalidation/revalidation-stats.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Builds a mock chain that resolves to `rows` for both direct awaiting and
 * after any intermediary calls (groupBy, where, from, select).
 */
function makeSelectChain(rows: unknown[]) {
    const chain: Record<string, unknown> = {};

    const resolved = Promise.resolve(rows);
    Object.assign(chain, resolved);
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock of Drizzle's awaitable query builder
    (chain as { then: unknown }).then = resolved.then.bind(resolved);
    (chain as { catch: unknown }).catch = resolved.catch.bind(resolved);

    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockReturnValue(chain);

    return chain;
}

/**
 * Creates a mock DB whose `.select()` returns successive chains from the
 * provided `results` array. Each call to `.select()` uses the next result.
 */
function buildMockDb(results: unknown[][]) {
    let idx = 0;
    return {
        select: vi.fn().mockImplementation(() => {
            const rows = results[idx] ?? [];
            idx++;
            return makeSelectChain(rows);
        })
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('RevalidationStatsService', () => {
    let svc: RevalidationStatsService;

    beforeEach(() => {
        vi.clearAllMocks();
        svc = new RevalidationStatsService();
    });

    describe('getStats()', () => {
        it('should return zero totals when there are no log entries', async () => {
            // Arrange
            const db = buildMockDb([
                [{ total: 0, successCount: 0, avgDurationMs: null, lastRevalidation: null }],
                [], // entityType breakdown
                [] // trigger breakdown
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getStats();

            // Assert
            expect(result.totalRevalidations).toBe(0);
            expect(result.successRate).toBe(0);
            expect(result.avgDurationMs).toBe(0);
            expect(result.lastRevalidation).toBeNull();
            expect(result.byEntityType).toEqual({});
            expect(result.byTrigger).toEqual({});
        });

        it('should compute successRate as successCount / total', async () => {
            // Arrange
            const db = buildMockDb([
                [
                    {
                        total: 10,
                        successCount: 8,
                        avgDurationMs: '250',
                        lastRevalidation: new Date('2025-06-01')
                    }
                ],
                [],
                []
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getStats();

            // Assert
            expect(result.totalRevalidations).toBe(10);
            expect(result.successRate).toBeCloseTo(0.8);
        });

        it('should round avgDurationMs to nearest integer', async () => {
            // Arrange
            const db = buildMockDb([
                [{ total: 4, successCount: 4, avgDurationMs: '123.7', lastRevalidation: null }],
                [],
                []
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getStats();

            // Assert
            expect(result.avgDurationMs).toBe(124); // Math.round(123.7)
        });

        it('should populate byEntityType from grouped query', async () => {
            // Arrange
            const db = buildMockDb([
                [{ total: 5, successCount: 5, avgDurationMs: '100', lastRevalidation: null }],
                [
                    { entityType: 'accommodation', cnt: 3 },
                    { entityType: 'destination', cnt: 2 }
                ],
                []
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getStats();

            // Assert
            expect(result.byEntityType).toEqual({
                accommodation: 3,
                destination: 2
            });
        });

        it('should populate byTrigger from grouped query', async () => {
            // Arrange
            const db = buildMockDb([
                [{ total: 6, successCount: 6, avgDurationMs: '50', lastRevalidation: null }],
                [],
                [
                    { trigger: 'manual', cnt: 4 },
                    { trigger: 'create', cnt: 2 }
                ]
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getStats();

            // Assert
            expect(result.byTrigger).toEqual({
                manual: 4,
                create: 2
            });
        });

        it('should set lastRevalidation from the max createdAt', async () => {
            // Arrange
            const lastDate = new Date('2025-06-15T10:00:00.000Z');
            const db = buildMockDb([
                [{ total: 1, successCount: 1, avgDurationMs: '80', lastRevalidation: lastDate }],
                [],
                []
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getStats();

            // Assert
            expect(result.lastRevalidation).toEqual(lastDate);
        });

        it('should handle null summary row gracefully (empty db)', async () => {
            // Arrange — db returns empty arrays for all queries
            const db = buildMockDb([[], [], []]);
            mockGetDb.mockReturnValue(db);

            // Act
            const result = await svc.getStats();

            // Assert
            expect(result.totalRevalidations).toBe(0);
            expect(result.successRate).toBe(0);
            expect(result.avgDurationMs).toBe(0);
        });

        it('should call getDb once', async () => {
            // Arrange
            const db = buildMockDb([
                [{ total: 0, successCount: 0, avgDurationMs: null, lastRevalidation: null }],
                [],
                []
            ]);
            mockGetDb.mockReturnValue(db);

            // Act
            await svc.getStats();

            // Assert
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });
});
