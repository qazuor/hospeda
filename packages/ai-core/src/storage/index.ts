/**
 * AI artifact storage module (SPEC-173 T-010).
 *
 * The ONE AND ONLY module in `@repo/ai-core` that is allowed to import
 * `@repo/db` directly (AC-4 isolation rule).  All other sub-modules must
 * depend on storage through plain function calls and `@repo/schemas` types —
 * never through Drizzle types.
 *
 * Sub-modules:
 * - `settings.storage` — read/write the `ai_settings` table (`'global'` key).
 * - `prompt.storage`   — read active `ai_prompt_versions` rows.
 * - `usage.storage`    — append rows to `ai_usage` and `ai_request_log`.
 *
 * @module ai-core/storage
 */

export {
    AiSettingsParseError,
    readAiSettings,
    writeAiSettings,
    type WriteAiSettingsInput
} from './settings.storage.js';

export {
    getActivePrompt,
    type GetActivePromptInput,
    type GetActivePromptResult
} from './prompt.storage.js';

export {
    insertAiUsage,
    insertAiRequestLog,
    type InsertAiUsageInput,
    type InsertAiRequestLogInput
} from './usage.storage.js';

// Re-export DB result types so usage/ sub-module can type its return value
// without importing @repo/db directly (AC-4 isolation rule).
export type { SelectAiUsage } from '@repo/db';

// Read-only aggregate reporting queries (SPEC-173 T-018)
export {
    aggregateAiUsageByMonth,
    aggregateAiUsageByUser,
    aggregateAiUsageByFeature,
    type AggregateAiUsageByMonthInput,
    type AggregateAiUsageByUserInput,
    type AggregateAiUsageByFeatureInput,
    type AiUsageMonthlyAggRow,
    type AiUsageByUserAggRow,
    type AiUsageByFeatureAggRow
} from './usage.queries.js';
