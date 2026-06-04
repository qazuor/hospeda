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
