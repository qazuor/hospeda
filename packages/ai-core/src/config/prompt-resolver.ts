/**
 * System-prompt resolver with TTL cache (SPEC-173 §5.6.3, T-034, AC-12).
 *
 * Provides a single cached access point for the active system prompt of any
 * AI feature.  The resolver reads through the storage layer (`getActivePrompt`)
 * and falls back to the in-code default from `DEFAULT_PROMPTS` when the admin
 * has not configured a prompt or the active prompt is blank.
 *
 * ## Cache design
 *
 * Mirrors the pattern in `./resolver.ts` (the config resolver):
 * - Module-scope `Map<AiFeature, PromptCacheEntry>` keyed by feature.
 * - Per-entry timestamps: a cache hit requires `Date.now() - cachedAt < TTL`.
 * - TTL is 300 000 ms (5 min) — same as the config resolver.
 * - `invalidatePromptCache(feature?)` clears one feature or all features.
 *
 * ## AC-12 fallback rule
 *
 * `content === null` OR `content.trim() === ''` → use `DEFAULT_PROMPTS[feature]`
 * with `source: 'default'`.  Any non-blank admin content wins with
 * `source: 'admin'`.
 *
 * ## R-7 stale-read prevention
 *
 * The admin routes that write / activate prompt versions (apps/api T-028 + T-034
 * wiring) MUST call `invalidatePromptCache(feature)` immediately after the write.
 * The TTL is a safety net for long-running processes, not the primary freshness
 * mechanism.
 *
 * @module ai-core/config/prompt-resolver
 */

import type { AiFeature } from '@repo/schemas';
import { DEFAULT_PROMPTS } from '../engine/default-prompts.js';
import { getActivePrompt } from '../storage/prompt.storage.js';

// ---------------------------------------------------------------------------
// Cache TTL
// ---------------------------------------------------------------------------

/**
 * Time-to-live for per-feature resolved system-prompt entries, in milliseconds.
 *
 * 5 minutes (300 000 ms) — mirrors the billing and config-resolver convention.
 * On-write invalidation via {@link invalidatePromptCache} is the primary
 * freshness mechanism; the TTL is only a safety net.
 *
 * **Decision (owner-approved 2026-06-04): TTL = 300s, identical to the config
 * resolver.** Admin prompts change rarely; stale prompts degrade quality but do
 * not cause security issues. The admin write path (T-028 routes) calls
 * `invalidatePromptCache` on every successful write so the TTL is rarely the
 * first line of defence.
 */
const PROMPT_CACHE_TTL_MS = 300_000;

// ---------------------------------------------------------------------------
// Cache state
// ---------------------------------------------------------------------------

/** Single cache entry for a resolved prompt. */
interface PromptCacheEntry {
    readonly content: string;
    readonly source: 'admin' | 'default';
    /** Epoch ms when this entry was populated. */
    readonly cachedAt: number;
}

/** Module-scope per-feature prompt cache. */
const _promptCache = new Map<AiFeature, PromptCacheEntry>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the cache entry for `feature` is valid and non-expired.
 */
function isEntryCacheValid(feature: AiFeature): boolean {
    const entry = _promptCache.get(feature);
    if (entry === undefined) {
        return false;
    }
    return Date.now() - entry.cachedAt < PROMPT_CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// I/O shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for {@link resolveSystemPrompt}.
 */
export interface ResolveSystemPromptInput {
    /** The AI feature whose system prompt is requested. */
    readonly feature: AiFeature;
}

/**
 * Result returned by {@link resolveSystemPrompt}.
 *
 * - `content` — the effective system-prompt text (never blank).
 * - `source`  — `'admin'` if the content came from the database row;
 *               `'default'` if the in-code fallback was used (AC-12).
 */
export interface ResolveSystemPromptResult {
    /** The effective system-prompt text. Always a non-empty string. */
    readonly content: string;
    /**
     * Identifies where the content came from.
     *
     * - `'admin'`   — the content was read from the `ai_prompt_versions` table
     *                 (an admin-configured prompt is active).
     * - `'default'` — no active admin prompt exists or it was blank; the
     *                 in-code default from `DEFAULT_PROMPTS` was used (AC-12).
     */
    readonly source: 'admin' | 'default';
}

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidates the system-prompt cache immediately.
 *
 * - When `feature` is provided, only that feature's cache entry is cleared.
 * - When `feature` is absent (or `undefined`), ALL entries are cleared.
 *
 * **Must be called** by the admin prompt write / activate routes (apps/api,
 * T-028 + T-034 wiring) after every successful `createPromptVersion` or
 * `activatePromptVersion` call to prevent stale prompts (R-7 convention).
 *
 * The same convention applies to {@link invalidateConfigCache} in
 * `./resolver.ts` — both resolvers are invalidated on their respective write
 * paths to prevent stale reads.
 *
 * @param feature - The feature to invalidate, or `undefined` to clear all.
 *
 * @example
 * ```ts
 * // After activating a new admin prompt for 'text_improve':
 * await activatePromptVersion({ id: versionId });
 * invalidatePromptCache('text_improve');
 *
 * // After a bulk reset (e.g. test teardown):
 * invalidatePromptCache();
 * ```
 */
export function invalidatePromptCache(feature?: AiFeature): void {
    if (feature !== undefined) {
        _promptCache.delete(feature);
    } else {
        _promptCache.clear();
    }
}

// ---------------------------------------------------------------------------
// Core resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the effective system prompt for an AI feature.
 *
 * ## Resolution order
 *
 * 1. **Cache hit** — returns the cached entry when the TTL has not expired.
 * 2. **Storage read** — calls `getActivePrompt({ feature })` (the storage layer;
 *    never imports `@repo/db` directly — AC-4).
 * 3. **AC-12 fallback** — if `content` is `null` or blank (`trim() === ''`),
 *    falls back to `DEFAULT_PROMPTS[feature]` with `source: 'default'`.
 * 4. **Storage error resilience (AC-12 spirit)** — if the storage read THROWS
 *    (e.g. DB unavailable), the default is returned WITHOUT caching so a
 *    recovered DB is picked up on the next call (no poisoned cache).
 *
 * The resolved result is written to the cache before returning, so subsequent
 * calls within the TTL window skip the storage read.
 *
 * @param input - {@link ResolveSystemPromptInput}
 * @returns {@link ResolveSystemPromptResult} — always a non-blank `content`.
 *
 * @example
 * ```ts
 * // Engine usage (generateText, streamText, generateObject):
 * const { content, source } = await resolveSystemPrompt({ feature: 'text_improve' });
 * // source === 'admin'   → admin-configured prompt (DB row)
 * // source === 'default' → in-code fallback (AC-12)
 * ```
 */
export async function resolveSystemPrompt(
    input: ResolveSystemPromptInput
): Promise<ResolveSystemPromptResult> {
    const { feature } = input;

    // Cache hit — return early.
    if (isEntryCacheValid(feature)) {
        // Non-null assertion: isEntryCacheValid already confirmed the entry exists.
        // biome-ignore lint/style/noNonNullAssertion: guarded by isEntryCacheValid
        const cached = _promptCache.get(feature)!;
        return { content: cached.content, source: cached.source };
    }

    // Cache miss — read from storage.
    //
    // AC-12 resilience (F4): if the storage layer throws (e.g. DB unavailable),
    // fall back to the in-code default WITHOUT caching the failure result.
    // This keeps a recovered DB usable on the next call — no poisoned cache.
    let adminContent: string | null;
    try {
        const storageResult = await getActivePrompt({ feature });
        adminContent = storageResult.content;
    } catch {
        // Storage error — return the in-code default without caching so
        // a subsequent call after DB recovery will retry the storage read.
        return { content: DEFAULT_PROMPTS[feature], source: 'default' };
    }

    // AC-12: null or blank admin prompt → use in-code default.
    const isAdminPromptBlank = adminContent === null || adminContent.trim() === '';
    const resolved: ResolveSystemPromptResult = isAdminPromptBlank
        ? { content: DEFAULT_PROMPTS[feature], source: 'default' as const }
        : { content: adminContent as string, source: 'admin' as const };

    // Populate the cache only on a clean successful read.
    const entry: PromptCacheEntry = {
        content: resolved.content,
        source: resolved.source,
        cachedAt: Date.now()
    };
    _promptCache.set(feature, entry);

    return resolved;
}
