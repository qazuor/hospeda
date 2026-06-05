/**
 * moderate capability module (SPEC-173 T-015).
 *
 * Thin helper that shapes a `moderate` call for the AiService layer.
 * Unlike the text/object capabilities, `moderate` does NOT have a `feature`
 * routing key — the engine routes it directly to the configured moderation
 * provider. Locale is still optional and defaults to `defaultLocale`.
 *
 * AC-4: this module MUST NOT import `@repo/db`, `ai`, or `@ai-sdk/*`.
 *
 * @module ai-core/capabilities/moderate
 */

import type { LanguageEnum, ModerateRequest, ModerateResponse } from '@repo/schemas';
import type { AiEngine } from '../engine/index.js';

// ---------------------------------------------------------------------------
// I/O shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for the `moderate` capability helper.
 *
 * Extends `ModerateRequest` with an optional `locale` (already optional in
 * the schema). Included here for symmetry with the other capability helpers.
 */
export type ModerateCapabilityInput = ModerateRequest & {
    /**
     * Optional locale hint for locale-aware moderation policies.
     * When absent the `AiService` fills in `defaultLocale` (default `'es'`).
     */
    readonly locale?: LanguageEnum;
};

/**
 * Output of the `moderate` capability helper.
 *
 * Identical to `ModerateResponse` — the helper adds no extra fields.
 */
export type ModerateCapabilityOutput = ModerateResponse;

// ---------------------------------------------------------------------------
// Capability input for the internal implementation
// ---------------------------------------------------------------------------

/**
 * Internal input shape used by {@link executeModerate}.
 */
export interface ExecuteModerateInput {
    /** The raw capability request (locale may be omitted by the caller). */
    readonly request: ModerateCapabilityInput;
    /** Resolved default locale from `AiService` config. */
    readonly defaultLocale: LanguageEnum;
    /** The engine instance to delegate to. */
    readonly engine: AiEngine;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Executes a `moderate` call via the engine, applying locale defaulting.
 *
 * 1. If `request.locale` is absent, fills in `defaultLocale` (FR-13).
 * 2. Delegates the fully-shaped request to `engine.moderate`.
 *
 * Note: `moderate` bypasses feature-config routing in the engine (it has no
 * `feature` field) and goes directly to the configured moderation provider.
 * Fallback is NOT supported for moderation in V1.
 *
 * @param input - {@link ExecuteModerateInput}
 * @returns The moderation response from the engine.
 *
 * @throws If the moderation provider call fails.
 *
 * @example
 * ```ts
 * const result = await executeModerate({
 *   request: { input: userContent },
 *   defaultLocale: 'es',
 *   engine,
 * });
 * if (result.flagged) {
 *   throw new Error('Content policy violation');
 * }
 * ```
 */
export async function executeModerate(
    input: ExecuteModerateInput
): Promise<ModerateCapabilityOutput> {
    const { request, defaultLocale, engine } = input;

    const engineRequest: ModerateRequest = {
        ...request,
        locale: request.locale ?? defaultLocale
    };

    return engine.moderate(engineRequest);
}
