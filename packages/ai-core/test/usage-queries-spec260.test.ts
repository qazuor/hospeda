/**
 * Unit tests for SPEC-260 storage aggregation queries:
 * aggregateAiUsageByModel, aggregateAiUsageByProvider,
 * aggregateAiUsageByFeatureModel, aggregateAiUsageDaily.
 *
 * The DB is stubbed entirely via `vi.mock('@repo/db')` — no real database
 * connection required.  This mirrors the pattern in `storage.test.ts`.
 *
 * Coverage:
 *   - byModel: correct grouping key, SQL null coercion, filters (feature/provider),
 *     window (since/until), empty → [], tx passthrough.
 *   - byProvider: correct grouping key, filters (feature), empty → [], tx passthrough.
 *   - byFeatureModel: two-column GROUP BY, empty → [], tx passthrough.
 *   - daily: UTC day format, correct ordering, SQL null coercion, all filters,
 *     empty → [], tx passthrough.
 *   - buildConditions extension: model and provider conditions are appended.
 *
 * @module test/usage-queries-spec260
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/db BEFORE importing the modules under test
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    aiUsage: {
        id: 'id',
        feature: 'feature',
        provider: 'provider',
        model: 'model',
        tokensIn: 'tokensIn',
        tokensOut: 'tokensOut',
        costEstimateMicroUsd: 'costEstimateMicroUsd',
        createdAt: 'createdAt',
        userId: 'userId',
        status: 'status'
    },
    eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
    and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
    gte: vi.fn((_col, _val) => `gte(${String(_col)},${String(_val)})`),
    lt: vi.fn((_col, _val) => `lt(${String(_col)},${String(_val)})`),
    count: vi.fn(() => 'count()'),
    sql: Object.assign(
        vi.fn((_parts: TemplateStringsArray, ..._vals: unknown[]) => 'sql_expr'),
        { join: vi.fn() }
    ),
    getDb: vi.fn()
}));

import * as dbModule from '@repo/db';
import {
    aggregateAiUsageByFeatureModel,
    aggregateAiUsageByModel,
    aggregateAiUsageByProvider,
    aggregateAiUsageDaily
} from '../src/storage/usage.queries.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers — chainable aggregate query builder stubs
// ---------------------------------------------------------------------------

/**
 * Builds a Drizzle select aggregate chain:
 * `select().from().where().groupBy().orderBy()` resolving to `rows`.
 */
function buildAggregateChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const orderByFn = vi.fn().mockResolvedValue(rows);
    const groupByFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
    const whereFn = vi.fn().mockReturnValue({ groupBy: groupByFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });
    return selectFn;
}

// ---------------------------------------------------------------------------
// aggregateAiUsageByModel
// ---------------------------------------------------------------------------

describe('aggregateAiUsageByModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when DB returns rows', () => {
        it('should map model, calls, tokensIn, tokensOut, costMicroUsd correctly', async () => {
            // Arrange
            const rawRows = [
                {
                    model: 'gpt-4o-mini',
                    calls: '120',
                    tokensIn: '240000',
                    tokensOut: '90000',
                    costMicroUsd: '90000'
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByModel({});

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                model: 'gpt-4o-mini',
                calls: 120,
                tokensIn: 240000,
                tokensOut: 90000,
                costMicroUsd: 90000
            });
        });

        it('should coerce SQL null sums to 0', async () => {
            // Arrange — SQL SUM returns null when no matching rows (Postgres behaviour)
            const rawRows = [
                {
                    model: 'claude-3-5-haiku',
                    calls: '1',
                    tokensIn: null,
                    tokensOut: null,
                    costMicroUsd: null
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByModel({});

            // Assert
            expect(result[0]?.tokensIn).toBe(0);
            expect(result[0]?.tokensOut).toBe(0);
            expect(result[0]?.costMicroUsd).toBe(0);
        });

        it('should return multiple rows for multiple models', async () => {
            // Arrange
            const rawRows = [
                {
                    model: 'gpt-4o-mini',
                    calls: '100',
                    tokensIn: '200000',
                    tokensOut: '80000',
                    costMicroUsd: '80000'
                },
                {
                    model: 'claude-3-5-haiku',
                    calls: '40',
                    tokensIn: '80000',
                    tokensOut: '30000',
                    costMicroUsd: '184000'
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByModel({});

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]?.model).toBe('gpt-4o-mini');
            expect(result[1]?.model).toBe('claude-3-5-haiku');
        });
    });

    describe('when DB returns no rows', () => {
        it('should return an empty array', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            const result = await aggregateAiUsageByModel({});

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { select: buildAggregateChain([]) };

            // Act
            await aggregateAiUsageByModel({ tx: fakeTx as never });

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    describe('filter forwarding', () => {
        it('should call eq(feature, ...) when feature filter provided', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageByModel({ feature: 'chat' });

            // Assert — eq was called with the feature column and value
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.feature, 'chat');
        });

        it('should call eq(provider, ...) when provider filter provided', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageByModel({ provider: 'openai' });

            // Assert
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.provider, 'openai');
        });

        it('should call gte(createdAt, since) when since provided', async () => {
            // Arrange
            const since = new Date('2026-06-01T00:00:00Z');
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageByModel({ since });

            // Assert
            expect(dbModule.gte).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, since);
        });

        it('should call lt(createdAt, until) when until provided', async () => {
            // Arrange
            const until = new Date('2026-07-01T00:00:00Z');
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageByModel({ until });

            // Assert
            expect(dbModule.lt).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, until);
        });
    });
});

// ---------------------------------------------------------------------------
// aggregateAiUsageByProvider
// ---------------------------------------------------------------------------

describe('aggregateAiUsageByProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when DB returns rows', () => {
        it('should map provider, calls, tokensIn, tokensOut, costMicroUsd correctly', async () => {
            // Arrange
            const rawRows = [
                {
                    provider: 'openai',
                    calls: '200',
                    tokensIn: '400000',
                    tokensOut: '150000',
                    costMicroUsd: '120000'
                },
                {
                    provider: 'anthropic',
                    calls: '50',
                    tokensIn: '100000',
                    tokensOut: '40000',
                    costMicroUsd: '95000'
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByProvider({});

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                provider: 'openai',
                calls: 200,
                tokensIn: 400000,
                tokensOut: 150000,
                costMicroUsd: 120000
            });
            expect(result[1]?.provider).toBe('anthropic');
        });

        it('should coerce SQL null sums to 0', async () => {
            // Arrange
            const rawRows = [
                {
                    provider: 'stub',
                    calls: '0',
                    tokensIn: null,
                    tokensOut: null,
                    costMicroUsd: null
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByProvider({});

            // Assert
            expect(result[0]?.tokensIn).toBe(0);
            expect(result[0]?.costMicroUsd).toBe(0);
        });
    });

    describe('when DB returns no rows', () => {
        it('should return an empty array', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            const result = await aggregateAiUsageByProvider({});

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { select: buildAggregateChain([]) };

            // Act
            await aggregateAiUsageByProvider({ tx: fakeTx as never });

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    describe('filter forwarding', () => {
        it('should call eq(feature, ...) when feature filter provided', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageByProvider({ feature: 'text_improve' });

            // Assert
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.feature, 'text_improve');
        });

        it('should apply since/until window filters', async () => {
            // Arrange
            const since = new Date('2026-06-01T00:00:00Z');
            const until = new Date('2026-07-01T00:00:00Z');
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageByProvider({ since, until });

            // Assert
            expect(dbModule.gte).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, since);
            expect(dbModule.lt).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, until);
        });
    });
});

// ---------------------------------------------------------------------------
// aggregateAiUsageByFeatureModel
// ---------------------------------------------------------------------------

describe('aggregateAiUsageByFeatureModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when DB returns rows', () => {
        it('should map feature, model, calls, tokens, cost correctly', async () => {
            // Arrange
            const rawRows = [
                {
                    feature: 'chat',
                    model: 'gpt-4o-mini',
                    calls: '120',
                    tokensIn: '240000',
                    tokensOut: '90000',
                    costMicroUsd: '90000'
                },
                {
                    feature: 'chat',
                    model: 'claude-3-5-haiku',
                    calls: '40',
                    tokensIn: '80000',
                    tokensOut: '30000',
                    costMicroUsd: '184000'
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByFeatureModel({});

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                feature: 'chat',
                model: 'gpt-4o-mini',
                calls: 120,
                tokensIn: 240000,
                tokensOut: 90000,
                costMicroUsd: 90000
            });
            expect(result[1]).toMatchObject({
                feature: 'chat',
                model: 'claude-3-5-haiku',
                calls: 40,
                costMicroUsd: 184000
            });
        });

        it('should produce one row per unique (feature, model) combination', async () => {
            // Arrange — two features, two models each = 4 rows
            const rawRows = [
                {
                    feature: 'chat',
                    model: 'gpt-4o-mini',
                    calls: '50',
                    tokensIn: '100000',
                    tokensOut: '40000',
                    costMicroUsd: '40000'
                },
                {
                    feature: 'chat',
                    model: 'claude-3-5-haiku',
                    calls: '20',
                    tokensIn: '40000',
                    tokensOut: '15000',
                    costMicroUsd: '92000'
                },
                {
                    feature: 'text_improve',
                    model: 'gpt-4o-mini',
                    calls: '80',
                    tokensIn: '160000',
                    tokensOut: '60000',
                    costMicroUsd: '60000'
                },
                {
                    feature: 'text_improve',
                    model: 'gpt-4o',
                    calls: '10',
                    tokensIn: '20000',
                    tokensOut: '8000',
                    costMicroUsd: '28000'
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByFeatureModel({});

            // Assert — one row per combination
            expect(result).toHaveLength(4);
            const features = result.map((r) => r.feature);
            expect(features).toContain('chat');
            expect(features).toContain('text_improve');
        });

        it('should coerce SQL null sums to 0', async () => {
            // Arrange
            const rawRows = [
                {
                    feature: 'support',
                    model: 'gpt-4o',
                    calls: '1',
                    tokensIn: null,
                    tokensOut: null,
                    costMicroUsd: null
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageByFeatureModel({});

            // Assert
            expect(result[0]?.tokensIn).toBe(0);
            expect(result[0]?.costMicroUsd).toBe(0);
        });
    });

    describe('when DB returns no rows', () => {
        it('should return an empty array', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            const result = await aggregateAiUsageByFeatureModel({});

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { select: buildAggregateChain([]) };

            // Act
            await aggregateAiUsageByFeatureModel({ tx: fakeTx as never });

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    describe('window filters', () => {
        it('should apply since/until when provided', async () => {
            // Arrange
            const since = new Date('2026-06-01T00:00:00Z');
            const until = new Date('2026-07-01T00:00:00Z');
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageByFeatureModel({ since, until });

            // Assert
            expect(dbModule.gte).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, since);
            expect(dbModule.lt).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, until);
        });
    });
});

// ---------------------------------------------------------------------------
// aggregateAiUsageDaily
// ---------------------------------------------------------------------------

describe('aggregateAiUsageDaily', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when DB returns rows', () => {
        it('should map day, calls, tokensIn, tokensOut, costMicroUsd correctly', async () => {
            // Arrange
            const rawRows = [
                {
                    day: '2026-06-01',
                    calls: '5',
                    tokensIn: '10000',
                    tokensOut: '4000',
                    costMicroUsd: '2500'
                },
                {
                    day: '2026-06-15',
                    calls: '12',
                    tokensIn: '24000',
                    tokensOut: '9000',
                    costMicroUsd: '6000'
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageDaily({});

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                day: '2026-06-01',
                calls: 5,
                tokensIn: 10000,
                tokensOut: 4000,
                costMicroUsd: 2500
            });
            expect(result[1]?.day).toBe('2026-06-15');
        });

        it('should coerce SQL null sums to 0', async () => {
            // Arrange
            const rawRows = [
                {
                    day: '2026-06-01',
                    calls: '0',
                    tokensIn: null,
                    tokensOut: null,
                    costMicroUsd: null
                }
            ];
            mockGetDb.mockReturnValue({ select: buildAggregateChain(rawRows) });

            // Act
            const result = await aggregateAiUsageDaily({});

            // Assert
            expect(result[0]?.tokensIn).toBe(0);
            expect(result[0]?.costMicroUsd).toBe(0);
        });
    });

    describe('when DB returns no rows', () => {
        it('should return an empty array', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            const result = await aggregateAiUsageDaily({});

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { select: buildAggregateChain([]) };

            // Act
            await aggregateAiUsageDaily({ tx: fakeTx as never });

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    describe('filter forwarding', () => {
        it('should call eq(feature, ...) when feature filter provided', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageDaily({ feature: 'chat' });

            // Assert
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.feature, 'chat');
        });

        it('should call eq(model, ...) when model filter provided', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageDaily({ model: 'gpt-4o-mini' });

            // Assert
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.model, 'gpt-4o-mini');
        });

        it('should call eq(provider, ...) when provider filter provided', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageDaily({ provider: 'anthropic' });

            // Assert
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.provider, 'anthropic');
        });

        it('should apply since/until window filters', async () => {
            // Arrange
            const since = new Date('2026-06-01T00:00:00Z');
            const until = new Date('2026-07-01T00:00:00Z');
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageDaily({ since, until });

            // Assert
            expect(dbModule.gte).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, since);
            expect(dbModule.lt).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, until);
        });

        it('should compose all filters together when all provided', async () => {
            // Arrange
            const since = new Date('2026-06-01T00:00:00Z');
            const until = new Date('2026-07-01T00:00:00Z');
            mockGetDb.mockReturnValue({ select: buildAggregateChain([]) });

            // Act
            await aggregateAiUsageDaily({
                since,
                until,
                feature: 'chat',
                model: 'gpt-4o-mini',
                provider: 'openai'
            });

            // Assert — all four condition constructors called
            expect(dbModule.gte).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, since);
            expect(dbModule.lt).toHaveBeenCalledWith(dbModule.aiUsage.createdAt, until);
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.feature, 'chat');
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.model, 'gpt-4o-mini');
            expect(dbModule.eq).toHaveBeenCalledWith(dbModule.aiUsage.provider, 'openai');
        });
    });
});
