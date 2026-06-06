/**
 * AI configuration module (SPEC-173 T-011).
 *
 * Provides typed, cache-aware access to the `ai_settings` blob stored in the
 * database.  All storage access goes through the `../storage` sub-module —
 * this module never imports `@repo/db` directly (AC-4 isolation rule).
 *
 * ### Exports
 *
 * - **`resolveConfig()`** — Reads the full `AiSettingsValue` blob via an
 *   in-memory TTL cache. Returns an empty default when no row exists yet.
 * - **`resolveFeatureConfig()`** — Returns the `AiFeatureConfig` for one
 *   feature from the resolved blob; throws `AiFeatureNotConfiguredError` if
 *   the feature has no config entry.
 * - **`saveConfig()`** — Validates, persists, and invalidates the cache in one
 *   atomic step (R-7 stale-read prevention).
 * - **`invalidateConfigCache()`** — Clears the cache immediately; useful when
 *   a write happens outside `saveConfig()` (e.g. transactional writes).
 * - **`getProviderOrder()`** — Returns the ordered provider list for a feature
 *   (primary + fallback chain).
 * - **`isFeatureKillSwitched()`** — Returns `true` when `enabled === false`.
 * - **`AiFeatureNotConfiguredError`** — Error class for unconfigured features.
 *
 * @module ai-core/config
 */

export {
    AiFeatureNotConfiguredError,
    getProviderOrder,
    invalidateConfigCache,
    isFeatureKillSwitched,
    resolveConfig,
    resolveFeatureConfig,
    saveConfig,
    type GetProviderOrderInput,
    type ProviderOrderResult,
    type ResolveFeatureConfigInput,
    type SaveConfigInput
} from './resolver.js';

// ---------------------------------------------------------------------------
// System-prompt resolver (T-034)
// ---------------------------------------------------------------------------

export {
    invalidatePromptCache,
    resolveSystemPrompt,
    type ResolveSystemPromptInput,
    type ResolveSystemPromptResult
} from './prompt-resolver.js';
