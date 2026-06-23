/**
 * AI usage reporting aggregate schemas (SPEC-173 T-018).
 *
 * These schemas describe the READ-ONLY shapes returned by the usage reporting
 * helpers in `@repo/ai-core/usage/reporting`. They are NOT stored directly in
 * the DB — they are the result of GROUP BY aggregate queries over `ai_usage`.
 *
 * Money convention: all `costMicroUsd` fields are **integer µUSD**
 * (millionths of a US dollar; 1 USD = 1,000,000 µUSD). Never float.
 *
 * Decision (owner-approved 2026-06-04): the "month" period is calendar-month
 * UTC — `date_trunc('month', created_at)` in UTC, matching the existing repo
 * precedent (conversation.model monthly stats). NOT the billing-cycle
 * anniversary.
 *
 * @module schemas/entities/ai/ai-usage-report
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// AiUsageTotalsSchema — shared totals shape
// ---------------------------------------------------------------------------

/**
 * Totals sub-shape shared by every aggregate row.
 *
 * - `calls`        — number of AI requests in the bucket.
 * - `tokensIn`     — total prompt tokens consumed.
 * - `tokensOut`    — total completion tokens generated.
 * - `costMicroUsd` — total estimated cost in integer µUSD (1 USD = 1,000,000 µUSD).
 */
export const AiUsageTotalsSchema = z.object({
    /** Number of AI requests in this bucket. */
    calls: z.number().int().min(0),
    /** Total prompt (input) tokens consumed. */
    tokensIn: z.number().int().min(0),
    /** Total completion (output) tokens generated. */
    tokensOut: z.number().int().min(0),
    /**
     * Total estimated cost in integer micro-USD (µUSD).
     * 1 USD = 1,000,000 µUSD. Never float.
     */
    costMicroUsd: z.number().int().min(0)
});

/** Shared totals shape for all AI usage aggregate rows. */
export type AiUsageTotals = z.infer<typeof AiUsageTotalsSchema>;

// ---------------------------------------------------------------------------
// AiUsageMonthlyRowSchema — time-bucketed rollup
// ---------------------------------------------------------------------------

/**
 * One row in a monthly rollup report.
 *
 * `month` is formatted as `'YYYY-MM'` (e.g. `'2026-06'`), matching the
 * `to_char(date_trunc('month', created_at), 'YYYY-MM')` SQL pattern.
 *
 * Decision (owner-approved 2026-06-04): bucketing is calendar-month UTC.
 */
export const AiUsageMonthlyRowSchema = AiUsageTotalsSchema.extend({
    /**
     * Calendar month in `'YYYY-MM'` format (UTC).
     * @example '2026-06'
     */
    month: z.string().regex(/^\d{4}-\d{2}$/, "month must be 'YYYY-MM' format")
});

/** A single monthly rollup row for AI usage. */
export type AiUsageMonthlyRow = z.infer<typeof AiUsageMonthlyRowSchema>;

// ---------------------------------------------------------------------------
// AiUsageByUserRowSchema — per-user rollup
// ---------------------------------------------------------------------------

/**
 * One row in a per-user aggregate report.
 *
 * `userId` is `null` for anonymised rows (user was deleted; `ON DELETE SET NULL`
 * preserves the metering data but removes the FK).
 */
export const AiUsageByUserRowSchema = AiUsageTotalsSchema.extend({
    /**
     * UUID of the user, or `null` for anonymised (deleted-user) rows.
     */
    userId: z.string().uuid().nullable()
});

/** A single per-user aggregate row for AI usage. */
export type AiUsageByUserRow = z.infer<typeof AiUsageByUserRowSchema>;

// ---------------------------------------------------------------------------
// AiUsageByFeatureRowSchema — per-feature rollup
// ---------------------------------------------------------------------------

/**
 * One row in a per-feature aggregate report.
 *
 * `feature` matches `AiFeature` values (`text_improve`, `chat`, `search`,
 * `support`) but is typed as `string` to stay decoupled from the enum definition
 * and to accommodate future feature additions without schema churn.
 */
export const AiUsageByFeatureRowSchema = AiUsageTotalsSchema.extend({
    /**
     * AI feature identifier (e.g. `'text_improve'`, `'chat'`, `'search'`).
     */
    feature: z.string().min(1)
});

/** A single per-feature aggregate row for AI usage. */
export type AiUsageByFeatureRow = z.infer<typeof AiUsageByFeatureRowSchema>;

// ---------------------------------------------------------------------------
// AiUsageByModelRowSchema — per-model rollup (SPEC-260)
// ---------------------------------------------------------------------------

/**
 * One row in a per-model aggregate report (SPEC-260).
 *
 * `model` is typed as `string` to stay decoupled from the model identifier
 * enum and to accommodate new provider models without schema churn.
 * Expected values follow provider conventions (e.g. `'gpt-4o-mini'`,
 * `'claude-3-5-haiku-20241022'`).
 */
export const AiUsageByModelRowSchema = AiUsageTotalsSchema.extend({
    /**
     * AI model identifier string (e.g. `'gpt-4o-mini'`, `'claude-3-5-haiku-20241022'`).
     * Non-empty; value comes directly from the `ai_usage.model` column.
     */
    model: z.string().min(1)
});

/** A single per-model aggregate row for AI usage. */
export type AiUsageByModelRow = z.infer<typeof AiUsageByModelRowSchema>;

// ---------------------------------------------------------------------------
// AiUsageByProviderRowSchema — per-provider rollup (SPEC-260)
// ---------------------------------------------------------------------------

/**
 * One row in a per-provider aggregate report (SPEC-260).
 *
 * `provider` is typed as `string` to stay forward-compatible with new
 * provider integrations.  Expected values: `'openai'`, `'anthropic'`,
 * `'stub'`.
 */
export const AiUsageByProviderRowSchema = AiUsageTotalsSchema.extend({
    /**
     * AI provider identifier (e.g. `'openai'`, `'anthropic'`, `'stub'`).
     * Non-empty; value comes directly from the `ai_usage.provider` column.
     */
    provider: z.string().min(1)
});

/** A single per-provider aggregate row for AI usage. */
export type AiUsageByProviderRow = z.infer<typeof AiUsageByProviderRowSchema>;

// ---------------------------------------------------------------------------
// AiUsageByFeatureModelRowSchema — feature × model cross rollup (SPEC-260)
// ---------------------------------------------------------------------------

/**
 * One row in a feature × model cross aggregate report (SPEC-260).
 *
 * Enables side-by-side comparison of two models used for the same feature
 * (e.g. `chat` + `gpt-4o-mini` vs. `chat` + `claude-3-5-haiku-20241022`).
 * Both `feature` and `model` are typed as `string` to stay forward-compatible.
 */
export const AiUsageByFeatureModelRowSchema = AiUsageTotalsSchema.extend({
    /**
     * AI feature identifier (e.g. `'text_improve'`, `'chat'`).
     * Non-empty; value comes directly from the `ai_usage.feature` column.
     */
    feature: z.string().min(1),
    /**
     * AI model identifier string (e.g. `'gpt-4o-mini'`).
     * Non-empty; value comes directly from the `ai_usage.model` column.
     */
    model: z.string().min(1)
});

/** A single feature × model cross aggregate row for AI usage. */
export type AiUsageByFeatureModelRow = z.infer<typeof AiUsageByFeatureModelRowSchema>;

// ---------------------------------------------------------------------------
// AiUsageDailyRowSchema — daily time-series rollup (SPEC-260)
// ---------------------------------------------------------------------------

/**
 * One row in a daily time-series aggregate report (SPEC-260).
 *
 * `day` is formatted as `'YYYY-MM-DD'` (UTC), matching the
 * `to_char(date_trunc('day', created_at), 'YYYY-MM-DD')` SQL pattern.
 * Days with zero activity are NOT emitted by the storage layer — the
 * reporting wrapper fills missing days with zeros for continuous chart axes.
 */
export const AiUsageDailyRowSchema = AiUsageTotalsSchema.extend({
    /**
     * UTC calendar day in `'YYYY-MM-DD'` format.
     *
     * @example '2026-06-15'
     */
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be 'YYYY-MM-DD' format")
});

/** A single daily aggregate row for AI usage. */
export type AiUsageDailyRow = z.infer<typeof AiUsageDailyRowSchema>;
