/**
 * Unit tests for SPEC-260 reporting wrappers:
 * getUsageByModel, getUsageByProvider, getUsageByFeatureModel, getDailyUsage.
 *
 * The storage layer (`../../src/storage/index.js`) is stubbed entirely via
 * `vi.mock` — no real database connection required.  This mirrors the pattern
 * in `reporting.test.ts`.
 *
 * Coverage:
 *   - getUsageByModel: year/month window resolution; since/until passthrough;
 *     feature/provider filters forwarded; storage rows returned as-is.
 *   - getUsageByProvider: year/month window; feature filter forwarded; empty → [].
 *   - getUsageByFeatureModel: year/month window; since/until passthrough; empty → [].
 *   - getDailyUsage: year/month window; daily zero-fill produces a continuous
 *     series; boundary rows land in the correct day; ascending order preserved;
 *     without window bounds — returns storage rows as-is.
 *   - Reconciliation: summed totals across byModel and byProvider match the
 *     by-feature totals for the same window (same source table behaviour).
 *
 * @module test/reporting-spec260
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock storage BEFORE importing the modules under test
// ---------------------------------------------------------------------------

vi.mock('../src/storage/index.js', () => ({
    aggregateAiUsageByMonth: vi.fn(),
    aggregateAiUsageByUser: vi.fn(),
    aggregateAiUsageByFeature: vi.fn(),
    aggregateAiUsageByModel: vi.fn(),
    aggregateAiUsageByProvider: vi.fn(),
    aggregateAiUsageByFeatureModel: vi.fn(),
    aggregateAiUsageDaily: vi.fn(),
    // Other storage fns that may be imported elsewhere
    insertAiUsage: vi.fn(),
    insertAiRequestLog: vi.fn(),
    readAiSettings: vi.fn(),
    writeAiSettings: vi.fn(),
    getActivePrompt: vi.fn(),
    AiSettingsParseError: class AiSettingsParseError extends Error {},
    countAiUsageForUserFeatureMonth: vi.fn()
}));

import * as storageModule from '../src/storage/index.js';
import {
    getDailyUsage,
    getUsageByFeature,
    getUsageByFeatureModel,
    getUsageByModel,
    getUsageByProvider
} from '../src/usage/reporting/usage-reporting.js';

const mockAggregateByFeature = storageModule.aggregateAiUsageByFeature as ReturnType<typeof vi.fn>;
const mockAggregateByModel = storageModule.aggregateAiUsageByModel as ReturnType<typeof vi.fn>;
const mockAggregateByProvider = storageModule.aggregateAiUsageByProvider as ReturnType<
    typeof vi.fn
>;
const mockAggregateByFeatureModel = storageModule.aggregateAiUsageByFeatureModel as ReturnType<
    typeof vi.fn
>;
const mockAggregateDaily = storageModule.aggregateAiUsageDaily as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// getUsageByModel
// ---------------------------------------------------------------------------

describe('getUsageByModel', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('window resolution via year+month', () => {
        it('should resolve year=2026, month=6 to the correct UTC month range', async () => {
            // Arrange
            mockAggregateByModel.mockResolvedValue([]);

            // Act
            await getUsageByModel({ year: 2026, month: 6 });

            // Assert
            expect(mockAggregateByModel).toHaveBeenCalledOnce();
            const callArg = mockAggregateByModel.mock.calls[0][0] as {
                since: Date;
                until: Date;
            };
            expect(callArg.since.toISOString()).toBe('2026-06-01T00:00:00.000Z');
            expect(callArg.until.toISOString()).toBe('2026-07-01T00:00:00.000Z');
        });

        it('should handle December year-rollover correctly', async () => {
            // Arrange
            mockAggregateByModel.mockResolvedValue([]);

            // Act
            await getUsageByModel({ year: 2026, month: 12 });

            // Assert
            const callArg = mockAggregateByModel.mock.calls[0][0] as { until: Date };
            expect(callArg.until.toISOString()).toBe('2027-01-01T00:00:00.000Z');
        });
    });

    describe('window passthrough via since/until', () => {
        it('should forward explicit since/until dates unchanged', async () => {
            // Arrange
            const since = new Date('2026-06-10T00:00:00Z');
            const until = new Date('2026-06-20T00:00:00Z');
            mockAggregateByModel.mockResolvedValue([]);

            // Act
            await getUsageByModel({ since, until });

            // Assert
            const callArg = mockAggregateByModel.mock.calls[0][0] as {
                since: Date;
                until: Date;
            };
            expect(callArg.since).toBe(since);
            expect(callArg.until).toBe(until);
        });
    });

    describe('filter forwarding', () => {
        it('should forward feature filter to storage', async () => {
            // Arrange
            mockAggregateByModel.mockResolvedValue([]);

            // Act
            await getUsageByModel({ year: 2026, month: 6, feature: 'chat' });

            // Assert
            const callArg = mockAggregateByModel.mock.calls[0][0] as { feature?: string };
            expect(callArg.feature).toBe('chat');
        });

        it('should forward provider filter to storage', async () => {
            // Arrange
            mockAggregateByModel.mockResolvedValue([]);

            // Act
            await getUsageByModel({ year: 2026, month: 6, provider: 'openai' });

            // Assert
            const callArg = mockAggregateByModel.mock.calls[0][0] as { provider?: string };
            expect(callArg.provider).toBe('openai');
        });
    });

    describe('row passthrough', () => {
        it('should return rows as-is from storage', async () => {
            // Arrange
            const stubRows = [
                {
                    model: 'gpt-4o-mini',
                    calls: 120,
                    tokensIn: 240000,
                    tokensOut: 90000,
                    costMicroUsd: 90000
                },
                {
                    model: 'claude-3-5-haiku',
                    calls: 40,
                    tokensIn: 80000,
                    tokensOut: 30000,
                    costMicroUsd: 184000
                }
            ];
            mockAggregateByModel.mockResolvedValue(stubRows);

            // Act
            const result = await getUsageByModel({ year: 2026, month: 6 });

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ model: 'gpt-4o-mini', costMicroUsd: 90000 });
            expect(result[1]).toMatchObject({ model: 'claude-3-5-haiku', costMicroUsd: 184000 });
        });

        it('should return empty array when storage returns no rows', async () => {
            // Arrange
            mockAggregateByModel.mockResolvedValue([]);

            // Act
            const result = await getUsageByModel({ year: 2026, month: 1 });

            // Assert
            expect(result).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// getUsageByProvider
// ---------------------------------------------------------------------------

describe('getUsageByProvider', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('window resolution via year+month', () => {
        it('should resolve year=2026, month=6 to the correct UTC month range', async () => {
            // Arrange
            mockAggregateByProvider.mockResolvedValue([]);

            // Act
            await getUsageByProvider({ year: 2026, month: 6 });

            // Assert
            const callArg = mockAggregateByProvider.mock.calls[0][0] as {
                since: Date;
                until: Date;
            };
            expect(callArg.since.toISOString()).toBe('2026-06-01T00:00:00.000Z');
            expect(callArg.until.toISOString()).toBe('2026-07-01T00:00:00.000Z');
        });
    });

    describe('filter forwarding', () => {
        it('should forward feature filter to storage', async () => {
            // Arrange
            mockAggregateByProvider.mockResolvedValue([]);

            // Act
            await getUsageByProvider({ year: 2026, month: 6, feature: 'text_improve' });

            // Assert
            const callArg = mockAggregateByProvider.mock.calls[0][0] as { feature?: string };
            expect(callArg.feature).toBe('text_improve');
        });
    });

    describe('row passthrough', () => {
        it('should return rows as-is from storage', async () => {
            // Arrange
            const stubRows = [
                {
                    provider: 'openai',
                    calls: 200,
                    tokensIn: 400000,
                    tokensOut: 150000,
                    costMicroUsd: 120000
                },
                {
                    provider: 'anthropic',
                    calls: 50,
                    tokensIn: 100000,
                    tokensOut: 40000,
                    costMicroUsd: 95000
                }
            ];
            mockAggregateByProvider.mockResolvedValue(stubRows);

            // Act
            const result = await getUsageByProvider({ year: 2026, month: 6 });

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]?.provider).toBe('openai');
            expect(result[1]?.provider).toBe('anthropic');
        });

        it('should return empty array when storage returns no rows', async () => {
            // Arrange
            mockAggregateByProvider.mockResolvedValue([]);

            // Act
            const result = await getUsageByProvider({ year: 2026, month: 3 });

            // Assert
            expect(result).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// getUsageByFeatureModel
// ---------------------------------------------------------------------------

describe('getUsageByFeatureModel', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('window resolution via year+month', () => {
        it('should resolve year=2026, month=6 to the correct UTC month range', async () => {
            // Arrange
            mockAggregateByFeatureModel.mockResolvedValue([]);

            // Act
            await getUsageByFeatureModel({ year: 2026, month: 6 });

            // Assert
            const callArg = mockAggregateByFeatureModel.mock.calls[0][0] as {
                since: Date;
                until: Date;
            };
            expect(callArg.since.toISOString()).toBe('2026-06-01T00:00:00.000Z');
            expect(callArg.until.toISOString()).toBe('2026-07-01T00:00:00.000Z');
        });
    });

    describe('window passthrough via since/until', () => {
        it('should forward explicit since/until dates unchanged', async () => {
            // Arrange
            const since = new Date('2026-06-01T00:00:00Z');
            const until = new Date('2026-06-15T00:00:00Z');
            mockAggregateByFeatureModel.mockResolvedValue([]);

            // Act
            await getUsageByFeatureModel({ since, until });

            // Assert
            const callArg = mockAggregateByFeatureModel.mock.calls[0][0] as {
                since: Date;
                until: Date;
            };
            expect(callArg.since).toBe(since);
            expect(callArg.until).toBe(until);
        });
    });

    describe('row passthrough', () => {
        it('should return feature×model rows as-is from storage', async () => {
            // Arrange
            const stubRows = [
                {
                    feature: 'chat',
                    model: 'gpt-4o-mini',
                    calls: 120,
                    tokensIn: 240000,
                    tokensOut: 90000,
                    costMicroUsd: 90000
                },
                {
                    feature: 'chat',
                    model: 'claude-3-5-haiku',
                    calls: 40,
                    tokensIn: 80000,
                    tokensOut: 30000,
                    costMicroUsd: 184000
                }
            ];
            mockAggregateByFeatureModel.mockResolvedValue(stubRows);

            // Act
            const result = await getUsageByFeatureModel({ year: 2026, month: 6 });

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ feature: 'chat', model: 'gpt-4o-mini' });
            expect(result[1]).toMatchObject({ feature: 'chat', model: 'claude-3-5-haiku' });
        });

        it('should return empty array when storage returns no rows', async () => {
            // Arrange
            mockAggregateByFeatureModel.mockResolvedValue([]);

            // Act
            const result = await getUsageByFeatureModel({ year: 2026, month: 1 });

            // Assert
            expect(result).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// getDailyUsage — with zero-fill
// ---------------------------------------------------------------------------

describe('getDailyUsage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('window resolution via year+month', () => {
        it('should resolve year=2026, month=6 and produce 30 rows (June = 30 days)', async () => {
            // Arrange — storage returns only 2 of 30 days
            const storageRows = [
                { day: '2026-06-05', calls: 10, tokensIn: 2000, tokensOut: 800, costMicroUsd: 500 },
                { day: '2026-06-20', calls: 5, tokensIn: 1000, tokensOut: 400, costMicroUsd: 250 }
            ];
            mockAggregateDaily.mockResolvedValue(storageRows);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 6 });

            // Assert — exactly 30 rows (June has 30 days)
            expect(result).toHaveLength(30);
        });

        it('should produce 31 rows for January (31-day month)', async () => {
            // Arrange — storage returns no rows
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 1 });

            // Assert
            expect(result).toHaveLength(31);
        });

        it('should produce 28 rows for February 2026 (non-leap year)', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 2 });

            // Assert
            expect(result).toHaveLength(28);
        });

        it('should produce 29 rows for February 2028 (leap year)', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            const result = await getDailyUsage({ year: 2028, month: 2 });

            // Assert
            expect(result).toHaveLength(29);
        });
    });

    describe('daily zero-fill — continuous series', () => {
        it('should fill missing days with zero rows', async () => {
            // Arrange — only 2 days have data out of 30
            const storageRows = [
                { day: '2026-06-01', calls: 5, tokensIn: 1000, tokensOut: 400, costMicroUsd: 250 },
                { day: '2026-06-30', calls: 3, tokensIn: 600, tokensOut: 240, costMicroUsd: 150 }
            ];
            mockAggregateDaily.mockResolvedValue(storageRows);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 6 });

            // Assert — days 2–29 should be zeros
            const day2 = result.find((r) => r.day === '2026-06-02');
            expect(day2).toBeDefined();
            expect(day2?.calls).toBe(0);
            expect(day2?.tokensIn).toBe(0);
            expect(day2?.costMicroUsd).toBe(0);

            const day15 = result.find((r) => r.day === '2026-06-15');
            expect(day15?.calls).toBe(0);
        });

        it('should preserve storage row data for days that have rows', async () => {
            // Arrange
            const storageRows = [
                { day: '2026-06-05', calls: 10, tokensIn: 2000, tokensOut: 800, costMicroUsd: 500 }
            ];
            mockAggregateDaily.mockResolvedValue(storageRows);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 6 });

            // Assert — day 5 has real data
            const day5 = result.find((r) => r.day === '2026-06-05');
            expect(day5).toMatchObject({
                day: '2026-06-05',
                calls: 10,
                tokensIn: 2000,
                tokensOut: 800,
                costMicroUsd: 500
            });
        });

        it('should return all zero rows when storage returns no rows', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 6 });

            // Assert — all 30 rows are zeros
            expect(result).toHaveLength(30);
            for (const row of result) {
                expect(row.calls).toBe(0);
                expect(row.tokensIn).toBe(0);
                expect(row.costMicroUsd).toBe(0);
            }
        });

        it('should order days ascending (YYYY-MM-DD)', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 6 });

            // Assert — first day is June 1, last day is June 30
            expect(result[0]?.day).toBe('2026-06-01');
            expect(result[29]?.day).toBe('2026-06-30');
        });
    });

    describe('UTC month boundary handling', () => {
        it('should emit the first and last day of June correctly', async () => {
            // Arrange — boundary rows at start and end of month
            const storageRows = [
                { day: '2026-06-01', calls: 1, tokensIn: 100, tokensOut: 40, costMicroUsd: 25 },
                { day: '2026-06-30', calls: 2, tokensIn: 200, tokensOut: 80, costMicroUsd: 50 }
            ];
            mockAggregateDaily.mockResolvedValue(storageRows);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 6 });

            // Assert — both boundary days are present with correct data
            expect(result[0]?.day).toBe('2026-06-01');
            expect(result[0]?.calls).toBe(1);
            expect(result[29]?.day).toBe('2026-06-30');
            expect(result[29]?.calls).toBe(2);
        });

        it('should NOT emit July 1 when window is June (until is exclusive)', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 6 });

            // Assert — June has 30 days; July 1 must NOT appear
            const july1 = result.find((r) => r.day === '2026-07-01');
            expect(july1).toBeUndefined();
            expect(result).toHaveLength(30);
        });

        it('should handle December → January year rollover (31 days in December)', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            const result = await getDailyUsage({ year: 2026, month: 12 });

            // Assert — December has 31 days; January 1 must not appear
            expect(result).toHaveLength(31);
            expect(result[0]?.day).toBe('2026-12-01');
            expect(result[30]?.day).toBe('2026-12-31');
            const jan1 = result.find((r) => r.day === '2027-01-01');
            expect(jan1).toBeUndefined();
        });
    });

    describe('explicit since/until window (no zero-fill when bounds provided)', () => {
        it('should zero-fill a 10-day explicit window', async () => {
            // Arrange — storage returns only 1 of 10 days
            const since = new Date('2026-06-10T00:00:00Z');
            const until = new Date('2026-06-20T00:00:00Z'); // exclusive
            mockAggregateDaily.mockResolvedValue([
                { day: '2026-06-15', calls: 7, tokensIn: 1400, tokensOut: 560, costMicroUsd: 350 }
            ]);

            // Act
            const result = await getDailyUsage({ since, until });

            // Assert — 10 days: June 10..19 (until is exclusive)
            expect(result).toHaveLength(10);
            const day15 = result.find((r) => r.day === '2026-06-15');
            expect(day15?.calls).toBe(7);
            const day10 = result.find((r) => r.day === '2026-06-10');
            expect(day10?.calls).toBe(0);
        });
    });

    describe('without window bounds', () => {
        it('should return storage rows as-is when no since/until provided', async () => {
            // Arrange — no bounds; storage returns sparse rows
            const storageRows = [
                { day: '2026-05-10', calls: 3, tokensIn: 600, tokensOut: 240, costMicroUsd: 150 },
                { day: '2026-06-01', calls: 8, tokensIn: 1600, tokensOut: 640, costMicroUsd: 400 }
            ];
            mockAggregateDaily.mockResolvedValue(storageRows);

            // Act
            const result = await getDailyUsage({});

            // Assert — no zero-fill, returns 2 rows exactly
            expect(result).toHaveLength(2);
            expect(result[0]?.day).toBe('2026-05-10');
            expect(result[1]?.day).toBe('2026-06-01');
        });
    });

    describe('filter forwarding', () => {
        it('should forward feature filter to storage', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            await getDailyUsage({ year: 2026, month: 6, feature: 'chat' });

            // Assert
            const callArg = mockAggregateDaily.mock.calls[0][0] as { feature?: string };
            expect(callArg.feature).toBe('chat');
        });

        it('should forward model filter to storage', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            await getDailyUsage({ year: 2026, month: 6, model: 'gpt-4o-mini' });

            // Assert
            const callArg = mockAggregateDaily.mock.calls[0][0] as { model?: string };
            expect(callArg.model).toBe('gpt-4o-mini');
        });

        it('should forward provider filter to storage', async () => {
            // Arrange
            mockAggregateDaily.mockResolvedValue([]);

            // Act
            await getDailyUsage({ year: 2026, month: 6, provider: 'anthropic' });

            // Assert
            const callArg = mockAggregateDaily.mock.calls[0][0] as { provider?: string };
            expect(callArg.provider).toBe('anthropic');
        });
    });
});

// ---------------------------------------------------------------------------
// Reconciliation: byModel totals == byFeature totals for the same window
// ---------------------------------------------------------------------------

describe('reconciliation — byModel totals equal byFeature totals for the same window', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should have matching total calls across byModel and byFeature for the same window', async () => {
        // Arrange — fixture rows: chat uses two models
        const byModelRows = [
            {
                model: 'gpt-4o-mini',
                calls: 120,
                tokensIn: 240000,
                tokensOut: 90000,
                costMicroUsd: 90000
            },
            {
                model: 'claude-3-5-haiku',
                calls: 40,
                tokensIn: 80000,
                tokensOut: 30000,
                costMicroUsd: 184000
            }
        ];
        const byFeatureRows = [
            // All 160 calls belong to the 'chat' feature; same window
            {
                feature: 'chat',
                calls: 160,
                tokensIn: 320000,
                tokensOut: 120000,
                costMicroUsd: 274000
            }
        ];
        mockAggregateByModel.mockResolvedValue(byModelRows);
        mockAggregateByFeature.mockResolvedValue(byFeatureRows);

        // Act — both over the same June 2026 window
        const modelResult = await getUsageByModel({ year: 2026, month: 6 });
        const featureResult = await getUsageByFeature({ year: 2026, month: 6 });

        // Assert — summed totals must match
        const totalModelCalls = modelResult.reduce((acc, r) => acc + r.calls, 0);
        const totalFeatureCalls = featureResult.reduce((acc, r) => acc + r.calls, 0);
        expect(totalModelCalls).toBe(totalFeatureCalls);

        const totalModelCost = modelResult.reduce((acc, r) => acc + r.costMicroUsd, 0);
        const totalFeatureCost = featureResult.reduce((acc, r) => acc + r.costMicroUsd, 0);
        expect(totalModelCost).toBe(totalFeatureCost);

        const totalModelTokensIn = modelResult.reduce((acc, r) => acc + r.tokensIn, 0);
        const totalFeatureTokensIn = featureResult.reduce((acc, r) => acc + r.tokensIn, 0);
        expect(totalModelTokensIn).toBe(totalFeatureTokensIn);
    });

    it('should have matching total cost across byProvider and byFeature for the same window', async () => {
        // Arrange
        const byProviderRows = [
            {
                provider: 'openai',
                calls: 120,
                tokensIn: 240000,
                tokensOut: 90000,
                costMicroUsd: 90000
            },
            {
                provider: 'anthropic',
                calls: 40,
                tokensIn: 80000,
                tokensOut: 30000,
                costMicroUsd: 184000
            }
        ];
        const byFeatureRows = [
            {
                feature: 'chat',
                calls: 160,
                tokensIn: 320000,
                tokensOut: 120000,
                costMicroUsd: 274000
            }
        ];
        mockAggregateByProvider.mockResolvedValue(byProviderRows);
        mockAggregateByFeature.mockResolvedValue(byFeatureRows);

        // Act
        const providerResult = await getUsageByProvider({ year: 2026, month: 6 });
        const featureResult = await getUsageByFeature({ year: 2026, month: 6 });

        // Assert
        const totalProviderCost = providerResult.reduce((acc, r) => acc + r.costMicroUsd, 0);
        const totalFeatureCost = featureResult.reduce((acc, r) => acc + r.costMicroUsd, 0);
        expect(totalProviderCost).toBe(totalFeatureCost);
    });
});
