/**
 * generateObject capability module (SPEC-173 T-015).
 *
 * Thin helper that shapes a `generateObject` call for the AiService layer:
 * fills in the locale default when the caller omits it, then delegates to
 * the engine.
 *
 * AC-4: this module MUST NOT import `@repo/db`, `ai`, or `@ai-sdk/*`.
 *
 * @module ai-core/capabilities/generate-object
 */

import type {
    AiFeature,
    GenerateObjectRequest,
    GenerateObjectResponseMeta,
    LanguageEnum
} from '@repo/schemas';
import type { ZodType } from 'zod';
import type { AiEngine } from '../engine/index.js';

// ---------------------------------------------------------------------------
// I/O shapes (RO-RO)
// ---------------------------------------------------------------------------

/**
 * Input for the `generateObject` capability helper.
 *
 * Extends `GenerateObjectRequest` but makes `locale` optional — when omitted
 * the service fills in `defaultLocale` before forwarding to the engine.
 */
export type GenerateObjectCapabilityInput = Omit<GenerateObjectRequest, 'locale'> & {
    /**
     * User locale for prompt localisation.
     * When absent the `AiService` fills in `defaultLocale` (default `'es'`).
     */
    readonly locale?: LanguageEnum;
};

/**
 * Output of the `generateObject` capability helper.
 *
 * `object` is the typed structured result; the remainder is usage metadata.
 */
export type GenerateObjectCapabilityOutput<T> = { object: T } & GenerateObjectResponseMeta;

// ---------------------------------------------------------------------------
// Capability input for the internal implementation
// ---------------------------------------------------------------------------

/**
 * Internal input shape used by {@link executeGenerateObject}.
 */
export interface ExecuteGenerateObjectInput<T> {
    /** The raw capability request (locale may be omitted by the caller). */
    readonly request: GenerateObjectCapabilityInput;
    /** Zod schema describing the structured output type `T`. */
    readonly outputSchema: ZodType<T>;
    /** Resolved default locale from `AiService` config. */
    readonly defaultLocale: LanguageEnum;
    /** The engine instance to delegate to. */
    readonly engine: AiEngine;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Executes a `generateObject` call via the engine, applying locale defaulting.
 *
 * 1. If `request.locale` is absent, fills in `defaultLocale` (FR-13).
 * 2. Delegates the fully-shaped request + Zod schema to `engine.generateObject`.
 *
 * @param input - {@link ExecuteGenerateObjectInput}
 * @returns The structured object merged with usage metadata.
 *
 * @throws {AiFeatureDisabledError} If the feature kill-switch is active.
 * @throws {AiFeatureNotConfiguredError} If the feature has no config entry.
 * @throws {AiEngineExhaustedError} If all providers fail.
 *
 * @example
 * ```ts
 * const DestSchema = z.object({ name: z.string().optional(), type: z.string().optional() });
 * const result = await executeGenerateObject({
 *   request: { feature: 'search', prompt: 'Hoteles en Colón' },
 *   outputSchema: DestSchema,
 *   defaultLocale: 'es',
 *   engine,
 * });
 * console.log(result.object.name);
 * ```
 */
export async function executeGenerateObject<T>(
    input: ExecuteGenerateObjectInput<T>
): Promise<GenerateObjectCapabilityOutput<T>> {
    const { request, outputSchema, defaultLocale, engine } = input;

    const engineRequest: GenerateObjectRequest = {
        ...request,
        locale: request.locale ?? defaultLocale,
        feature: request.feature as AiFeature
    };

    return engine.generateObject(engineRequest, outputSchema);
}
