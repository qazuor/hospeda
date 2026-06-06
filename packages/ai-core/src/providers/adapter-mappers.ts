/**
 * Shared mapping utilities for Vercel AI SDK v6 ↔ AiProvider interface.
 *
 * This module is the ONLY place inside `@repo/ai-core` that is allowed to
 * import from `'ai'`. It converts SDK-internal shapes to the platform-agnostic
 * types defined in `@repo/schemas` so that neither the adapter classes nor any
 * upstream code depends directly on the SDK's types.
 *
 * **Import rules**:
 * - MAY import from `'ai'` for type-level SDK shapes.
 * - MUST NOT import from `'@ai-sdk/openai'` or `'@ai-sdk/anthropic'`
 *   (those are adapter-specific concerns).
 * - MUST NOT be imported by the engine or capabilities layers.
 *
 * @module ai-core/providers/adapter-mappers
 */

import type { AiProviderId, AiUsageStats } from '@repo/schemas';
import type { LanguageModelUsage } from 'ai';

// ---------------------------------------------------------------------------
// Usage mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Vercel AI SDK v6 `LanguageModelUsage` object to the platform-agnostic
 * `AiUsageStats` shape.
 *
 * The SDK v6 uses `inputTokens` / `outputTokens` (both `number | undefined`).
 * `AiUsageStats` uses `promptTokens` / `completionTokens` / `totalTokens`
 * (all `number`, min 0). Undefined SDK values are normalised to 0.
 *
 * @param sdkUsage - The usage object from `generateText` or `streamText` SDK results.
 * @returns Platform-agnostic token-usage statistics.
 *
 * @example
 * ```ts
 * const usage = mapSdkUsage(result.usage);
 * // { promptTokens: 50, completionTokens: 100, totalTokens: 150 }
 * ```
 */
export function mapSdkUsage(sdkUsage: LanguageModelUsage): AiUsageStats {
    const prompt = sdkUsage.inputTokens ?? 0;
    const completion = sdkUsage.outputTokens ?? 0;
    return {
        promptTokens: prompt,
        completionTokens: completion,
        totalTokens: prompt + completion
    };
}

// ---------------------------------------------------------------------------
// Finish reason mapping
// ---------------------------------------------------------------------------

/**
 * Maps a Vercel AI SDK v6 `FinishReason` string to a plain string for the
 * platform-agnostic response.
 *
 * The SDK's `FinishReason` type is already a plain string union
 * (`'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other'`),
 * so this is a pass-through. The function exists so callers do not need to
 * import `FinishReason` from `'ai'`.
 *
 * @param finishReason - The finish reason from the SDK result.
 * @returns The same string value, typed as `string` for the agnostic response.
 */
export function mapFinishReason(finishReason: string): string {
    return finishReason;
}

// ---------------------------------------------------------------------------
// Model identifier mapping
// ---------------------------------------------------------------------------

/**
 * Resolves the model string to use in a provider call.
 *
 * If the request carries an explicit `model` override it is used as-is.
 * Otherwise the `defaultModel` (the adapter's configured default) is returned.
 *
 * @param requestModel - Optional model override from the capability request.
 * @param defaultModel - The adapter's default model identifier.
 * @returns The resolved model string.
 */
export function resolveModel(requestModel: string | undefined, defaultModel: string): string {
    return requestModel ?? defaultModel;
}

// ---------------------------------------------------------------------------
// Provider ID constant mapper
// ---------------------------------------------------------------------------

/**
 * Returns the canonical `AiProviderId` for a given adapter.
 *
 * This function exists so the adapters can pass their `id` through without
 * directly asserting `'openai' as AiProviderId` (which would bypass the Zod
 * schema's runtime guarantees at call sites that validate the value).
 *
 * @param id - The provider identifier string.
 * @returns The same value cast to `AiProviderId`.
 */
export function asProviderId(id: string): AiProviderId {
    // AiProviderId is z.enum(['openai', 'anthropic', 'stub']) — the adapters
    // always pass a literal string that is one of those three values. This
    // function avoids `as` casts spreading through adapter code.
    return id as AiProviderId;
}
