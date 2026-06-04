/**
 * AI configuration resolver with in-memory cache (SPEC-173 T-011).
 *
 * Provides typed access to the `ai_settings` blob from `@repo/db` via the
 * storage layer.  All DB access goes through `readAiSettings()` and
 * `writeAiSettings()` from `../storage/index.js` — this module NEVER imports
 * `@repo/db` directly (AC-4 isolation rule).
 *
 * ## Cache + R-7 stale-read prevention
 *
 * The billing surface had a 300s in-memory TTL cache that was NOT invalidated
 * on write, causing stale reads after admin saves (SPEC-173 §9 R-7).  This
 * module prevents the same bug through two mechanisms:
 *
 * 1. **`saveConfig()`** — the ONLY write path. It calls `writeAiSettings()`
 *    and then immediately clears the cache, so the very next `resolveConfig()`
 *    call reads fresh data.
 * 2. **`invalidateConfigCache()`** — exported standalone so the admin route
 *    handler (T-016) can call it directly if it bypasses `saveConfig()` for
 *    some reason (e.g. transactional writes).
 *
 * The cache entry is cleared on write, NOT only after TTL expiry.  The TTL is
 * a safety net for long-running processes that never write; it is NOT the
 * primary freshness mechanism.
 *
 * @module ai-core/config/resolver
 */

import type { AiFeature, AiFeatureConfig, AiSettingsValue } from '@repo/schemas';
import { readAiSettings, writeAiSettings } from '../storage/index.js';
import type { WriteAiSettingsInput } from '../storage/index.js';

// ---------------------------------------------------------------------------
// Cache TTL
// ---------------------------------------------------------------------------

/**
 * Time-to-live for the in-memory resolved config, in milliseconds.
 *
 * 5 minutes (300 000 ms) — mirrors the billing convention used across this
 * codebase.  The TTL is the **fallback** freshness mechanism; explicit
 * invalidation on write (R-7) is the primary one.
 *
 * **Decision (owner-approved 2026-06-04): TTL = 300s (5 min), mirroring billing.**
 * The on-write `invalidateConfigCache()` is the primary anti-stale mechanism
 * (R-7); the TTL is only a safety net for long-running processes that never
 * write. AI settings change rarely, so 300s is safe.
 */
const CONFIG_CACHE_TTL_MS = 300_000;

// ---------------------------------------------------------------------------
// Module-scope cache state
// ---------------------------------------------------------------------------

/** Cached resolved settings blob. */
let _cachedConfig: AiSettingsValue | null = null;

/** Epoch ms when the cache was last populated.  `0` means empty. */
let _cachedAt = 0;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown by {@link resolveFeatureConfig} when the requested feature has no
 * entry in the `features` map of the stored blob.
 *
 * A missing feature entry is a **configuration error** (the admin has not yet
 * saved config for that feature), not a transient failure.  Callers should
 * surface this as a 503 / capability-unavailable response.
 */
export class AiFeatureNotConfiguredError extends Error {
    /** The feature that was requested but not found in the config. */
    readonly feature: AiFeature;

    constructor(feature: AiFeature) {
        super(
            `AI feature '${feature}' is not configured in ai_settings. An admin must save a configuration for this feature before it can be used.`
        );
        this.name = 'AiFeatureNotConfiguredError';
        this.feature = feature;
    }
}

// ---------------------------------------------------------------------------
// I/O shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for {@link resolveFeatureConfig}.
 */
export interface ResolveFeatureConfigInput {
    /** The AI feature to look up. */
    readonly feature: AiFeature;
}

/**
 * Input for {@link saveConfig}.
 */
export interface SaveConfigInput {
    /** The full AI settings blob to persist. */
    readonly value: AiSettingsValue;
    /** UUID of the SUPER_ADMIN performing the write. */
    readonly actorId: string;
}

/**
 * Result of {@link getProviderOrder} — the ordered list of provider IDs to
 * try for a feature (primary first, then fallback chain).
 */
export interface ProviderOrderResult {
    /**
     * Ordered provider IDs for the feature.
     * Index 0 is the primary provider; subsequent entries are fallbacks.
     * Empty only if the feature config has no primary provider (shouldn't
     * happen with a valid schema, but defensive typing is useful here).
     */
    readonly providers: readonly string[];
}

/**
 * Input for {@link getProviderOrder}.
 */
export interface GetProviderOrderInput {
    /** The feature config from which to derive the provider order. */
    readonly featureConfig: AiFeatureConfig;
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the in-memory cache holds a valid, non-expired entry.
 */
function isCacheValid(): boolean {
    return _cachedConfig !== null && Date.now() - _cachedAt < CONFIG_CACHE_TTL_MS;
}

/**
 * Invalidates the in-memory config cache immediately.
 *
 * The next call to {@link resolveConfig} will hit the storage layer and
 * repopulate the cache with fresh data.
 *
 * **Must be called** after any `ai_settings` write to prevent stale reads
 * (SPEC-173 §9 R-7).  {@link saveConfig} calls this automatically.  If a
 * caller writes to `ai_settings` through some other path (e.g. a direct
 * `writeAiSettings()` call in a transaction), it should call this function
 * explicitly.
 *
 * @example
 * ```ts
 * await writeAiSettings({ value, actorId });
 * invalidateConfigCache(); // ensure next resolve reads fresh data
 * ```
 */
export function invalidateConfigCache(): void {
    _cachedConfig = null;
    _cachedAt = 0;
}

// ---------------------------------------------------------------------------
// Core resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the full AI settings blob, using the in-memory cache when valid.
 *
 * Reads through `readAiSettings()` (the storage layer) on a cache miss.
 * Never imports `@repo/db` directly (AC-4).
 *
 * **No-config-yet default**: when no row exists in `ai_settings` (i.e.
 * `readAiSettings()` returns `null`), this function returns an empty-shaped
 * config: `{ providers: {}, features: {} }`.  The empty shape is safe — the
 * engine treats a missing provider entry as `{ enabled: false }` and a
 * missing feature entry as "not configured" (callers get
 * `AiFeatureNotConfiguredError` from `resolveFeatureConfig`).
 *
 * **Decision (owner-approved 2026-06-04): no-config-yet returns the empty
 * default `{ providers: {}, features: {} }`** (not `null`). Callers invoke
 * `resolveConfig()` unconditionally without a null-check; they only fail at
 * `resolveFeatureConfig()` with `AiFeatureNotConfiguredError` for an
 * unconfigured feature. The engine treats everything as disabled until seeded.
 *
 * @returns The validated `AiSettingsValue` blob (possibly an empty default).
 * @throws {AiSettingsParseError} If the stored blob fails schema validation.
 *
 * @example
 * ```ts
 * const config = await resolveConfig();
 * const openaiEnabled = config.providers.openai?.enabled ?? false;
 * ```
 */
export async function resolveConfig(): Promise<AiSettingsValue> {
    if (isCacheValid() && _cachedConfig !== null) {
        return _cachedConfig;
    }

    const value = await readAiSettings();

    // When no row exists yet, return an empty-but-safe default.  The `features`
    // field is typed as `Record<AiFeature, AiFeatureConfig>` by the schema
    // (all four keys required), but at runtime an absent row means NOTHING is
    // configured yet — the empty map is the correct representation.  We cast
    // it through `as AiSettingsValue` because:
    //   (a) `resolveFeatureConfig` guards callers against absent keys by
    //       throwing `AiFeatureNotConfiguredError` before they touch the map.
    //   (b) Changing the schema to `z.partialRecord` would ripple through
    //       every engine call site.
    // This is the ONLY place we use this cast; all real reads return a
    // schema-validated blob from `readAiSettings`.
    // Decision (owner-approved 2026-06-04): empty default over `null`.
    const resolved: AiSettingsValue =
        value ?? ({ providers: {}, features: {} } as unknown as AiSettingsValue);

    _cachedConfig = resolved;
    _cachedAt = Date.now();

    return resolved;
}

// ---------------------------------------------------------------------------
// Feature-level accessor
// ---------------------------------------------------------------------------

/**
 * Resolves the {@link AiFeatureConfig} for a single AI feature.
 *
 * Internally calls {@link resolveConfig} (cache-aware) and then looks up the
 * feature key in the `features` map.
 *
 * @param input - {@link ResolveFeatureConfigInput}
 * @returns The validated `AiFeatureConfig` for the requested feature.
 * @throws {AiFeatureNotConfiguredError} If the feature has no entry in the
 *   resolved blob (admin has not configured it yet, or the blob is empty).
 * @throws {AiSettingsParseError} If the stored blob fails schema validation.
 *
 * @example
 * ```ts
 * const featureCfg = await resolveFeatureConfig({ feature: 'text_improve' });
 * if (!featureCfg.enabled) {
 *   throw new Error('text_improve is kill-switched off');
 * }
 * console.log(featureCfg.primaryProvider); // 'openai'
 * ```
 */
export async function resolveFeatureConfig(
    input: ResolveFeatureConfigInput
): Promise<AiFeatureConfig> {
    const { feature } = input;
    const config = await resolveConfig();

    const featureConfig = config.features[feature];
    if (featureConfig === undefined) {
        throw new AiFeatureNotConfiguredError(feature);
    }

    return featureConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of provider IDs the engine should try for a
 * feature: primary provider first, followed by the fallback chain.
 *
 * Purely a helper that composes data already present in the feature config.
 * Does NOT read from cache or storage.
 *
 * @param input - {@link GetProviderOrderInput}
 * @returns {@link ProviderOrderResult} with the ordered provider IDs.
 *
 * @example
 * ```ts
 * const featureCfg = await resolveFeatureConfig({ feature: 'chat' });
 * const { providers } = getProviderOrder({ featureConfig: featureCfg });
 * // providers: ['anthropic', 'openai'] (primary + fallback)
 * ```
 */
export function getProviderOrder(input: GetProviderOrderInput): ProviderOrderResult {
    const { featureConfig } = input;
    return {
        providers: [featureConfig.primaryProvider, ...featureConfig.fallbackChain]
    };
}

/**
 * Returns `true` when the given feature config's kill-switch is active (i.e.
 * `enabled === false`).
 *
 * This is a thin helper so the engine layer has a single expressive call site
 * rather than repeating `!featureConfig.enabled` inline.
 *
 * @param featureConfig - The resolved feature config to check.
 * @returns `true` if the feature is disabled, `false` if it is enabled.
 *
 * @example
 * ```ts
 * const featureCfg = await resolveFeatureConfig({ feature: 'search' });
 * if (isFeatureKillSwitched(featureCfg)) {
 *   return { error: 'AI search is currently disabled by an admin.' };
 * }
 * ```
 */
export function isFeatureKillSwitched(featureConfig: AiFeatureConfig): boolean {
    return !featureConfig.enabled;
}

// ---------------------------------------------------------------------------
// Write path (cache-invalidating)
// ---------------------------------------------------------------------------

/**
 * Validates, persists, and immediately invalidates the in-memory cache.
 *
 * This is the ONLY write path callers should use when they want the cache to
 * stay coherent.  After this call returns, the next {@link resolveConfig}
 * will read fresh data from storage — no stale cache window (R-7).
 *
 * @param input - {@link SaveConfigInput}
 * @returns The saved `ai_settings` DB row (raw Drizzle type from storage).
 * @throws {Error} If `value` fails schema validation (forwarded from
 *   `writeAiSettings`).
 *
 * @example
 * ```ts
 * await saveConfig({ value: newBlob, actorId: adminId });
 * // The very next resolveConfig() call will read the new blob, not the
 * // previously cached one.
 * ```
 */
export async function saveConfig(input: SaveConfigInput): Promise<void> {
    const writeInput: WriteAiSettingsInput = {
        value: input.value,
        actorId: input.actorId
    };

    await writeAiSettings(writeInput);

    // Explicit invalidation — prevents the R-7 stale-read window entirely.
    // The cache TTL alone is NOT sufficient; this must happen synchronously
    // after the await resolves so no concurrent reader can get stale data.
    invalidateConfigCache();
}
