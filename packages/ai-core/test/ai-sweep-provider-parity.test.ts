/**
 * HOS-2217: the migration sweep calls the AI SDK directly, so it must send what
 * production sends after the engine and the OpenAI adapter transform a route's
 * request. These tests run EVERY stored task case through the real
 * `createAiEngine` (capturing what reaches the provider) and through the real
 * `OpenAiAdapter` (capturing what reaches the SDK), and compare both with the
 * sweep's own `toProviderRequest` / `toSdkCallOptions`. No network: the config
 * resolver, the prompt storage and the `ai` SDK are mocked.
 */

import { resolve } from 'node:path';
import type { AiFeatureConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const sdk = vi.hoisted(() => ({
    generateText: vi.fn(),
    streamText: vi.fn(),
    generateObject: vi.fn(),
    createOpenAI: vi.fn()
}));

vi.mock('ai', () => ({
    generateText: sdk.generateText,
    streamText: sdk.streamText,
    generateObject: sdk.generateObject,
    zodSchema: (schema: unknown) => schema
}));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: sdk.createOpenAI }));
vi.mock('../src/storage/prompt.storage.js', () => ({
    getActivePrompt: vi.fn().mockResolvedValue({ content: null, row: null })
}));
vi.mock('../src/config/resolver.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('../src/config/resolver.js')>();
    return {
        ...original,
        resolveConfig: vi.fn(),
        resolveFeatureConfig: vi.fn(),
        getProviderOrder: vi.fn(),
        isFeatureKillSwitched: vi.fn()
    };
});

import { loadTaskCases } from '../scripts/ai-sweep/load-cases.js';
import {
    type ProviderRequest,
    toProviderRequest,
    toSdkCallOptions
} from '../scripts/ai-sweep/provider-call.js';
import { invalidatePromptCache } from '../src/config/prompt-resolver.js';
import * as configResolver from '../src/config/resolver.js';
import { createAiEngine } from '../src/engine/engine.js';
import type { AiProvider } from '../src/providers/ai-provider.interface.js';
import { OpenAiAdapter } from '../src/providers/vercel-openai.adapter.js';

const DIR = resolve(import.meta.dirname, '../scripts/ai-sweep');
const { cases } = loadTaskCases({ dir: DIR });
const usage = { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
const ANY_OBJECT = z.object({}).passthrough();

/** A provider that records what the engine hands it. */
function capturingProvider(captured: unknown[]): AiProvider {
    const meta = { usage, provider: 'stub', model: 'stub-model', finishReason: 'stop' };
    return {
        id: 'stub',
        generateText: vi.fn().mockImplementation((req) => {
            captured.push(req);
            return Promise.resolve({ text: 'ok', ...meta });
        }),
        streamText: vi.fn().mockImplementation((req) => {
            captured.push(req);
            return Promise.resolve({
                stream: (async function* () {
                    yield { delta: 'ok' };
                })(),
                meta: Promise.resolve(meta)
            });
        }),
        generateObject: vi.fn().mockImplementation((req) => {
            captured.push(req);
            return Promise.resolve({ object: {}, ...meta });
        }),
        extractIntent: vi.fn(),
        moderate: vi.fn().mockResolvedValue({ flagged: false, categories: {} }),
        embed: vi.fn()
    };
}

function featureConfig(effort: 'low' | null): AiFeatureConfig {
    return {
        enabled: true,
        primaryProvider: 'stub',
        fallbackChain: [],
        model: 'stub-model',
        params: effort ? { reasoningEffort: effort } : {}
    } as AiFeatureConfig;
}

/** The fields of a provider request the sweep reproduces (model/locale are routing). */
function comparable(req: Record<string, unknown>): Record<string, unknown> {
    const { model: _m, locale: _l, ...rest } = req;
    return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
}

function sweepComparable(p: ProviderRequest): Record<string, unknown> {
    const { kind: _k, ...rest } = p;
    return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
}

/** Key-order-insensitive JSON, `undefined` fields dropped. */
function canon(value: unknown): string {
    const sort = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(sort);
        if (typeof v === 'object' && v !== null) {
            return Object.fromEntries(
                Object.entries(v)
                    .filter(([, x]) => x !== undefined)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, x]) => [k, sort(x)])
            );
        }
        return v;
    };
    return JSON.stringify(sort(value));
}

beforeEach(() => {
    vi.clearAllMocks();
    invalidatePromptCache();
    vi.mocked(configResolver.resolveConfig).mockResolvedValue({
        providers: {},
        features: {}
    } as never);
    vi.mocked(configResolver.isFeatureKillSwitched).mockImplementation((cfg) => !cfg.enabled);
    vi.mocked(configResolver.getProviderOrder).mockImplementation(({ featureConfig: fc }) => ({
        providers: [fc.primaryProvider, ...fc.fallbackChain]
    }));
});

describe('HOS-2217 sweep provider requests equal the engine output', () => {
    for (const effort of [null, 'low'] as const) {
        it(`every task case, feature effort ${effort ?? 'unset'}`, async () => {
            // Arrange
            vi.mocked(configResolver.resolveFeatureConfig).mockResolvedValue(featureConfig(effort));
            const captured: unknown[] = [];
            const engine = createAiEngine({ getProvider: () => capturingProvider(captured) });
            const mismatches: string[] = [];

            // Act
            for (const c of cases) {
                captured.length = 0;
                const req = { ...c.request, messages: c.request.messages?.map((m) => ({ ...m })) };
                if (c.mode === 'object') {
                    await engine.generateObject(req as never, ANY_OBJECT);
                } else if (c.stream) {
                    const r = await engine.streamText(req as never);
                    for await (const _chunk of r.stream) {
                        /* drain */
                    }
                } else {
                    await engine.generateText(req as never);
                }
                const engineSide = comparable(captured[0] as Record<string, unknown>);
                const sweepSide = sweepComparable(
                    toProviderRequest({ request: c.request, mode: c.mode, effort }).providerRequest
                );
                if (canon(engineSide) !== canon(sweepSide)) {
                    mismatches.push(`${c.id} | ${canon(engineSide)} | ${canon(sweepSide)}`);
                }
            }

            // Assert
            expect(captured).toHaveLength(1);
            expect(mismatches).toEqual([]);
        });
    }
});

describe('HOS-2217 sweep SDK options equal the OpenAI adapter output', () => {
    it('every task case: system, prompt/messages, temperature, cap and provider options', async () => {
        // Arrange
        const model = vi.fn((id: string) => ({ id }));
        Object.assign(model, { chat: vi.fn((id: string) => ({ id })) });
        sdk.createOpenAI.mockReturnValue(model);
        const sdkUsage = { inputTokens: 1, outputTokens: 1 };
        sdk.generateText.mockResolvedValue({ text: 'ok', usage: sdkUsage, finishReason: 'stop' });
        sdk.generateObject.mockResolvedValue({ object: {}, usage: sdkUsage, finishReason: 'stop' });
        sdk.streamText.mockImplementation(() => ({
            textStream: (async function* () {
                yield 'ok';
            })(),
            usage: Promise.resolve(sdkUsage),
            finishReason: Promise.resolve('stop')
        }));
        const adapter = new OpenAiAdapter({ apiKey: 'test-key' });
        const mismatches: string[] = [];
        const CAP = 777;

        // Act
        for (const c of cases) {
            for (const effort of [null, 'low'] as const) {
                vi.clearAllMocks();
                const p = toProviderRequest({
                    request: c.request,
                    mode: c.mode,
                    effort
                }).providerRequest;
                // The adapter sends no cap when production sends none; the sweep
                // adds its own, so compare with the cap the request carries.
                const params = { ...p.params, maxTokens: p.params?.maxTokens ?? CAP };
                let sent: Record<string, unknown>;
                if (p.kind === 'object') {
                    await adapter.generateObject(
                        { feature: p.feature, prompt: p.prompt, params } as never,
                        ANY_OBJECT
                    );
                    sent = sdk.generateObject.mock.calls[0]?.[0] as Record<string, unknown>;
                } else if (c.stream) {
                    const r = await adapter.streamText({ ...p, params } as never);
                    for await (const _chunk of r.stream) {
                        /* drain */
                    }
                    sent = sdk.streamText.mock.calls[0]?.[0] as Record<string, unknown>;
                } else {
                    await adapter.generateText({ ...p, params } as never);
                    sent = sdk.generateText.mock.calls[0]?.[0] as Record<string, unknown>;
                }
                const { model: _m, schema: _s, maxRetries: _r, ...adapterSide } = sent;
                const { options } = toSdkCallOptions({
                    providerRequest: p,
                    fallbackMaxOutputTokens: CAP
                });
                if (canon(adapterSide) !== canon(options)) {
                    mismatches.push(
                        `${c.id} (${effort ?? 'none'}) | ${canon(adapterSide)} | ${canon(options)}`
                    );
                }
            }
        }

        // Assert
        expect(mismatches).toEqual([]);
    });
});
