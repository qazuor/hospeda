/**
 * extractIntent capability module (SPEC-173 T-015).
 *
 * Thin helper that shapes an `extractIntent` call for the AiService layer:
 * fills in the locale default when the caller omits it, then delegates to
 * the engine with the required `feature` routing parameter.
 *
 * AC-4: this module MUST NOT import `@repo/db`, `ai`, or `@ai-sdk/*`.
 *
 * @module ai-core/capabilities/extract-intent
 */

import type { AiFeature, AiIntent, ExtractIntentRequest, LanguageEnum } from '@repo/schemas';
import type { AiEngine } from '../engine/index.js';

// ---------------------------------------------------------------------------
// I/O shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for the `extractIntent` capability helper.
 *
 * Extends `ExtractIntentRequest` but makes `locale` optional (filled by the
 * service from `defaultLocale`) and adds the required `feature` routing key
 * (the engine's `extractIntent` signature requires a separate `feature` arg
 * because the request schema intentionally omits it).
 */
export type ExtractIntentCapabilityInput = ExtractIntentRequest & {
    /**
     * The AI feature context for engine routing (e.g. `'search'` or `'chat'`).
     * Required because `ExtractIntentRequest` has no `feature` field — the
     * engine resolves the provider chain from this key.
     */
    readonly feature: AiFeature;
    /**
     * User locale hint for slot extraction.
     * When absent the `AiService` fills in `defaultLocale` (default `'es'`).
     */
    readonly locale?: LanguageEnum;
};

/**
 * Output of the `extractIntent` capability helper.
 *
 * Identical to `AiIntent` — the helper adds no extra fields.
 */
export type ExtractIntentCapabilityOutput = AiIntent;

// ---------------------------------------------------------------------------
// Capability input for the internal implementation
// ---------------------------------------------------------------------------

/**
 * Internal input shape used by {@link executeExtractIntent}.
 */
export interface ExecuteExtractIntentInput {
    /** The raw capability request (locale may be omitted by the caller). */
    readonly request: ExtractIntentCapabilityInput;
    /** Resolved default locale from `AiService` config. */
    readonly defaultLocale: LanguageEnum;
    /** The engine instance to delegate to. */
    readonly engine: AiEngine;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Executes an `extractIntent` call via the engine, applying locale defaulting.
 *
 * 1. If `request.locale` is absent, fills in `defaultLocale` (FR-13).
 * 2. Strips the `feature` field from the engine request (which expects only
 *    `ExtractIntentRequest` + a separate `feature` arg).
 * 3. Delegates to `engine.extractIntent(req, feature)`.
 *
 * @param input - {@link ExecuteExtractIntentInput}
 * @returns The extracted intent envelope.
 *
 * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
 * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
 * @throws {AiEngineExhaustedError} If all providers fail.
 *
 * @example
 * ```ts
 * const intent = await executeExtractIntent({
 *   request: {
 *     feature: 'search',
 *     query: 'cabaña con pileta para 4 personas',
 *   },
 *   defaultLocale: 'es',
 *   engine,
 * });
 * console.log(intent.kind, intent.confidence);
 * ```
 */
export async function executeExtractIntent(
    input: ExecuteExtractIntentInput
): Promise<ExtractIntentCapabilityOutput> {
    const { request, defaultLocale, engine } = input;

    const { feature, ...rest } = request;

    const engineRequest: ExtractIntentRequest = {
        ...rest,
        locale: request.locale ?? defaultLocale
    };

    return engine.extractIntent(engineRequest, feature);
}
