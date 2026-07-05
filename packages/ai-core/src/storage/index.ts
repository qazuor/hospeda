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

// Re-export DB result types so other sub-modules / consumers can type their
// return values without importing @repo/db directly (AC-4 isolation rule).
export type { SelectAiPromptVersion, SelectAiUsage } from '@repo/db';

export {
    type ActivatePromptVersionInput,
    activatePromptVersion,
    type CreatePromptVersionInput,
    createPromptVersion,
    type GetActivePromptInput,
    type GetActivePromptResult,
    getActivePrompt,
    type ListPromptVersionsByFeatureInput,
    listPromptVersionsByFeature
} from './prompt.storage.js';
export {
    AiSettingsParseError,
    readAiSettings,
    type WriteAiSettingsInput,
    writeAiSettings
} from './settings.storage.js';
// Read-only aggregate reporting queries (SPEC-173 T-018)
// Monthly call-count query for quota enforcement (SPEC-173 T-031)
// SPEC-260: new aggregate queries — byModel, byProvider, byFeatureModel, daily
export {
    type AggregateAiUsageByFeatureInput,
    type AggregateAiUsageByFeatureModelInput,
    type AggregateAiUsageByModelInput,
    type AggregateAiUsageByMonthInput,
    type AggregateAiUsageByProviderInput,
    type AggregateAiUsageByUserInput,
    type AggregateAiUsageDailyInput,
    type AiUsageByFeatureAggRow,
    type AiUsageByFeatureModelAggRow,
    type AiUsageByModelAggRow,
    type AiUsageByProviderAggRow,
    type AiUsageByUserAggRow,
    type AiUsageDailyAggRow,
    type AiUsageMonthlyAggRow,
    aggregateAiUsageByFeature,
    aggregateAiUsageByFeatureModel,
    aggregateAiUsageByModel,
    aggregateAiUsageByMonth,
    aggregateAiUsageByProvider,
    aggregateAiUsageByUser,
    aggregateAiUsageDaily,
    type CountAiUsageForUserFeatureMonthInput,
    countAiUsageForUserFeatureMonth
} from './usage.queries.js';
export {
    type InsertAiRequestLogInput,
    type InsertAiUsageInput,
    insertAiRequestLog,
    insertAiUsage
} from './usage.storage.js';
