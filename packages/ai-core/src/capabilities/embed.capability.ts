/**
 * embed capability module (SPEC-173 T-015, V2 stub).
 *
 * Surface-complete stub for the `embed` capability. The `AiService.embed`
 * method is part of the public API so consumers have a stable import path
 * today, but V1 providers throw `NotImplementedError` — this helper passes
 * that error through transparently.
 *
 * **V2 stub**: no locale defaulting is applied (embedding is language-model
 * agnostic in V1). This module will be replaced in the vector-search child
 * spec with a real implementation routed through the engine.
 *
 * AC-4: this module MUST NOT import `@repo/db`, `ai`, or `@ai-sdk/*`.
 *
 * @module ai-core/capabilities/embed
 */

import type { AiProviderId } from '@repo/schemas';
import type { EmbedInput, EmbedOutput } from '../providers/ai-provider.interface.js';

// ---------------------------------------------------------------------------
// I/O shapes — re-export for public surface
// ---------------------------------------------------------------------------

export type { EmbedInput, EmbedOutput };

// ---------------------------------------------------------------------------
// Dependency injection shape
// ---------------------------------------------------------------------------

/**
 * Minimal provider interface needed by the embed capability.
 *
 * The embed capability does not go through the full routing engine in V1 — it
 * calls a single provider directly (the first available, or a configured embed
 * provider). This interface subset avoids importing the full `AiProvider` to
 * keep the capability self-contained.
 */
export interface EmbedProvider {
    /** The provider's stable identifier. */
    readonly id: AiProviderId;
    /**
     * Converts text to a dense vector embedding.
     * All V1 implementations throw `NotImplementedError`.
     */
    embed(input: EmbedInput): Promise<EmbedOutput>;
}

// ---------------------------------------------------------------------------
// Capability input for the internal implementation
// ---------------------------------------------------------------------------

/**
 * Internal input shape used by {@link executeEmbed}.
 */
export interface ExecuteEmbedInput {
    /** The embed request. */
    readonly request: EmbedInput;
    /**
     * Provider to call. In V1, the `AiService` forwards the primary provider
     * (obtained from `getProvider`); V1 providers throw `NotImplementedError`.
     */
    readonly provider: EmbedProvider;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Executes an `embed` call via the given provider.
 *
 * **V2 STUB**: In V1 all concrete providers throw `NotImplementedError`.
 * This function is exposed so that callers can already import and call
 * `AiService.embed` without a compile error; the error surfaces at runtime.
 *
 * The vector-search child spec will replace this with a real engine-routed
 * implementation.
 *
 * @param input - {@link ExecuteEmbedInput}
 * @returns A promise that V1 providers reject with `NotImplementedError`.
 *
 * @throws {NotImplementedError} Always in V1.
 *
 * @example
 * ```ts
 * // V2 usage (future):
 * const { embedding } = await executeEmbed({
 *   request: { text: 'alojamiento familiar' },
 *   provider: embedProvider,
 * });
 * ```
 */
export async function executeEmbed(input: ExecuteEmbedInput): Promise<EmbedOutput> {
    const { request, provider } = input;
    return provider.embed(request);
}
