/**
 * Turns a rendered engine request into the exact provider call production
 * makes (HOS-2217). Pure: no I/O.
 *
 * Two steps, each mirroring one production layer and each pinned by a test
 * that runs the real code next to it (`test/ai-sweep-provider-parity.test.ts`):
 *
 * 1. {@link toProviderRequest} = what `createAiEngine` hands the adapter: the
 *    resolved in-code system prompt injected with the real `injectSystemPrompt`
 *    (text) or prepended to the prompt (object), plus the feature's reasoning
 *    effort merged under the request params.
 * 2. {@link toSdkCallOptions} = what `OpenAiAdapter` hands the AI SDK: the
 *    native `system` channel, `maxOutputTokens`, `temperature`, the OpenAI
 *    provider options and, for objects, the feature's strict-JSON-schema flag.
 *
 * Production may override the in-code prompts through the DB
 * (`resolveSystemPrompt`); the sweep always uses the in-code defaults.
 *
 * @module ai-core/scripts/ai-sweep/provider-call
 */

import { composeSystemPrompt } from '../../src/config/prompt-resolver.js';
import { DEFAULT_PROMPTS, DEFAULT_RULES } from '../../src/engine/default-prompts.js';
import { injectSystemPrompt } from '../../src/engine/prompt-injection.js';
import { FEATURES_WITHOUT_STRICT_JSON_SCHEMA } from '../../src/providers/vercel-openai.adapter.js';
import type { SWEEP_FEATURES } from './cases.js';
import type { ReasoningEffort } from './lib.js';
import type { EngineRequest, TaskFeature } from './tasks.js';

/** Any feature a provider request can be billed under (chat features included). */
export type ProviderFeature = (typeof SWEEP_FEATURES)[number] | TaskFeature;

/** Params as the engine forwards them to the adapter. */
export interface ProviderParams {
    readonly maxTokens?: number;
    readonly temperature?: number;
    readonly reasoningEffort?: ReasoningEffort;
}

/** A text call as the adapter receives it. */
export interface ProviderTextRequest {
    readonly kind: 'text';
    readonly feature: ProviderFeature;
    readonly system: string | undefined;
    readonly prompt?: string;
    readonly messages?: ReadonlyArray<{
        readonly role: 'user' | 'assistant';
        readonly content: string;
    }>;
    readonly params: ProviderParams | undefined;
}

/** An object call as the adapter receives it (the system travels inside the prompt). */
export interface ProviderObjectRequest {
    readonly kind: 'object';
    readonly feature: ProviderFeature;
    readonly prompt: string;
    readonly params: ProviderParams | undefined;
}

/** One provider request. */
export type ProviderRequest = ProviderTextRequest | ProviderObjectRequest;

/** The in-code system prompt the engine resolves for a feature (no DB override). */
export function defaultSystemFor(feature: TaskFeature): string {
    return composeSystemPrompt({
        content: DEFAULT_PROMPTS[feature],
        rules: DEFAULT_RULES[feature]
    });
}

/**
 * The engine's params merge: the feature-config effort first, then the request
 * params (which win). `undefined` when neither exists, as in the engine.
 */
function mergeParams(input: {
    readonly request: EngineRequest;
    readonly effort: ReasoningEffort | null;
}): ProviderParams | undefined {
    if (!input.request.params && !input.effort) return undefined;
    return {
        ...(input.effort ? { reasoningEffort: input.effort } : {}),
        ...input.request.params
    };
}

/**
 * Mirrors `createAiEngine` (`generateText` / `streamText` / `generateObject`).
 *
 * @param input.request - The engine request the route builds.
 * @param input.mode - `text` or `object`.
 * @param input.effort - The reasoning effort the feature config would carry.
 * @returns `{ providerRequest }`.
 */
export function toProviderRequest(input: {
    readonly request: EngineRequest;
    readonly mode: 'text' | 'object';
    readonly effort: ReasoningEffort | null;
}): { readonly providerRequest: ProviderRequest } {
    const { request } = input;
    const params = mergeParams(input);
    if (input.mode === 'object') {
        if (request.prompt === undefined) throw new Error('An object request needs a prompt.');
        const system = request.systemPrompt ?? defaultSystemFor(request.feature);
        return {
            providerRequest: {
                kind: 'object',
                feature: request.feature,
                prompt: `${system}\n\nUser request: ${request.prompt}`,
                params
            }
        };
    }
    const injected = injectSystemPrompt({
        req: {
            ...(request.system === undefined ? {} : { system: request.system }),
            ...(request.prompt === undefined ? {} : { prompt: request.prompt }),
            ...(request.messages === undefined ? {} : { messages: [...request.messages] })
        },
        systemContent: defaultSystemFor(request.feature)
    });
    return {
        providerRequest: {
            kind: 'text',
            feature: request.feature,
            system: injected.system,
            ...(request.prompt === undefined ? {} : { prompt: request.prompt }),
            ...(request.messages === undefined ? {} : { messages: request.messages }),
            params
        }
    };
}

/** The AI SDK options the adapter passes (model and schema are added by the caller). */
export interface SdkCallOptions {
    readonly system: string | undefined;
    readonly prompt?: string;
    readonly messages?: ReadonlyArray<{
        readonly role: 'user' | 'assistant';
        readonly content: string;
    }>;
    readonly temperature: number | undefined;
    readonly maxOutputTokens: number | undefined;
    readonly topP: undefined;
    readonly providerOptions?: { readonly openai: Readonly<Record<string, string | boolean>> };
}

/**
 * Mirrors `OpenAiAdapter.generateText/streamText/generateObject`, with one
 * deliberate difference: when production sends no `maxTokens`, the sweep caps
 * the call at `fallbackMaxOutputTokens` so its worst case is bounded. A capped
 * answer shows up as finishReason `length`.
 *
 * @param input.providerRequest - From {@link toProviderRequest}.
 * @param input.fallbackMaxOutputTokens - Cap used only when production sends none.
 * @returns `{ options }`.
 */
export function toSdkCallOptions(input: {
    readonly providerRequest: ProviderRequest;
    readonly fallbackMaxOutputTokens: number;
}): { readonly options: SdkCallOptions } {
    const req = input.providerRequest;
    const params = req.params;
    const effort = params?.reasoningEffort;
    const base = {
        temperature: params?.temperature,
        maxOutputTokens: params?.maxTokens ?? input.fallbackMaxOutputTokens,
        topP: undefined
    };
    if (req.kind === 'object') {
        const relax = FEATURES_WITHOUT_STRICT_JSON_SCHEMA.has(req.feature);
        const openai: Record<string, string | boolean> = {
            ...(relax ? { strictJsonSchema: false } : {}),
            ...(effort ? { reasoningEffort: effort } : {})
        };
        return {
            options: {
                system: undefined,
                prompt: req.prompt,
                ...base,
                ...(Object.keys(openai).length > 0 ? { providerOptions: { openai } } : {})
            }
        };
    }
    return {
        options: {
            system: req.system,
            ...(req.prompt === undefined
                ? { messages: req.messages ?? [] }
                : { prompt: req.prompt }),
            ...base,
            ...(effort ? { providerOptions: { openai: { reasoningEffort: effort } } } : {})
        }
    };
}
