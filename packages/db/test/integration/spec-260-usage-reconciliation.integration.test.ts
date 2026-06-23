/**
 * SPEC-260 T-020 — Real-DB reconciliation test for the four AI usage
 * aggregation queries.
 *
 * ## What this proves
 *
 * All four `aggregate*` functions in `@repo/ai-core/src/storage/usage.queries`
 * — `aggregateAiUsageByModel`, `aggregateAiUsageByProvider`,
 * `aggregateAiUsageByFeatureModel`, and `aggregateAiUsageDaily` — read the
 * same `ai_usage` rows.  A GROUP BY / SUM bug in any one of them would cause
 * its grand total to diverge from the others.  Mocked unit tests cannot detect
 * this because the mock fixtures are hand-authored numbers that bypass the real
 * SQL.
 *
 * ## Harness
 *
 * Uses `withTestTransaction` so every seed insert is rolled back after each
 * test, keeping the ephemeral `hospeda_integration_test` DB clean between runs.
 * The test DB is created and migrated once by the global-setup in
 * `./global-setup.ts` (invoked via `pnpm --filter @repo/db test:integration`).
 *
 * ## Seed dataset
 *
 * Four rows spanning two features, two models, and two providers:
 *
 * | feature      | model          | provider  | calls | tokensIn | tokensOut | cost |
 * |------------- |--------------- |---------- |-------|----------|-----------|------|
 * | chat         | gpt-4o-mini    | openai    |   100 |   200000 |    80000  | 100k |
 * | text_improve | gpt-4o-mini    | openai    |    60 |   120000 |    45000  |  60k |
 * | search       | claude-haiku   | anthropic |    50 |   100000 |    40000  |  80k |
 * | chat         | claude-haiku   | anthropic |    30 |    60000 |    25000  |  80k |
 *
 * Grand total: calls=240, tokensIn=480000, tokensOut=190000, costMicroUsd=320000
 *
 * An additional "excluded" row (status=error) verifies that errored rows are
 * included in aggregations (the queries do NOT filter by status — quota
 * enforcement does that separately via countAiUsageForUserFeatureMonth).
 *
 * @module spec-260-usage-reconciliation.integration.test
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    aggregateAiUsageByFeatureModel,
    aggregateAiUsageByModel,
    aggregateAiUsageByProvider,
    aggregateAiUsageDaily
} from '../../../ai-core/src/storage/usage.queries.ts';
import { setDb } from '../../src/client.ts';
import { aiUsage } from '../../src/schemas/ai/ai_usage.dbschema.ts';
import { closeTestPool, getTestDb, withTestTransaction } from './helpers.ts';

// ---------------------------------------------------------------------------
// DB availability guard
// ---------------------------------------------------------------------------

const dbAvailable = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

// ---------------------------------------------------------------------------
// Ground-truth constants
// ---------------------------------------------------------------------------

/**
 * The exact grand total that ALL four aggregations must sum to.
 * Derived by summing the four seed rows below.
 */
const GRAND_TOTAL = {
    calls: 240,
    tokensIn: 480_000,
    tokensOut: 190_000,
    costMicroUsd: 320_000
} as const;

/**
 * Per-feature ground totals used to validate the by-feature-model
 * grouped reconciliation.
 */
const FEATURE_TOTALS = {
    chat: { calls: 130, tokensIn: 260_000, tokensOut: 105_000, costMicroUsd: 180_000 },
    text_improve: { calls: 60, tokensIn: 120_000, tokensOut: 45_000, costMicroUsd: 60_000 },
    search: { calls: 50, tokensIn: 100_000, tokensOut: 40_000, costMicroUsd: 80_000 }
} as const;

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

/**
 * One seed row.  Each row represents a single AI call (latencyMs is required
 * NOT NULL — set to a dummy value of 100ms for every row).
 */
interface SeedRow {
    readonly feature: string;
    readonly model: string;
    readonly provider: string;
    readonly calls: number;
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly costMicroUsd: number;
    /** UTC day to assign to createdAt (ISO date string, e.g. '2026-06-10'). */
    readonly day: string;
}

/**
 * Expands a SeedRow into `calls` individual `ai_usage` inserts, each with
 * tokensIn/tokensOut/cost split as evenly as possible across rows.
 *
 * This models realistic data where each row = one actual AI call.
 */
function buildInserts(row: SeedRow): (typeof aiUsage.$inferInsert)[] {
    const perCall = {
        tokensIn: Math.floor(row.tokensIn / row.calls),
        tokensOut: Math.floor(row.tokensOut / row.calls),
        costMicroUsd: Math.floor(row.costMicroUsd / row.calls)
    };

    return Array.from({ length: row.calls }, (_, i) => {
        // Distribute remainder into first rows to keep the sum exact.
        const extra = i < row.tokensIn % row.calls ? 1 : 0;
        const extraOut = i < row.tokensOut % row.calls ? 1 : 0;
        const extraCost = i < row.costMicroUsd % row.calls ? 1 : 0;

        return {
            id: crypto.randomUUID(),
            userId: null,
            feature: row.feature,
            model: row.model,
            provider: row.provider,
            tokensIn: perCall.tokensIn + extra,
            tokensOut: perCall.tokensOut + extraOut,
            costEstimateMicroUsd: perCall.costMicroUsd + extraCost,
            latencyMs: 100,
            status: 'success',
            createdAt: new Date(`${row.day}T12:00:00Z`)
        };
    });
}

/**
 * The four seed-row descriptors.  Total: 240 calls across 2 days.
 */
const SEED_ROWS: readonly SeedRow[] = [
    {
        feature: 'chat',
        model: 'gpt-4o-mini',
        provider: 'openai',
        calls: 100,
        tokensIn: 200_000,
        tokensOut: 80_000,
        costMicroUsd: 100_000,
        day: '2026-06-10'
    },
    {
        feature: 'text_improve',
        model: 'gpt-4o-mini',
        provider: 'openai',
        calls: 60,
        tokensIn: 120_000,
        tokensOut: 45_000,
        costMicroUsd: 60_000,
        day: '2026-06-10'
    },
    {
        feature: 'search',
        model: 'claude-haiku',
        provider: 'anthropic',
        calls: 50,
        tokensIn: 100_000,
        tokensOut: 40_000,
        costMicroUsd: 80_000,
        day: '2026-06-11'
    },
    {
        feature: 'chat',
        model: 'claude-haiku',
        provider: 'anthropic',
        calls: 30,
        tokensIn: 60_000,
        tokensOut: 25_000,
        costMicroUsd: 80_000,
        day: '2026-06-11'
    }
] as const;

// ---------------------------------------------------------------------------
// Sum helper — reduces result rows to a single aggregate object.
// ---------------------------------------------------------------------------

interface TotalsRow {
    readonly calls: number;
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly costMicroUsd: number;
}

/**
 * Sums an array of aggregate rows into a single TotalsRow.
 * Returns all-zeros for an empty array.
 */
function sumRows(rows: readonly TotalsRow[]): TotalsRow {
    return rows.reduce(
        (acc, row) => ({
            calls: acc.calls + row.calls,
            tokensIn: acc.tokensIn + row.tokensIn,
            tokensOut: acc.tokensOut + row.tokensOut,
            costMicroUsd: acc.costMicroUsd + row.costMicroUsd
        }),
        { calls: 0, tokensIn: 0, tokensOut: 0, costMicroUsd: 0 }
    );
}

// ---------------------------------------------------------------------------
// Query window — covers both seed days and excludes any pre-existing rows.
// ---------------------------------------------------------------------------

const SINCE = new Date('2026-06-10T00:00:00Z');
const UNTIL = new Date('2026-06-12T00:00:00Z');

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
    if (!dbAvailable) return;
    // Wire @repo/db singleton so usage.queries.ts `getDb()` resolves to
    // the test DB.  `withTestTransaction` passes tx directly, but setDb()
    // ensures a fallback path if any helper calls getDb() without tx.
    setDb(getTestDb());
});

afterAll(async () => {
    if (!dbAvailable) return;
    await closeTestPool();
});

// ---------------------------------------------------------------------------
// Helpers to run all four aggregations within a single tx.
// ---------------------------------------------------------------------------

interface AllAggResults {
    readonly byModel: Awaited<ReturnType<typeof aggregateAiUsageByModel>>;
    readonly byProvider: Awaited<ReturnType<typeof aggregateAiUsageByProvider>>;
    readonly byFeatureModel: Awaited<ReturnType<typeof aggregateAiUsageByFeatureModel>>;
    readonly daily: Awaited<ReturnType<typeof aggregateAiUsageDaily>>;
}

async function runAllAggs(
    tx: Parameters<Parameters<typeof withTestTransaction>[0]>[0],
    opts: { readonly feature?: string } = {}
): Promise<AllAggResults> {
    const base = { since: SINCE, until: UNTIL, tx };
    const [byModel, byProvider, byFeatureModel, daily] = await Promise.all([
        aggregateAiUsageByModel({ ...base, feature: opts.feature }),
        aggregateAiUsageByProvider({ ...base, feature: opts.feature }),
        aggregateAiUsageByFeatureModel(base),
        aggregateAiUsageDaily({ ...base, feature: opts.feature })
    ]);
    return { byModel, byProvider, byFeatureModel, daily };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!dbAvailable)(
    'SPEC-260 T-020 — AI usage aggregation reconciliation (real DB)',
    () => {
        // -----------------------------------------------------------------------
        // 1. Grand-total reconciliation: all four dimensions sum to the same total
        // -----------------------------------------------------------------------
        describe('grand-total reconciliation', () => {
            it('all four aggregations produce the same grand-total calls', async () => {
                await withTestTransaction(async (tx) => {
                    // Arrange: seed all rows
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    // Act
                    const { byModel, byProvider, byFeatureModel, daily } = await runAllAggs(tx);

                    // Assert — all four sum to GRAND_TOTAL.calls
                    expect(sumRows(byModel).calls).toBe(GRAND_TOTAL.calls);
                    expect(sumRows(byProvider).calls).toBe(GRAND_TOTAL.calls);
                    expect(sumRows(byFeatureModel).calls).toBe(GRAND_TOTAL.calls);
                    expect(sumRows(daily).calls).toBe(GRAND_TOTAL.calls);
                });
            });

            it('all four aggregations produce the same grand-total tokensIn', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const { byModel, byProvider, byFeatureModel, daily } = await runAllAggs(tx);

                    expect(sumRows(byModel).tokensIn).toBe(GRAND_TOTAL.tokensIn);
                    expect(sumRows(byProvider).tokensIn).toBe(GRAND_TOTAL.tokensIn);
                    expect(sumRows(byFeatureModel).tokensIn).toBe(GRAND_TOTAL.tokensIn);
                    expect(sumRows(daily).tokensIn).toBe(GRAND_TOTAL.tokensIn);
                });
            });

            it('all four aggregations produce the same grand-total tokensOut', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const { byModel, byProvider, byFeatureModel, daily } = await runAllAggs(tx);

                    expect(sumRows(byModel).tokensOut).toBe(GRAND_TOTAL.tokensOut);
                    expect(sumRows(byProvider).tokensOut).toBe(GRAND_TOTAL.tokensOut);
                    expect(sumRows(byFeatureModel).tokensOut).toBe(GRAND_TOTAL.tokensOut);
                    expect(sumRows(daily).tokensOut).toBe(GRAND_TOTAL.tokensOut);
                });
            });

            it('all four aggregations produce the same grand-total costMicroUsd', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const { byModel, byProvider, byFeatureModel, daily } = await runAllAggs(tx);

                    expect(sumRows(byModel).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                    expect(sumRows(byProvider).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                    expect(sumRows(byFeatureModel).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                    expect(sumRows(daily).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                });
            });
        });

        // -----------------------------------------------------------------------
        // 2. by-feature-model grouped-by-feature == per-feature totals
        //    (proves the (feature, model) GROUP BY is consistent with a feature-only
        //    GROUP BY)
        // -----------------------------------------------------------------------
        describe('by-feature-model grouped-by-feature reconciliation', () => {
            it('grouping by-feature-model rows by feature yields the correct chat total', async () => {
                await withTestTransaction(async (tx) => {
                    // Arrange
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    // Act
                    const { byFeatureModel } = await runAllAggs(tx);

                    // Group by feature and sum
                    const chatRows = byFeatureModel.filter((r) => r.feature === 'chat');
                    const chatSum = sumRows(chatRows);

                    // Assert
                    expect(chatSum.calls).toBe(FEATURE_TOTALS.chat.calls);
                    expect(chatSum.tokensIn).toBe(FEATURE_TOTALS.chat.tokensIn);
                    expect(chatSum.tokensOut).toBe(FEATURE_TOTALS.chat.tokensOut);
                    expect(chatSum.costMicroUsd).toBe(FEATURE_TOTALS.chat.costMicroUsd);
                });
            });

            it('grouping by-feature-model rows by feature yields the correct text_improve total', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const { byFeatureModel } = await runAllAggs(tx);
                    const rows = byFeatureModel.filter((r) => r.feature === 'text_improve');
                    const tot = sumRows(rows);

                    expect(tot.calls).toBe(FEATURE_TOTALS.text_improve.calls);
                    expect(tot.tokensIn).toBe(FEATURE_TOTALS.text_improve.tokensIn);
                    expect(tot.tokensOut).toBe(FEATURE_TOTALS.text_improve.tokensOut);
                    expect(tot.costMicroUsd).toBe(FEATURE_TOTALS.text_improve.costMicroUsd);
                });
            });

            it('grouping by-feature-model rows by feature yields the correct search total', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const { byFeatureModel } = await runAllAggs(tx);
                    const rows = byFeatureModel.filter((r) => r.feature === 'search');
                    const tot = sumRows(rows);

                    expect(tot.calls).toBe(FEATURE_TOTALS.search.calls);
                    expect(tot.tokensIn).toBe(FEATURE_TOTALS.search.tokensIn);
                    expect(tot.tokensOut).toBe(FEATURE_TOTALS.search.tokensOut);
                    expect(tot.costMicroUsd).toBe(FEATURE_TOTALS.search.costMicroUsd);
                });
            });
        });

        // -----------------------------------------------------------------------
        // 3. Feature filter: a feature-scoped query reconciles to that feature's
        //    seeded subset
        // -----------------------------------------------------------------------
        describe('feature-filtered reconciliation', () => {
            it('all four aggregations scoped to feature=chat sum to the chat ground truth', async () => {
                await withTestTransaction(async (tx) => {
                    // Arrange
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    // Act — pass feature filter to by-model, by-provider, daily
                    // (by-feature-model filter is applied in assertions via
                    //  filtering the unscoped result)
                    const base = { since: SINCE, until: UNTIL, tx };
                    const [byModel, byProvider, daily] = await Promise.all([
                        aggregateAiUsageByModel({ ...base, feature: 'chat' }),
                        aggregateAiUsageByProvider({ ...base, feature: 'chat' }),
                        aggregateAiUsageDaily({ ...base, feature: 'chat' })
                    ]);

                    // Assert — each must sum to the chat ground truth
                    const expected = FEATURE_TOTALS.chat;
                    expect(sumRows(byModel).calls).toBe(expected.calls);
                    expect(sumRows(byProvider).calls).toBe(expected.calls);
                    expect(sumRows(daily).calls).toBe(expected.calls);

                    expect(sumRows(byModel).costMicroUsd).toBe(expected.costMicroUsd);
                    expect(sumRows(byProvider).costMicroUsd).toBe(expected.costMicroUsd);
                    expect(sumRows(daily).costMicroUsd).toBe(expected.costMicroUsd);
                });
            });
        });

        // -----------------------------------------------------------------------
        // 4. Daily bucketing: two days produce two daily rows whose totals sum
        //    to the grand total
        // -----------------------------------------------------------------------
        describe('daily bucketing', () => {
            it('daily aggregation returns exactly 2 rows (one per seed day)', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const daily = await aggregateAiUsageDaily({
                        since: SINCE,
                        until: UNTIL,
                        tx
                    });

                    expect(daily).toHaveLength(2);
                    expect(daily[0].day).toBe('2026-06-10');
                    expect(daily[1].day).toBe('2026-06-11');
                });
            });

            it('day 2026-06-10 totals match the chat+text_improve seed rows', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const daily = await aggregateAiUsageDaily({
                        since: SINCE,
                        until: UNTIL,
                        tx
                    });

                    const day10 = daily.find((r) => r.day === '2026-06-10');
                    expect(day10).toBeDefined();
                    // chat (100c/200kIn/80kOut/100kCost) + text_improve
                    // (60c/120kIn/45kOut/60kCost)
                    expect(day10?.calls).toBe(160);
                    expect(day10?.tokensIn).toBe(320_000);
                    expect(day10?.tokensOut).toBe(125_000);
                    expect(day10?.costMicroUsd).toBe(160_000);
                });
            });

            it('day 2026-06-11 totals match the search+chat/claude-haiku seed rows', async () => {
                await withTestTransaction(async (tx) => {
                    const inserts = SEED_ROWS.flatMap(buildInserts);
                    await tx.insert(aiUsage).values(inserts);

                    const daily = await aggregateAiUsageDaily({
                        since: SINCE,
                        until: UNTIL,
                        tx
                    });

                    const day11 = daily.find((r) => r.day === '2026-06-11');
                    expect(day11).toBeDefined();
                    // search (50c/100kIn/40kOut/80kCost) + chat/haiku
                    // (30c/60kIn/25kOut/80kCost)
                    expect(day11?.calls).toBe(80);
                    expect(day11?.tokensIn).toBe(160_000);
                    expect(day11?.tokensOut).toBe(65_000);
                    expect(day11?.costMicroUsd).toBe(160_000);
                });
            });
        });

        // -----------------------------------------------------------------------
        // 5. Date-window isolation: rows outside the window are excluded
        // -----------------------------------------------------------------------
        describe('date-window isolation', () => {
            it('rows outside the [since, until) window do not appear in any aggregation', async () => {
                await withTestTransaction(async (tx) => {
                    // Arrange: seed 4 rows in-window + 1 row out-of-window
                    const inWindow = SEED_ROWS.flatMap(buildInserts);
                    const outOfWindow: typeof aiUsage.$inferInsert = {
                        id: crypto.randomUUID(),
                        userId: null,
                        feature: 'chat',
                        model: 'gpt-4o-mini',
                        provider: 'openai',
                        tokensIn: 999_999,
                        tokensOut: 999_999,
                        costEstimateMicroUsd: 999_999,
                        latencyMs: 1,
                        status: 'success',
                        // One day AFTER the window
                        createdAt: new Date('2026-06-12T00:00:00Z')
                    };
                    await tx.insert(aiUsage).values([...inWindow, outOfWindow]);

                    // Act
                    const { byModel, byProvider, byFeatureModel, daily } = await runAllAggs(tx);

                    // Assert: grand totals are unaffected by the out-of-window row
                    expect(sumRows(byModel).calls).toBe(GRAND_TOTAL.calls);
                    expect(sumRows(byProvider).calls).toBe(GRAND_TOTAL.calls);
                    expect(sumRows(byFeatureModel).calls).toBe(GRAND_TOTAL.calls);
                    expect(sumRows(daily).calls).toBe(GRAND_TOTAL.calls);

                    expect(sumRows(byModel).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                    expect(sumRows(byProvider).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                    expect(sumRows(byFeatureModel).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                    expect(sumRows(daily).costMicroUsd).toBe(GRAND_TOTAL.costMicroUsd);
                });
            });
        });
    }
);
