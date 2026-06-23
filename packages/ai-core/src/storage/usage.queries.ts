/**
 * Read-only aggregate query helpers over `ai_usage` (SPEC-173 T-018).
 *
 * This file is part of the `storage/` module — the ONLY sub-module in
 * `@repo/ai-core` permitted to import `@repo/db` directly (AC-4 isolation
 * rule).  All other sub-modules (including `usage/reporting`) must call
 * functions from this file and use `@repo/schemas` types instead.
 *
 * Decision (owner-approved 2026-06-04): the "month" period is calendar-month
 * UTC — `date_trunc('month', created_at)` where `created_at` is a
 * `timestamp with time zone` stored in UTC.  This matches the repo precedent
 * in `conversation.model.ts:426-468`. NOT the billing-cycle anniversary.
 *
 * Index alignment:
 *   - (userId, feature, createdAt desc) — used by byMonth(userId/feature) and byUser.
 *   - (provider, feature, createdAt desc) — used by byFeature with feature filter.
 * WHERE clauses are aligned to keep these indexes effective.
 *
 * SQL null handling: `sum()` returns NULL in Postgres when all group rows are
 * absent.  The `sql<string>` typed sum expression coerces to `string | null`
 * at runtime.  We coerce with `Number(val ?? 0)`.
 * `count()` returns a string bigint — coerce via `Number(val)`.
 *
 * Note: `sum` is NOT re-exported by `@repo/db`, so we use a typed `sql<>`
 * template literal for sum aggregates, which is the pattern used in the
 * existing codebase for custom aggregates.
 *
 * @module ai-core/storage/usage.queries
 */

import { and, count, eq, gte, lt, sql } from '@repo/db';
import { aiUsage, getDb } from '@repo/db';
import type { DrizzleClient } from '@repo/db';

// ---------------------------------------------------------------------------
// aggregateAiUsageByMonth
// ---------------------------------------------------------------------------

/**
 * Input for {@link aggregateAiUsageByMonth}.
 */
export interface AggregateAiUsageByMonthInput {
    /**
     * Inclusive start date for the query window.
     * When omitted, the query covers all rows up to `until` (or all rows).
     */
    readonly since?: Date;
    /**
     * Exclusive end date for the query window.
     * When omitted, the query covers all rows from `since` (or all rows).
     */
    readonly until?: Date;
    /**
     * Filter to a specific user.  When omitted, aggregates across all users.
     */
    readonly userId?: string;
    /**
     * Filter to a specific AI feature (e.g. `'text_improve'`).
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * One row returned by {@link aggregateAiUsageByMonth}.
 */
export interface AiUsageMonthlyAggRow {
    /** Calendar month formatted as `'YYYY-MM'` (UTC). */
    readonly month: string;
    /** Number of AI requests in this month. */
    readonly calls: number;
    /** Total prompt tokens consumed. */
    readonly tokensIn: number;
    /** Total completion tokens generated. */
    readonly tokensOut: number;
    /** Total estimated cost in integer µUSD (1 USD = 1,000,000 µUSD). */
    readonly costMicroUsd: number;
}

/**
 * Groups `ai_usage` rows by calendar month (UTC) and returns aggregate totals.
 *
 * Months with zero rows are NOT emitted — the caller is responsible for
 * filling gaps in sparse series (chart use-cases).
 *
 * Optional filters narrow the window to a specific user, feature, and/or
 * date range.  Filters are applied before aggregation so indexes are effective.
 *
 * Decision (owner-approved 2026-06-04): bucketing uses calendar-month UTC
 * via `date_trunc('month', created_at)`.
 *
 * @param input - {@link AggregateAiUsageByMonthInput}
 * @returns Rows ordered by month ASC.
 *
 * @example
 * ```ts
 * const rows = await aggregateAiUsageByMonth({
 *   since: new Date('2026-01-01T00:00:00Z'),
 *   until: new Date('2026-07-01T00:00:00Z'),
 *   userId: 'abc-123',
 * });
 * // [{ month: '2026-01', calls: 12, tokensIn: 3000, tokensOut: 1500, costMicroUsd: 900 }]
 * ```
 */
export async function aggregateAiUsageByMonth(
    input: AggregateAiUsageByMonthInput
): Promise<ReadonlyArray<AiUsageMonthlyAggRow>> {
    const { since, until, userId, feature, tx } = input;
    const db = tx ?? getDb();

    const conditions = buildConditions({ since, until, userId, feature });

    const rows = await db
        .select({
            month: sql<string>`to_char(date_trunc('month', ${aiUsage.createdAt}), 'YYYY-MM')`,
            calls: count(aiUsage.id),
            tokensIn: sql<string>`sum(${aiUsage.tokensIn})`,
            tokensOut: sql<string>`sum(${aiUsage.tokensOut})`,
            costMicroUsd: sql<string>`sum(${aiUsage.costEstimateMicroUsd})`
        })
        .from(aiUsage)
        .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
        .groupBy(sql`date_trunc('month', ${aiUsage.createdAt})`)
        .orderBy(sql`date_trunc('month', ${aiUsage.createdAt}) ASC`);

    return rows.map((r) => ({
        month: r.month,
        calls: Number(r.calls),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costMicroUsd: Number(r.costMicroUsd ?? 0)
    }));
}

// ---------------------------------------------------------------------------
// aggregateAiUsageByUser
// ---------------------------------------------------------------------------

/**
 * Input for {@link aggregateAiUsageByUser}.
 */
export interface AggregateAiUsageByUserInput {
    /**
     * Inclusive start of the calendar-month window (UTC).
     * Typically the first instant of the target month: `new Date('YYYY-MM-01T00:00:00Z')`.
     */
    readonly monthStart: Date;
    /**
     * Exclusive end of the calendar-month window (UTC).
     * Typically the first instant of the following month.
     */
    readonly monthEnd: Date;
    /**
     * Filter to a specific AI feature.
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * One row returned by {@link aggregateAiUsageByUser}.
 */
export interface AiUsageByUserAggRow {
    /** User UUID, or `null` for anonymised (deleted-user) rows. */
    readonly userId: string | null;
    /** Number of AI requests by this user in the period. */
    readonly calls: number;
    /** Total prompt tokens consumed. */
    readonly tokensIn: number;
    /** Total completion tokens generated. */
    readonly tokensOut: number;
    /** Total estimated cost in integer µUSD. */
    readonly costMicroUsd: number;
}

/**
 * Groups `ai_usage` rows within a half-open calendar-month window
 * `[monthStart, monthEnd)` by `userId`, returning aggregate totals.
 *
 * Rows with `userId IS NULL` (anonymised deleted users) are included and
 * reported with `userId: null`.
 *
 * Decision (owner-approved 2026-06-04): half-open range (`gte` + `lt`) is
 * the repo standard for monthly boundary queries.
 *
 * @param input - {@link AggregateAiUsageByUserInput}
 * @returns Rows ordered by calls DESC.
 *
 * @example
 * ```ts
 * const rows = await aggregateAiUsageByUser({
 *   monthStart: new Date('2026-06-01T00:00:00Z'),
 *   monthEnd:   new Date('2026-07-01T00:00:00Z'),
 * });
 * // [{ userId: 'abc...', calls: 50, tokensIn: 10000, tokensOut: 5000, costMicroUsd: 3000 }]
 * ```
 */
export async function aggregateAiUsageByUser(
    input: AggregateAiUsageByUserInput
): Promise<ReadonlyArray<AiUsageByUserAggRow>> {
    const { monthStart, monthEnd, feature, tx } = input;
    const db = tx ?? getDb();

    const conditions = buildConditions({ since: monthStart, until: monthEnd, feature });

    const rows = await db
        .select({
            userId: aiUsage.userId,
            calls: count(aiUsage.id),
            tokensIn: sql<string>`sum(${aiUsage.tokensIn})`,
            tokensOut: sql<string>`sum(${aiUsage.tokensOut})`,
            costMicroUsd: sql<string>`sum(${aiUsage.costEstimateMicroUsd})`
        })
        .from(aiUsage)
        .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
        .groupBy(aiUsage.userId)
        .orderBy(sql`count(${aiUsage.id}) DESC`);

    return rows.map((r) => ({
        userId: r.userId ?? null,
        calls: Number(r.calls),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costMicroUsd: Number(r.costMicroUsd ?? 0)
    }));
}

// ---------------------------------------------------------------------------
// aggregateAiUsageByFeature
// ---------------------------------------------------------------------------

/**
 * Input for {@link aggregateAiUsageByFeature}.
 */
export interface AggregateAiUsageByFeatureInput {
    /**
     * Inclusive start of the calendar-month window (UTC).
     * Typically the first instant of the target month: `new Date('YYYY-MM-01T00:00:00Z')`.
     */
    readonly monthStart: Date;
    /**
     * Exclusive end of the calendar-month window (UTC).
     * Typically the first instant of the following month.
     */
    readonly monthEnd: Date;
    /**
     * Filter to a specific user.
     * When omitted, aggregates across all users.
     */
    readonly userId?: string;
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * One row returned by {@link aggregateAiUsageByFeature}.
 */
export interface AiUsageByFeatureAggRow {
    /** AI feature identifier (e.g. `'text_improve'`, `'chat'`). */
    readonly feature: string;
    /** Number of AI requests for this feature in the period. */
    readonly calls: number;
    /** Total prompt tokens consumed. */
    readonly tokensIn: number;
    /** Total completion tokens generated. */
    readonly tokensOut: number;
    /** Total estimated cost in integer µUSD. */
    readonly costMicroUsd: number;
}

/**
 * Groups `ai_usage` rows within a half-open calendar-month window
 * `[monthStart, monthEnd)` by `feature`, returning aggregate totals.
 *
 * Decision (owner-approved 2026-06-04): half-open range (`gte` + `lt`) is
 * the repo standard for monthly boundary queries.
 *
 * @param input - {@link AggregateAiUsageByFeatureInput}
 * @returns Rows ordered by calls DESC.
 *
 * @example
 * ```ts
 * const rows = await aggregateAiUsageByFeature({
 *   monthStart: new Date('2026-06-01T00:00:00Z'),
 *   monthEnd:   new Date('2026-07-01T00:00:00Z'),
 * });
 * // [{ feature: 'chat', calls: 100, tokensIn: 20000, tokensOut: 8000, costMicroUsd: 5000 }]
 * ```
 */
export async function aggregateAiUsageByFeature(
    input: AggregateAiUsageByFeatureInput
): Promise<ReadonlyArray<AiUsageByFeatureAggRow>> {
    const { monthStart, monthEnd, userId, tx } = input;
    const db = tx ?? getDb();

    const conditions = buildConditions({ since: monthStart, until: monthEnd, userId });

    const rows = await db
        .select({
            feature: aiUsage.feature,
            calls: count(aiUsage.id),
            tokensIn: sql<string>`sum(${aiUsage.tokensIn})`,
            tokensOut: sql<string>`sum(${aiUsage.tokensOut})`,
            costMicroUsd: sql<string>`sum(${aiUsage.costEstimateMicroUsd})`
        })
        .from(aiUsage)
        .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
        .groupBy(aiUsage.feature)
        .orderBy(sql`count(${aiUsage.id}) DESC`);

    return rows.map((r) => ({
        feature: r.feature,
        calls: Number(r.calls),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costMicroUsd: Number(r.costMicroUsd ?? 0)
    }));
}

// ---------------------------------------------------------------------------
// countAiUsageForUserFeatureMonth
// ---------------------------------------------------------------------------

/**
 * Input for {@link countAiUsageForUserFeatureMonth}.
 */
export interface CountAiUsageForUserFeatureMonthInput {
    /** UUID of the authenticated user. */
    readonly userId: string;
    /** AI feature to count (e.g. `'text_improve'`, `'chat'`). */
    readonly feature: string;
    /**
     * Inclusive start of the calendar-month window (UTC).
     * Typically sourced from {@link getUtcMonthRange}.
     */
    readonly monthStart: Date;
    /**
     * Exclusive end of the calendar-month window (UTC).
     * Typically sourced from {@link getUtcMonthRange}.
     */
    readonly monthEnd: Date;
    /**
     * Which `status` values to include in the count.
     * The quota enforcement helper passes `['success', 'fallback']` — only
     * calls that **delivered value** count against quota. Provider errors
     * (`'error'`), rejected attempts (`'quota_exceeded'`, `'ceiling_hit'`,
     * `'kill_switch'`) are excluded so they do NOT consume quota.
     *
     * Must be a non-empty array; an empty array will return 0 via the WHERE
     * clause but is a caller bug — document it for later detection.
     */
    readonly statuses: readonly string[];
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * Counts `ai_usage` rows for a specific user, feature, and calendar-month
 * window, filtered to the supplied `statuses`.
 *
 * This is the lean call-count query used by the monthly quota enforcement
 * layer (SPEC-173 T-031).  It counts rows matching:
 *   `user_id = userId AND feature = feature AND created_at IN [monthStart, monthEnd)`
 *   AND `status IN statuses`.
 *
 * **Decision (owner-approved T-031)**: only calls that delivered value count
 * against quota.  The caller MUST pass `statuses: ['success', 'fallback']` for
 * quota checks.  Provider errors (`'error'`) and rejected attempts
 * (`'quota_exceeded'`, `'ceiling_hit'`, `'kill_switch'`) are excluded so they
 * do NOT consume quota.
 *
 * AC-4: this function lives in `storage/` — the ONLY sub-module allowed to
 * import `@repo/db` directly.
 *
 * @param input - {@link CountAiUsageForUserFeatureMonthInput}
 * @returns The number of matching rows (0 when there are none).
 *
 * @example
 * ```ts
 * const n = await countAiUsageForUserFeatureMonth({
 *   userId: 'abc-123',
 *   feature: 'text_improve',
 *   monthStart: new Date('2026-06-01T00:00:00Z'),
 *   monthEnd:   new Date('2026-07-01T00:00:00Z'),
 *   statuses: ['success', 'fallback'],
 * });
 * // n === 7
 * ```
 */
export async function countAiUsageForUserFeatureMonth(
    input: CountAiUsageForUserFeatureMonthInput
): Promise<number> {
    const { userId, feature, monthStart, monthEnd, statuses, tx } = input;
    const db = tx ?? getDb();

    // Build base conditions using the shared helper.
    const baseConditions = buildConditions({ since: monthStart, until: monthEnd, userId, feature });

    // Build the status IN (...) condition via sql template because `inArray`
    // is not re-exported by `@repo/db` and `drizzle-orm` is not a direct
    // dependency of this package. Using a positional parameter list avoids
    // SQL injection — Drizzle's `sql` template binds each value safely.
    //
    // When statuses is empty the placeholder list is empty, which is invalid SQL.
    // We guard with an early-return of 0 to make the edge-case explicit.
    if (statuses.length === 0) {
        return 0;
    }

    // Build `status IN ($1, $2, ...)` using Drizzle sql template.
    // Each element is interpolated as a bound parameter by Drizzle.
    const placeholders = statuses.map((s) => sql`${s}`);
    const statusCondition = sql`${aiUsage.status} IN (${sql.join(placeholders, sql`, `)})`;

    const allConditions = [...baseConditions, statusCondition];

    const [row] = await db
        .select({ total: count(aiUsage.id) })
        .from(aiUsage)
        .where(and(...(allConditions as Parameters<typeof and>)));

    return Number(row?.total ?? 0);
}

// ---------------------------------------------------------------------------
// aggregateAiUsageByModel (SPEC-260 T-003)
// ---------------------------------------------------------------------------

/**
 * Input for {@link aggregateAiUsageByModel}.
 */
export interface AggregateAiUsageByModelInput {
    /**
     * Inclusive start date for the query window.
     * When omitted, the query covers all rows up to `until` (or all rows).
     */
    readonly since?: Date;
    /**
     * Exclusive end date for the query window.
     * When omitted, the query covers all rows from `since` (or all rows).
     */
    readonly until?: Date;
    /**
     * Filter to a specific AI feature (e.g. `'text_improve'`).
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
    /**
     * Filter to a specific AI provider (e.g. `'openai'`, `'anthropic'`).
     * When omitted, aggregates across all providers.
     */
    readonly provider?: string;
    /**
     * Filter to a specific user (UUID).
     * When omitted, aggregates across all users.
     * Owner decision (OQ#1, 2026-06-22): API-level passthrough for debugging.
     */
    readonly userId?: string;
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * One row returned by {@link aggregateAiUsageByModel}.
 */
export interface AiUsageByModelAggRow {
    /** AI model identifier (e.g. `'gpt-4o-mini'`, `'claude-3-5-haiku-20241022'`). */
    readonly model: string;
    /** Number of AI requests for this model in the period. */
    readonly calls: number;
    /** Total prompt tokens consumed. */
    readonly tokensIn: number;
    /** Total completion tokens generated. */
    readonly tokensOut: number;
    /** Total estimated cost in integer µUSD (1 USD = 1,000,000 µUSD). */
    readonly costMicroUsd: number;
}

/**
 * Groups `ai_usage` rows by `model` and returns aggregate totals.
 *
 * Optionally filters by `feature` and/or `provider` and/or date window.
 * Rows with zero activity are NOT emitted — the caller handles zero-fill.
 *
 * @param input - {@link AggregateAiUsageByModelInput}
 * @returns Rows ordered by cost DESC.
 *
 * @example
 * ```ts
 * const rows = await aggregateAiUsageByModel({
 *   since: new Date('2026-06-01T00:00:00Z'),
 *   until: new Date('2026-07-01T00:00:00Z'),
 * });
 * // [{ model: 'gpt-4o-mini', calls: 120, tokensIn: 240000, tokensOut: 90000, costMicroUsd: 90000 }]
 * ```
 */
export async function aggregateAiUsageByModel(
    input: AggregateAiUsageByModelInput
): Promise<ReadonlyArray<AiUsageByModelAggRow>> {
    const { since, until, feature, provider, userId, tx } = input;
    const db = tx ?? getDb();

    const conditions = buildConditions({ since, until, feature, provider, userId });

    const rows = await db
        .select({
            model: aiUsage.model,
            calls: count(aiUsage.id),
            tokensIn: sql<string>`sum(${aiUsage.tokensIn})`,
            tokensOut: sql<string>`sum(${aiUsage.tokensOut})`,
            costMicroUsd: sql<string>`sum(${aiUsage.costEstimateMicroUsd})`
        })
        .from(aiUsage)
        .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
        .groupBy(aiUsage.model)
        .orderBy(sql`sum(${aiUsage.costEstimateMicroUsd}) DESC`);

    return rows.map((r) => ({
        model: r.model,
        calls: Number(r.calls),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costMicroUsd: Number(r.costMicroUsd ?? 0)
    }));
}

// ---------------------------------------------------------------------------
// aggregateAiUsageByProvider (SPEC-260 T-004)
// ---------------------------------------------------------------------------

/**
 * Input for {@link aggregateAiUsageByProvider}.
 */
export interface AggregateAiUsageByProviderInput {
    /**
     * Inclusive start date for the query window.
     * When omitted, the query covers all rows up to `until` (or all rows).
     */
    readonly since?: Date;
    /**
     * Exclusive end date for the query window.
     * When omitted, the query covers all rows from `since` (or all rows).
     */
    readonly until?: Date;
    /**
     * Filter to a specific AI feature (e.g. `'text_improve'`).
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
    /**
     * Filter to a specific user (UUID).
     * When omitted, aggregates across all users.
     * Owner decision (OQ#1, 2026-06-22): API-level passthrough for debugging.
     */
    readonly userId?: string;
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * One row returned by {@link aggregateAiUsageByProvider}.
 */
export interface AiUsageByProviderAggRow {
    /** AI provider identifier (e.g. `'openai'`, `'anthropic'`, `'stub'`). */
    readonly provider: string;
    /** Number of AI requests for this provider in the period. */
    readonly calls: number;
    /** Total prompt tokens consumed. */
    readonly tokensIn: number;
    /** Total completion tokens generated. */
    readonly tokensOut: number;
    /** Total estimated cost in integer µUSD (1 USD = 1,000,000 µUSD). */
    readonly costMicroUsd: number;
}

/**
 * Groups `ai_usage` rows by `provider` and returns aggregate totals.
 *
 * Optionally filters by `feature` and/or date window.
 * Rows with zero activity are NOT emitted — the caller handles zero-fill.
 *
 * @param input - {@link AggregateAiUsageByProviderInput}
 * @returns Rows ordered by cost DESC.
 *
 * @example
 * ```ts
 * const rows = await aggregateAiUsageByProvider({
 *   since: new Date('2026-06-01T00:00:00Z'),
 *   until: new Date('2026-07-01T00:00:00Z'),
 * });
 * // [{ provider: 'openai', calls: 200, tokensIn: 40000, tokensOut: 15000, costMicroUsd: 12000 }]
 * ```
 */
export async function aggregateAiUsageByProvider(
    input: AggregateAiUsageByProviderInput
): Promise<ReadonlyArray<AiUsageByProviderAggRow>> {
    const { since, until, feature, userId, tx } = input;
    const db = tx ?? getDb();

    const conditions = buildConditions({ since, until, feature, userId });

    const rows = await db
        .select({
            provider: aiUsage.provider,
            calls: count(aiUsage.id),
            tokensIn: sql<string>`sum(${aiUsage.tokensIn})`,
            tokensOut: sql<string>`sum(${aiUsage.tokensOut})`,
            costMicroUsd: sql<string>`sum(${aiUsage.costEstimateMicroUsd})`
        })
        .from(aiUsage)
        .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
        .groupBy(aiUsage.provider)
        .orderBy(sql`sum(${aiUsage.costEstimateMicroUsd}) DESC`);

    return rows.map((r) => ({
        provider: r.provider,
        calls: Number(r.calls),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costMicroUsd: Number(r.costMicroUsd ?? 0)
    }));
}

// ---------------------------------------------------------------------------
// aggregateAiUsageByFeatureModel (SPEC-260 T-005)
// ---------------------------------------------------------------------------

/**
 * Input for {@link aggregateAiUsageByFeatureModel}.
 */
export interface AggregateAiUsageByFeatureModelInput {
    /**
     * Inclusive start date for the query window.
     * When omitted, the query covers all rows up to `until` (or all rows).
     */
    readonly since?: Date;
    /**
     * Exclusive end date for the query window.
     * When omitted, the query covers all rows from `since` (or all rows).
     */
    readonly until?: Date;
    /**
     * Filter to a specific user (UUID).
     * When omitted, aggregates across all users.
     * Owner decision (OQ#1, 2026-06-22): API-level passthrough for debugging.
     */
    readonly userId?: string;
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * One row returned by {@link aggregateAiUsageByFeatureModel}.
 */
export interface AiUsageByFeatureModelAggRow {
    /** AI feature identifier (e.g. `'chat'`, `'text_improve'`). */
    readonly feature: string;
    /** AI model identifier (e.g. `'gpt-4o-mini'`). */
    readonly model: string;
    /** Number of AI requests for this feature × model combination in the period. */
    readonly calls: number;
    /** Total prompt tokens consumed. */
    readonly tokensIn: number;
    /** Total completion tokens generated. */
    readonly tokensOut: number;
    /** Total estimated cost in integer µUSD (1 USD = 1,000,000 µUSD). */
    readonly costMicroUsd: number;
}

/**
 * Groups `ai_usage` rows by `(feature, model)` and returns aggregate totals.
 *
 * Enables side-by-side comparison of two models used for the same feature.
 * Optionally filters by date window.
 * Rows with zero activity are NOT emitted.
 *
 * @param input - {@link AggregateAiUsageByFeatureModelInput}
 * @returns Rows ordered by feature ASC then cost DESC.
 *
 * @example
 * ```ts
 * const rows = await aggregateAiUsageByFeatureModel({
 *   since: new Date('2026-06-01T00:00:00Z'),
 *   until: new Date('2026-07-01T00:00:00Z'),
 * });
 * // [{ feature: 'chat', model: 'gpt-4o-mini', calls: 120, ... }]
 * ```
 */
export async function aggregateAiUsageByFeatureModel(
    input: AggregateAiUsageByFeatureModelInput
): Promise<ReadonlyArray<AiUsageByFeatureModelAggRow>> {
    const { since, until, userId, tx } = input;
    const db = tx ?? getDb();

    const conditions = buildConditions({ since, until, userId });

    const rows = await db
        .select({
            feature: aiUsage.feature,
            model: aiUsage.model,
            calls: count(aiUsage.id),
            tokensIn: sql<string>`sum(${aiUsage.tokensIn})`,
            tokensOut: sql<string>`sum(${aiUsage.tokensOut})`,
            costMicroUsd: sql<string>`sum(${aiUsage.costEstimateMicroUsd})`
        })
        .from(aiUsage)
        .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
        .groupBy(aiUsage.feature, aiUsage.model)
        .orderBy(aiUsage.feature, sql`sum(${aiUsage.costEstimateMicroUsd}) DESC`);

    return rows.map((r) => ({
        feature: r.feature,
        model: r.model,
        calls: Number(r.calls),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costMicroUsd: Number(r.costMicroUsd ?? 0)
    }));
}

// ---------------------------------------------------------------------------
// aggregateAiUsageDaily (SPEC-260 T-006)
// ---------------------------------------------------------------------------

/**
 * Input for {@link aggregateAiUsageDaily}.
 */
export interface AggregateAiUsageDailyInput {
    /**
     * Inclusive start date for the query window.
     * When omitted, the query covers all rows up to `until` (or all rows).
     */
    readonly since?: Date;
    /**
     * Exclusive end date for the query window.
     * When omitted, the query covers all rows from `since` (or all rows).
     */
    readonly until?: Date;
    /**
     * Filter to a specific AI feature (e.g. `'text_improve'`).
     * When omitted, aggregates across all features.
     */
    readonly feature?: string;
    /**
     * Filter to a specific AI model (e.g. `'gpt-4o-mini'`).
     * When omitted, aggregates across all models.
     */
    readonly model?: string;
    /**
     * Filter to a specific AI provider (e.g. `'openai'`).
     * When omitted, aggregates across all providers.
     */
    readonly provider?: string;
    /**
     * Filter to a specific user (UUID).
     * When omitted, aggregates across all users.
     * Owner decision (OQ#1, 2026-06-22): API-level passthrough for debugging.
     */
    readonly userId?: string;
    /** Optional Drizzle transaction client (falls back to `getDb()`). */
    readonly tx?: DrizzleClient;
}

/**
 * One row returned by {@link aggregateAiUsageDaily}.
 */
export interface AiUsageDailyAggRow {
    /**
     * UTC calendar day in `'YYYY-MM-DD'` format.
     * @example '2026-06-15'
     */
    readonly day: string;
    /** Number of AI requests on this day. */
    readonly calls: number;
    /** Total prompt tokens consumed. */
    readonly tokensIn: number;
    /** Total completion tokens generated. */
    readonly tokensOut: number;
    /** Total estimated cost in integer µUSD (1 USD = 1,000,000 µUSD). */
    readonly costMicroUsd: number;
}

/**
 * Groups `ai_usage` rows by UTC calendar day (`date_trunc('day', created_at)`)
 * and returns aggregate totals, ordered by day ascending.
 *
 * Only days with at least one row are returned — the reporting wrapper fills
 * missing days with zero rows for continuous chart axes (AC-3.3).
 *
 * Optionally filters by `feature`, `model`, and/or `provider` in addition to
 * the date window.
 *
 * @param input - {@link AggregateAiUsageDailyInput}
 * @returns Rows ordered by day ASC (YYYY-MM-DD strings, UTC).
 *
 * @example
 * ```ts
 * const rows = await aggregateAiUsageDaily({
 *   since: new Date('2026-06-01T00:00:00Z'),
 *   until: new Date('2026-07-01T00:00:00Z'),
 * });
 * // [{ day: '2026-06-01', calls: 5, tokensIn: 1000, tokensOut: 400, costMicroUsd: 250 }, ...]
 * ```
 */
export async function aggregateAiUsageDaily(
    input: AggregateAiUsageDailyInput
): Promise<ReadonlyArray<AiUsageDailyAggRow>> {
    const { since, until, feature, model, provider, userId, tx } = input;
    const db = tx ?? getDb();

    const conditions = buildConditions({ since, until, feature, model, provider, userId });

    const rows = await db
        .select({
            day: sql<string>`to_char(date_trunc('day', ${aiUsage.createdAt}), 'YYYY-MM-DD')`,
            calls: count(aiUsage.id),
            tokensIn: sql<string>`sum(${aiUsage.tokensIn})`,
            tokensOut: sql<string>`sum(${aiUsage.tokensOut})`,
            costMicroUsd: sql<string>`sum(${aiUsage.costEstimateMicroUsd})`
        })
        .from(aiUsage)
        .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
        .groupBy(sql`date_trunc('day', ${aiUsage.createdAt})`)
        .orderBy(sql`date_trunc('day', ${aiUsage.createdAt}) ASC`);

    return rows.map((r) => ({
        day: r.day,
        calls: Number(r.calls),
        tokensIn: Number(r.tokensIn ?? 0),
        tokensOut: Number(r.tokensOut ?? 0),
        costMicroUsd: Number(r.costMicroUsd ?? 0)
    }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a Drizzle SQL condition array from optional common filters.
 * The returned array can be spread into `and(...)`.
 *
 * Extended (SPEC-260 T-007) to support `model` and `provider` filters in
 * addition to the original `since`/`until`/`userId`/`feature` filters.
 *
 * @internal
 */
function buildConditions(filters: {
    readonly since?: Date;
    readonly until?: Date;
    readonly userId?: string;
    readonly feature?: string;
    readonly model?: string;
    readonly provider?: string;
}): ReturnType<typeof gte | typeof lt | typeof eq>[] {
    const { since, until, userId, feature, model, provider } = filters;
    const conditions: ReturnType<typeof gte | typeof lt | typeof eq>[] = [];

    if (since !== undefined) {
        conditions.push(gte(aiUsage.createdAt, since));
    }
    if (until !== undefined) {
        conditions.push(lt(aiUsage.createdAt, until));
    }
    if (userId !== undefined) {
        conditions.push(eq(aiUsage.userId, userId));
    }
    if (feature !== undefined) {
        conditions.push(eq(aiUsage.feature, feature));
    }
    if (model !== undefined) {
        conditions.push(eq(aiUsage.model, model));
    }
    if (provider !== undefined) {
        conditions.push(eq(aiUsage.provider, provider));
    }

    return conditions;
}
