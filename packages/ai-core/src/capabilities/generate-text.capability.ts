/**
 * generateText capability module (SPEC-173 T-015).
 *
 * Thin helper that shapes a `generateText` call for the AiService layer:
 * fills in the locale default when the caller omits it, then delegates to
 * the engine.
 *
 * AC-4: this module MUST NOT import `@repo/db`, `ai`, or `@ai-sdk/*`.
 *
 * @module ai-core/capabilities/generate-text
 */

import type {
    AiFeature,
    GenerateTextRequest,
    GenerateTextResponse,
    LanguageEnum
} from '@repo/schemas';
import type { AiEngine } from '../engine/index.js';

// ---------------------------------------------------------------------------
// I/O shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for the `generateText` capability helper.
 *
 * Extends `GenerateTextRequest` but makes `locale` optional — when omitted
 * the service fills in `defaultLocale` before forwarding to the engine.
 *
 * Exactly one of `prompt` or `messages` must be provided (same constraint as
 * `GenerateTextRequest`; enforced by the engine's underlying Zod schema at the
 * HTTP boundary — not re-enforced here to keep the helper thin).
 */
export type GenerateTextCapabilityInput = Omit<GenerateTextRequest, 'locale'> & {
    /**
     * User locale for prompt localisation.
     * When absent the `AiService` fills in `defaultLocale` (default `'es'`).
     */
    readonly locale?: LanguageEnum;
};

/**
 * Output of the `generateText` capability helper.
 *
 * Identical to `GenerateTextResponse` — the helper adds no extra fields.
 */
export type GenerateTextCapabilityOutput = GenerateTextResponse;

// ---------------------------------------------------------------------------
// Capability input for the internal implementation
// ---------------------------------------------------------------------------

/**
 * Internal input shape used by {@link executeGenerateText}.
 */
export interface ExecuteGenerateTextInput {
    /** The raw capability request (locale may be omitted by the caller). */
    readonly request: GenerateTextCapabilityInput;
    /** Resolved default locale from `AiService` config. */
    readonly defaultLocale: LanguageEnum;
    /** The engine instance to delegate to. */
    readonly engine: AiEngine;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Executes a `generateText` call via the engine, applying locale defaulting.
 *
 * 1. If `request.locale` is absent, fills in `defaultLocale` (FR-13).
 * 2. Delegates the fully-shaped request to `engine.generateText`.
 *
 * @param input - {@link ExecuteGenerateTextInput}
 * @returns The generate-text response from the engine.
 *
 * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
 * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
 * @throws {AiEngineExhaustedError} If all providers fail.
 *
 * @example
 * ```ts
 * const result = await executeGenerateText({
 *   request: { feature: 'text_improve', prompt: 'Fix grammar' },
 *   defaultLocale: 'es',
 *   engine,
 * });
 * console.log(result.text);
 * ```
 */
export async function executeGenerateText(
    input: ExecuteGenerateTextInput
): Promise<GenerateTextCapabilityOutput> {
    const { request, defaultLocale, engine } = input;

    const engineRequest: GenerateTextRequest = {
        ...request,
        locale: request.locale ?? defaultLocale,
        feature: request.feature as AiFeature
    };

    return engine.generateText(engineRequest);
}
